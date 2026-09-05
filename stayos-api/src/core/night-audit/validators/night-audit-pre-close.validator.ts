import { Injectable } from '@nestjs/common';
import {
  NightAuditValidationBlockersDto,
  NightAuditValidationDto,
  NightAuditValidationReasonCode,
  NightAuditValidationReasonDto,
} from '../dto/night-audit-validation.dto';
import { NightAuditWorkspaceDto } from '../dto/night-audit-workspace.dto';

@Injectable()
export class NightAuditPreCloseValidator {
  /**
   * Evaluates the current Night Audit workspace to determine whether the run can authoritatively close.
   *
   * Architectural & Domain Rules:
   * 1. Consumes the workspace outputs / blockingCount values directly; zero duplicate collector execution.
   * 2. canClose is true ONLY when every operational section has zero blockers (totalBlockingCount === 0).
   * 3. totalBlockingCount = pendingArrivals.blockingCount + stayReview.blockingCount + folioExceptions.blockingCount + groupReview.blockingCount.
   *    - Represents a count of blocking CONDITIONS, not unique reservations/groups.
   *    - No cross-section deduplication (e.g. same reservation blocking stayReview and folioExceptions counts as 2 conditions).
   * 4. Informational/non-blocking items (e.g. STAYOVER folio balance or normal group stayover) do not prevent canClose.
   * 5. Generates stable machine-readable reasons only for sections with non-zero blockers.
   * 6. Pure, read-only calculation: does not mutate the workspace or underlying database entities.
   */
  validate(workspace: NightAuditWorkspaceDto): NightAuditValidationDto {
    const pendingArrivals = workspace.pendingArrivals?.blockingCount ?? 0;
    const stayReview = workspace.stayReview?.blockingCount ?? 0;
    const folioExceptions = workspace.folioExceptions?.blockingCount ?? 0;
    const groupReview = workspace.groupReview?.blockingCount ?? 0;

    const totalBlockingCount =
      pendingArrivals + stayReview + folioExceptions + groupReview;

    const canClose = totalBlockingCount === 0;

    const blockers: NightAuditValidationBlockersDto = {
      pendingArrivals,
      stayReview,
      folioExceptions,
      groupReview,
    };

    const reasons: NightAuditValidationReasonDto[] = [];

    if (pendingArrivals > 0) {
      reasons.push({
        code: NightAuditValidationReasonCode.PENDING_ARRIVALS,
        count: pendingArrivals,
      });
    }

    if (stayReview > 0) {
      reasons.push({
        code: NightAuditValidationReasonCode.DUE_OUT_OR_OVERDUE_STAYS,
        count: stayReview,
      });
    }

    if (folioExceptions > 0) {
      reasons.push({
        code: NightAuditValidationReasonCode.FOLIO_EXCEPTIONS,
        count: folioExceptions,
      });
    }

    if (groupReview > 0) {
      reasons.push({
        code: NightAuditValidationReasonCode.GROUP_EXCEPTIONS,
        count: groupReview,
      });
    }

    return {
      canClose,
      totalBlockingCount,
      blockers,
      reasons,
    };
  }
}
