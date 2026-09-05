import { NightAuditValidationReasonCode } from '../dto/night-audit-validation.dto';
import { NightAuditWorkspaceDto } from '../dto/night-audit-workspace.dto';
import { NightAuditPreCloseValidator } from './night-audit-pre-close.validator';

describe('NightAuditPreCloseValidator', () => {
  let validator: NightAuditPreCloseValidator;

  function createMockWorkspace(overrides?: Partial<NightAuditWorkspaceDto>): NightAuditWorkspaceDto {
    return {
      pendingArrivals: {
        count: 0,
        blockingCount: 0,
        items: [],
        ...(overrides?.pendingArrivals ?? {}),
      },
      stayReview: {
        count: 0,
        blockingCount: 0,
        summary: { stayover: 0, dueOut: 0, overdue: 0 },
        items: [],
        ...(overrides?.stayReview ?? {}),
      },
      folioExceptions: {
        count: 0,
        blockingCount: 0,
        summary: { outstandingBalance: 0, unsettledZeroBalance: 0, missingFolio: 0 },
        items: [],
        ...(overrides?.folioExceptions ?? {}),
      },
      groupReview: {
        count: 0,
        blockingCount: 0,
        summary: { stayover: 0, dueOut: 0, overdue: 0, financialExceptions: 0, operationalExceptions: 0 },
        items: [],
        ...(overrides?.groupReview ?? {}),
      },
    };
  }

  beforeEach(() => {
    validator = new NightAuditPreCloseValidator();
  });

  describe('A: Zero-blocker workspace', () => {
    it('A. empty/zero-blocker workspace => canClose true, totalBlockingCount 0, no reasons', () => {
      const workspace = createMockWorkspace();

      const result = validator.validate(workspace);

      expect(result.canClose).toBe(true);
      expect(result.totalBlockingCount).toBe(0);
      expect(result.blockers).toEqual({
        pendingArrivals: 0,
        stayReview: 0,
        folioExceptions: 0,
        groupReview: 0,
      });
      expect(result.reasons).toEqual([]);
    });
  });

  describe('B, C, D, E: Single section blockers prevent close', () => {
    it('B. pendingArrivals blocker => canClose false, reason PENDING_ARRIVALS', () => {
      const workspace = createMockWorkspace({
        pendingArrivals: {
          count: 3,
          blockingCount: 3,
          items: [{ reservationId: 'res-1' } as any, { reservationId: 'res-2' } as any, { reservationId: 'res-3' } as any],
        },
      });

      const result = validator.validate(workspace);

      expect(result.canClose).toBe(false);
      expect(result.totalBlockingCount).toBe(3);
      expect(result.blockers.pendingArrivals).toBe(3);
      expect(result.reasons).toEqual([
        {
          code: NightAuditValidationReasonCode.PENDING_ARRIVALS,
          count: 3,
        },
      ]);
    });

    it('C. stayReview blocker => canClose false, reason DUE_OUT_OR_OVERDUE_STAYS', () => {
      const workspace = createMockWorkspace({
        stayReview: {
          count: 2,
          blockingCount: 2,
          summary: { stayover: 0, dueOut: 1, overdue: 1 },
          items: [{ reservationId: 'stay-1' } as any, { reservationId: 'stay-2' } as any],
        },
      });

      const result = validator.validate(workspace);

      expect(result.canClose).toBe(false);
      expect(result.totalBlockingCount).toBe(2);
      expect(result.blockers.stayReview).toBe(2);
      expect(result.reasons).toEqual([
        {
          code: NightAuditValidationReasonCode.DUE_OUT_OR_OVERDUE_STAYS,
          count: 2,
        },
      ]);
    });

    it('D. folioExceptions blocker => canClose false, reason FOLIO_EXCEPTIONS', () => {
      const workspace = createMockWorkspace({
        folioExceptions: {
          count: 1,
          blockingCount: 1,
          summary: { outstandingBalance: 1, unsettledZeroBalance: 0, missingFolio: 0 },
          items: [{ reservationId: 'folio-res-1' } as any],
        },
      });

      const result = validator.validate(workspace);

      expect(result.canClose).toBe(false);
      expect(result.totalBlockingCount).toBe(1);
      expect(result.blockers.folioExceptions).toBe(1);
      expect(result.reasons).toEqual([
        {
          code: NightAuditValidationReasonCode.FOLIO_EXCEPTIONS,
          count: 1,
        },
      ]);
    });

    it('E. groupReview blocker => canClose false, reason GROUP_EXCEPTIONS', () => {
      const workspace = createMockWorkspace({
        groupReview: {
          count: 1,
          blockingCount: 1,
          summary: { stayover: 0, dueOut: 1, overdue: 0, financialExceptions: 1, operationalExceptions: 0 },
          items: [{ groupBookingId: 'grp-1' } as any],
        },
      });

      const result = validator.validate(workspace);

      expect(result.canClose).toBe(false);
      expect(result.totalBlockingCount).toBe(1);
      expect(result.blockers.groupReview).toBe(1);
      expect(result.reasons).toEqual([
        {
          code: NightAuditValidationReasonCode.GROUP_EXCEPTIONS,
          count: 1,
        },
      ]);
    });
  });

  describe('F, G: Multiple sections and distinct condition counts', () => {
    it('F. mixed blockers across multiple sections sum correctly and list all reasons', () => {
      const workspace = createMockWorkspace({
        pendingArrivals: { count: 2, blockingCount: 2, items: [] },
        stayReview: { count: 3, blockingCount: 1, summary: { stayover: 2, dueOut: 1, overdue: 0 }, items: [] },
        folioExceptions: { count: 2, blockingCount: 2, summary: { outstandingBalance: 2, unsettledZeroBalance: 0, missingFolio: 0 }, items: [] },
        groupReview: { count: 4, blockingCount: 1, summary: { stayover: 3, dueOut: 1, overdue: 0, financialExceptions: 1, operationalExceptions: 0 }, items: [] },
      });

      const result = validator.validate(workspace);

      expect(result.canClose).toBe(false);
      expect(result.totalBlockingCount).toBe(6); // 2 + 1 + 2 + 1
      expect(result.blockers).toEqual({
        pendingArrivals: 2,
        stayReview: 1,
        folioExceptions: 2,
        groupReview: 1,
      });
      expect(result.reasons).toEqual([
        { code: NightAuditValidationReasonCode.PENDING_ARRIVALS, count: 2 },
        { code: NightAuditValidationReasonCode.DUE_OUT_OR_OVERDUE_STAYS, count: 1 },
        { code: NightAuditValidationReasonCode.FOLIO_EXCEPTIONS, count: 2 },
        { code: NightAuditValidationReasonCode.GROUP_EXCEPTIONS, count: 1 },
      ]);
    });

    it('G. same reservation blocking in both stayReview and folioExceptions counts as multiple conditions (no cross-section deduplication)', () => {
      const sharedReservationId = 'res-shared-123';
      const workspace = createMockWorkspace({
        stayReview: {
          count: 1,
          blockingCount: 1,
          summary: { stayover: 0, dueOut: 1, overdue: 0 },
          items: [{ reservationId: sharedReservationId, blocking: true } as any],
        },
        folioExceptions: {
          count: 1,
          blockingCount: 1,
          summary: { outstandingBalance: 1, unsettledZeroBalance: 0, missingFolio: 0 },
          items: [{ reservationId: sharedReservationId, blocking: true } as any],
        },
      });

      const result = validator.validate(workspace);

      // Distinct operational conditions: 1 stay condition + 1 folio condition = 2 blocking conditions
      expect(result.canClose).toBe(false);
      expect(result.totalBlockingCount).toBe(2);
      expect(result.blockers.stayReview).toBe(1);
      expect(result.blockers.folioExceptions).toBe(1);
      expect(result.reasons).toHaveLength(2);
    });
  });

  describe('H: Informational/non-blocking items do not prevent canClose', () => {
    it('H. non-blocking informational items in stayReview, folioExceptions, or groupReview do not affect canClose', () => {
      const workspace = createMockWorkspace({
        stayReview: {
          count: 5,
          blockingCount: 0, // 5 stayovers, none blocking
          summary: { stayover: 5, dueOut: 0, overdue: 0 },
          items: [
            { reservationId: 'stay-1', reviewState: 'STAYOVER', blocking: false } as any,
            { reservationId: 'stay-2', reviewState: 'STAYOVER', blocking: false } as any,
          ],
        },
        folioExceptions: {
          count: 3,
          blockingCount: 0, // 3 stayovers with positive balance => informational, blockingCount = 0
          summary: { outstandingBalance: 3, unsettledZeroBalance: 0, missingFolio: 0 },
          items: [
            { reservationId: 'stay-1', stayReviewState: 'STAYOVER', blocking: false } as any,
          ],
        },
        groupReview: {
          count: 2,
          blockingCount: 0, // 2 normal group stayovers with balance => non-blocking
          summary: { stayover: 2, dueOut: 0, overdue: 0, financialExceptions: 2, operationalExceptions: 0 },
          items: [
            { groupBookingId: 'grp-1', reviewState: 'STAYOVER', blocking: false, financialException: true } as any,
          ],
        },
      });

      const result = validator.validate(workspace);

      // Since all blockingCounts are 0, canClose must be true
      expect(result.canClose).toBe(true);
      expect(result.totalBlockingCount).toBe(0);
      expect(result.blockers).toEqual({
        pendingArrivals: 0,
        stayReview: 0,
        folioExceptions: 0,
        groupReview: 0,
      });
      expect(result.reasons).toEqual([]);
    });
  });

  describe('I, J: Reasons metadata and purity', () => {
    it('I. reason codes and counts are exact and only present for non-zero sections', () => {
      const workspace = createMockWorkspace({
        stayReview: { count: 1, blockingCount: 2, summary: { stayover: 0, dueOut: 2, overdue: 0 }, items: [] },
        // other sections are 0
      });

      const result = validator.validate(workspace);

      expect(result.reasons).toEqual([
        {
          code: NightAuditValidationReasonCode.DUE_OUT_OR_OVERDUE_STAYS,
          count: 2,
        },
      ]);
    });

    it('J. validator does not mutate workspace', () => {
      const workspace = createMockWorkspace({
        pendingArrivals: { count: 1, blockingCount: 1, items: [{ reservationId: 'res-1' } as any] },
        stayReview: { count: 1, blockingCount: 1, summary: { stayover: 0, dueOut: 1, overdue: 0 }, items: [] },
      });

      const snapshotBefore = JSON.stringify(workspace);
      validator.validate(workspace);
      const snapshotAfter = JSON.stringify(workspace);

      expect(snapshotAfter).toBe(snapshotBefore);
    });
  });
});
