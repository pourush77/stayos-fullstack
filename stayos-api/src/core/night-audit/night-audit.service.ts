import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { PropertyEntity } from '../properties/infrastructure/property.entity';
import { BusinessDateService } from '../properties/services/business-date.service';
import { NightAuditFolioExceptionsCollector } from './collectors/night-audit-folio-exceptions.collector';
import { NightAuditFinancialSummaryCollector } from './collectors/night-audit-financial-summary.collector';
import { NightAuditGroupReviewCollector } from './collectors/night-audit-group-review.collector';
import { NightAuditPendingArrivalsCollector } from './collectors/night-audit-pending-arrivals.collector';
import { NightAuditStayReviewCollector } from './collectors/night-audit-stay-review.collector';
import { NightAuditValidationDto } from './dto/night-audit-validation.dto';
import { NightAuditWorkspaceDto } from './dto/night-audit-workspace.dto';
import { NightAuditRunStatus } from './domain/night-audit-run-status.enum';
import { NightAuditRunEntity } from './infrastructure/night-audit-run.entity';
import { NightAuditCompletionSnapshotBuilder } from './snapshots/night-audit-completion-snapshot';
import { NightAuditPreCloseValidator } from './validators/night-audit-pre-close.validator';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { AccommodationPostingMode } from '../reservations/domain/accommodation-posting-mode.enum';
import { BillingService } from '../billing/billing.service';

export interface NightAuditRunResult {
  run: NightAuditRunEntity;
  workspace: NightAuditWorkspaceDto;
  validation: NightAuditValidationDto;
}

export interface NightAuditCloseResult {
  run: NightAuditRunEntity;
  nextBusinessDate: string;
}

@Injectable()
export class NightAuditService {
  private readonly completionSnapshotBuilder = new NightAuditCompletionSnapshotBuilder();

  constructor(
    @InjectRepository(NightAuditRunEntity)
    private readonly nightAuditRunRepository: Repository<NightAuditRunEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepository: Repository<PropertyEntity>,
    @InjectRepository(AuditEventEntity)
    private readonly auditRepository: Repository<AuditEventEntity>,
    private readonly businessDateService: BusinessDateService,
    private readonly dataSource: DataSource,
    private readonly billingService: BillingService,
    private readonly pendingArrivalsCollector: NightAuditPendingArrivalsCollector,
    private readonly stayReviewCollector: NightAuditStayReviewCollector,
    private readonly folioExceptionsCollector: NightAuditFolioExceptionsCollector,
    private readonly groupReviewCollector: NightAuditGroupReviewCollector,
    private readonly preCloseValidator: NightAuditPreCloseValidator,
    private readonly financialSummaryCollector: NightAuditFinancialSummaryCollector,
  ) {}

  /**
   * Retrieves an existing OPEN Night Audit run for the property's authoritative
   * currentBusinessDate or creates a new one safely, then collects and returns
   * the workspace operational sections (pending arrivals, stay review, folio exceptions, group review)
   * alongside authoritative pre-close validation.
   *
   * Invariants:
   * - Reads authoritative persisted currentBusinessDate.
   * - Never creates a run for a dynamically calculated future date.
   * - Never advances currentBusinessDate.
   * - If an OPEN run exists for a mismatched business date, throws ConflictException.
   * - If an audit run has already completed for currentBusinessDate, throws ConflictException.
   * - Emits NIGHT_AUDIT_STARTED only when creating a new run (not on resume).
   * - Concurrently safe via database constraints (catches 23505 and re-reads open run).
   * - Collects workspace sections using run.businessDate as the sole date boundary.
   * - Pre-close validation is evaluated on the exact same collected workspace (zero duplicate queries).
   */
  async getOrCreateOpenRun(propertyId: string, actorUserId: string): Promise<NightAuditRunResult> {
    const run = await this.getOrCreateRunEntity(propertyId, actorUserId);
    const [pendingArrivals, stayReview, folioExceptions, groupReview] = await Promise.all([
      this.pendingArrivalsCollector.collect(propertyId, run.businessDate),
      this.stayReviewCollector.collect(propertyId, run.businessDate),
      this.folioExceptionsCollector.collect(propertyId, run.businessDate),
      this.groupReviewCollector.collect(propertyId, run.businessDate),
    ]);
    const workspace: NightAuditWorkspaceDto = {
      pendingArrivals,
      stayReview,
      folioExceptions,
      groupReview,
    };
    const validation = this.preCloseValidator.validate(workspace);

    return { run, workspace, validation };
  }

