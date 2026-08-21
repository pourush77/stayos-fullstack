import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlaceOfSupply } from '../../rates/domain/gst.types';
import { MealPlan } from '../../rates/domain/meal-plan.enum';
import { RatePlanStatus } from '../../rates/domain/rate-plan-status.enum';
import { PropertyPolicyType } from '../../policies/domain/property-policy-type.enum';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { ReservationQuoteService } from './reservation-quote.service';

const DLX = {
  id: 'dlx-1',
  code: 'DLX',
  name: 'Deluxe',
  baseOccupancy: 2,
  maxOccupancy: 3,
  maxAdults: 2,
  maxChildren: 1,
};

const barPlan = {
  id: 'bar-1',
  code: 'BAR',
  name: 'Best Available Rate',
  description: 'Standard flexible rate',
  mealPlan: MealPlan.ROOM_ONLY,
  refundable: true,
  isDefault: true,
  status: RatePlanStatus.ACTIVE,
};

const bfastPlan = {
  id: 'bfast-1',
  code: 'BFAST',
  name: 'Breakfast Included',
  description: 'Includes buffet breakfast',
  mealPlan: MealPlan.BREAKFAST,
  refundable: true,
  isDefault: false,
  status: RatePlanStatus.ACTIVE,
};

const nonrefPlan = {
  id: 'nonref-1',
  code: 'NONREF',
  name: 'Non-Refundable Saver',
  description: 'Saver rate',
  mealPlan: MealPlan.ROOM_ONLY,
  refundable: false,
  isDefault: false,
  status: RatePlanStatus.ACTIVE,
};

function build(
  overrides: {
    roomType?: unknown;
    snapshot?: unknown;
    gst?: unknown;
    deposit?: unknown;
    activePlans?: unknown[];
    resolvedRates?: Record<string, unknown>;
  } = {},
) {
  const roomTypesRepository = {
    findOne: jest
      .fn()
      .mockResolvedValue(overrides.roomType !== undefined ? overrides.roomType : DLX),
  };

  const defaultSnapshot = {
    ratePlanId: 'bar-1',
    rateSnapshot: {
      pricingStatus: 'PRICED',
      ratePlan: { id: 'bar-1', code: 'BAR' },
      roomTypeId: 'dlx-1',
      occupancy: { adults: 2, children: 0 },
      nights: [{ date: '2026-08-18' }],
      totals: { room: '5900.00', extraAdult: '0.00', child: '0.00', grandTotal: '5900.00' },
      policies: {},
      childPricing: { lines: [], limitations: [] },
    },
  };

  const reservationPricingService = {
    buildCommercialSnapshot: jest.fn().mockImplementation(async (input) => {
      if (overrides.snapshot !== undefined) {
        return overrides.snapshot;
      }
      const targetId = input.ratePlanId || 'bar-1';
      if (targetId === 'bfast-1') {
        return {
          ratePlanId: 'bfast-1',
          rateSnapshot: {
            pricingStatus: 'PRICED',
            ratePlan: { id: 'bfast-1', code: 'BFAST' },
            roomTypeId: 'dlx-1',
            mealPlan: MealPlan.BREAKFAST,
            refundable: true,
            occupancy: { adults: 2, children: 0 },
            nights: [{ date: '2026-08-18' }],
            totals: { room: '6900.00', extraAdult: '0.00', child: '0.00', grandTotal: '6900.00' },
            policies: {},
            childPricing: { lines: [], limitations: [] },
          },
        };
      }
      return defaultSnapshot;
    }),
  };

  const childPricingService = {
    validateReservationChildAges: jest.fn().mockResolvedValue(undefined),
  };

  const gstService = {
    computeTax: jest.fn().mockImplementation(async ({ taxableAmountCents }) => {
      if (overrides.gst !== undefined) return overrides.gst;
      // 12% GST
      const totalTaxCents = Math.round(taxableAmountCents * 0.12);
      const totalTax = (totalTaxCents / 100).toFixed(2);
      return {
        applied: true,
        hsnSac: '996311',
        placeOfSupply: PlaceOfSupply.INTRA_STATE,
        totalRate: '12.00',
        totalTax,
        totalTaxCents,
        components: [
          { name: 'CGST', rate: '6.00', amount: (totalTaxCents / 200).toFixed(2) },
          { name: 'SGST', rate: '6.00', amount: (totalTaxCents / 200).toFixed(2) },
        ],
        taxRuleId: 'tax-1',
      };
    }),
  };

  const policyResolver = {
    resolveDepositInput: jest.fn().mockResolvedValue(
      overrides.deposit ?? { type: GroupBookingDepositPolicyType.PERCENTAGE, value: 30 },
    ),
  };

  const activePlans =
    overrides.activePlans !== undefined ? overrides.activePlans : [barPlan, bfastPlan, nonrefPlan];

  const ratesService = {
    findActiveApplicableRatePlans: jest.fn().mockResolvedValue(activePlans),
  };

  const rateResolver = {
    resolve: jest.fn().mockImplementation(async ({ ratePlanId }) => {
      if (overrides.resolvedRates && overrides.resolvedRates[ratePlanId]) {
        return overrides.resolvedRates[ratePlanId];
      }
      if (ratePlanId === 'bfast-1') {
        return {
          ratePlanId: 'bfast-1',
          ratePlanCode: 'BFAST',
          roomTypeId: 'dlx-1',
          mealPlan: MealPlan.BREAKFAST,
          refundable: true,
          nights: [{ date: '2026-08-18' }],
          totals: { room: '6900.00', extraAdult: '0.00', child: '0.00', grandTotal: '6900.00' },
        };
      }
      if (ratePlanId === 'nonref-1') {
        return {
          ratePlanId: 'nonref-1',
          ratePlanCode: 'NONREF',
          roomTypeId: 'dlx-1',
          mealPlan: MealPlan.ROOM_ONLY,
          refundable: false,
          nights: [{ date: '2026-08-18' }],
          totals: { room: '5310.00', extraAdult: '0.00', child: '0.00', grandTotal: '5310.00' },
        };
      }
      return {
        ratePlanId: 'bar-1',
        ratePlanCode: 'BAR',
        roomTypeId: 'dlx-1',
        mealPlan: MealPlan.ROOM_ONLY,
        refundable: true,
        nights: [{ date: '2026-08-18' }],
        totals: { room: '5900.00', extraAdult: '0.00', child: '0.00', grandTotal: '5900.00' },
      };
    }),
  };

  const service = new ReservationQuoteService(
    roomTypesRepository as never,
    reservationPricingService as never,
    childPricingService as never,
    gstService as never,
    policyResolver as never,
    ratesService as never,
    rateResolver as never,
  );

  return {
    service,
    roomTypesRepository,
    reservationPricingService,
    childPricingService,
    gstService,
    policyResolver,
    ratesService,
    rateResolver,
  };
}

