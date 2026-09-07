import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { NightAuditRunStatus } from './domain/night-audit-run-status.enum';
import { NightAuditWorkspaceDto } from './dto/night-audit-workspace.dto';
import { NightAuditRunEntity } from './infrastructure/night-audit-run.entity';
import { NightAuditController } from './night-audit.controller';
import { NightAuditService } from './night-audit.service';

describe('NightAuditController', () => {
  let controller: NightAuditController;
  let service: { getOrCreateOpenRun: jest.Mock; closeRun: jest.Mock };

  const mockPropertyId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '99999999-9999-9999-9999-999999999999';

  const mockRun: NightAuditRunEntity = {
    id: 'run-uuid-1',
    propertyId: mockPropertyId,
    businessDate: '2026-09-04',
    status: NightAuditRunStatus.OPEN,
    startedByUserId: mockUserId,
    startedAt: new Date('2026-09-04T12:00:00Z'),
    completedByUserId: null,
    completedAt: null,
    summary: null,
    completionSnapshot: null,
    completionSnapshotVersion: null,
    createdAt: new Date('2026-09-04T12:00:00Z'),
    updatedAt: new Date('2026-09-04T12:00:00Z'),
  };

  const mockCompletedRun: NightAuditRunEntity = {
    id: 'run-uuid-1',
    propertyId: mockPropertyId,
    businessDate: '2026-09-04',
    status: NightAuditRunStatus.COMPLETED,
    startedByUserId: mockUserId,
    startedAt: new Date('2026-09-04T12:00:00Z'),
    completedByUserId: mockUserId,
    completedAt: new Date('2026-09-04T23:59:00Z'),
    summary: {
      businessDate: '2026-09-04',
      nextBusinessDate: '2026-09-05',
      validation: {
        totalBlockingCount: 0,
        blockers: {
          pendingArrivals: 0,
          stayReview: 0,
          folioExceptions: 0,
          groupReview: 0,
        },
      },
      workspaceCounts: {
        pendingArrivals: 1,
        stayReview: 1,
        folioExceptions: 1,
        groupReview: 0,
      },
    },
    completionSnapshot: null,
    completionSnapshotVersion: null,
    createdAt: new Date('2026-09-04T12:00:00Z'),
    updatedAt: new Date('2026-09-04T23:59:00Z'),
  };

  const mockWorkspace: NightAuditWorkspaceDto = {
    pendingArrivals: {
      count: 1,
      blockingCount: 1,
      items: [
        {
          reservationId: 'res-1',
          confirmationNumber: 'RES-001',
          guestId: 'guest-1',
          guestName: 'John Doe',
          arrivalDate: '2026-09-04',
          departureDate: '2026-09-06',
          status: 'CONFIRMED' as any,
          roomId: 'room-1',
          roomNumber: '101',
          roomTypeId: 'type-1',
          actions: [{ type: 'OPEN_BOOKING' }, { type: 'CHECK_IN' }],
        },
      ],
    },
    stayReview: {
      count: 1,
      blockingCount: 1,
      summary: {
        stayover: 0,
        dueOut: 1,
        overdue: 0,
      },
      items: [
        {
          reservationId: 'res-stay-1',
          confirmationNumber: 'RES-S001',
          guestId: 'guest-2',
          guestName: 'Jane Smith',
          arrivalDate: '2026-09-01',
          departureDate: '2026-09-04',
          status: 'CHECKED_IN' as any,
          reviewState: 'DUE_OUT' as any,
          blocking: true,
          roomId: 'room-2',
          roomNumber: '102',
          roomTypeId: 'type-1',
          roomAssignmentMissing: false,
          actions: [{ type: 'OPEN_STAY' }, { type: 'EXTEND_STAY' }, { type: 'CHECK_OUT' }],
        },
      ],
    },
    folioExceptions: {
      count: 1,
      blockingCount: 1,
      summary: {
        outstandingBalance: 1,
        unsettledZeroBalance: 0,
        missingFolio: 0,
      },
      items: [
        {
          reservationId: 'res-stay-1',
          confirmationNumber: 'RES-S001',
          guestId: 'guest-2',
          guestName: 'Jane Smith',
          departureDate: '2026-09-04',
          roomId: 'room-2',
          roomNumber: '102',
          folioId: 'folio-1',
          folioStatus: 'OPEN' as any,
          stayReviewState: 'DUE_OUT' as any,
          totalCharges: '1000.00',
          totalPayments: '0.00',
          totalRefunds: '0.00',
          balanceDue: '1000.00',
          exceptionType: 'OUTSTANDING_BALANCE' as any,
          blocking: true,
          actions: [{ type: 'OPEN_FOLIO' }, { type: 'RECORD_PAYMENT' }, { type: 'OPEN_STAY' }],
        },
      ],
    },
    groupReview: {
      count: 0,
      blockingCount: 0,
      summary: {
        stayover: 0,
        dueOut: 0,
        overdue: 0,
        financialExceptions: 0,
        operationalExceptions: 0,
      },
      items: [],
    },
  };

  const mockValidation = {
    canClose: false,
    totalBlockingCount: 3,
    blockers: {
      pendingArrivals: 1,
      stayReview: 1,
      folioExceptions: 1,
      groupReview: 0,
    },
    reasons: [
      { code: 'PENDING_ARRIVALS', count: 1 },
      { code: 'DUE_OUT_OR_OVERDUE_STAYS', count: 1 },
      { code: 'FOLIO_EXCEPTIONS', count: 1 },
    ],
  };

  beforeEach(async () => {
    service = {
      getOrCreateOpenRun: jest
        .fn()
        .mockResolvedValue({ run: mockRun, workspace: mockWorkspace, validation: mockValidation }),
      closeRun: jest
        .fn()
        .mockResolvedValue({ run: mockCompletedRun, nextBusinessDate: '2026-09-05' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NightAuditController],
      providers: [
        {
          provide: NightAuditService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<NightAuditController>(NightAuditController);
  });

  describe('getOrCreateOpenRun', () => {
    it('delegates getOrCreateOpenRun to service and returns mapped response with workspace and validation', async () => {
      const mockUser = { id: mockUserId } as AuthenticatedRequest['currentUser'];

      const response = await controller.getOrCreateOpenRun(mockPropertyId, mockUser);

      expect(service.getOrCreateOpenRun).toHaveBeenCalledWith(mockPropertyId, mockUserId);
      expect(response).toEqual({
        id: mockRun.id,
        propertyId: mockRun.propertyId,
        businessDate: mockRun.businessDate,
        status: mockRun.status,
        startedAt: mockRun.startedAt,
        startedByUserId: mockRun.startedByUserId,
        completedByUserId: null,
        completedAt: null,
        summary: null,
        createdAt: mockRun.createdAt,
        updatedAt: mockRun.updatedAt,
        workspace: mockWorkspace,
        validation: mockValidation,
      });
    });

    it('uses default fallback uuid if user is undefined', async () => {
      await controller.getOrCreateOpenRun(mockPropertyId, undefined);

      expect(service.getOrCreateOpenRun).toHaveBeenCalledWith(
        mockPropertyId,
        '00000000-0000-0000-0000-000000000001',
      );
    });

    it('is protected with night-audit.manage permission metadata', () => {
      const reflector = new Reflector();
      const permissions = reflector.get<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        NightAuditController.prototype.getOrCreateOpenRun,
      );

      expect(permissions).toBeDefined();
      expect(permissions).toContain(Permissions.NightAuditManage);
    });
  });

  describe('closeRun (NA-3B atomic close)', () => {
    it('delegates closeRun to service and returns mapped response with nextBusinessDate and summary', async () => {
      const mockUser = { id: mockUserId } as AuthenticatedRequest['currentUser'];

      const response = await controller.closeRun(mockPropertyId, mockUser);

      expect(service.closeRun).toHaveBeenCalledWith(mockPropertyId, mockUserId);
      expect(response).toEqual({
        id: mockCompletedRun.id,
        propertyId: mockCompletedRun.propertyId,
        businessDate: mockCompletedRun.businessDate,
        status: mockCompletedRun.status,
        startedAt: mockCompletedRun.startedAt,
        startedByUserId: mockCompletedRun.startedByUserId,
        completedByUserId: mockCompletedRun.completedByUserId,
        completedAt: mockCompletedRun.completedAt,
        summary: mockCompletedRun.summary,
        nextBusinessDate: '2026-09-05',
        createdAt: mockCompletedRun.createdAt,
        updatedAt: mockCompletedRun.updatedAt,
      });
    });

    it('uses default fallback uuid if user is undefined', async () => {
      await controller.closeRun(mockPropertyId, undefined);

      expect(service.closeRun).toHaveBeenCalledWith(
        mockPropertyId,
        '00000000-0000-0000-0000-000000000001',
      );
    });

    it('W: is protected with night-audit.manage permission metadata', () => {
      const reflector = new Reflector();
      const permissions = reflector.get<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        NightAuditController.prototype.closeRun,
      );

      expect(permissions).toBeDefined();
      expect(permissions).toContain(Permissions.NightAuditManage);
    });
  });
});
