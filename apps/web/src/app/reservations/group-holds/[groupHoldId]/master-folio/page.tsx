import { GroupMasterFolioPage } from '../../../../../features/reservations/GroupMasterFolioPage';

export default async function Page({ params }: { params: Promise<{ groupHoldId: string }> }) {
  const { groupHoldId } = await params;
  return <GroupMasterFolioPage groupBookingId={groupHoldId} />;
}
