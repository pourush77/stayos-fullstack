import { GroupHoldDetailPage } from '../../../../features/reservations/GroupHoldDetailPage';

export default async function Page({ params }: { params: Promise<{ groupHoldId: string }> }) {
  const { groupHoldId } = await params;
  return <GroupHoldDetailPage groupHoldId={groupHoldId} />;
}