  private async getOrCreateRunEntity(
    propertyId: string,
    actorUserId: string,
  ): Promise<NightAuditRunEntity> {
    const property = await this.propertiesRepository.findOne({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} was not found`);
    }

    const currentBusinessDate = this.businessDateService.getAuthoritativeDate(property);

    const existingOpenRun = await this.nightAuditRunRepository.findOne({
      where: { propertyId, status: NightAuditRunStatus.OPEN },
    });

    if (existingOpenRun) {
      if (existingOpenRun.businessDate !== currentBusinessDate) {
        throw new ConflictException(
          `An open Night Audit run (${existingOpenRun.id}) exists for business date ${existingOpenRun.businessDate}, which does not match current business date ${currentBusinessDate}.`,
        );
      }
      return existingOpenRun;
    }

    const existingRunForDate = await this.nightAuditRunRepository.findOne({
      where: { propertyId, businessDate: currentBusinessDate },
    });
    if (existingRunForDate) {
      throw new ConflictException(
        `Night Audit run for business date ${currentBusinessDate} has already been completed.`,
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const runRepo = manager.getRepository(NightAuditRunEntity);
        const auditRepo = manager.getRepository(AuditEventEntity);

        const newRun = runRepo.create({
          propertyId,
          businessDate: currentBusinessDate,
          status: NightAuditRunStatus.OPEN,
          startedByUserId: actorUserId,
          startedAt: new Date(),
          completedByUserId: null,
          completedAt: null,
          summary: null,
        });

        const savedRun = await runRepo.save(newRun);

        await auditRepo.save(
          auditRepo.create({
            propertyId,
            actorId: actorUserId,
            entityType: 'NightAuditRun',
            entityId: savedRun.id,
            action: 'NIGHT_AUDIT_STARTED',
            previousState: null,
            nextState: {
              status: savedRun.status,
              businessDate: savedRun.businessDate,
              startedAt: savedRun.startedAt,
              startedByUserId: savedRun.startedByUserId,
            },
            metadata: {
              businessDate: savedRun.businessDate,
            },
          }),
        );

        return savedRun;
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };
        if (driverError?.code === '23505') {
          const concurrentRun = await this.nightAuditRunRepository.findOne({
            where: { propertyId, status: NightAuditRunStatus.OPEN },
          });
          if (concurrentRun && concurrentRun.businessDate === currentBusinessDate) {
            return concurrentRun;
          }
          throw new ConflictException('A concurrent night audit run creation conflict occurred.');
        }
      }
      throw error;
    }
  }

  /**
   * Atomically closes the currently OPEN NightAuditRun for the property,
   * advances the property's authoritative currentBusinessDate by exactly one calendar day,
   * and persists a NIGHT_AUDIT_COMPLETED audit event within a single database transaction.
   *
   * Invariants & Rules:
   * 1. Re-collects fresh workspace using run.businessDate and validates authoritatively
   *    prior to transaction entry; never trusts prior GET validation.
   * 2. If pre-close validation fails (canClose === false), rejects with ConflictException
   *    (code: NIGHT_AUDIT_BLOCKED) and performs zero database mutations.
   * 3. Requires an existing OPEN run whose businessDate equals property.currentBusinessDate.
   * 4. Does NOT dynamically derive or wall-clock compute a business date.
   * 5. Protects against concurrent close via pessimistic row locking (PropertyEntity and
   *    NightAuditRunEntity) inside a single database transaction.
   * 6. Re-checks run status (must still be OPEN) and business date equality under lock.
   * 7. Advances currentBusinessDate by exactly one calendar day (date-only safe arithmetic).
   * 8. Persists compact immutable summary with 0 blockers and section counts.
   * 9. Emits NIGHT_AUDIT_COMPLETED audit event in the same transaction.
   * 10. Does NOT post nightly accommodation charges, settle folios, or modify reservations/rooms.
   */
  async closeRun(propertyId: string, actorUserId: string): Promise<NightAuditCloseResult> {
    const property = await this.propertiesRepository.findOne({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} was not found`);
    }

