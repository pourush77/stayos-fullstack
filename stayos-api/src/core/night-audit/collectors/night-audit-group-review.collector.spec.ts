import { Repository } from 'typeorm';
import { FolioPaymentEntity } from '../../billing/infrastructure/folio-payment.entity';
import { GroupBookingStatus } from '../../operations/domain/group-booking-status.enum';
import { GroupBookingRoomAssignmentEntity } from '../../operations/infrastructure/group-booking-room-assignment.entity';
import { GroupBookingEntity } from '../../operations/infrastructure/group-booking.entity';
import { GroupMasterFolioEntity } from '../../operations/infrastructure/group-master-folio.entity';
import { GroupStayEntity } from '../../operations/infrastructure/group-stay.entity';
import { NightAuditStayReviewState } from '../dto/night-audit-workspace.dto';
import { NightAuditGroupReviewCollector } from './night-audit-group-review.collector';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('NightAuditGroupReviewCollector', () => {
  let collector: NightAuditGroupReviewCollector;
  let groupStaysRepo: MockRepository<GroupStayEntity>;
  let roomAssignmentsRepo: MockRepository<GroupBookingRoomAssignmentEntity>;
  let groupMasterFoliosRepo: MockRepository<GroupMasterFolioEntity>;
  let folioPaymentsRepo: MockRepository<FolioPaymentEntity>;

  const mockPropertyId = '11111111-1111-1111-1111-111111111111';
  const otherPropertyId = '22222222-2222-2222-2222-222222222222';
  const businessDate = '2026-09-04';

  function createGroup(
    id: string,
    overrides?: Partial<GroupBookingEntity>,
  ): GroupBookingEntity {
    return {
      id,
      propertyId: mockPropertyId,
      groupCode: `GRP-${id}`,
      groupName: `Group ${id}`,
      leadName: `Lead ${id}`,
      leadPhone: '+1234567890',
      leadEmail: `lead-${id}@example.com`,
      arrivalDate: '2026-09-01',
      departureDate: '2026-09-06',
      adults: 4,
      children: 0,
      source: 'DIRECT' as any,
      status: GroupBookingStatus.CHECKED_IN,
      releaseAt: null,
      depositRequired: '0',
      depositPolicyType: 'NONE' as any,
      depositPolicyValue: '0',
      estimatedTotal: '1000.00',
      externalChannelId: null,
      syncStatus: 'PMS_ONLY',
      notes: null,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      updatedAt: new Date('2026-09-01T10:00:00Z'),
      property: { id: mockPropertyId } as any,
      ...overrides,
    };
  }

  function createStay(
    id: string,
    group: GroupBookingEntity,
    overrides?: Partial<GroupStayEntity>,
  ): GroupStayEntity {
    return {
      id: `stay-${id}`,
      propertyId: group.propertyId,
      groupBookingId: group.id,
      groupBooking: group,
      checkedInAt: new Date('2026-09-01T12:00:00Z'),
      status: 'IN_HOUSE',
      createdAt: new Date('2026-09-01T12:00:00Z'),
      updatedAt: new Date('2026-09-01T12:00:00Z'),
      ...overrides,
    };
  }

  function createFolio(
    id: string,
    group: GroupBookingEntity,
    stay: GroupStayEntity,
    overrides?: Partial<GroupMasterFolioEntity>,
  ): GroupMasterFolioEntity {
    return {
      id: `folio-${id}`,
      propertyId: group.propertyId,
      groupBookingId: group.id,
      groupBooking: group,
      groupStayId: stay.id,
      groupStay: stay,
      folioNumber: `GMF-${id}`,
      status: 'OPEN',
      currency: 'INR',
      estimatedTotal: group.estimatedTotal,
      payments: [],
      createdAt: new Date('2026-09-01T12:00:00Z'),
      updatedAt: new Date('2026-09-01T12:00:00Z'),
      ...overrides,
    };
  }

  function createAssignment(
    id: string,
    groupBookingId: string,
    roomNumber: string,
  ): GroupBookingRoomAssignmentEntity {
    return {
      id: `assign-${id}`,
      groupBookingId,
      groupBooking: { id: groupBookingId } as any,
      roomId: `room-${id}`,
      room: { id: `room-${id}`, roomNumber, propertyId: mockPropertyId } as any,
      roomTypeId: `type-${id}`,
      createdAt: new Date('2026-09-01T12:00:00Z'),
      updatedAt: new Date('2026-09-01T12:00:00Z'),
    };
  }

  beforeEach(() => {
    groupStaysRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    roomAssignmentsRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    groupMasterFoliosRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    folioPaymentsRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    collector = new NightAuditGroupReviewCollector(
      groupStaysRepo as unknown as Repository<GroupStayEntity>,
      roomAssignmentsRepo as unknown as Repository<GroupBookingRoomAssignmentEntity>,
      groupMasterFoliosRepo as unknown as Repository<GroupMasterFolioEntity>,
      folioPaymentsRepo as unknown as Repository<FolioPaymentEntity>,
    );
  });

  describe('A, B, C: Business-date classification', () => {
    it('A. IN_HOUSE group departure after businessDate => STAYOVER', async () => {
      const group = createGroup('1', { departureDate: '2026-09-06' }); // after 2026-09-04
      const stay = createStay('1', group);
      const folio = createFolio('1', group, stay, { estimatedTotal: '0' });
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.count).toBe(1);
      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.STAYOVER);
      expect(result.summary.stayover).toBe(1);
      expect(result.summary.dueOut).toBe(0);
      expect(result.summary.overdue).toBe(0);
    });

    it('B. IN_HOUSE group departure on businessDate => DUE_OUT', async () => {
      const group = createGroup('2', { departureDate: '2026-09-04' }); // on 2026-09-04
      const stay = createStay('2', group);
      const folio = createFolio('2', group, stay);
      const assignment = createAssignment('2', group.id, '102');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.count).toBe(1);
      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.DUE_OUT);
      expect(result.summary.stayover).toBe(0);
      expect(result.summary.dueOut).toBe(1);
      expect(result.summary.overdue).toBe(0);
    });

    it('C. IN_HOUSE group departure before businessDate => OVERDUE', async () => {
      const group = createGroup('3', { departureDate: '2026-09-02' }); // before 2026-09-04
      const stay = createStay('3', group);
      const folio = createFolio('3', group, stay);
      const assignment = createAssignment('3', group.id, '103');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.count).toBe(1);
      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(result.summary.stayover).toBe(0);
      expect(result.summary.dueOut).toBe(0);
      expect(result.summary.overdue).toBe(1);
    });
  });

  describe('D, E, F: Operational blocking', () => {
    it('D. DUE_OUT blocks', async () => {
      const group = createGroup('dueout', { departureDate: businessDate, estimatedTotal: '0' });
      const stay = createStay('dueout', group);
      const folio = createFolio('dueout', group, stay, { estimatedTotal: '0' });
      const assignment = createAssignment('dueout', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.DUE_OUT);
      expect(result.items[0].blocking).toBe(true);
      expect(result.blockingCount).toBe(1);
    });

    it('E. OVERDUE blocks', async () => {
      const group = createGroup('overdue', { departureDate: '2026-09-03', estimatedTotal: '0' });
      const stay = createStay('overdue', group);
      const folio = createFolio('overdue', group, stay, { estimatedTotal: '0' });
      const assignment = createAssignment('overdue', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(result.items[0].blocking).toBe(true);
      expect(result.blockingCount).toBe(1);
    });

    it('F. normal STAYOVER does not block', async () => {
      const group = createGroup('stayover', { departureDate: '2026-09-07', estimatedTotal: '0' });
      const stay = createStay('stayover', group);
      const folio = createFolio('stayover', group, stay, { estimatedTotal: '0' });
      const assignment = createAssignment('stayover', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.STAYOVER);
      expect(result.items[0].blocking).toBe(false);
      expect(result.items[0].financialException).toBe(false);
      expect(result.items[0].operationalException).toBe(false);
      expect(result.blockingCount).toBe(0);
    });
  });

  describe('G, H, I: Scope & Authoritative in-house lifecycle', () => {
    it('G. group from another property is excluded', async () => {
      const group = createGroup('other-prop', {
        propertyId: otherPropertyId,
        departureDate: '2026-09-06',
      });
      const stay = createStay('other-prop', group, { propertyId: otherPropertyId });

      // Stays query finds nothing for mockPropertyId or returns stays from other property
      groupStaysRepo.find?.mockResolvedValueOnce([stay]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.count).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('H. non-IN_HOUSE group excluded (status !== CHECKED_IN or stay.status !== IN_HOUSE)', async () => {
      const groupConfirmed = createGroup('confirmed', { status: GroupBookingStatus.CONFIRMED });
      const stayConfirmed = createStay('confirmed', groupConfirmed, { status: 'IN_HOUSE' });

      const groupCheckedOut = createGroup('checkedout', { status: GroupBookingStatus.CHECKED_OUT });
      const stayCheckedOut = createStay('checkedout', groupCheckedOut, { status: 'CHECKED_OUT' });

      const groupOnHold = createGroup('onhold', { status: GroupBookingStatus.ON_HOLD });
      const stayOnHold = createStay('onhold', groupOnHold, { status: 'IN_HOUSE' });

      groupStaysRepo.find?.mockResolvedValueOnce([stayConfirmed, stayCheckedOut, stayOnHold]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.count).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('I. group lifecycle is NOT inferred from room assignment', async () => {
      // Group is NOT checked in (CONFIRMED), but has room assignments
      const group = createGroup('not-in-house', { status: GroupBookingStatus.CONFIRMED });
      const stay = createStay('not-in-house', group, { status: 'CHECKED_OUT' });
      const assignment = createAssignment('not-in-house', group.id, '201');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      // Must be excluded: in-house state is authoritatively from GroupBooking.status and GroupStay.status
      expect(result.count).toBe(0);
    });
  });

  describe('J, K: Room assignments and operational inconsistencies', () => {
    it('J. in-house group with assignments returns room details', async () => {
      const group = createGroup('assigned', { departureDate: '2026-09-08' });
      const stay = createStay('assigned', group);
      const folio = createFolio('assigned', group, stay);
      const assign1 = createAssignment('a1', group.id, '105');
      const assign2 = createAssignment('a2', group.id, '102');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assign1, assign2]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.items[0].assignedRoomCount).toBe(2);
      expect(result.items[0].roomAssignmentMissing).toBe(false);
      // Natural sorting: 102 then 105
      expect(result.items[0].assignedRooms).toEqual([
        { roomId: 'room-a2', roomNumber: '102' },
        { roomId: 'room-a1', roomNumber: '105' },
      ]);
    });

    it('K. in-house group with zero assignments remains visible and blocks', async () => {
      const group = createGroup('no-rooms', { departureDate: '2026-09-08' }); // STAYOVER
      const stay = createStay('no-rooms', group);
      const folio = createFolio('no-rooms', group, stay, { estimatedTotal: '0' });

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([]); // zero assignments

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.count).toBe(1);
      const item = result.items[0];
      expect(item.assignedRoomCount).toBe(0);
      expect(item.assignedRooms).toEqual([]);
      expect(item.roomAssignmentMissing).toBe(true);
      expect(item.operationalException).toBe(true);
      expect(item.blocking).toBe(true); // blocks even though STAYOVER!
      expect(result.blockingCount).toBe(1);
      expect(result.summary.operationalExceptions).toBe(1);
    });
  });

  describe('L, M, N, O: Financial blocking and master folio', () => {
    it('L. DUE_OUT with positive master-folio balance blocks', async () => {
      const group = createGroup('dueout-balance', {
        departureDate: businessDate,
        estimatedTotal: '2500.00',
      });
      const stay = createStay('dueout-balance', group);
      const folio = createFolio('dueout-balance', group, stay, { estimatedTotal: '2500.00' });
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFolioRepoMock([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);
      folioPaymentsRepo.find?.mockResolvedValueOnce([]); // 0 paid

      const result = await collector.collect(mockPropertyId, businessDate);

      const item = result.items[0];
      expect(item.reviewState).toBe(NightAuditStayReviewState.DUE_OUT);
      expect(item.totalCharges).toBe(2500);
      expect(item.totalPayments).toBe(0);
      expect(item.balanceDue).toBe(2500);
      expect(item.checkoutEligible).toBe(false);
      expect(item.financialException).toBe(true);
      expect(item.blocking).toBe(true);
    });

    it('M. OVERDUE with positive balance blocks', async () => {
      const group = createGroup('overdue-balance', {
        departureDate: '2026-09-02',
        estimatedTotal: '1500.00',
      });
      const stay = createStay('overdue-balance', group);
      const folio = createFolio('overdue-balance', group, stay, { estimatedTotal: '1500.00' });
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFolioRepoMock([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);
      folioPaymentsRepo.find?.mockResolvedValueOnce([]);

      const result = await collector.collect(mockPropertyId, businessDate);

      const item = result.items[0];
      expect(item.reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(item.balanceDue).toBe(1500);
      expect(item.financialException).toBe(true);
      expect(item.blocking).toBe(true);
    });

    it('N. STAYOVER positive balance is informational/non-blocking unless structural invariant fails', async () => {
      const group = createGroup('stayover-balance', {
        departureDate: '2026-09-08',
        estimatedTotal: '3000.00',
      });
      const stay = createStay('stayover-balance', group);
      const folio = createFolio('stayover-balance', group, stay, { estimatedTotal: '3000.00' });
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFolioRepoMock([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);
      folioPaymentsRepo.find?.mockResolvedValueOnce([
        {
          id: 'pay-1',
          groupMasterFolioId: folio.id,
          amount: '1000.00',
          receivedAt: new Date(),
        } as FolioPaymentEntity,
      ]);

      const result = await collector.collect(mockPropertyId, businessDate);

      const item = result.items[0];
      expect(item.reviewState).toBe(NightAuditStayReviewState.STAYOVER);
      expect(item.totalCharges).toBe(3000);
      expect(item.totalPayments).toBe(1000);
      expect(item.balanceDue).toBe(2000);
      expect(item.financialException).toBe(true); // informational flag
      expect(item.operationalException).toBe(false);
      expect(item.blocking).toBe(false); // NON-BLOCKING for STAYOVER
      expect(result.blockingCount).toBe(0);
      expect(result.summary.financialExceptions).toBe(1);
    });

    it('O. missing required master folio handled according to existing invariant and blocks even for STAYOVER', async () => {
      const group = createGroup('missing-folio', {
        departureDate: '2026-09-08',
        estimatedTotal: '1000.00',
      });
      const stay = createStay('missing-folio', group);
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([]); // No folio found
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, businessDate);

      const item = result.items[0];
      expect(item.masterFolioId).toBeNull();
      expect(item.masterFolioStatus).toBeNull();
      expect(item.financialException).toBe(true);
      expect(item.checkoutEligible).toBe(false);
      expect(item.blocking).toBe(true); // Structural invariant failure blocks!
      expect(result.blockingCount).toBe(1);
      // When master folio is missing, OPEN_MASTER_FOLIO is not offered
      expect(item.actions).toEqual([
        { type: 'OPEN_GROUP' },
        { type: 'EXTEND_GROUP_STAY' },
      ]);
    });
  });

  describe('P, Q, R, S: Financial logic, businessDate purity, deterministic sort, read-only', () => {
    it('P. group totals/payments/balance use existing authoritative group financial logic', async () => {
      const group = createGroup('fin-calc', {
        departureDate: '2026-09-08',
        estimatedTotal: '2000.00',
      });
      const stay = createStay('fin-calc', group);
      const folio = createFolio('fin-calc', group, stay, {
        estimatedTotal: '2200.00',
      });
      // Add extra charges on folio
      (folio as unknown as { charges: Array<{ amount: number }> }).charges = [
        { amount: 150 },
        { amount: 50 },
      ];
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);
      folioPaymentsRepo.find?.mockResolvedValueOnce([
        {
          id: 'p1',
          groupMasterFolioId: folio.id,
          amount: '1400.00',
          receivedAt: new Date(),
        } as FolioPaymentEntity,
      ]);

      const result = await collector.collect(mockPropertyId, businessDate);

      const item = result.items[0];
      // 2200 + 150 + 50 = 2400 total charges
      expect(item.totalCharges).toBe(2400);
      expect(item.estimatedTotal).toBe(2400);
      expect(item.totalPayments).toBe(1400);
      expect(item.totalPaid).toBe(1400);
      // 2400 - 1400 = 1000 balance due
      expect(item.balanceDue).toBe(1000);
    });

    it('Q. classification uses run.businessDate, not wall clock', async () => {
      // Suppose wall clock is today in 2026. Departure is 2026-08-01.
      // If businessDate is 2026-07-15:
      // departureDate (2026-08-01) > businessDate (2026-07-15) => STAYOVER!
      const group = createGroup('pure-date', {
        departureDate: '2026-08-01',
        estimatedTotal: '0',
      });
      const stay = createStay('pure-date', group);
      const folio = createFolio('pure-date', group, stay, { estimatedTotal: '0' });
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      const result = await collector.collect(mockPropertyId, '2026-07-15');

      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.STAYOVER);
    });

    it('R. deterministic ordering: OVERDUE -> DUE_OUT -> STAYOVER', async () => {
      const groupStayover = createGroup('stayover-item', {
        groupCode: 'GRP-B',
        departureDate: '2026-09-08',
      });
      const stayStayover = createStay('stayover-item', groupStayover);

      const groupDueOut = createGroup('dueout-item', {
        groupCode: 'GRP-C',
        departureDate: businessDate,
      });
      const stayDueOut = createStay('dueout-item', groupDueOut);

      const groupOverdue = createGroup('overdue-item', {
        groupCode: 'GRP-A',
        departureDate: '2026-09-02',
      });
      const stayOverdue = createStay('overdue-item', groupOverdue);

      groupStaysRepo.find?.mockResolvedValueOnce([stayStayover, stayDueOut, stayOverdue]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([
        createFolio('s', groupStayover, stayStayover),
        createFolio('d', groupDueOut, stayDueOut),
        createFolio('o', groupOverdue, stayOverdue),
      ]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([
        createAssignment('s', groupStayover.id, '101'),
        createAssignment('d', groupDueOut.id, '102'),
        createAssignment('o', groupOverdue.id, '103'),
      ]);

      const result = await collector.collect(mockPropertyId, businessDate);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].reviewState).toBe(NightAuditStayReviewState.OVERDUE);
      expect(result.items[1].reviewState).toBe(NightAuditStayReviewState.DUE_OUT);
      expect(result.items[2].reviewState).toBe(NightAuditStayReviewState.STAYOVER);
    });

    it('S. collector performs no writes', async () => {
      const group = createGroup('readonly-check', { departureDate: businessDate });
      const stay = createStay('readonly-check', group);
      const folio = createFolio('readonly-check', group, stay);
      const assignment = createAssignment('1', group.id, '101');

      groupStaysRepo.find?.mockResolvedValueOnce([stay]);
      groupMasterFoliosRepo.find?.mockResolvedValueOnce([folio]);
      roomAssignmentsRepo.find?.mockResolvedValueOnce([assignment]);

      await collector.collect(mockPropertyId, businessDate);

      expect(groupStaysRepo.save).not.toHaveBeenCalled();
      expect(groupStaysRepo.update).not.toHaveBeenCalled();
      expect(groupStaysRepo.delete).not.toHaveBeenCalled();

      expect(roomAssignmentsRepo.save).not.toHaveBeenCalled();
      expect(roomAssignmentsRepo.update).not.toHaveBeenCalled();
      expect(roomAssignmentsRepo.delete).not.toHaveBeenCalled();

      expect(groupMasterFoliosRepo.save).not.toHaveBeenCalled();
      expect(groupMasterFoliosRepo.update).not.toHaveBeenCalled();
      expect(groupMasterFoliosRepo.delete).not.toHaveBeenCalled();

      expect(folioPaymentsRepo.save).not.toHaveBeenCalled();
      expect(folioPaymentsRepo.update).not.toHaveBeenCalled();
      expect(folioPaymentsRepo.delete).not.toHaveBeenCalled();
    });
  });

  function groupMasterFolioRepoMock(folios: GroupMasterFolioEntity[]) {
    groupMasterFoliosRepo.find?.mockResolvedValueOnce(folios);
  }
});
