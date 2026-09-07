import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { NightAuditRunStatus } from '../night-audit/domain/night-audit-run-status.enum';
import { NightAuditRunEntity } from '../night-audit/infrastructure/night-audit-run.entity';
import type {
  NightAuditCompletionSnapshot,
  NightAuditCompletionSnapshotSections,
} from '../night-audit/snapshots/night-audit-completion-snapshot';
import { parseReportRange } from './reports-range';

export type NightAuditHistorySectionKey =
  | 'pendingArrivals'
  | 'stayReview'
  | 'folioExceptions'
  | 'groupReview';

export type NightAuditHistorySectionCounts = Record<
  NightAuditHistorySectionKey,
  {
    count: number | null;
    blockingCount: number | null;
  }
>;

export interface NightAuditHistoryRowDto {
  runId: string;
  businessDate: string;
  nextBusinessDate: string | null;
  startedAt: Date;
  completedAt: Date | null;
  completedByUserId: string | null;
  completionSnapshotVersion: string | null;
  hasSnapshot: boolean;
  totalBlockingCount: number | null;
  sectionCounts: NightAuditHistorySectionCounts;
}

export interface NightAuditHistoryDetailDto {
  runId: string;
  propertyId: string;
  businessDate: string;
  nextBusinessDate: string | null;
  startedAt: Date;
  startedByUserId: string;
  completedAt: Date | null;
  completedByUserId: string | null;
  completionSnapshotVersion: string | null;
  hasSnapshot: boolean;
  completionSnapshot: NightAuditCompletionSnapshot | null;
  legacySummary: Record<string, unknown> | null;
}

const SECTION_KEYS: NightAuditHistorySectionKey[] = [
  'pendingArrivals',
  'stayReview',
  'folioExceptions',
  'groupReview',
];

@Injectable()
export class NightAuditHistoryService {
  constructor(
    @InjectRepository(NightAuditRunEntity)
    private readonly nightAuditRunsRepository: Repository<NightAuditRunEntity>,
  ) {}

  async list(propertyId: string, from?: string, to?: string): Promise<NightAuditHistoryRowDto[]> {
    const range = from || to ? parseReportRange(from, to) : null;
    const where: FindOptionsWhere<NightAuditRunEntity> = {
      propertyId,
      status: NightAuditRunStatus.COMPLETED,
    };

    if (range) {
      where.businessDate = from && to
        ? Between(range.fromKey, range.toKey)
        : from
          ? MoreThanOrEqual(range.fromKey)
          : LessThanOrEqual(range.toKey);
    }

    const runs = await this.nightAuditRunsRepository.find({
      where,
      order: { businessDate: 'DESC', completedAt: 'DESC' },
    });

    return runs.map((run) => this.toRow(run));
  }

  async getDetail(propertyId: string, runId: string): Promise<NightAuditHistoryDetailDto> {
    const run = await this.nightAuditRunsRepository.findOne({
      where: {
        id: runId,
        propertyId,
        status: NightAuditRunStatus.COMPLETED,
      },
    });

    if (!run) {
      throw new NotFoundException({
        code: 'NIGHT_AUDIT_RUN_NOT_FOUND',
        message: 'Night Audit run was not found for this property',
      });
    }

    const snapshot = run.completionSnapshot;
    return {
      runId: run.id,
      propertyId: run.propertyId,
      businessDate: run.businessDate,
      nextBusinessDate: this.nextBusinessDate(run),
      startedAt: run.startedAt,
      startedByUserId: run.startedByUserId,
      completedAt: run.completedAt,
      completedByUserId: run.completedByUserId,
      completionSnapshotVersion: run.completionSnapshotVersion,
      hasSnapshot: snapshot !== null,
      completionSnapshot: snapshot,
      legacySummary: snapshot === null ? run.summary : null,
    };
  }

  private toRow(run: NightAuditRunEntity): NightAuditHistoryRowDto {
    const snapshot = run.completionSnapshot;
    return {
      runId: run.id,
      businessDate: run.businessDate,
      nextBusinessDate: this.nextBusinessDate(run),
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      completedByUserId: run.completedByUserId,
      completionSnapshotVersion: run.completionSnapshotVersion,
      hasSnapshot: snapshot !== null,
      totalBlockingCount: snapshot
        ? snapshot.validation.totalBlockingCount
        : numberFromPath(run.summary, ['validation', 'totalBlockingCount']),
      sectionCounts: snapshot
        ? sectionCountsFromSnapshot(snapshot.sections)
        : sectionCountsFromLegacySummary(run.summary),
    };
  }

  private nextBusinessDate(run: NightAuditRunEntity): string | null {
    return run.completionSnapshot?.nextBusinessDate ?? stringFromPath(run.summary, ['nextBusinessDate']);
  }
}

function sectionCountsFromSnapshot(
  sections: NightAuditCompletionSnapshotSections,
): NightAuditHistorySectionCounts {
  return {
    pendingArrivals: {
      count: sections.pendingArrivals.count,
      blockingCount: sections.pendingArrivals.blockingCount,
    },
    stayReview: {
      count: sections.stayReview.count,
      blockingCount: sections.stayReview.blockingCount,
    },
    folioExceptions: {
      count: sections.folioExceptions.count,
      blockingCount: sections.folioExceptions.blockingCount,
    },
    groupReview: {
      count: sections.groupReview.count,
      blockingCount: sections.groupReview.blockingCount,
    },
  };
}

function sectionCountsFromLegacySummary(
  summary: Record<string, unknown> | null,
): NightAuditHistorySectionCounts {
  return SECTION_KEYS.reduce((counts, key) => {
    counts[key] = {
      count: numberFromPath(summary, ['workspaceCounts', key]),
      blockingCount: numberFromPath(summary, ['validation', 'blockers', key]),
    };
    return counts;
  }, {} as NightAuditHistorySectionCounts);
}

function stringFromPath(source: Record<string, unknown> | null, path: string[]): string | null {
  const value = valueFromPath(source, path);
  return typeof value === 'string' ? value : null;
}

function numberFromPath(source: Record<string, unknown> | null, path: string[]): number | null {
  const value = valueFromPath(source, path);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function valueFromPath(source: Record<string, unknown> | null, path: string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
