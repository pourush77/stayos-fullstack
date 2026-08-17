import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { ChildPricingService } from '../../rates/child-pricing.service';
import { GstService } from '../../rates/gst.service';
import { PlaceOfSupply } from '../../rates/domain/gst.types';
import { PolicyResolverService } from '../../policies/policy-resolver.service';
import { PropertyPolicyType } from '../../policies/domain/property-policy-type.enum';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import { normalizeDepositPolicy } from '../../policies/domain/normalize-deposit-policy';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { toCents, fromCents } from '../../billing/domain/money';
import { QuoteReservationDto } from '../dto/quote-reservation.dto';
import { ReservationPricingService } from './reservation-pricing.service';

export interface ReservationQuoteResult {
  pricingStatus: 'PRICED' | 'UNPRICED';
  currency: 'INR';
  ratePlan: { id: string; code: string } | null;
  roomType: {
    id: string;
    code: string;
    name: string;
    baseOccupancy: number;
    maxOccupancy: number;
    maxAdults: number;
    maxChildren: number;
  };
  occupancy: Record<string, unknown>;
  nights: number;
  roomCharges: string;
  extraAdultCharges: string;
  childCharges: string;
  taxableSubtotal: string;
  tax: {
    applied: boolean;
    hsnSac: string | null;
    placeOfSupply: PlaceOfSupply;
    totalRate: string;
    totalTax: string;
    components: Array<{ name: string; rate: string; amount: string }>;
    taxRuleId: string | null;
  };
  grandTotal: string;
  deposit: {
    policyType: string;
    policyValue: number;
    required: boolean;
    suggestedAmount: string;
    basis: 'GRAND_TOTAL';
  };
  childPricing: { lines: unknown[]; limitations: string[] };
  policies: Record<string, unknown>;
  blocker: string | null;
}

/**
 * READ-ONLY individual-reservation pricing quote. Runs the SAME resolution path
 * a CONFIRMED create would persist (ReservationPricingService -> RateResolver),
 * then applies GST exactly as BillingService posts the ROOM charge and resolves
 * the INDIVIDUAL_DEPOSIT policy. Performs NO database writes. Never fabricates a
 * price: when no applicable rate plan exists it returns an explicit UNPRICED
 * blocker (no default/demo value).
 */
@Injectable()
export class ReservationQuoteService {
  constructor(
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypesRepository: Repository<RoomTypeEntity>,
    private readonly reservationPricingService: ReservationPricingService,
    private readonly childPricingService: ChildPricingService,
    private readonly gstService: GstService,
    private readonly policyResolver: PolicyResolverService,
  ) {}

