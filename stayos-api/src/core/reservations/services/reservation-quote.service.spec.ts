import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlaceOfSupply } from '../../rates/domain/gst.types';
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

function build(overrides: {
  roomType?: unknown;
  snapshot?: unknown;
  gst?: unknown;
  deposit?: unknown;
} = {}) {
  const roomTypesRepository = {
    findOne: jest.fn().mockResolvedValue(overrides.roomType !== undefined ? overrides.roomType : DLX),
  };
  const reservationPricingService = {
    buildCommercialSnapshot: jest.fn().mockResolvedValue(
      overrides.snapshot ?? {
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
      },
    ),
  };
  const childPricingService = {
    validateReservationChildAges: jest.fn().mockResolvedValue(undefined),
  };
  const gstService = {
    computeTax: jest.fn().mockResolvedValue(
      overrides.gst ?? {
        applied: true,
        hsnSac: '996311',
        placeOfSupply: PlaceOfSupply.INTRA_STATE,
        totalRate: '12.00',
        totalTax: '708.00',
        totalTaxCents: 70800,
        components: [
          { name: 'CGST', rate: '6.00', amount: '354.00' },
          { name: 'SGST', rate: '6.00', amount: '354.00' },
        ],
        taxRuleId: 'tax-1',
      },
    ),
  };
  const policyResolver = {
    resolveDepositInput: jest.fn().mockResolvedValue(
      overrides.deposit ?? { type: GroupBookingDepositPolicyType.PERCENTAGE, value: 30 },
    ),
  };
  const service = new ReservationQuoteService(
    roomTypesRepository as never,
    reservationPricingService as never,
    childPricingService as never,
    gstService as never,
    policyResolver as never,
  );
  return { service, roomTypesRepository, reservationPricingService, childPricingService, gstService, policyResolver };
}

const baseInput = {
  arrivalDate: '2026-08-18',
  departureDate: '2026-08-19',
  adults: 2,
  children: 0,
  roomTypeId: 'dlx-1',
};

describe('ReservationQuoteService', () => {
  it('prices a Deluxe BAR stay from the shared pricing path with backend GST + deposit', async () => {
    const { service, gstService } = build();
    const quote = await service.quote('prop-1', baseInput);

    expect(quote.pricingStatus).toBe('PRICED');
    expect(quote.ratePlan).toEqual({ id: 'bar-1', code: 'BAR' });
    expect(quote.roomCharges).toBe('5900.00');
    expect(quote.taxableSubtotal).toBe('5900.00'); // == snapshot grandTotal (create parity)
    expect(quote.tax.totalTax).toBe('708.00');
    expect(quote.grandTotal).toBe('6608.00'); // 5900 + 708
    expect(quote.deposit).toMatchObject({ policyType: 'PERCENTAGE', policyValue: 30, required: true, suggestedAmount: '1982.40' });

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
  });

  it('never sends ratePlanId when omitted (backend resolves the default plan)', async () => {
    const { service, reservationPricingService } = build();
    await service.quote('prop-1', baseInput);
    expect(reservationPricingService.buildCommercialSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'prop-1', ratePlanId: null, roomTypeId: 'dlx-1' }),
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
    const STE = { ...DLX, id: 'ste-1', code: 'STE', name: 'Suite', maxOccupancy: 4, maxAdults: 2, maxChildren: 2 };
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
      snapshot: {
        ratePlanId: null,
        rateSnapshot: { pricingStatus: 'UNPRICED', reason: 'NO_APPLICABLE_RATE_PLAN', occupancy: { adults: 2, children: 0 } },
      },
    });
    const quote = await service.quote('prop-1', baseInput);
    expect(quote.pricingStatus).toBe('UNPRICED');
    expect(quote.grandTotal).toBe('0.00');
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
