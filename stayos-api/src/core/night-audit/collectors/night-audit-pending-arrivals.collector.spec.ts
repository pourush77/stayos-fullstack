import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { NightAuditPendingArrivalsCollector } from './night-audit-pending-arrivals.collector';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('NightAuditPendingArrivalsCollector', () => {
  let collector: NightAuditPendingArrivalsCollector;
  let reservationRepo: MockRepository<ReservationEntity>;

  const propertyId = '11111111-1111-1111-1111-111111111111';
  const otherPropertyId = '22222222-2222-2222-2222-222222222222';
  const auditBusinessDate = '2026-09-04';

  beforeEach(async () => {
    reservationRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NightAuditPendingArrivalsCollector,
        {
          provide: getRepositoryToken(ReservationEntity),
          useValue: reservationRepo,
        },
      ],
    }).compile();

    collector = module.get<NightAuditPendingArrivalsCollector>(NightAuditPendingArrivalsCollector);
  });

  describe('collect', () => {
    it('queries with correct property scope, status filter, date boundary, and deterministic ordering', async () => {
      reservationRepo.find?.mockResolvedValue([]);

      await collector.collect(propertyId, auditBusinessDate);

      expect(reservationRepo.find).toHaveBeenCalledWith({
        where: {
          propertyId,
          status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
          arrivalDate: LessThanOrEqual(auditBusinessDate),
        },
        relations: {
          guest: true,
          room: true,
        },
        order: {
          arrivalDate: 'ASC',
          createdAt: 'ASC',
          id: 'ASC',
        },
      });
    });

    it('A-D: includes CONFIRMED and PENDING arrivals on or before businessDate', async () => {
      const mockReservations = [
        {
          id: 'res-1',
          propertyId,
          reservationCode: 'RES-001',
          arrivalDate: auditBusinessDate, // on businessDate
          departureDate: '2026-09-06',
          status: ReservationStatus.CONFIRMED,
          roomId: 'room-1',
          roomNumber: '101',
          room: { id: 'room-1', roomNumber: '101' },
          roomTypeId: 'type-1',
          guestId: 'guest-1',
          guest: { id: 'guest-1', displayName: 'Confirmed OnDate' },
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
        {
          id: 'res-2',
          propertyId,
          reservationCode: 'RES-002',
          arrivalDate: auditBusinessDate, // on businessDate
          departureDate: '2026-09-05',
          status: ReservationStatus.PENDING,
          roomId: null,
          room: null,
          roomTypeId: 'type-1',
          guestId: 'guest-2',
          guest: { id: 'guest-2', displayName: 'Pending OnDate' },
          createdAt: new Date('2026-09-01T11:00:00Z'),
        },
        {
          id: 'res-3',
          propertyId,
          reservationCode: 'RES-003',
          arrivalDate: '2026-09-02', // before businessDate (earlier date)
          departureDate: '2026-09-05',
          status: ReservationStatus.CONFIRMED,
          roomId: 'room-2',
          roomNumber: '102',
          room: { id: 'room-2', roomNumber: '102' },
          roomTypeId: 'type-2',
          guestId: 'guest-3',
          guest: { id: 'guest-3', displayName: 'Confirmed EarlierDate' },
          createdAt: new Date('2026-08-30T10:00:00Z'),
        },
        {
          id: 'res-4',
          propertyId,
          reservationCode: 'RES-004',
          arrivalDate: '2026-09-03', // before businessDate (earlier date)
          departureDate: '2026-09-06',
          status: ReservationStatus.PENDING,
          roomId: null,
          room: null,
          roomTypeId: 'type-2',
          guestId: 'guest-4',
          guest: { id: 'guest-4', displayName: 'Pending EarlierDate' },
          createdAt: new Date('2026-08-31T10:00:00Z'),
        },
      ];

      reservationRepo.find?.mockResolvedValue(mockReservations);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(4);
      expect(result.blockingCount).toBe(4);
      expect(result.items).toHaveLength(4);
      expect(result.items.map((i) => i.reservationId)).toEqual(['res-1', 'res-2', 'res-3', 'res-4']);
    });

    it('E-J: query safety excludes future arrivals, non-pending/confirmed statuses, and other properties', async () => {
      // In PostgreSQL/TypeORM, the database executes the query filters:
      // - arrivalDate: LessThanOrEqual(auditBusinessDate) -> excludes future arrivals (> auditBusinessDate)
      // - status: In([PENDING, CONFIRMED]) -> excludes CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
      // - propertyId: propertyId -> excludes another property's reservations
      //
      // Here we simulate a dataset containing all variations and verify the query parameters
      // strictly exclude them.
      reservationRepo.find?.mockImplementation(async (options: any) => {
        const { propertyId: filterProp, status: filterStatus, arrivalDate: filterArrival } = options.where;

        const allReservations = [
          {
            id: 'valid-1',
            propertyId,
            status: ReservationStatus.CONFIRMED,
            arrivalDate: '2026-09-04',
            reservationCode: 'VALID-1',
            createdAt: new Date(),
          },
          {
            id: 'future-arrival',
            propertyId,
            status: ReservationStatus.CONFIRMED,
            arrivalDate: '2026-09-05', // E. future arrival
            reservationCode: 'FUTURE',
            createdAt: new Date(),
          },
          {
            id: 'checked-in',
            propertyId,
            status: ReservationStatus.CHECKED_IN, // F. CHECKED_IN
            arrivalDate: '2026-09-04',
            reservationCode: 'CHKIN',
            createdAt: new Date(),
          },
          {
            id: 'checked-out',
            propertyId,
            status: ReservationStatus.CHECKED_OUT, // G. CHECKED_OUT
            arrivalDate: '2026-09-04',
            reservationCode: 'CHKOUT',
            createdAt: new Date(),
          },
          {
            id: 'cancelled',
            propertyId,
            status: ReservationStatus.CANCELLED, // H. CANCELLED
            arrivalDate: '2026-09-04',
            reservationCode: 'CANC',
            createdAt: new Date(),
          },
          {
            id: 'no-show',
            propertyId,
            status: ReservationStatus.NO_SHOW, // I. NO_SHOW
            arrivalDate: '2026-09-04',
            reservationCode: 'NOSHOW',
            createdAt: new Date(),
          },
          {
            id: 'other-property',
            propertyId: otherPropertyId, // J. another property
            status: ReservationStatus.CONFIRMED,
            arrivalDate: '2026-09-04',
            reservationCode: 'OTHER',
            createdAt: new Date(),
          },
        ];

        return allReservations.filter((r) => {
          if (r.propertyId !== filterProp) return false;
          if (!filterStatus._value.includes(r.status)) return false;
          if (r.arrivalDate > filterArrival._value) return false;
          return true;
        });
      });

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.items[0].reservationId).toBe('valid-1');
    });

    it('K-L: both assigned and unassigned qualifying reservations appear correctly', async () => {
      const mockReservations = [
        {
          id: 'assigned-res',
          propertyId,
          reservationCode: 'RES-ASSIGNED',
          arrivalDate: auditBusinessDate,
          departureDate: '2026-09-06',
          status: ReservationStatus.CONFIRMED,
          roomId: 'room-uuid-101',
          room: { id: 'room-uuid-101', roomNumber: '101' },
          roomTypeId: 'type-uuid-1',
          guestId: 'guest-1',
          guest: { id: 'guest-1', displayName: 'Assigned Guest' },
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
        {
          id: 'unassigned-res',
          propertyId,
          reservationCode: 'RES-UNASSIGNED',
          arrivalDate: auditBusinessDate,
          departureDate: '2026-09-06',
          status: ReservationStatus.CONFIRMED,
          roomId: null,
          room: null,
          roomTypeId: 'type-uuid-2',
          guestId: 'guest-2',
          guest: { id: 'guest-2', displayName: 'Unassigned Guest' },
          createdAt: new Date('2026-09-01T11:00:00Z'),
        },
      ];

      reservationRepo.find?.mockResolvedValue(mockReservations);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(2);

      const assignedItem = result.items.find((i) => i.reservationId === 'assigned-res')!;
      expect(assignedItem.roomId).toBe('room-uuid-101');
      expect(assignedItem.roomNumber).toBe('101');

      const unassignedItem = result.items.find((i) => i.reservationId === 'unassigned-res')!;
      expect(unassignedItem.roomId).toBeNull();
      expect(unassignedItem.roomNumber).toBeNull();
    });

    it('M-N: count is correct and blockingCount equals count', async () => {
      const mockReservations = [
        {
          id: 'res-1',
          propertyId,
          reservationCode: 'RES-1',
          arrivalDate: auditBusinessDate,
          departureDate: '2026-09-06',
          status: ReservationStatus.CONFIRMED,
          roomId: null,
          room: null,
          roomTypeId: 'type-1',
          guest: { displayName: 'Guest 1' },
          createdAt: new Date(),
        },
        {
          id: 'res-2',
          propertyId,
          reservationCode: 'RES-2',
          arrivalDate: auditBusinessDate,
          departureDate: '2026-09-06',
          status: ReservationStatus.PENDING,
          roomId: null,
          room: null,
          roomTypeId: 'type-1',
          guest: { displayName: 'Guest 2' },
          createdAt: new Date(),
        },
        {
          id: 'res-3',
          propertyId,
          reservationCode: 'RES-3',
          arrivalDate: auditBusinessDate,
          departureDate: '2026-09-06',
          status: ReservationStatus.CONFIRMED,
          roomId: null,
          room: null,
          roomTypeId: 'type-1',
          guest: { displayName: 'Guest 3' },
          createdAt: new Date(),
        },
      ];

      reservationRepo.find?.mockResolvedValue(mockReservations);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(3);
      expect(result.blockingCount).toBe(3);
      expect(result.blockingCount).toBe(result.count);
    });

    it('O: deterministic ordering is requested from database (arrivalDate ASC, createdAt ASC, id ASC)', async () => {
      reservationRepo.find?.mockResolvedValue([]);

      await collector.collect(propertyId, auditBusinessDate);

      const findCall = reservationRepo.find?.mock.calls[0][0];
      expect(findCall.order).toEqual({
        arrivalDate: 'ASC',
        createdAt: 'ASC',
        id: 'ASC',
      });
    });

    it('P: supplied NightAuditRun.businessDate is used as sole date boundary rather than wall clock', async () => {
      reservationRepo.find?.mockResolvedValue([]);

      // Pass an arbitrary historical or far-future date
      const historicalDate = '2025-01-15';
      await collector.collect(propertyId, historicalDate);

      expect(reservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            arrivalDate: LessThanOrEqual(historicalDate),
          }),
        }),
      );
    });

    describe('action metadata', () => {
      it('exposes OPEN_BOOKING, CHECK_IN, MARK_NO_SHOW, CANCEL for CONFIRMED status', async () => {
        reservationRepo.find?.mockResolvedValue([
          {
            id: 'res-c',
            propertyId,
            reservationCode: 'RES-C',
            arrivalDate: auditBusinessDate,
            departureDate: '2026-09-06',
            status: ReservationStatus.CONFIRMED,
            roomId: null,
            room: null,
            guest: { displayName: 'Confirmed Guest' },
            createdAt: new Date(),
          },
        ]);

        const result = await collector.collect(propertyId, auditBusinessDate);

        expect(result.items[0].actions).toEqual([
          { type: 'OPEN_BOOKING' },
          { type: 'CHECK_IN' },
          { type: 'MARK_NO_SHOW' },
          { type: 'CANCEL' },
        ]);
      });

      it('exposes OPEN_BOOKING, CONFIRM, MARK_NO_SHOW, CANCEL for PENDING status (no CHECK_IN)', async () => {
        reservationRepo.find?.mockResolvedValue([
          {
            id: 'res-p',
            propertyId,
            reservationCode: 'RES-P',
            arrivalDate: auditBusinessDate,
            departureDate: '2026-09-06',
            status: ReservationStatus.PENDING,
            roomId: null,
            room: null,
            guest: { displayName: 'Pending Guest' },
            createdAt: new Date(),
          },
        ]);

        const result = await collector.collect(propertyId, auditBusinessDate);

        expect(result.items[0].actions).toEqual([
          { type: 'OPEN_BOOKING' },
          { type: 'CONFIRM' },
          { type: 'MARK_NO_SHOW' },
          { type: 'CANCEL' },
        ]);
        expect(result.items[0].actions).not.toContainEqual({ type: 'CHECK_IN' });
      });
    });
  });
});
