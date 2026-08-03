import { GroupHoldDetailPage } from '../../../../features/reservations/GroupHoldDetailPage';

export default function Page({ params }: { params: { groupHoldId: string } }) {
  return <GroupHoldDetailPage groupHoldId={params.groupHoldId} />;
}