  async quote(propertyId: string, dto: QuoteReservationDto): Promise<ReservationQuoteResult> {
    if (dto.departureDate <= dto.arrivalDate) {
      throw new BadRequestException('Departure date must be after arrival date');
    }

    const roomType = await this.roomTypesRepository.findOne({
      where: { id: dto.roomTypeId, propertyId },
    });
    if (!roomType) {
      throw new NotFoundException(`Room type ${dto.roomTypeId} was not found for this property`);
    }

    const children = dto.children ?? 0;

    // Occupancy / capacity enforcement (independent of physical room assignment,
    // exactly the room-type limits used at create-time room assignment).
    this.assertCapacity(roomType, dto.adults, children);

    // Child-age policy validation (throws a clear message when ages are missing
    // or fall outside a configured band).
    await this.childPricingService.validateReservationChildAges(propertyId, children, dto.childAges);

    // SAME commercial path as create: resolves the effective/default rate plan
    // (e.g. BAR) and prices via the shared RateResolver. Never mutates anything.
    const snapshot = await this.reservationPricingService.buildCommercialSnapshot({
      propertyId,
      ratePlanId: dto.ratePlanId ?? null,
      roomTypeId: dto.roomTypeId,
      arrivalDate: dto.arrivalDate,
      departureDate: dto.departureDate,
      adults: dto.adults,
      childAges: children > 0 ? dto.childAges : undefined,
    });

    const roomTypeView = {
      id: roomType.id,
      code: roomType.code,
      name: roomType.name,
      baseOccupancy: roomType.baseOccupancy,
      maxOccupancy: roomType.maxOccupancy,
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
    };

    const snap = snapshot.rateSnapshot as Record<string, unknown>;
    if (snap.pricingStatus !== 'PRICED') {
      return {
        pricingStatus: 'UNPRICED',
        currency: 'INR',
        ratePlan: null,
        roomType: roomTypeView,
        occupancy: (snap.occupancy as Record<string, unknown>) ?? {},
        nights: 0,
        roomCharges: '0.00',
        extraAdultCharges: '0.00',
        childCharges: '0.00',
        taxableSubtotal: '0.00',
        tax: {
          applied: false,
          hsnSac: null,
          placeOfSupply: PlaceOfSupply.INTRA_STATE,
          totalRate: '0.00',
          totalTax: '0.00',
          components: [],
          taxRuleId: null,
        },
        grandTotal: '0.00',
        deposit: {
          policyType: GroupBookingDepositPolicyType.NONE,
          policyValue: 0,
          required: false,
          suggestedAmount: '0.00',
          basis: 'GRAND_TOTAL',
        },
        childPricing: { lines: [], limitations: [] },
        policies: {},
        blocker:
          'No active rate plan is configured for this room type. Set up a rate in Settings → Rates before booking.',
      };
    }

    const ratePlan = snap.ratePlan as { id: string; code: string };
    const totals = snap.totals as {
      room: string;
      extraAdult: string;
      child: string;
      grandTotal: string;
    };
    const nightsArr = snap.nights as unknown[];
    const nights = Array.isArray(nightsArr) ? nightsArr.length : 0;

    // GST: computed EXACTLY like BillingService.postRoomChargesFromSnapshot —
    // taxable = snapshot grand total (room+extraAdult+child), slab basis = the
    // per-night grand total, ROOM is always intra-state, time of supply = the
    // arrival date. Guarantees the quote tax equals the tax the created folio
    // will post for identical input.
    const grandTotalCents = toCents(totals.grandTotal);
    const unitCents = nights > 0 ? Math.round(grandTotalCents / nights) : grandTotalCents;
    const gst = await this.gstService.computeTax({
      propertyId,
      chargeType: FolioChargeType.ROOM,
      taxableAmountCents: grandTotalCents,
      slabBasisAmount: unitCents / 100,
      placeOfSupply: PlaceOfSupply.INTRA_STATE,
      chargeDate: new Date(dto.arrivalDate),
    });

    const payableCents = grandTotalCents + gst.totalTaxCents;

    // INDIVIDUAL_DEPOSIT via the policy resolver (rate-plan override -> property
    // default). Suggested amount computed on the payable grand total.
    const deposit = await this.resolveIndividualDeposit(propertyId, ratePlan.id, payableCents);

    return {
      pricingStatus: 'PRICED',
      currency: 'INR',
      ratePlan: { id: ratePlan.id, code: ratePlan.code },
      roomType: roomTypeView,
      occupancy: (snap.occupancy as Record<string, unknown>) ?? {},
      nights,
      roomCharges: totals.room,
      extraAdultCharges: totals.extraAdult,
      childCharges: totals.child,
      taxableSubtotal: totals.grandTotal,
      tax: {
        applied: gst.applied,
        hsnSac: gst.hsnSac,
        placeOfSupply: gst.placeOfSupply,
        totalRate: gst.totalRate,
        totalTax: gst.totalTax,
        components: gst.components,
        taxRuleId: gst.taxRuleId,
      },
      grandTotal: fromCents(payableCents),
      deposit,
      childPricing: (snap.childPricing as { lines: unknown[]; limitations: string[] }) ?? {
        lines: [],
        limitations: [],
      },
      policies: (snap.policies as Record<string, unknown>) ?? {},
      blocker: null,
    };
  }

  private assertCapacity(roomType: RoomTypeEntity, adults: number, children: number): void {
    const totalGuests = adults + children;
    if (adults > roomType.maxAdults) {
      throw new BadRequestException(
        `${roomType.name} allows at most ${roomType.maxAdults} adult${roomType.maxAdults === 1 ? '' : 's'}.`,
      );
    }
    if (children > roomType.maxChildren) {
      throw new BadRequestException(
        `${roomType.name} allows at most ${roomType.maxChildren} child${roomType.maxChildren === 1 ? '' : 'ren'}.`,
      );
    }
    if (totalGuests > roomType.maxOccupancy) {
      throw new BadRequestException(
        `${roomType.name} holds at most ${roomType.maxOccupancy} guest${roomType.maxOccupancy === 1 ? '' : 's'}.`,
      );
    }
  }

  private async resolveIndividualDeposit(
    propertyId: string,
    ratePlanId: string | null,
    payableCents: number,
  ): Promise<ReservationQuoteResult['deposit']> {
    const input = await this.policyResolver.resolveDepositInput(
      propertyId,
      PropertyPolicyType.INDIVIDUAL_DEPOSIT,
      ratePlanId,
    );
    const normalized = normalizeDepositPolicy(input, { label: 'Deposit' });

    let suggestedCents = 0;
    if (normalized.type === GroupBookingDepositPolicyType.PERCENTAGE) {
      suggestedCents = Math.round((payableCents * normalized.value) / 100);
    } else if (normalized.type === GroupBookingDepositPolicyType.FIXED_AMOUNT) {
      suggestedCents = Math.min(Math.round(normalized.value * 100), Math.max(0, payableCents));
    }

    return {
      policyType: normalized.type,
      policyValue: normalized.type === GroupBookingDepositPolicyType.NONE ? 0 : normalized.value,
      required: suggestedCents > 0,
      suggestedAmount: fromCents(suggestedCents),
      basis: 'GRAND_TOTAL',
    };
  }
}