const baseInput = {
  arrivalDate: '2026-08-18',
  departureDate: '2026-08-19',
  adults: 2,
  children: 0,
  roomTypeId: 'dlx-1',
};

describe('ReservationQuoteService', () => {
  it('prices a Deluxe BAR stay and returns all eligible active rate plans with pricing', async () => {
    const { service, gstService } = build();
    const quote = await service.quote('prop-1', baseInput);

    expect(quote.pricingStatus).toBe('PRICED');
    expect(quote.ratePlan).toEqual({
      id: 'bar-1',
      code: 'BAR',
      name: 'Best Available Rate',
      mealPlan: MealPlan.ROOM_ONLY,
      refundable: true,
      isDefault: true,
    });
    expect(quote.roomCharges).toBe('5900.00');
    expect(quote.taxableSubtotal).toBe('5900.00');
    expect(quote.tax.totalTax).toBe('708.00');
    expect(quote.grandTotal).toBe('6608.00'); // 5900 + 708
    expect(quote.deposit).toMatchObject({
      policyType: 'PERCENTAGE',
      policyValue: 30,
      required: true,
      suggestedAmount: '1982.40',
    });

    // GST computed EXACTLY like BillingService posts the ROOM charge.
    expect(gstService.computeTax).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeType: FolioChargeType.ROOM,
        taxableAmountCents: 590000,
        slabBasisAmount: 5900,
        placeOfSupply: PlaceOfSupply.INTRA_STATE,
        chargeDate: new Date('2026-08-18'),
      }),
    );

    // Rate plans array contains all 3 active eligible plans with individual pricing
    expect(quote.ratePlans).toHaveLength(3);
    expect(quote.ratePlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'bar-1',
          code: 'BAR',
          name: 'Best Available Rate',
          isDefault: true,
          mealPlan: MealPlan.ROOM_ONLY,
          refundable: true,
          roomCharges: '5900.00',
          grandTotal: '6608.00',
        }),
        expect.objectContaining({
          id: 'bfast-1',
          code: 'BFAST',
          name: 'Breakfast Included',
          isDefault: false,
          mealPlan: MealPlan.BREAKFAST,
          refundable: true,
          roomCharges: '6900.00',
          grandTotal: '7728.00',
        }),
        expect.objectContaining({
          id: 'nonref-1',
          code: 'NONREF',
          name: 'Non-Refundable Saver',
          isDefault: false,
          mealPlan: MealPlan.ROOM_ONLY,
          refundable: false,
          roomCharges: '5310.00',
          grandTotal: '5947.20',
        }),
      ]),
    );
  });

  it('prices the selected rate plan when ratePlanId is provided in quote input', async () => {
    const { service, reservationPricingService } = build();
    const quote = await service.quote('prop-1', {
      ...baseInput,
      ratePlanId: 'bfast-1',
    });

    expect(quote.pricingStatus).toBe('PRICED');
    expect(quote.ratePlan).toEqual({
      id: 'bfast-1',
      code: 'BFAST',
      name: 'Breakfast Included',
      mealPlan: MealPlan.BREAKFAST,
      refundable: true,
      isDefault: false,
    });
    expect(quote.roomCharges).toBe('6900.00');
    expect(quote.taxableSubtotal).toBe('6900.00');
    expect(quote.grandTotal).toBe('7728.00'); // 6900 + 828 GST
    expect(reservationPricingService.buildCommercialSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'prop-1',
        ratePlanId: 'bfast-1',
        roomTypeId: 'dlx-1',
      }),
    );
  });

  it('skips unpriced or failing rate plans from eligibleRatePlans list', async () => {
    const { service, rateResolver } = build();
    rateResolver.resolve.mockImplementation(async ({ ratePlanId }) => {
      if (ratePlanId === 'nonref-1') {
        throw new Error('Not applicable to room type');
      }
      return {
        ratePlanId,
        ratePlanCode: ratePlanId === 'bfast-1' ? 'BFAST' : 'BAR',
        roomTypeId: 'dlx-1',
        mealPlan: MealPlan.ROOM_ONLY,
        refundable: true,
        nights: [{ date: '2026-08-18' }],
        totals: { room: '5900.00', extraAdult: '0.00', child: '0.00', grandTotal: '5900.00' },
      };
    });

    const quote = await service.quote('prop-1', baseInput);
    expect(quote.ratePlans).toHaveLength(2);
    expect(quote.ratePlans.some((p) => p.id === 'nonref-1')).toBe(false);
  });

  it('rejects an explicitly selected rate plan when it is no longer sellable', async () => {
    const { service, reservationPricingService, rateResolver } = build();
    rateResolver.resolve.mockImplementation(async ({ ratePlanId }) => {
      if (ratePlanId === 'nonref-1') {
        throw new Error('Rate plan is no longer active');
      }
      return {
        ratePlanId,
        ratePlanCode: ratePlanId === 'bfast-1' ? 'BFAST' : 'BAR',
        roomTypeId: 'dlx-1',
        mealPlan: MealPlan.ROOM_ONLY,
        refundable: true,
        nights: [{ date: '2026-08-18' }],
        totals: { room: '5900.00', extraAdult: '0.00', child: '0.00', grandTotal: '5900.00' },
      };
    });

    await expect(
      service.quote('prop-1', { ...baseInput, ratePlanId: 'nonref-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(reservationPricingService.buildCommercialSnapshot).not.toHaveBeenCalled();
  });

  it('never sends ratePlanId when omitted (backend resolves the default plan)', async () => {
    const { service, reservationPricingService } = build();
    await service.quote('prop-1', baseInput);
    expect(reservationPricingService.buildCommercialSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'prop-1', ratePlanId: 'bar-1', roomTypeId: 'dlx-1' }),
    );
  });

  it('rejects when children exceed the room type limit (Deluxe 2 adults + 2 children)', async () => {
    const { service, reservationPricingService } = build();
    await expect(
      service.quote('prop-1', { ...baseInput, children: 2, childAges: [4, 7] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Never priced once capacity fails.
    expect(reservationPricingService.buildCommercialSnapshot).not.toHaveBeenCalled();
  });

  it('allows a Suite 2 adults + 2 children within limits', async () => {
    const STE = {
      ...DLX,
      id: 'ste-1',
      code: 'STE',
      name: 'Suite',
      maxOccupancy: 4,
      maxAdults: 2,
      maxChildren: 2,
    };
    const { service } = build({
      roomType: STE,
      snapshot: {
        ratePlanId: 'bar-1',
        rateSnapshot: {
          pricingStatus: 'PRICED',
          ratePlan: { id: 'bar-1', code: 'BAR' },
          roomTypeId: 'ste-1',
          occupancy: { adults: 2, children: 2 },
          nights: [{ date: '2026-08-18' }],
          totals: { room: '7900.00', extraAdult: '0.00', child: '0.00', grandTotal: '7900.00' },
          policies: {},
          childPricing: { lines: [], limitations: [] },
        },
      },
    });
    const quote = await service.quote('prop-1', {
      ...baseInput,
      roomTypeId: 'ste-1',
      children: 2,
      childAges: [4, 7],
    });
    expect(quote.pricingStatus).toBe('PRICED');
    expect(quote.roomCharges).toBe('7900.00');
  });

  it('returns an explicit UNPRICED blocker (no fabricated price) when no rate plan applies', async () => {
    const { service, gstService } = build({
      activePlans: [],
      snapshot: {
        ratePlanId: null,
        rateSnapshot: {
          pricingStatus: 'UNPRICED',
          reason: 'NO_APPLICABLE_RATE_PLAN',
          occupancy: { adults: 2, children: 0 },
        },
      },
    });
    const quote = await service.quote('prop-1', baseInput);
    expect(quote.pricingStatus).toBe('UNPRICED');
    expect(quote.grandTotal).toBe('0.00');
    expect(quote.ratePlans).toEqual([]);
    expect(quote.blocker).toBeTruthy();
    expect(gstService.computeTax).not.toHaveBeenCalled();
  });

  it('throws NotFound when the room type is not in the property', async () => {
    const { service } = build({ roomType: null });
    await expect(service.quote('prop-1', baseInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid date range', async () => {
    const { service } = build();
    await expect(
      service.quote('prop-1', { ...baseInput, departureDate: '2026-08-18' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
