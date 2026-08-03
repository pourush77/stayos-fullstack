import { GroupMasterFolioPage } from '../../../../../features/reservations/GroupMasterFolioPage';

export default function Page({ params }: { params: { groupHoldId: string } }) {
  return <GroupMasterFolioPage groupBookingId={params.groupHoldId} />;
}
