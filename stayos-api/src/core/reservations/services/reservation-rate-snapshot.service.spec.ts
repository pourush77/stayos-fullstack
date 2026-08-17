import { ReservationRateSnapshotService, CommercialKey } from './reservation-rate-snapshot.service';
import { ReservationRateSnapshotStatus } from '../domain/reservation-rate-snapshot-status.enum';
import { ReservationRateSnapshotTrigger } from '../domain/reservation-rate-snapshot-trigger.enum';

type Row = Record<string, unknown>;

function fakeManager() {
  const rows: Row[] = [];
  const repo = {
    create: (v: Row) => ({ ...v }),
    save: jest.fn(async (v: Row) => {
      const existing = rows.find((r) => r === v);
      if (!existing) rows.push(v);
      return v;
    }),
    findOne: jest.fn(async ({ where }: { where: Row }) =>
      rows.find(
        (r) => r.reservationId === where.reservationId && r.status === where.status,
      ) ?? null,
    ),
  };
  const manager = { getRepository: jest.fn().mockReturnValue(repo) };
  return { manager, repo, rows };
}

function pricingMock(resolved?: Partial<{ ratePlanId: string | null; rateSnapshot: Record<string, unknown> }>) {
  return {
    buildCommercialSnapshot: jest.fn().mockResolvedValue({
      ratePlanId: resolved?.ratePlanId ?? 'rp-1',
      rateSnapshot: resolved?.rateSnapshot ?? { version: 1, pricingStatus: 'PRICED', totals: { grandTotal: '10000.00' } },
    }),
  };
}

const baseKey: CommercialKey = {
  propertyId: 'prop-1',
  ratePlanId: 'rp-1',
  roomTypeId: 'rt-1',
  arrivalDate: '2027-04-01',
  departureDate: '2027-04-03',
  adults: 2,
  childAges: [],
};

describe('ReservationRateSnapshotService', () => {
  it('computes a stable, order-independent commercial hash', () => {
    const svc = new ReservationRateSnapshotService(pricingMock() as never);
    const a = svc.computeCommercialHash({ ...baseKey, childAges: [4, 9] });
    const b = svc.computeCommercialHash({ ...baseKey, childAges: [9, 4] });
    expect(a).toBe(b);
    expect(a).not.toBe(svc.computeCommercialHash({ ...baseKey, adults: 3 }));
  });

  it('records version 1 (INITIAL) and sets the reservation mirror', async () => {
    const pricing = pricingMock();
    const svc = new ReservationRateSnapshotService(pricing as never);
    const { manager, rows } = fakeManager();
    const reservation: Row = { id: 'res-1', propertyId: 'prop-1', rateSnapshotVersion: null };

    await svc.recordInitialVersion(manager as never, reservation as never, baseKey);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: 1, status: ReservationRateSnapshotStatus.ACTIVE, trigger: ReservationRateSnapshotTrigger.INITIAL });
    expect(reservation.rateSnapshotVersion).toBe(1);
    expect(reservation.ratePlanId).toBe('rp-1');
    expect(reservation.rateSnapshot).toMatchObject({ pricingStatus: 'PRICED' });
  });

  it('is idempotent: recordInitialVersion is a no-op when already versioned', async () => {
    const pricing = pricingMock();
    const svc = new ReservationRateSnapshotService(pricing as never);
    const { manager, rows } = fakeManager();
    const reservation: Row = { id: 'res-1', propertyId: 'prop-1', rateSnapshotVersion: 1 };

    await svc.recordInitialVersion(manager as never, reservation as never, baseKey);

    expect(rows).toHaveLength(0);
    expect(pricing.buildCommercialSnapshot).not.toHaveBeenCalled();
  });

  it('amend makes no version on a commercial no-op', async () => {
    const pricing = pricingMock();
    const svc = new ReservationRateSnapshotService(pricing as never);
    const { manager, rows } = fakeManager();
    const reservation: Row = { id: 'res-1', propertyId: 'prop-1', rateSnapshotVersion: null };

    await svc.recordInitialVersion(manager as never, reservation as never, baseKey);
    pricing.buildCommercialSnapshot.mockClear();

    // same effective inputs (ratePlanId resolved to rp-1 == baseKey.ratePlanId)
    const result = await svc.amend(manager as never, reservation as never, baseKey, ReservationRateSnapshotTrigger.AMENDMENT);

    expect(result.changed).toBe(false);
    expect(pricing.buildCommercialSnapshot).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows.filter((r) => r.status === ReservationRateSnapshotStatus.ACTIVE)).toHaveLength(1);
  });

  it('amend supersedes v1 and creates immutable v2, keeping exactly one ACTIVE', async () => {
    const pricing = pricingMock();
    const svc = new ReservationRateSnapshotService(pricing as never);
    const { manager, rows } = fakeManager();
    const reservation: Row = { id: 'res-1', propertyId: 'prop-1', rateSnapshotVersion: null };

    await svc.recordInitialVersion(manager as never, reservation as never, baseKey);
    const v1 = rows[0];
    const v1SnapshotRef = v1.snapshot;

    pricing.buildCommercialSnapshot.mockResolvedValueOnce({
      ratePlanId: 'rp-1',
      rateSnapshot: { version: 1, pricingStatus: 'PRICED', totals: { grandTotal: '15000.00' } },
    });
    const result = await svc.amend(
      manager as never,
      reservation as never,
      { ...baseKey, departureDate: '2027-04-04' },
      ReservationRateSnapshotTrigger.DATE_CHANGE,
    );

    expect(result).toEqual({ changed: true, version: 2 });
    expect(rows).toHaveLength(2);
    // v1 preserved (never rewritten) but marked SUPERSEDED pointing at v2
    expect(v1.status).toBe(ReservationRateSnapshotStatus.SUPERSEDED);
    expect(v1.supersededByVersion).toBe(2);
    expect(v1.snapshot).toBe(v1SnapshotRef);
    // exactly one ACTIVE, and it is v2
    const active = rows.filter((r) => r.status === ReservationRateSnapshotStatus.ACTIVE);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ version: 2, trigger: ReservationRateSnapshotTrigger.DATE_CHANGE });
    // mirror updated
    expect(reservation.rateSnapshotVersion).toBe(2);
    expect(reservation.rateSnapshot).toMatchObject({ totals: { grandTotal: '15000.00' } });
  });
});
