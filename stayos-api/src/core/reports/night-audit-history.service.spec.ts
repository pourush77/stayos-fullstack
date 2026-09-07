import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NightAuditRunStatus } from '../night-audit/domain/night-audit-run-status.enum';
import { NightAuditRunEntity } from '../night-audit/infrastructure/night-audit-run.entity';
import {
  NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION,
  NightAuditCompletionSnapshot,
} from '../night-audit/snapshots/night-audit-completion-snapshot';
import { NightAuditHistoryService } from './night-audit-history.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const asRepository = <T extends object>(repository: MockRepository<T>): Repository<T> =>
  repository as unknown as Repository<T>;

const propertyId = '11111111-1111-1111-1111-111111111111';
const otherPropertyId = '22222222-2222-2222-2222-222222222222';
const userId = '99999999-9999-9999-9999-999999999999';

describe('NightAuditHistoryService', () => {
  let repository: MockRepository<NightAuditRunEntity>;
  let service: NightAuditHistoryService;

  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    service = new NightAuditHistoryService(asRepository(repository));
  });

  it('list returns completed runs only', async () => {
    repository.find?.mockResolvedValue([run({ status: NightAuditRunStatus.COMPLETED })]);

    const result = await service.list(propertyId);

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propertyId, status: NightAuditRunStatus.COMPLETED }),
    }));
    expect(result).toHaveLength(1);
  });

  it('scopes list queries to property', async () => {
    await service.list(propertyId);

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propertyId }),
    }));
  });

  it('orders newest business date first', async () => {
    await service.list(propertyId);

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({
      order: { businessDate: 'DESC', completedAt: 'DESC' },
    }));
  });

  it('applies date filtering to businessDate', async () => {
    await service.list(propertyId, '2026-09-01', '2026-09-05');

    const call = repository.find?.mock.calls[0][0];
    expect(call.where.businessDate._type).toBe('between');
    expect(call.where.businessDate._value).toEqual(['2026-09-01', '2026-09-05']);
  });

  it('maps snapshot-backed rows from completionSnapshot', async () => {
    repository.find?.mockResolvedValue([run({ completionSnapshot: snapshot() })]);

    await expect(service.list(propertyId)).resolves.toEqual([
      expect.objectContaining({
        runId: '33333333-3333-3333-3333-333333333333',
        businessDate: '2026-09-04',
        nextBusinessDate: '2026-09-05',
        hasSnapshot: true,
        completionSnapshotVersion: NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION,
        totalBlockingCount: 0,
        sectionCounts: {
          pendingArrivals: { count: 1, blockingCount: 0 },
          stayReview: { count: 2, blockingCount: 0 },
          folioExceptions: { count: 3, blockingCount: 0 },
          groupReview: { count: 4, blockingCount: 0 },
        },
      }),
    ]);
  });

  it('falls back to legacy summary when snapshot is null', async () => {
    repository.find?.mockResolvedValue([run({ completionSnapshot: null, summary: legacySummary() })]);

    await expect(service.list(propertyId)).resolves.toEqual([
      expect.objectContaining({
        hasSnapshot: false,
        nextBusinessDate: '2026-09-05',
        totalBlockingCount: 2,
        sectionCounts: {
          pendingArrivals: { count: 7, blockingCount: 1 },
          stayReview: { count: 8, blockingCount: 1 },
          folioExceptions: { count: 9, blockingCount: 0 },
          groupReview: { count: 10, blockingCount: 0 },
        },
      }),
    ]);
  });

  it('detail returns snapshot', async () => {
    const entity = run({ completionSnapshot: snapshot() });
    repository.findOne?.mockResolvedValue(entity);

    await expect(service.getDetail(propertyId, entity.id)).resolves.toEqual({
      runId: entity.id,
      propertyId,
      businessDate: '2026-09-04',
      nextBusinessDate: '2026-09-05',
      startedAt: entity.startedAt,
      startedByUserId: userId,
      completedAt: entity.completedAt,
      completedByUserId: userId,
      completionSnapshotVersion: NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION,
      hasSnapshot: true,
      completionSnapshot: entity.completionSnapshot,
      legacySummary: null,
    });
  });

  it('wrong property/run returns 404', async () => {
    repository.findOne?.mockResolvedValue(null);

    await expect(
      service.getDetail(otherPropertyId, '33333333-3333-3333-3333-333333333333'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        id: '33333333-3333-3333-3333-333333333333',
        propertyId: otherPropertyId,
        status: NightAuditRunStatus.COMPLETED,
      },
    });
  });

  it('OPEN run is not exposed by detail', async () => {
    await expect(
      service.getDetail(propertyId, '33333333-3333-3333-3333-333333333333'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: NightAuditRunStatus.COMPLETED }),
    }));
  });
});

function run(overrides: Partial<NightAuditRunEntity> = {}): NightAuditRunEntity {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    propertyId,
    businessDate: '2026-09-04',
    status: NightAuditRunStatus.COMPLETED,
    startedByUserId: userId,
    startedAt: new Date('2026-09-04T12:00:00.000Z'),
    completedByUserId: userId,
    completedAt: new Date('2026-09-04T23:59:00.000Z'),
    summary: null,
    completionSnapshot: null,
    completionSnapshotVersion: overrides.completionSnapshot
      ? NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION
      : null,
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    updatedAt: new Date('2026-09-04T23:59:00.000Z'),
    ...overrides,
  };
}

function snapshot(): NightAuditCompletionSnapshot {
  return {
    version: NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION,
    propertyId,
    runId: '33333333-3333-3333-3333-333333333333',
    businessDate: '2026-09-04',
    nextBusinessDate: '2026-09-05',
    startedAt: '2026-09-04T12:00:00.000Z',
    startedByUserId: userId,
    completedAt: '2026-09-04T23:59:00.000Z',
    completedByUserId: userId,
    validation: {
      canClose: true,
      totalBlockingCount: 0,
      blockers: {
        pendingArrivals: 0,
        stayReview: 0,
        folioExceptions: 0,
        groupReview: 0,
      },
    },
    sections: {
      pendingArrivals: { count: 1, blockingCount: 0, refs: [] },
      stayReview: {
        count: 2,
        blockingCount: 0,
        summary: { stayover: 1, dueOut: 1, overdue: 0 },
        refs: [],
      },
      folioExceptions: {
        count: 3,
        blockingCount: 0,
        summary: { outstandingBalance: 1, unsettledZeroBalance: 1, missingFolio: 1 },
        refs: [],
      },
      groupReview: {
        count: 4,
        blockingCount: 0,
        summary: {
          stayover: 1,
          dueOut: 1,
          overdue: 1,
          financialExceptions: 1,
          operationalExceptions: 0,
        },
        refs: [],
      },
    },
    inHouseSummary: {
      individualInHouseCount: 2,
      individualStayoverCount: 1,
      groupInHouseCount: 4,
      groupStayoverCount: 1,
    },
  };
}

function legacySummary(): Record<string, unknown> {
  return {
    nextBusinessDate: '2026-09-05',
    validation: {
      totalBlockingCount: 2,
      blockers: {
        pendingArrivals: 1,
        stayReview: 1,
        folioExceptions: 0,
        groupReview: 0,
      },
    },
    workspaceCounts: {
      pendingArrivals: 7,
      stayReview: 8,
      folioExceptions: 9,
      groupReview: 10,
    },
  };
}
