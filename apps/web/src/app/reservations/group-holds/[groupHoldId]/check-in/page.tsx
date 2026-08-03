import { GroupCheckInPreviewPage } from '../../../../../features/reservations/GroupCheckInPreviewPage';

export default async function Page({ params }: { params: Promise<{ groupHoldId: string }> }) {
  const { groupHoldId } = await params;
  return <GroupCheckInPreviewPage groupHoldId={groupHoldId} />;
}
