import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { NightAuditStayReviewState } from '../dto/night-audit-workspace.dto';
import {
  classifyStayReview,
  NightAuditStayReviewCollector,
} from './night-audit-stay-review.collector';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('NightAuditStayReviewCollector', () => {
  let collector: NightAuditStayReviewCollector;
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
        NightAuditStayReviewCollector,
        {
          provide: getRepositoryToken(ReservationEntity),
          useValue: reservationRepo,
        },
      ],
    }).compile();

    collector = module.get<NightAuditStayReviewCollector>(NightAuditStayReviewCollector);
  });

  describe('classifyStayReview pure helper', () => {
    it('returns STAYOVER when departureDate > businessDate', () => {
      expect(classifyStayReview('2026-09-05', '2026-09-04')).toBe(NightAuditStayReviewState.STAYOVER);
    });

    it('returns DUE_OUT when departureDate == businessDate', () => {
      expect(classifyStayReview('2026-09-04', '2026-09-04')).toBe(NightAuditStayReviewState.DUE_OUT);
    });

    it('returns OVERDUE when departureDate < businessDate', () => {
      expect(classifyStayReview('2026-09-03', '2026-09-04')).toBe(NightAuditStayReviewState.OVERDUE);
    });
  });

  describe('collect', () => {
    it('queries with correct property scope, status = CHECKED_IN, relations, and initial DB ordering', async () => {
      reservationRepo.find?.mockResolvedValue([]);

      await collector.collect(propertyId, auditBusinessDate);

      expect(reservationRepo.find).toHaveBeenCalledWith({
        where: {
          propertyId,
          status: ReservationStatus.CHECKED_IN,
        },
        relations: {
          guest: true,
          room: true,
        },
        order: {
          departureDate: 'ASC',
          createdAt: 'ASC',
          id: 'ASC',
        },
      });
    });

    it('A. CHECKED_IN departure after businessDate => STAYOVER, non-blocking', async () => {
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'stayover-res',
          propertyId,
          reservationCode: 'RES-STAYOVER',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-06', // after businessDate
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-1',
          room: { id: 'room-1', roomNumber: '101' },
          roomTypeId: 'type-1',
          guestId: 'guest-1',
          guest: { id: 'guest-1', displayName: 'Stayover Guest' },
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.blockingCount).toBe(0);
      expect(result.summary.stayover).toBe(1);
      expect(result.summary.dueOut).toBe(0);
      expect(result.summary.overdue).toBe(0);

      const item = result.items[0];
      expect(item.reviewState).toBe(NightAuditStayReviewState.STAYOVER);
      expect(item.blocking).toBe(false);
      expect(item.actions).toEqual([{ type: 'OPEN_STAY' }, { type: 'EXTEND_STAY' }]);
    });

    it('B. CHECKED_IN departure on businessDate => DUE_OUT, blocking', async () => {
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'dueout-res',
          propertyId,
          reservationCode: 'RES-DUEOUT',
          arrivalDate: '2026-09-01',
          departureDate: auditBusinessDate, // on businessDate
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-2',
          room: { id: 'room-2', roomNumber: '102' },
          roomTypeId: 'type-1',
          guestId: 'guest-2',
          guest: { id: 'guest-2', displayName: 'Due Out Guest' },
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.blockingCount).toBe(1);
      expect(result.summary.stayover).toBe(0);
      expect(result.summary.dueOut).toBe(1);
      expect(result.summary.overdue).toBe(0);

      const item = result.items[0];
      expect(item.reviewState).toBe(NightAuditStayReviewState.DUE_OUT);
      expect(item.blocking).toBe(true);
      expect(item.actions).toEqual([
        { type: 'OPEN_STAY' },
        { type: 'EXTEND_STAY' },
        { type: 'CHECK_OUT' },
      ]);
    });

    it('C. CHECKED_IN departure before businessDate => OVERDUE, blocking', async () => {
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'overdue-res',
          propertyId,
          reservationCode: 'RES-OVERDUE',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-03', // before businessDate
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-3',
          room: { id: 'room-3', roomNumber: '103' },
          roomTypeId: 'type-1',
          guestId: 'guest-3',
          guest: { id: 'guest-3', displayName: 'Overdue Guest' },
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.blockingCount).toBe(1);
      expect(result.summary.stayover).toBe(0);
      expect(result.summary.dueOut).toBe(0);
      expect(result.summary.overdue).toBe(1);

      const item = result.items[0];
      expect(item.reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(item.blocking).toBe(true);
      expect(item.actions).toEqual([
        { type: 'OPEN_STAY' },
        { type: 'EXTEND_STAY' },
        { type: 'CHECK_OUT' },
      ]);
    });

    it('D. old overdue CHECKED_IN guest is NOT excluded', async () => {
      // Guest scheduled to depart over a month ago but still marked CHECKED_IN
      const oldDepartureDate = '2026-07-15';
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'old-overdue-res',
          propertyId,
          reservationCode: 'RES-OLD-OVERDUE',
          arrivalDate: '2026-07-10',
          departureDate: oldDepartureDate,
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-4',
          room: { id: 'room-4', roomNumber: '104' },
          roomTypeId: 'type-1',
          guestId: 'guest-4',
          guest: { id: 'guest-4', displayName: 'Long Overdue Guest' },
          createdAt: new Date('2026-07-01T10:00:00Z'),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.blockingCount).toBe(1);
      expect(result.summary.overdue).toBe(1);
      expect(result.items[0].reservationId).toBe('old-overdue-res');
      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(result.items[0].blocking).toBe(true);
    });

    it('E. future/stayover CHECKED_IN guest appears', async () => {
      const futureDepartureDate = '2026-09-20';
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'future-stayover-res',
          propertyId,
          reservationCode: 'RES-FUTURE-STAY',
          arrivalDate: '2026-09-02',
          departureDate: futureDepartureDate,
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-5',
          room: { id: 'room-5', roomNumber: '105' },
          roomTypeId: 'type-1',
          guestId: 'guest-5',
          guest: { id: 'guest-5', displayName: 'Future Stayover Guest' },
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.blockingCount).toBe(0);
      expect(result.summary.stayover).toBe(1);
      expect(result.items[0].reservationId).toBe('future-stayover-res');
      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.STAYOVER);
      expect(result.items[0].blocking).toBe(false);
    });

    it('F-K. query safety excludes non-CHECKED_IN statuses (CONFIRMED, PENDING, CHECKED_OUT, CANCELLED, NO_SHOW) and other properties', async () => {
      reservationRepo.find?.mockImplementation(async (options: any) => {
        const { propertyId: filterProp, status: filterStatus } = options.where;

        const allReservations = [
          {
            id: 'valid-checked-in',
            propertyId,
            status: ReservationStatus.CHECKED_IN,
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'VALID-1',
            createdAt: new Date(),
          },
          {
            id: 'confirmed-res',
            propertyId,
            status: ReservationStatus.CONFIRMED, // F. CONFIRMED
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'CONF',
            createdAt: new Date(),
          },
          {
            id: 'pending-res',
            propertyId,
            status: ReservationStatus.PENDING, // G. PENDING
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'PEND',
            createdAt: new Date(),
          },
          {
            id: 'checked-out-res',
            propertyId,
            status: ReservationStatus.CHECKED_OUT, // H. CHECKED_OUT
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'CHKOUT',
            createdAt: new Date(),
          },
          {
            id: 'cancelled-res',
            propertyId,
            status: ReservationStatus.CANCELLED, // I. CANCELLED
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'CANC',
            createdAt: new Date(),
          },
          {
            id: 'no-show-res',
            propertyId,
            status: ReservationStatus.NO_SHOW, // J. NO_SHOW
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'NOSHOW',
            createdAt: new Date(),
          },
          {
            id: 'other-prop-checked-in',
            propertyId: otherPropertyId, // K. another property
            status: ReservationStatus.CHECKED_IN,
            arrivalDate: '2026-09-01',
            departureDate: '2026-09-04',
            reservationCode: 'OTHER',
            createdAt: new Date(),
          },
        ];

        return allReservations.filter((r) => {
          if (r.propertyId !== filterProp) return false;
          if (r.status !== filterStatus) return false;
          return true;
        });
      });

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      expect(result.items[0].reservationId).toBe('valid-checked-in');
    });

    it('L. CHECKED_IN reservation with room assignment appears with room data and roomAssignmentMissing = false', async () => {
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'assigned-res',
          propertyId,
          reservationCode: 'RES-ASSIGNED',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05',
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-uuid-201',
          room: { id: 'room-uuid-201', roomNumber: '201' },
          roomTypeId: 'type-1',
          guestId: 'guest-1',
          guest: { id: 'guest-1', displayName: 'Assigned Guest' },
          createdAt: new Date(),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      const item = result.items[0];
      expect(item.roomId).toBe('room-uuid-201');
      expect(item.roomNumber).toBe('201');
      expect(item.roomAssignmentMissing).toBe(false);
    });

    it('M. CHECKED_IN reservation without room assignment still appears with nulls and roomAssignmentMissing = true', async () => {
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'unassigned-checked-in',
          propertyId,
          reservationCode: 'RES-UNASSIGNED-CHKIN',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05',
          status: ReservationStatus.CHECKED_IN,
          roomId: null,
          room: null,
          roomTypeId: 'type-1',
          guestId: 'guest-2',
          guest: { id: 'guest-2', displayName: 'Unassigned Guest' },
          createdAt: new Date(),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.count).toBe(1);
      const item = result.items[0];
      expect(item.roomId).toBeNull();
      expect(item.roomNumber).toBeNull();
      expect(item.roomAssignmentMissing).toBe(true);
      expect(item.status).toBe(ReservationStatus.CHECKED_IN);
    });

    it('N-O. summary counts are correct and blockingCount equals dueOut + overdue', async () => {
      const mockReservations = [
        // 2 stayover
        {
          id: 'stayover-1',
          propertyId,
          reservationCode: 'RES-S1',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-06',
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-1',
          room: { roomNumber: '101' },
          guest: { displayName: 'Guest S1' },
          createdAt: new Date(),
        },
        {
          id: 'stayover-2',
          propertyId,
          reservationCode: 'RES-S2',
          arrivalDate: '2026-09-02',
          departureDate: '2026-09-07',
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-2',
          room: { roomNumber: '102' },
          guest: { displayName: 'Guest S2' },
          createdAt: new Date(),
        },
        // 3 dueOut
        {
          id: 'dueout-1',
          propertyId,
          reservationCode: 'RES-D1',
          arrivalDate: '2026-09-01',
          departureDate: auditBusinessDate,
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-3',
          room: { roomNumber: '103' },
          guest: { displayName: 'Guest D1' },
          createdAt: new Date(),
        },
        {
          id: 'dueout-2',
          propertyId,
          reservationCode: 'RES-D2',
          arrivalDate: '2026-09-02',
          departureDate: auditBusinessDate,
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-4',
          room: { roomNumber: '104' },
          guest: { displayName: 'Guest D2' },
          createdAt: new Date(),
        },
        {
          id: 'dueout-3',
          propertyId,
          reservationCode: 'RES-D3',
          arrivalDate: '2026-09-03',
          departureDate: auditBusinessDate,
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-5',
          room: { roomNumber: '105' },
          guest: { displayName: 'Guest D3' },
          createdAt: new Date(),
        },
        // 1 overdue
        {
          id: 'overdue-1',
          propertyId,
          reservationCode: 'RES-O1',
          arrivalDate: '2026-08-30',
          departureDate: '2026-09-02',
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-6',
          room: { roomNumber: '106' },
          guest: { displayName: 'Guest O1' },
          createdAt: new Date(),
        },
      ];

      reservationRepo.find?.mockResolvedValue(mockReservations);

      const result = await collector.collect(propertyId, auditBusinessDate);

      // N. summary counts are correct
      expect(result.count).toBe(6);
      expect(result.summary).toEqual({
        stayover: 2,
        dueOut: 3,
        overdue: 1,
      });

      // O. blockingCount = dueOut + overdue
      expect(result.blockingCount).toBe(4);
      expect(result.blockingCount).toBe(result.summary.dueOut + result.summary.overdue);
    });

    it('P. ordering is strictly OVERDUE -> DUE_OUT -> STAYOVER with departureDate ASC and roomNumber/id tie-breaker', async () => {
      // Deliberately unsorted in input
      const mockReservations = [
        {
          id: 'res-so-2',
          propertyId,
          reservationCode: 'SO-2',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-06', // STAYOVER later date
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-so2',
          room: { roomNumber: '102' },
          guest: { displayName: 'SO 2' },
          createdAt: new Date(),
        },
        {
          id: 'res-so-1b',
          propertyId,
          reservationCode: 'SO-1B',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05', // STAYOVER earlier date, room 103
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-so1b',
          room: { roomNumber: '103' },
          guest: { displayName: 'SO 1B' },
          createdAt: new Date(),
        },
        {
          id: 'res-so-1a',
          propertyId,
          reservationCode: 'SO-1A',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05', // STAYOVER earlier date, room 101
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-so1a',
          room: { roomNumber: '101' },
          guest: { displayName: 'SO 1A' },
          createdAt: new Date(),
        },
        {
          id: 'res-do-b',
          propertyId,
          reservationCode: 'DO-B',
          arrivalDate: '2026-09-01',
          departureDate: auditBusinessDate, // DUE_OUT, room 202
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-dob',
          room: { roomNumber: '202' },
          guest: { displayName: 'DO B' },
          createdAt: new Date(),
        },
        {
          id: 'res-do-a',
          propertyId,
          reservationCode: 'DO-A',
          arrivalDate: '2026-09-01',
          departureDate: auditBusinessDate, // DUE_OUT, room 201
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-doa',
          room: { roomNumber: '201' },
          guest: { displayName: 'DO A' },
          createdAt: new Date(),
        },
        {
          id: 'res-ov-2',
          propertyId,
          reservationCode: 'OV-2',
          arrivalDate: '2026-08-25',
          departureDate: '2026-09-03', // OVERDUE, later departure (yesterday)
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-ov2',
          room: { roomNumber: '302' },
          guest: { displayName: 'OV 2' },
          createdAt: new Date(),
        },
        {
          id: 'res-ov-1',
          propertyId,
          reservationCode: 'OV-1',
          arrivalDate: '2026-08-20',
          departureDate: '2026-09-01', // OVERDUE, older departure (3 days ago)
          status: ReservationStatus.CHECKED_IN,
          roomId: 'r-ov1',
          room: { roomNumber: '301' },
          guest: { displayName: 'OV 1' },
          createdAt: new Date(),
        },
      ];

      reservationRepo.find?.mockResolvedValue(mockReservations);

      const result = await collector.collect(propertyId, auditBusinessDate);

      const orderedIds = result.items.map((i) => i.reservationId);
      expect(orderedIds).toEqual([
        'res-ov-1',  // OVERDUE 2026-09-01
        'res-ov-2',  // OVERDUE 2026-09-03
        'res-do-a',  // DUE_OUT 2026-09-04, room 201
        'res-do-b',  // DUE_OUT 2026-09-04, room 202
        'res-so-1a', // STAYOVER 2026-09-05, room 101
        'res-so-1b', // STAYOVER 2026-09-05, room 103
        'res-so-2',  // STAYOVER 2026-09-06, room 102
      ]);

      const reviewStates = result.items.map((i) => i.reviewState);
      expect(reviewStates).toEqual([
        NightAuditStayReviewState.OVERDUE,
        NightAuditStayReviewState.OVERDUE,
        NightAuditStayReviewState.DUE_OUT,
        NightAuditStayReviewState.DUE_OUT,
        NightAuditStayReviewState.STAYOVER,
        NightAuditStayReviewState.STAYOVER,
        NightAuditStayReviewState.STAYOVER,
      ]);
    });

    it('Q. classification uses supplied run.businessDate rather than wall clock', async () => {
      // Test with an arbitrary historical business date: 2024-03-10
      const historicalDate = '2024-03-10';
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'res-hist-overdue',
          propertyId,
          reservationCode: 'HIST-OV',
          arrivalDate: '2024-03-01',
          departureDate: '2024-03-09',
          status: ReservationStatus.CHECKED_IN,
          createdAt: new Date(),
        },
        {
          id: 'res-hist-dueout',
          propertyId,
          reservationCode: 'HIST-DO',
          arrivalDate: '2024-03-05',
          departureDate: '2024-03-10',
          status: ReservationStatus.CHECKED_IN,
          createdAt: new Date(),
        },
        {
          id: 'res-hist-stayover',
          propertyId,
          reservationCode: 'HIST-SO',
          arrivalDate: '2024-03-08',
          departureDate: '2024-03-15',
          status: ReservationStatus.CHECKED_IN,
          createdAt: new Date(),
        },
      ]);

      const result = await collector.collect(propertyId, historicalDate);

      const overdueItem = result.items.find((i) => i.reservationId === 'res-hist-overdue')!;
      const dueOutItem = result.items.find((i) => i.reservationId === 'res-hist-dueout')!;
      const stayoverItem = result.items.find((i) => i.reservationId === 'res-hist-stayover')!;

      expect(overdueItem.reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(overdueItem.blocking).toBe(true);

      expect(dueOutItem.reviewState).toBe(NightAuditStayReviewState.DUE_OUT);
      expect(dueOutItem.blocking).toBe(true);

      expect(stayoverItem.reviewState).toBe(NightAuditStayReviewState.STAYOVER);
      expect(stayoverItem.blocking).toBe(false);
    });

    it('handles guest name resolution: displayName, firstName/lastName fallback, and Unknown Guest', async () => {
      reservationRepo.find?.mockResolvedValue([
        {
          id: 'g-display',
          propertyId,
          reservationCode: 'G-1',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05',
          status: ReservationStatus.CHECKED_IN,
          guest: { displayName: 'Display Name Guest' },
          createdAt: new Date(),
        },
        {
          id: 'g-firstlast',
          propertyId,
          reservationCode: 'G-2',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05',
          status: ReservationStatus.CHECKED_IN,
          guest: { firstName: 'Alice', lastName: 'Smith' },
          createdAt: new Date(),
        },
        {
          id: 'g-unknown',
          propertyId,
          reservationCode: 'G-3',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-05',
          status: ReservationStatus.CHECKED_IN,
          guest: null,
          createdAt: new Date(),
        },
      ]);

      const result = await collector.collect(propertyId, auditBusinessDate);

      expect(result.items.find((i) => i.reservationId === 'g-display')?.guestName).toBe('Display Name Guest');
      expect(result.items.find((i) => i.reservationId === 'g-firstlast')?.guestName).toBe('Alice Smith');
      expect(result.items.find((i) => i.reservationId === 'g-unknown')?.guestName).toBe('Unknown Guest');
    });
  });
});
