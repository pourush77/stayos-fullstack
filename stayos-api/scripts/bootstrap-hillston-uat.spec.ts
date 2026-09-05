import { ReservationStatus } from '../src/core/reservations/domain/reservation-status.enum';
import { ReservationPaymentStatus } from '../src/core/reservations/domain/reservation-payment-status.enum';
import { FolioChargeType } from '../src/core/billing/domain/folio-charge-type.enum';
import { FolioStatus } from '../src/core/billing/domain/folio-status.enum';
import { FolioEntity } from '../src/core/billing/infrastructure/folio.entity';
import { FolioChargeEntity } from '../src/core/billing/infrastructure/folio-charge.entity';
import {
  DAVID_BROWN_EXPECTED_FOLIO_TOTAL,
  DAVID_BROWN_MINIBAR_TOTAL,
  UAT_RATE_PLAN_CODE,
  UAT_DELUXE_SNAPSHOT_ROOM_TOTAL,
  reconcileExistingEmptySnapshotFolio,
  reservationSeeds,
} from './bootstrap-hillston-uat';

describe('Hillston UAT seed pricing fidelity', () => {
  const committedModernSeeds = reservationSeeds.filter((seed) =>
    [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN].includes(seed.status),
  );

  it('declares a dedicated UAT rate plan for production-shaped snapshots', () => {
    expect(UAT_RATE_PLAN_CODE).toBe('UAT_BAR');
  });

  it('keeps all committed CONFIRMED and CHECKED_IN UAT reservations eligible for modern pricing', () => {
    expect(committedModernSeeds.map((seed) => seed.code)).toEqual(
      expect.arrayContaining(['UAT26-ARR-03', 'UAT26-FUT-02']),
    );

    for (const seed of committedModernSeeds) {
      expect(seed.roomTypeCode).toBeTruthy();
      expect(seed.arrivalOffset).toBeLessThan(seed.departureOffset);
    }
  });

  it('uses snapshot-driven room charges for current in-house UAT folios', () => {
    const checkedInFolios = committedModernSeeds.filter(
      (seed) => seed.status === ReservationStatus.CHECKED_IN && seed.folio,
    );

    expect(checkedInFolios).not.toHaveLength(0);
    for (const seed of checkedInFolios) {
      expect(seed.folio?.mode).toBe('SNAPSHOT');
      expect(seed.folio?.roomAmount).toBeUndefined();
      expect(seed.folio?.extraCharges ?? []).not.toContainEqual(
        expect.objectContaining({ type: FolioChargeType.ROOM }),
      );
    }
  });

  it('keeps David Brown financially clear against the seeded snapshot-driven folio total', () => {
    const david = reservationSeeds.find((seed) => seed.code === 'UAT26-INH-02');

    expect(david).toEqual(
      expect.objectContaining({
        guestKey: 'DAVID',
        status: ReservationStatus.CHECKED_IN,
        paymentStatus: ReservationPaymentStatus.PAID,
      }),
    );
    expect(david?.folio?.mode).toBe('SNAPSHOT');
    expect(david?.folio?.roomAmount).toBeUndefined();

    const minibar = david?.folio?.extraCharges?.find(
      (charge) => charge.type === FolioChargeType.MINIBAR,
    );
    expect(minibar).toEqual(
      expect.objectContaining({
        description: 'Minibar consumption',
        amount: 650,
        tax: 32.5,
      }),
    );

    const minibarTotal = (minibar?.amount ?? 0) + (minibar?.tax ?? 0);
    const seededChargeTotal = UAT_DELUXE_SNAPSHOT_ROOM_TOTAL + minibarTotal;
    const paymentAmount = david?.folio?.payment?.amount;

    expect(minibarTotal).toBe(DAVID_BROWN_MINIBAR_TOTAL);
    expect(seededChargeTotal).toBe(DAVID_BROWN_EXPECTED_FOLIO_TOTAL);
    expect(paymentAmount).toBe(DAVID_BROWN_EXPECTED_FOLIO_TOTAL);
    expect(Number((seededChargeTotal - (paymentAmount ?? 0)).toFixed(2))).toBe(0);
  });

  it('labels checked-out history as the only legacy manual room-charge scenario', () => {
    const legacySeeds = reservationSeeds.filter((seed) => seed.folio?.mode === 'LEGACY_MANUAL');

    expect(legacySeeds.map((seed) => seed.code).sort()).toEqual(['UAT26-OUT-01', 'UAT26-OUT-02']);
    for (const seed of legacySeeds) {
      expect(seed.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(seed.folio?.roomAmount).toBeGreaterThan(0);
    }
  });

  it('does not repair an existing UAT folio that already has ROOM charges', async () => {
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FolioEntity) {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: 'folio-1',
              propertyId: 'property-1',
              reservationId: 'reservation-1',
              status: FolioStatus.OPEN,
            }),
          };
        }
        if (entity === FolioChargeEntity) {
          return { count: jest.fn().mockResolvedValue(1) };
        }
        return {};
      }),
    } as never;

    await expect(
      reconcileExistingEmptySnapshotFolio(manager, 'property-1', 'reservation-1'),
    ).resolves.toBe(false);
  });
});