    const openRun = await this.nightAuditRunRepository.findOne({
      where: { propertyId, status: NightAuditRunStatus.OPEN },
    });

    if (!openRun) {
      const completedRun = await this.nightAuditRunRepository.findOne({
        where: { propertyId, status: NightAuditRunStatus.COMPLETED },
        order: { completedAt: 'DESC' },
      });
      if (completedRun) {
        throw new ConflictException({
          code: 'NIGHT_AUDIT_ALREADY_CLOSED',
          message: `Night audit run ${completedRun.id} for business date ${completedRun.businessDate} has already been closed.`,
        });
      }
      throw new ConflictException({
        code: 'NIGHT_AUDIT_NOT_OPEN',
        message: `No open Night Audit run found for property ${propertyId}.`,
      });
    }

    if (openRun.businessDate !== property.currentBusinessDate) {
      throw new ConflictException({
        code: 'NIGHT_AUDIT_DATE_MISMATCH',
        message: `An open Night Audit run (${openRun.id}) exists for business date ${openRun.businessDate}, which does not match current business date ${property.currentBusinessDate}.`,
      });
    }

    // Step 2: Fresh pre-close validation on freshly collected workspace
    const [pendingArrivals, stayReview, folioExceptions, groupReview] = await Promise.all([
      this.pendingArrivalsCollector.collect(propertyId, openRun.businessDate),
      this.stayReviewCollector.collect(propertyId, openRun.businessDate),
      this.folioExceptionsCollector.collect(propertyId, openRun.businessDate),
      this.groupReviewCollector.collect(propertyId, openRun.businessDate),
    ]);

    const workspace: NightAuditWorkspaceDto = {
      pendingArrivals,
      stayReview,
      folioExceptions,
      groupReview,
    };

    const validation = this.preCloseValidator.validate(workspace);

    if (!validation.canClose) {
      throw new ConflictException({
        code: 'NIGHT_AUDIT_BLOCKED',
        message: 'Night audit cannot be closed because there are blocking operational items.',
        businessDate: openRun.businessDate,
        validation,
      });
    }

