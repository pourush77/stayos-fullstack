import { GroupCheckInPreviewPage } from '../../../../../features/reservations/GroupCheckInPreviewPage';

export default function Page({ params }: { params: { groupHoldId: string } }) {
  return <GroupCheckInPreviewPage groupHoldId={params.groupHoldId} />;
}
