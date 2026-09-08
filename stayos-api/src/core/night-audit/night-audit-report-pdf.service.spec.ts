import { NightAuditReportPdfService } from './night-audit-report-pdf.service';
import type { NightAuditCompletionSnapshot } from './snapshots/night-audit-completion-snapshot';

function v24Snapshot(overrides: Partial<any> = {}): NightAuditCompletionSnapshot {
  return {
    version: 'NA-V2.4',
    propertyId: 'p1',
    runId: 'r1',
    businessDate: '2026-09-08',
    nextBusinessDate: '2026-09-09',
    startedAt: '2026-09-08T20:00:00Z',
    startedByUserId: 'u1',
    completedAt: '2026-09-09T01:00:00Z',
    completedByUserId: 'u1',
    validation: { canClose: true, totalBlockingCount: 0 } as any,
    sections: {} as any,
    inHouseSummary: {
      individualInHouseCount: 3,
      individualStayoverCount: 2,
      groupInHouseCount: 1,
      groupStayoverCount: 1,
    },
    financial: {
      financialSummary: {
        currency: 'INR',
        roomRevenue: 5000,
        otherChargeRevenue: 1200,
        grossCharges: 7316,
        taxAmount: 1116,
        paymentsCollected: 4000,
        refunds: 500,
        netCollections: 3500,
        outstandingBalance: 3816,
      },
      paymentBreakdown: [
        { method: 'CASH', amount: 1500 },
        { method: 'CARD', amount: 2000 },
      ],
      operationalSummary: {
        totalRooms: 40,
        inHouseRooms: 3,
        stayovers: 2,
        arrivals: 2,
        departures: 1,
        noShows: 0,
      },
      groupSummary: {
        inHouseGroups: 1,
        stayoverGroups: 1,
        masterFolioPaymentsCollected: 800,
        masterFolioRefunds: 0,
        accommodationRevenueIncluded: false,
      },
    },
    ...overrides,
  } as NightAuditCompletionSnapshot;
}

describe('NightAuditReportPdfService', () => {
  const service = new NightAuditReportPdfService();
  const property = { name: 'Grand Hotel', legalName: 'Grand Hotel LLP' };

  it('renders a V2.4 report to a PDF buffer (including auditor note)', async () => {
    const buffer = await service.generate({
      snapshot: v24Snapshot({ auditorNote: 'Room 204 late checkout; corporate payment tomorrow' }),
      property,
      completedAt: '2026-09-09T01:00:00Z',
      completedByUserId: 'u1',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders an NA-V2.1 snapshot (no financial block) without throwing', async () => {
    const legacy = {
      version: 'NA-V2.1',
      propertyId: 'p1',
      runId: 'r1',
      businessDate: '2025-01-01',
      nextBusinessDate: '2025-01-02',
      startedAt: '2025-01-01T20:00:00Z',
      startedByUserId: 'u1',
      completedAt: '2025-01-02T01:00:00Z',
      completedByUserId: 'u1',
      validation: { canClose: true, totalBlockingCount: 0 } as any,
      sections: {} as any,
      inHouseSummary: {
        individualInHouseCount: 5,
        individualStayoverCount: 4,
        groupInHouseCount: 0,
        groupStayoverCount: 0,
      },
    } as NightAuditCompletionSnapshot;

    const buffer = await service.generate({
      snapshot: legacy,
      property,
      completedAt: '2025-01-02T01:00:00Z',
      completedByUserId: 'u1',
    });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