    // Step 3: Transactional mutation with pessimistic row locking
    return await this.dataSource.transaction(async (manager) => {
      const propertyRepo = manager.getRepository(PropertyEntity);
      const runRepo = manager.getRepository(NightAuditRunEntity);
      const auditRepo = manager.getRepository(AuditEventEntity);

      const lockedProperty = await propertyRepo.findOne({
        where: { id: propertyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedProperty) {
        throw new NotFoundException(`Property ${propertyId} was not found`);
      }

      const lockedRun = await runRepo.findOne({
        where: { id: openRun.id, propertyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRun) {
        throw new NotFoundException(`Night Audit run ${openRun.id} was not found`);
      }

      // Re-check under DB lock
      if (lockedRun.status !== NightAuditRunStatus.OPEN) {
        throw new ConflictException({
          code: 'NIGHT_AUDIT_ALREADY_CLOSED',
          message: `Night audit run ${lockedRun.id} is no longer OPEN (current status: ${lockedRun.status}).`,
        });
      }

      if (lockedRun.businessDate !== lockedProperty.currentBusinessDate) {
        throw new ConflictException({
          code: 'NIGHT_AUDIT_DATE_MISMATCH',
          message: `Night audit run business date (${lockedRun.businessDate}) does not match property current business date (${lockedProperty.currentBusinessDate}).`,
        });
      }

      const oldBusinessDate = lockedRun.businessDate;
      const newBusinessDate = this.businessDateService.advanceBusinessDate(oldBusinessDate);
      const completedAt = new Date();

      if (lockedRun.completionSnapshot || lockedRun.completionSnapshotVersion) {
        throw new ConflictException({
          code: 'NIGHT_AUDIT_COMPLETION_SNAPSHOT_EXISTS',
          message: `Night audit run ${lockedRun.id} already has a completion snapshot.`,
        });
      }

      // NIGHTLY_V1 posting: find eligible individual reservations and post nightly ROOM charges
      const reservationRepo = manager.getRepository(ReservationEntity);
      const eligibleReservations = await reservationRepo
        .createQueryBuilder('r')
        .where('r.propertyId = :propertyId', { propertyId })
        .andWhere('r.accommodationPostingMode = :mode', {
          mode: AccommodationPostingMode.NIGHTLY_V1,
        })
        .andWhere('r.status = :status', { status: ReservationStatus.CHECKED_IN })
        .andWhere('r.arrivalDate <= :serviceDate AND r.departureDate > :serviceDate', {
          serviceDate: lockedRun.businessDate,
        })
        .orderBy('r.id', 'ASC')
        .getMany();

      for (const reservation of eligibleReservations) {
        await this.billingService.postNightlyAccommodationChargeOnManager(
          manager,
          propertyId,
          reservation.id,
          lockedRun.businessDate,
          actorUserId,
        );
      }

      // V2.4: immutable financial closing summary captured AFTER nightly posting,
      // BEFORE the run is finalized and the business date advances.
      const financial = await this.financialSummaryCollector.collect(
        manager,
        propertyId,
        lockedRun.businessDate,
        workspace,
        lockedProperty.currency ?? null,
      );

      const completionSnapshot = this.completionSnapshotBuilder.build({
        run: lockedRun,
        workspace,
        validation,
        nextBusinessDate: newBusinessDate,
        completedAt,
        actorUserId,
        financial,
      });

      // 1. Advance property currentBusinessDate
      lockedProperty.currentBusinessDate = newBusinessDate;
      await propertyRepo.save(lockedProperty);

      // 2. Complete NightAuditRun
      lockedRun.status = NightAuditRunStatus.COMPLETED;
      lockedRun.completedAt = completedAt;
      lockedRun.completedByUserId = actorUserId;
      lockedRun.completionSnapshot = completionSnapshot;
      lockedRun.completionSnapshotVersion = completionSnapshot.version;
      lockedRun.summary = {
        businessDate: oldBusinessDate,
        nextBusinessDate: newBusinessDate,
        validation: {
          totalBlockingCount: validation.totalBlockingCount,
          blockers: validation.blockers,
        },
        workspaceCounts: {
          pendingArrivals: workspace.pendingArrivals.count,
          stayReview: workspace.stayReview.count,
          folioExceptions: workspace.folioExceptions.count,
          groupReview: workspace.groupReview.count,
        },
      };
      const savedRun = await runRepo.save(lockedRun);

      // 3. Record NIGHT_AUDIT_COMPLETED audit event
      await auditRepo.save(
        auditRepo.create({
          propertyId,
          actorId: actorUserId,
          entityType: 'NightAuditRun',
          entityId: savedRun.id,
          action: 'NIGHT_AUDIT_COMPLETED',
          previousState: {
            status: NightAuditRunStatus.OPEN,
            businessDate: oldBusinessDate,
          },
          nextState: {
            status: savedRun.status,
            businessDate: savedRun.businessDate,
            completedAt: savedRun.completedAt,
            completedByUserId: savedRun.completedByUserId,
          },
          metadata: {
            businessDate: oldBusinessDate,
            nextBusinessDate: newBusinessDate,
            totalBlockingCount: 0,
            snapshotVersion: completionSnapshot.version,
          },
        }),
      );

      return {
        run: savedRun,
        nextBusinessDate: newBusinessDate,
      };
    });
  }
}
