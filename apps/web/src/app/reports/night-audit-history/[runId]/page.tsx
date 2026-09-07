import { NightAuditHistoryDetailPage } from '../../../../features/reports/components/NightAuditHistoryPage';

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <NightAuditHistoryDetailPage runId={runId} />;
}
