import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { PropertyEntity } from '../properties/infrastructure/property.entity';
import {
  advanceCalendarDay,
  BusinessDateService,
} from '../properties/services/business-date.service';
import { NightAuditFolioExceptionsCollector } from './collectors/night-audit-folio-exceptions.collector';
import { NightAuditGroupReviewCollector } from './collectors/night-audit-group-review.collector';
import { NightAuditPendingArrivalsCollector } from './collectors/night-audit-pending-arrivals.collector';
import { NightAuditStayReviewCollector } from './collectors/night-audit-stay-review.collector';
import { NightAuditRunStatus } from './domain/night-audit-run-status.enum';
import {
  NightAuditValidationDto,
  NightAuditValidationReasonCode,
} from './dto/night-audit-validation.dto';
import {
  NightAuditFolioExceptionType,
  NightAuditStayReviewState,
  NightAuditWorkspaceDto,
} from './dto/night-audit-workspace.dto';
import { NightAuditRunEntity } from './infrastructure/night-audit-run.entity';
import { NightAuditService } from './night-audit.service';
import { NightAuditPreCloseValidator } from './validators/night-audit-pre-close.validator';
import { BillingService } from '../billing/billing.service';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('NightAuditService', () => {
  let service: NightAuditService;
  let nightAuditRunRepo: MockRepository<NightAuditRunEntity>;
  let propertiesRepo: MockRepository<PropertyEntity>;
  let auditRepo: MockRepository<AuditEventEntity>;
  let businessDateService: Partial<BusinessDateService>;
  let pendingArrivalsCollector: { collect: jest.Mock };
  let stayReviewCollector: { collect: jest.Mock };
  let folioExceptionsCollector: { collect: jest.Mock };
  let groupReviewCollector: { collect: jest.Mock };
  let preCloseValidator: { validate: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  let txRunRepo: MockRepository<NightAuditRunEntity>;
  let txAuditRepo: MockRepository<AuditEventEntity>;
  let txPropertyRepo: MockRepository<PropertyEntity>;

  const mockPropertyId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '99999999-9999-9999-9999-999999999999';
  const persistedBusinessDate = '2026-09-04';

  const mockProperty = {
    id: mockPropertyId,
    name: 'Hillston Hotel',
    currentBusinessDate: persistedBusinessDate,
  } as PropertyEntity;

  const mockRun: NightAuditRunEntity = {
    id: 'run-uuid-1',
    propertyId: mockPropertyId,
    businessDate: persistedBusinessDate,
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

  const mockPendingArrivals = {
    count: 2,
    blockingCount: 2,
    items: [
      {
        reservationId: 'res-1',
        confirmationNumber: 'RES-001',
        guestId: 'guest-1',
        guestName: 'Guest One',
        arrivalDate: persistedBusinessDate,
        departureDate: '2026-09-06',
        status: 'CONFIRMED' as const,
        roomId: 'room-1',
        roomNumber: '101',
        roomTypeId: 'type-1',
        actions: [{ type: 'OPEN_BOOKING' }, { type: 'CHECK_IN' }],
      },
      {
        reservationId: 'res-2',
        confirmationNumber: 'RES-002',
        guestId: 'guest-2',
        guestName: 'Guest Two',
        arrivalDate: persistedBusinessDate,
        departureDate: '2026-09-07',
        status: 'PENDING' as const,
        roomId: null,
        roomNumber: null,
        roomTypeId: 'type-1',
        actions: [{ type: 'OPEN_BOOKING' }, { type: 'CONFIRM' }],
      },
    ],
  };

  const mockStayReview = {
    count: 2,
    blockingCount: 1,
    summary: {
      stayover: 1,
      dueOut: 1,
      overdue: 0,
    },
    items: [
      {
        reservationId: 'res-stay-1',
        confirmationNumber: 'RES-S01',
        reservationCode: 'RES-S01',
        guestId: 'guest-s1',
        guestName: 'Stay Due Out Guest',
        arrivalDate: '2026-09-01',
        departureDate: persistedBusinessDate,
        roomId: 'room-1',
        roomNumber: '101',
        roomTypeId: 'type-1',
        status: 'CHECKED_IN' as const,
        reviewState: NightAuditStayReviewState.DUE_OUT,
        blocking: true,
        roomAssignmentMissing: false,
        actions: [{ type: 'OPEN_STAY' }, { type: 'EXTEND_STAY' }, { type: 'CHECK_OUT' }],
      },
      {
        reservationId: 'res-stay-2',
        confirmationNumber: 'RES-S02',
        reservationCode: 'RES-S02',
        guestId: 'guest-s2',
        guestName: 'Stayover Guest',
        arrivalDate: '2026-09-02',
        departureDate: '2026-09-06',
        roomId: 'room-2',
        roomNumber: '102',
        roomTypeId: 'type-1',
        status: 'CHECKED_IN' as const,
        reviewState: NightAuditStayReviewState.STAYOVER,
        blocking: false,
        roomAssignmentMissing: false,
        actions: [{ type: 'OPEN_STAY' }, { type: 'EXTEND_STAY' }],
      },
    ],
  };

  const mockFolioExceptions = {
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
        confirmationNumber: 'RES-S01',
        reservationCode: 'RES-S01',
        guestId: 'guest-s1',
        guestName: 'Stay Due Out Guest',
        departureDate: persistedBusinessDate,
        roomId: 'room-1',
        roomNumber: '101',
        folioId: 'folio-1',
        folioStatus: 'OPEN' as any,
        stayReviewState: NightAuditStayReviewState.DUE_OUT,
        totalCharges: '1000.00',
        totalPayments: '0.00',
        totalRefunds: '0.00',
        balanceDue: '1000.00',
        exceptionType: NightAuditFolioExceptionType.OUTSTANDING_BALANCE,
        blocking: true,
        actions: [{ type: 'OPEN_FOLIO' }, { type: 'RECORD_PAYMENT' }, { type: 'OPEN_STAY' }],
      },
    ],
  };

  const mockGroupReview = {
    count: 1,
    blockingCount: 1,
    summary: {
      stayover: 0,
      dueOut: 1,
      overdue: 0,
      financialExceptions: 1,
      operationalExceptions: 0,
    },
    items: [
      {
        groupBookingId: 'grp-1',
        groupCode: 'GRP-001',
        groupName: 'Test Group',
        leadGuestName: 'Lead Guest',
        leadName: 'Lead Guest',
        arrivalDate: '2026-09-01',
        departureDate: persistedBusinessDate,
        groupBookingStatus: 'CHECKED_IN' as any,
        groupStayStatus: 'IN_HOUSE',
        reviewState: NightAuditStayReviewState.DUE_OUT,
        assignedRoomCount: 1,
        assignedRooms: [{ roomId: 'room-1', roomNumber: '101' }],
        roomAssignmentMissing: false,
        masterFolioId: 'folio-grp-1',
        masterFolioStatus: 'OPEN',
        totalCharges: 1000,
        estimatedTotal: 1000,
        totalPayments: 0,
        totalPaid: 0,
        balanceDue: 1000,
        checkoutEligible: false,
        financialException: true,
        operationalException: false,
        blocking: true,
        actions: [
          { type: 'OPEN_GROUP' },
          { type: 'OPEN_MASTER_FOLIO' },
          { type: 'EXTEND_GROUP_STAY' },
          { type: 'CHECK_OUT_GROUP' },
        ],
      },
    ],
  };

  const mockValidation: NightAuditValidationDto = {
    canClose: false,
    totalBlockingCount: 5,
    blockers: {
      pendingArrivals: 2,
      stayReview: 1,
      folioExceptions: 1,
      groupReview: 1,
    },
    reasons: [
      { code: NightAuditValidationReasonCode.PENDING_ARRIVALS, count: 2 },
      { code: NightAuditValidationReasonCode.DUE_OUT_OR_OVERDUE_STAYS, count: 1 },
      { code: NightAuditValidationReasonCode.FOLIO_EXCEPTIONS, count: 1 },
      { code: NightAuditValidationReasonCode.GROUP_EXCEPTIONS, count: 1 },
    ],
  };

  const mockCleanWorkspace: NightAuditWorkspaceDto = {
    pendingArrivals: {
      count: 0,
      blockingCount: 0,
      items: [],
    },
    stayReview: {
      count: 5,
      blockingCount: 0,
      summary: {
        stayover: 5,
        dueOut: 0,
        overdue: 0,
      },
      items: [],
    },
    folioExceptions: {
      count: 0,
      blockingCount: 0,
      summary: {
        outstandingBalance: 0,
        unsettledZeroBalance: 0,
        missingFolio: 0,
      },
      items: [],
    },
    groupReview: {
      count: 1,
      blockingCount: 0,
      summary: {
        stayover: 1,
        dueOut: 0,
        overdue: 0,
        financialExceptions: 0,
        operationalExceptions: 0,
      },
      items: [],
    },
  };

  const mockCleanValidation: NightAuditValidationDto = {
    canClose: true,
    totalBlockingCount: 0,
    blockers: {
      pendingArrivals: 0,
      stayReview: 0,
      folioExceptions: 0,
      groupReview: 0,
    },
    reasons: [],
  };

  beforeEach(async () => {
    nightAuditRunRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    propertiesRepo = {
      findOne: jest.fn().mockResolvedValue(mockProperty),
      save: jest.fn(),
    };

    auditRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    txRunRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 'run-uuid-new' })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'run-uuid-new' })),
      findOne: jest.fn().mockResolvedValue({ ...mockRun }),
    };

    txAuditRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 'audit-uuid-1' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    txPropertyRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockProperty }),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const txReservationRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    dataSource = {
      transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) => {
        const fakeManager = {
          getRepository: (entity: unknown) => {
            if (entity === NightAuditRunEntity) return txRunRepo;
            if (entity === AuditEventEntity) return txAuditRepo;
            if (entity === PropertyEntity) return txPropertyRepo;
            if (entity === ReservationEntity) return txReservationRepo;
            throw new Error(`Unexpected entity in transaction: ${entity}`);
          },
        } as unknown as EntityManager;
        return callback(fakeManager);
      }),
    };

    businessDateService = {
      getAuthoritativeDate: jest.fn().mockReturnValue(persistedBusinessDate),
      advanceBusinessDate: jest.fn((date: string) => advanceCalendarDay(date)),
    };

    pendingArrivalsCollector = {
      collect: jest.fn().mockResolvedValue(mockPendingArrivals),
    };

    stayReviewCollector = {
      collect: jest.fn().mockResolvedValue(mockStayReview),
    };

    folioExceptionsCollector = {
      collect: jest.fn().mockResolvedValue(mockFolioExceptions),
    };

    groupReviewCollector = {
      collect: jest.fn().mockResolvedValue(mockGroupReview),
    };

    preCloseValidator = {
      validate: jest.fn().mockReturnValue(mockValidation),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NightAuditService,
        {
          provide: getRepositoryToken(NightAuditRunEntity),
          useValue: nightAuditRunRepo,
        },
        {
          provide: getRepositoryToken(PropertyEntity),
          useValue: propertiesRepo,
        },
        {
          provide: getRepositoryToken(AuditEventEntity),
          useValue: auditRepo,
        },
        {
          provide: BusinessDateService,
          useValue: businessDateService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: BillingService,
          useValue: {
            postNightlyAccommodationChargeOnManager: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NightAuditPendingArrivalsCollector,
          useValue: pendingArrivalsCollector,
        },
        {
          provide: NightAuditStayReviewCollector,
          useValue: stayReviewCollector,
        },
        {
          provide: NightAuditFolioExceptionsCollector,
          useValue: folioExceptionsCollector,
        },
        {
          provide: NightAuditGroupReviewCollector,
          useValue: groupReviewCollector,
        },
        {
          provide: NightAuditPreCloseValidator,
          useValue: preCloseValidator,
        },
      ],
    }).compile();

    service = module.get<NightAuditService>(NightAuditService);
  });

  describe('getOrCreateOpenRun', () => {
    it('throws NotFoundException if property does not exist', async () => {
      propertiesRepo.findOne?.mockResolvedValue(null);

      await expect(service.getOrCreateOpenRun('non-existent-id', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      expect(propertiesRepo.save).not.toHaveBeenCalled();
      expect(pendingArrivalsCollector.collect).not.toHaveBeenCalled();
      expect(stayReviewCollector.collect).not.toHaveBeenCalled();
      expect(folioExceptionsCollector.collect).not.toHaveBeenCalled();
    });

    it('first call creates OPEN run using persisted currentBusinessDate and returns workspace', async () => {
      nightAuditRunRepo.findOne
        ?.mockResolvedValueOnce(null) // no existing open run
        .mockResolvedValueOnce(null); // no existing run for date

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(businessDateService.getAuthoritativeDate).toHaveBeenCalledWith(mockProperty);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(txRunRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: mockPropertyId,
          businessDate: persistedBusinessDate,
          status: NightAuditRunStatus.OPEN,
          startedByUserId: mockUserId,
        }),
      );
      expect(txRunRepo.save).toHaveBeenCalled();
      expect(result.run.businessDate).toBe(persistedBusinessDate);
      expect(result.run.status).toBe(NightAuditRunStatus.OPEN);
      expect(result.workspace.pendingArrivals).toEqual(mockPendingArrivals);
      expect(result.workspace.stayReview).toEqual(mockStayReview);
      expect(result.workspace.folioExceptions).toEqual(mockFolioExceptions);
      expect(result.workspace.groupReview).toEqual(mockGroupReview);
      expect(result.validation).toEqual(mockValidation);
      expect(preCloseValidator.validate).toHaveBeenCalledWith(result.workspace);
      expect(pendingArrivalsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        persistedBusinessDate,
      );
      expect(stayReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        persistedBusinessDate,
      );
      expect(folioExceptionsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        persistedBusinessDate,
      );
      expect(groupReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        persistedBusinessDate,
      );
      // Invariant: currentBusinessDate is never modified/advanced
      expect(propertiesRepo.save).not.toHaveBeenCalled();
    });

    it('second call returns the same OPEN run without re-creating or emitting STARTED again', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(result.run).toEqual(mockRun);
      expect(result.workspace.pendingArrivals).toEqual(mockPendingArrivals);
      expect(result.workspace.stayReview).toEqual(mockStayReview);
      expect(result.workspace.folioExceptions).toEqual(mockFolioExceptions);
      expect(result.workspace.groupReview).toEqual(mockGroupReview);
      expect(result.validation).toEqual(mockValidation);
      expect(preCloseValidator.validate).toHaveBeenCalledWith(result.workspace);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txRunRepo.save).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
      expect(pendingArrivalsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(stayReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(folioExceptionsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(groupReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      // Invariant: currentBusinessDate is never modified/advanced
      expect(propertiesRepo.save).not.toHaveBeenCalled();
    });

    it('duplicate run for same property/businessDate is prevented when already completed', async () => {
      nightAuditRunRepo.findOne
        ?.mockResolvedValueOnce(null) // no open run
        .mockResolvedValueOnce({
          ...mockRun,
          status: NightAuditRunStatus.COMPLETED,
        }); // completed run exists for current business date

      await expect(service.getOrCreateOpenRun(mockPropertyId, mockUserId)).rejects.toThrow(
        new ConflictException(
          `Night Audit run for business date ${persistedBusinessDate} has already been completed.`,
        ),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(propertiesRepo.save).not.toHaveBeenCalled();
      expect(pendingArrivalsCollector.collect).not.toHaveBeenCalled();
      expect(stayReviewCollector.collect).not.toHaveBeenCalled();
      expect(folioExceptionsCollector.collect).not.toHaveBeenCalled();
      expect(groupReviewCollector.collect).not.toHaveBeenCalled();
    });

    it('OPEN run for a different businessDate causes a conflict/invariant error', async () => {
      const openRunDifferentDate: NightAuditRunEntity = {
        ...mockRun,
        businessDate: '2026-09-03', // different date
      };
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(openRunDifferentDate);

      await expect(service.getOrCreateOpenRun(mockPropertyId, mockUserId)).rejects.toThrow(
        new ConflictException(
          `An open Night Audit run (${openRunDifferentDate.id}) exists for business date ${openRunDifferentDate.businessDate}, which does not match current business date ${persistedBusinessDate}.`,
        ),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(propertiesRepo.save).not.toHaveBeenCalled();
      expect(pendingArrivalsCollector.collect).not.toHaveBeenCalled();
      expect(stayReviewCollector.collect).not.toHaveBeenCalled();
      expect(folioExceptionsCollector.collect).not.toHaveBeenCalled();
      expect(groupReviewCollector.collect).not.toHaveBeenCalled();
    });

    it('emits NIGHT_AUDIT_STARTED once when creating a new run', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(txAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: mockPropertyId,
          actorId: mockUserId,
          entityType: 'NightAuditRun',
          action: 'NIGHT_AUDIT_STARTED',
          metadata: {
            businessDate: persistedBusinessDate,
          },
        }),
      );
      expect(txAuditRepo.save).toHaveBeenCalledTimes(1);
    });

    it('resuming an existing run does not emit NIGHT_AUDIT_STARTED again', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(txAuditRepo.save).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('concurrent creation / unique-constraint race safely re-reads and returns the winning run with workspace', async () => {
      nightAuditRunRepo.findOne
        ?.mockResolvedValueOnce(null) // first check: no open run
        .mockResolvedValueOnce(null); // second check: no run for date

      const duplicateKeyError = new QueryFailedError(
        'INSERT INTO...',
        [],
        new Error('duplicate key'),
      );
      (duplicateKeyError as unknown as { driverError: { code: string } }).driverError = {
        code: '23505',
      };

      dataSource.transaction.mockRejectedValueOnce(duplicateKeyError);

      // Concurrency re-read finds the winning OPEN run
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(result.run).toEqual(mockRun);
      expect(result.workspace.pendingArrivals).toEqual(mockPendingArrivals);
      expect(result.workspace.stayReview).toEqual(mockStayReview);
      expect(result.workspace.folioExceptions).toEqual(mockFolioExceptions);
      expect(result.workspace.groupReview).toEqual(mockGroupReview);
      expect(result.validation).toEqual(mockValidation);
      expect(preCloseValidator.validate).toHaveBeenCalledWith(result.workspace);
      expect(nightAuditRunRepo.findOne).toHaveBeenCalledWith({
        where: { propertyId: mockPropertyId, status: NightAuditRunStatus.OPEN },
      });
      expect(pendingArrivalsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(stayReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(folioExceptionsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(groupReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(propertiesRepo.save).not.toHaveBeenCalled();
    });

    it('concurrent creation failure throws ConflictException if re-read does not match businessDate', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const duplicateKeyError = new QueryFailedError(
        'INSERT INTO...',
        [],
        new Error('duplicate key'),
      );
      (duplicateKeyError as unknown as { driverError: { code: string } }).driverError = {
        code: '23505',
      };

      dataSource.transaction.mockRejectedValueOnce(duplicateKeyError);

      // Re-read returns run with mismatched date
      nightAuditRunRepo.findOne?.mockResolvedValueOnce({
        ...mockRun,
        businessDate: '2026-09-02',
      });

      await expect(service.getOrCreateOpenRun(mockPropertyId, mockUserId)).rejects.toThrow(
        new ConflictException('A concurrent night audit run creation conflict occurred.'),
      );
      expect(pendingArrivalsCollector.collect).not.toHaveBeenCalled();
      expect(stayReviewCollector.collect).not.toHaveBeenCalled();
      expect(folioExceptionsCollector.collect).not.toHaveBeenCalled();
      expect(groupReviewCollector.collect).not.toHaveBeenCalled();
    });

    it('unrelated database errors are not swallowed and rethrow', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const foreignKeyError = new QueryFailedError(
        'INSERT INTO...',
        [],
        new Error('foreign key constraint'),
      );
      (foreignKeyError as unknown as { driverError: { code: string } }).driverError = {
        code: '23503',
      };

      dataSource.transaction.mockRejectedValueOnce(foreignKeyError);

      await expect(service.getOrCreateOpenRun(mockPropertyId, mockUserId)).rejects.toThrow(
        foreignKeyError,
      );
      expect(pendingArrivalsCollector.collect).not.toHaveBeenCalled();
      expect(stayReviewCollector.collect).not.toHaveBeenCalled();
      expect(folioExceptionsCollector.collect).not.toHaveBeenCalled();
      expect(groupReviewCollector.collect).not.toHaveBeenCalled();
    });

    it('general non-database errors are not swallowed and rethrow', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const genericError = new Error('Database connection reset');
      dataSource.transaction.mockRejectedValueOnce(genericError);

      await expect(service.getOrCreateOpenRun(mockPropertyId, mockUserId)).rejects.toThrow(
        genericError,
      );
      expect(pendingArrivalsCollector.collect).not.toHaveBeenCalled();
      expect(stayReviewCollector.collect).not.toHaveBeenCalled();
      expect(folioExceptionsCollector.collect).not.toHaveBeenCalled();
      expect(groupReviewCollector.collect).not.toHaveBeenCalled();
    });

    it('M & R. read-only guarantee: workspace retrieval does not mutate reservations, folios, or business date', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      // Verify propertiesRepository.save was never called
      expect(propertiesRepo.save).not.toHaveBeenCalled();
      // Verify no write transactions were opened
      expect(dataSource.transaction).not.toHaveBeenCalled();
      // Collectors were queried in read-only fashion
      expect(pendingArrivalsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(stayReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(folioExceptionsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(groupReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(result.run.status).toBe(NightAuditRunStatus.OPEN);
    });

    it('N & O & S. pendingArrivals and stayReview sections remain completely unchanged alongside folioExceptions', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(result.workspace).toHaveProperty('pendingArrivals');
      expect(result.workspace).toHaveProperty('stayReview');
      expect(result.workspace).toHaveProperty('folioExceptions');
      expect(result.workspace).toHaveProperty('groupReview');
      expect(result.workspace.pendingArrivals).toEqual(mockPendingArrivals);
      expect(result.workspace.stayReview).toEqual(mockStayReview);
      expect(result.workspace.folioExceptions).toEqual(mockFolioExceptions);
      expect(result.workspace.groupReview).toEqual(mockGroupReview);
      expect(result.workspace.pendingArrivals.count).toBe(2);
      expect(result.workspace.pendingArrivals.blockingCount).toBe(2);
      expect(result.workspace.stayReview.count).toBe(2);
      expect(result.workspace.stayReview.blockingCount).toBe(1);
      expect(result.workspace.folioExceptions.count).toBe(1);
      expect(result.workspace.folioExceptions.blockingCount).toBe(1);
    });

    it('currentBusinessDate is never modified or advanced', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      // Verify propertiesRepository.save was never called
      expect(propertiesRepo.save).not.toHaveBeenCalled();
    });

    it('K & L. existing GET returns workspace + validation derived from same workspace without duplicate collector queries', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      expect(result).toHaveProperty('workspace');
      expect(result).toHaveProperty('validation');
      expect(preCloseValidator.validate).toHaveBeenCalledTimes(1);
      expect(preCloseValidator.validate).toHaveBeenCalledWith(result.workspace);
      expect(result.validation).toEqual(mockValidation);

      // Invariant: collectors are invoked exactly once (never called twice for validation)
      expect(pendingArrivalsCollector.collect).toHaveBeenCalledTimes(1);
      expect(stayReviewCollector.collect).toHaveBeenCalledTimes(1);
      expect(folioExceptionsCollector.collect).toHaveBeenCalledTimes(1);
      expect(groupReviewCollector.collect).toHaveBeenCalledTimes(1);
    });

    it('M & N & O. NightAuditRun remains OPEN, businessDate is not modified, and no financial/posting writes occur', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(mockRun);

      const result = await service.getOrCreateOpenRun(mockPropertyId, mockUserId);

      // Run remains strictly OPEN
      expect(result.run.status).toBe(NightAuditRunStatus.OPEN);
      expect(result.run.completedAt).toBeNull();
      expect(result.run.completedByUserId).toBeNull();

      // Property currentBusinessDate is untouched
      expect(propertiesRepo.save).not.toHaveBeenCalled();

      // No transaction or write operations performed
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txRunRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('closeRun (NA-3B atomic close)', () => {
    beforeEach(() => {
      // By default, collectors return clean workspace with zero blockers
      pendingArrivalsCollector.collect.mockResolvedValue(mockCleanWorkspace.pendingArrivals);
      stayReviewCollector.collect.mockResolvedValue(mockCleanWorkspace.stayReview);
      folioExceptionsCollector.collect.mockResolvedValue(mockCleanWorkspace.folioExceptions);
      groupReviewCollector.collect.mockResolvedValue(mockCleanWorkspace.groupReview);
      preCloseValidator.validate.mockReturnValue(mockCleanValidation);

      // By default, open run exists for current property business date
      nightAuditRunRepo.findOne?.mockResolvedValue({ ...mockRun });
      propertiesRepo.findOne?.mockResolvedValue({ ...mockProperty });
      txRunRepo.findOne?.mockResolvedValue({ ...mockRun });
      txPropertyRepo.findOne?.mockResolvedValue({ ...mockProperty });
    });

    it('A & E & F & G & H & I & M. canClose=true closes successfully: OPEN -> COMPLETED, populated fields, summary persisted, date advanced, audit event created', async () => {
      const result = await service.closeRun(mockPropertyId, mockUserId);

      // E. successful close: OPEN -> COMPLETED
      expect(result.run.status).toBe(NightAuditRunStatus.COMPLETED);

      // F. completedByUserId populated
      expect(result.run.completedByUserId).toBe(mockUserId);

      // G. completedAt populated
      expect(result.run.completedAt).toBeInstanceOf(Date);

      // H. summary persisted
      expect(result.run.summary).toEqual({
        businessDate: persistedBusinessDate,
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
          pendingArrivals: mockCleanWorkspace.pendingArrivals.count,
          stayReview: mockCleanWorkspace.stayReview.count,
          folioExceptions: mockCleanWorkspace.folioExceptions.count,
          groupReview: mockCleanWorkspace.groupReview.count,
        },
      });

      // I. property currentBusinessDate advances exactly one date
      expect(txPropertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPropertyId,
          currentBusinessDate: '2026-09-05',
        }),
      );
      expect(result.nextBusinessDate).toBe('2026-09-05');

      // M. NIGHT_AUDIT_COMPLETED event created once within same transaction
      expect(txAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: mockPropertyId,
          actorId: mockUserId,
          entityType: 'NightAuditRun',
          entityId: mockRun.id,
          action: 'NIGHT_AUDIT_COMPLETED',
          previousState: {
            status: NightAuditRunStatus.OPEN,
            businessDate: persistedBusinessDate,
          },
          nextState: expect.objectContaining({
            status: NightAuditRunStatus.COMPLETED,
            businessDate: persistedBusinessDate,
            completedByUserId: mockUserId,
          }),
          metadata: expect.objectContaining({
            businessDate: persistedBusinessDate,
            nextBusinessDate: '2026-09-05',
            totalBlockingCount: 0,
          }),
        }),
      );
      expect(txAuditRepo.save).toHaveBeenCalledTimes(1);

      // Pessimistic locking verified
      expect(txPropertyRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPropertyId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(txRunRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockRun.id, propertyId: mockPropertyId },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('B & N. blocker present => rejected with ConflictException and ZERO writes (zero DB mutations, no completion event)', async () => {
      preCloseValidator.validate.mockReturnValueOnce(mockValidation); // mockValidation has totalBlockingCount = 5

      let thrownError: any;
      try {
        await service.closeRun(mockPropertyId, mockUserId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.getResponse()).toEqual(
        expect.objectContaining({
          code: 'NIGHT_AUDIT_BLOCKED',
          businessDate: persistedBusinessDate,
          validation: mockValidation,
        }),
      );

      // B: Zero database mutations
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(propertiesRepo.save).not.toHaveBeenCalled();
      expect(txPropertyRepo.save).not.toHaveBeenCalled();
      expect(nightAuditRunRepo.save).not.toHaveBeenCalled();
      expect(txRunRepo.save).not.toHaveBeenCalled();

      // N: No completion event
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });

    it('C. no OPEN run => rejected safely without writes', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      let thrownError: any;
      try {
        await service.closeRun(mockPropertyId, mockUserId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.getResponse()).toEqual(
        expect.objectContaining({
          code: 'NIGHT_AUDIT_NOT_OPEN',
        }),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txPropertyRepo.save).not.toHaveBeenCalled();
      expect(txRunRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });

    it('D. run.businessDate !== property.currentBusinessDate => rejected safely without writes', async () => {
      nightAuditRunRepo.findOne?.mockResolvedValueOnce({
        ...mockRun,
        businessDate: '2026-09-03', // does not match property.currentBusinessDate '2026-09-04'
      });

      let thrownError: any;
      try {
        await service.closeRun(mockPropertyId, mockUserId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.getResponse()).toEqual(
        expect.objectContaining({
          code: 'NIGHT_AUDIT_DATE_MISMATCH',
        }),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txPropertyRepo.save).not.toHaveBeenCalled();
      expect(txRunRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });

    it('J. handles month transition correctly: 2026-09-30 -> 2026-10-01', async () => {
      const monthEndRun = { ...mockRun, businessDate: '2026-09-30' };
      const monthEndProperty = { ...mockProperty, currentBusinessDate: '2026-09-30' };
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(monthEndRun);
      propertiesRepo.findOne?.mockResolvedValueOnce(monthEndProperty);
      txRunRepo.findOne?.mockResolvedValueOnce(monthEndRun);
      txPropertyRepo.findOne?.mockResolvedValueOnce(monthEndProperty);

      const result = await service.closeRun(mockPropertyId, mockUserId);

      expect(result.nextBusinessDate).toBe('2026-10-01');
      expect(txPropertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBusinessDate: '2026-10-01',
        }),
      );
      expect(result.run.summary).toEqual(
        expect.objectContaining({
          businessDate: '2026-09-30',
          nextBusinessDate: '2026-10-01',
        }),
      );
    });

    it('K. handles year transition correctly: 2026-12-31 -> 2027-01-01', async () => {
      const yearEndRun = { ...mockRun, businessDate: '2026-12-31' };
      const yearEndProperty = { ...mockProperty, currentBusinessDate: '2026-12-31' };
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(yearEndRun);
      propertiesRepo.findOne?.mockResolvedValueOnce(yearEndProperty);
      txRunRepo.findOne?.mockResolvedValueOnce(yearEndRun);
      txPropertyRepo.findOne?.mockResolvedValueOnce(yearEndProperty);

      const result = await service.closeRun(mockPropertyId, mockUserId);

      expect(result.nextBusinessDate).toBe('2027-01-01');
      expect(txPropertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBusinessDate: '2027-01-01',
        }),
      );
      expect(result.run.summary).toEqual(
        expect.objectContaining({
          businessDate: '2026-12-31',
          nextBusinessDate: '2027-01-01',
        }),
      );
    });

    it('L. handles leap year transitions correctly: 2028-02-28 -> 2028-02-29 and 2028-02-29 -> 2028-03-01', async () => {
      // Leap day transition 1: 2028-02-28 -> 2028-02-29
      const leapRun1 = { ...mockRun, businessDate: '2028-02-28' };
      const leapProp1 = { ...mockProperty, currentBusinessDate: '2028-02-28' };
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(leapRun1);
      propertiesRepo.findOne?.mockResolvedValueOnce(leapProp1);
      txRunRepo.findOne?.mockResolvedValueOnce(leapRun1);
      txPropertyRepo.findOne?.mockResolvedValueOnce(leapProp1);

      const result1 = await service.closeRun(mockPropertyId, mockUserId);
      expect(result1.nextBusinessDate).toBe('2028-02-29');
      expect(txPropertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentBusinessDate: '2028-02-29' }),
      );

      // Leap day transition 2: 2028-02-29 -> 2028-03-01
      const leapRun2 = { ...mockRun, businessDate: '2028-02-29' };
      const leapProp2 = { ...mockProperty, currentBusinessDate: '2028-02-29' };
      nightAuditRunRepo.findOne?.mockResolvedValueOnce(leapRun2);
      propertiesRepo.findOne?.mockResolvedValueOnce(leapProp2);
      txRunRepo.findOne?.mockResolvedValueOnce(leapRun2);
      txPropertyRepo.findOne?.mockResolvedValueOnce(leapProp2);

      const result2 = await service.closeRun(mockPropertyId, mockUserId);
      expect(result2.nextBusinessDate).toBe('2028-03-01');
      expect(txPropertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentBusinessDate: '2028-03-01' }),
      );
    });

    it('O. repeated close does not advance business date twice or emit duplicate audit event', async () => {
      // No open run, but completed run found from previous close
      nightAuditRunRepo.findOne
        ?.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockRun, status: NightAuditRunStatus.COMPLETED });

      let thrownError: any;
      try {
        await service.closeRun(mockPropertyId, mockUserId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.getResponse()).toEqual(
        expect.objectContaining({
          code: 'NIGHT_AUDIT_ALREADY_CLOSED',
        }),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txPropertyRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });

    it('P. simulated concurrent close cannot advance business date twice (re-check status under lock)', async () => {
      // Manager 2 enters transaction, but re-reading run under lock reveals it is already COMPLETED
      txRunRepo.findOne?.mockResolvedValueOnce({
        ...mockRun,
        status: NightAuditRunStatus.COMPLETED,
        completedAt: new Date(),
        completedByUserId: 'manager-1-uuid',
      });

      let thrownError: any;
      try {
        await service.closeRun(mockPropertyId, mockUserId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.getResponse()).toEqual(
        expect.objectContaining({
          code: 'NIGHT_AUDIT_ALREADY_CLOSED',
        }),
      );
      // Under lock conflict, transaction aborted: no date advance saved, no audit event emitted
      expect(txPropertyRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });

    it('P2. simulated concurrent close cannot advance business date if property date was already changed under lock', async () => {
      // Manager 2 enters transaction, but property currentBusinessDate has already advanced to 2026-09-05
      txPropertyRepo.findOne?.mockResolvedValueOnce({
        ...mockProperty,
        currentBusinessDate: '2026-09-05',
      });

      let thrownError: any;
      try {
        await service.closeRun(mockPropertyId, mockUserId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConflictException);
      expect(thrownError.getResponse()).toEqual(
        expect.objectContaining({
          code: 'NIGHT_AUDIT_DATE_MISMATCH',
        }),
      );
      expect(txPropertyRepo.save).not.toHaveBeenCalled();
      expect(txAuditRepo.save).not.toHaveBeenCalled();
    });

    it('Q. transaction failure rolls back run/date/event logically according to transaction conventions', async () => {
      // Simulate failure on audit repo save inside transaction
      txAuditRepo.save?.mockRejectedValueOnce(new Error('Audit log failure'));

      await expect(service.closeRun(mockPropertyId, mockUserId)).rejects.toThrow(
        'Audit log failure',
      );
    });

    it('R & S. POST performs FRESH collector/validator execution and passes run.businessDate to all collectors', async () => {
      await service.closeRun(mockPropertyId, mockUserId);

      // Collectors called fresh with run.businessDate
      expect(pendingArrivalsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(stayReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(folioExceptionsCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      expect(groupReviewCollector.collect).toHaveBeenCalledWith(
        mockPropertyId,
        mockRun.businessDate,
      );
      // Validator called fresh with the freshly collected workspace
      expect(preCloseValidator.validate).toHaveBeenCalledWith(mockCleanWorkspace);
    });

    it('T & U & V. no nightly room charge posted, no folio/payment mutation, no reservation/group/room/inventory mutation', async () => {
      await service.closeRun(mockPropertyId, mockUserId);

      // Only PropertyEntity, NightAuditRunEntity, and AuditEventEntity were saved
      expect(txPropertyRepo.save).toHaveBeenCalledTimes(1);
      expect(txRunRepo.save).toHaveBeenCalledTimes(1);
      expect(txAuditRepo.save).toHaveBeenCalledTimes(1);

      // Verify no other repositories or services were invoked for mutation
      expect(propertiesRepo.save).not.toHaveBeenCalled();
      expect(nightAuditRunRepo.save).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    });
  });
});
