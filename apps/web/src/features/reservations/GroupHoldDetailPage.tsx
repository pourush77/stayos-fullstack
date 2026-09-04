'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  ArrowRightLeft,
  BedDouble,
  CalendarPlus,
  CheckCircle2,
  Copy,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties } from '../../lib/inventory-api';
import {
  addGroupRoomingListItem,
  assignGroupRoom,
  changeGroupRoom,
  completeGroupCheckout,
  confirmGroupHold,
  extendGroupStay,
  getAvailableRooms,
  getGroupRoomChangeCandidates,
  deleteGroupHold,
  getGroupHold,
  getGroupMasterFolio,
  deleteGroupRoomingListItem,
  updateGroupRoomingListItem,
  type GroupMasterFolioDetailDto,
  type GroupHoldDto,
} from '../../lib/operations-api';
import { GroupExtendStayModal } from './components/GroupExtendStayModal';

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function voucherText(hold: GroupHoldDto) {
  return [
    `Group confirmation: ${hold.groupCode}`,
    `${hold.groupName}`,
    `${formatDate(hold.arrivalDate)} to ${formatDate(hold.departureDate)}`,
    `Guests: ${hold.adults} adults, ${hold.children} children`,
    `Rooms: ${hold.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ')}`,
    hold.roomAssignments.length
      ? `Assigned rooms: ${hold.roomAssignments.map((room) => room.roomNumber).join(', ')}`
      : 'Room numbers pending assignment',
    `Lead: ${hold.leadName} ${hold.leadPhone}`,
    `Deposit required: INR ${hold.depositRequired}`,
    `Status: ${hold.status.replace('_', ' ')}`,
  ].join('\n');
}

type RoomOption = { label: string; roomTypeId: string; value: string };
type RoomingListItem = GroupHoldDto['roomingList'][number];

function isAbortError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && /aborted|abort/i.test(err.message))
  );
}

export function GroupHoldDetailPage({ groupHoldId }: { groupHoldId: string }) {
  const backend = useBackendStatus();
  const router = useRouter();
  const [propertyId, setPropertyId] = useState('');
  const [hold, setHold] = useState<GroupHoldDto | undefined>();
  const [masterFolio, setMasterFolio] = useState<GroupMasterFolioDetailDto | undefined>();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [changeAssignment, setChangeAssignment] = useState<
    GroupHoldDto['roomAssignments'][number] | null
  >(null);
  const [replacementRooms, setReplacementRooms] = useState<RoomOption[]>([]);
  const [replacementRoomId, setReplacementRoomId] = useState<string | null>(null);
  const [isLoadingReplacementRooms, setIsLoadingReplacementRooms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingGuest, setEditingGuest] = useState<RoomingListItem | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<RoomingListItem | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAdults, setEditAdults] = useState(1);
  const [editChildren, setEditChildren] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [extendOpened, setExtendOpened] = useState(false);
  const [extendDepartureDate, setExtendDepartureDate] = useState('');
  const [extendError, setExtendError] = useState('');
  const [isExtending, setIsExtending] = useState(false);
  const hasValidGroupHoldId = Boolean(groupHoldId && groupHoldId !== 'undefined');

  const load = useCallback(
    async (id: string, signal?: AbortSignal) => {
      if (!id || !hasValidGroupHoldId) return;
      setError(undefined);
      const nextHold = await getGroupHold(id, groupHoldId, signal);
      const roomRows = await getAvailableRooms(
        id,
        {
          arrivalDate: nextHold.arrivalDate,
          departureDate: nextHold.departureDate,
        },
        signal,
      );
      setHold(nextHold);
      if (nextHold.status === 'CHECKED_IN' || nextHold.status === 'CHECKED_OUT') {
        try {
          setMasterFolio(await getGroupMasterFolio(id, groupHoldId, signal));
        } catch {
          setMasterFolio(undefined);
        }
      } else {
        setMasterFolio(undefined);
      }
      setRooms(
        roomRows.map((room) => ({
          label: `${room.roomNumber} - ${room.roomType.name || 'Room'}`,
          roomTypeId: room.roomType.id,
          value: room.roomId,
        })),
      );
    },
    [groupHoldId, hasValidGroupHoldId],
  );

  useEffect(() => {
    if (!hasValidGroupHoldId) {
      setError('Group hold link is missing a valid id.');
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    getProperties(controller.signal)
      .then(async (properties) => {
        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        setPropertyId(id);
        await load(id, controller.signal);
        if (!controller.signal.aborted) setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'Unable to load group hold.');
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [groupHoldId, hasValidGroupHoldId, load]);

  const assignableRooms = useMemo(() => {
    if (!hold) return [];
    const allowed = new Set(hold.roomBlocks.map((block) => block.roomTypeId));
    const assigned = new Set(hold.roomAssignments.map((assignment) => assignment.roomId));
    return rooms.filter((room) => allowed.has(room.roomTypeId) && !assigned.has(room.value));
  }, [hold, rooms]);

  const canEditRoomAssignments = hold?.status === 'ON_HOLD' || hold?.status === 'CONFIRMED';

  const totalHeldRooms = hold?.roomBlocks.reduce((sum, block) => sum + block.rooms, 0) ?? 0;

  const hasUnassignedRooms = hold ? hold.roomAssignments.length < totalHeldRooms : false;
  const checkoutAllowed =
    hold?.status === 'CHECKED_IN' &&
    Boolean(masterFolio?.checkoutSummary.checkoutEligible) &&
    Number(masterFolio?.checkoutSummary.balanceDue ?? 0) <= 0.01;
  const canExtendStay = hold?.status === 'CHECKED_IN';

  const openExtendStay = () => {
    if (!hold) return;
    setExtendError('');
    setExtendDepartureDate(hold.departureDate);
    setExtendOpened(true);
  };

  const submitExtendStay = async () => {
    if (!propertyId || !hold || !extendDepartureDate) return;
    setExtendError('');
    setIsExtending(true);
    try {
      await extendGroupStay(propertyId, hold.id, extendDepartureDate);
      setExtendOpened(false);
      await load(propertyId);
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : 'Unable to extend group stay.');
    } finally {
      setIsExtending(false);
    }
  };

  const addGuest = async () => {
    if (!propertyId || !guestName.trim()) return;
    setIsSaving(true);
    try {
      const updated = await addGroupRoomingListItem(propertyId, groupHoldId, {
        adults,
        children,
        guestName: guestName.trim(),
        notes: notes.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setHold(updated);
      setGuestName('');
      setPhone('');
      setAdults(1);
      setChildren(0);
      setNotes('');
      showToast({ color: 'green', message: 'Rooming list updated.', title: 'Guest added' });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to add guest.',
        title: 'Add failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditGuest = (item: RoomingListItem) => {
    setEditingGuest(item);
    setEditGuestName(item.guestName);
    setEditPhone(item.phone ?? '');
    setEditAdults(item.adults);
    setEditChildren(item.children);
    setEditNotes(item.notes ?? '');
  };

  const closeEditGuest = () => {
    if (isSaving) return;
    setEditingGuest(null);
  };

  const saveGuest = async () => {
    if (!propertyId || !editingGuest || !editGuestName.trim()) return;
    setIsSaving(true);
    try {
      const updated = await updateGroupRoomingListItem(propertyId, groupHoldId, editingGuest.id, {
        adults: editAdults,
        children: editChildren,
        guestName: editGuestName.trim(),
        notes: editNotes.trim() || undefined,
        phone: editPhone.trim() || undefined,
      });
      setHold(updated);
      setEditingGuest(null);
      showToast({ color: 'green', message: 'Rooming list updated.', title: 'Guest saved' });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to save guest.',
        title: 'Save failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const closeDeleteGuest = () => {
    if (isSaving) return;
    setDeletingGuest(null);
  };

  const deleteGuest = async () => {
    if (!propertyId || !deletingGuest) return;
    setIsSaving(true);
    try {
      const updated = await deleteGroupRoomingListItem(propertyId, groupHoldId, deletingGuest.id);
      setHold(updated);
      setDeletingGuest(null);
      showToast({ color: 'green', message: 'Rooming list updated.', title: 'Guest deleted' });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to delete guest.',
        title: 'Delete failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const assignRoom = async () => {
    if (!propertyId || !roomId) return;
    setIsSaving(true);
    try {
      const updated = await assignGroupRoom(propertyId, groupHoldId, { roomId });
      setHold(updated);
      setRoomId(null);
      showToast({
        color: 'green',
        message: 'Room assigned to group hold.',
        title: 'Room assigned',
      });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to assign room.',
        title: 'Assignment failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openChangeRoom = async (assignment: GroupHoldDto['roomAssignments'][number]) => {
    if (!propertyId) return;
    setChangeAssignment(assignment);
    setReplacementRoomId(null);
    setReplacementRooms([]);
    setIsLoadingReplacementRooms(true);

    try {
      const candidates = await getGroupRoomChangeCandidates(propertyId, groupHoldId, assignment.id);
      setReplacementRooms(
        candidates.map((room) => ({
          label: `${room.roomNumber} - ${room.roomType.name || 'Room'}`,
          roomTypeId: room.roomType.id,
          value: room.roomId,
        })),
      );
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to load replacement rooms.',
        title: 'Room candidates unavailable',
      });
      setChangeAssignment(null);
    } finally {
      setIsLoadingReplacementRooms(false);
    }
  };

  const closeChangeRoom = () => {
    if (isSaving || isLoadingReplacementRooms) return;
    setChangeAssignment(null);
    setReplacementRoomId(null);
    setReplacementRooms([]);
  };

  const submitRoomChange = async () => {
    if (!propertyId || !hold || !changeAssignment || !replacementRoomId) return;

    setIsSaving(true);
    try {
      const updated = await changeGroupRoom(propertyId, groupHoldId, changeAssignment.id, {
        roomId: replacementRoomId,
      });

      const replacement = replacementRooms.find((room) => room.value === replacementRoomId);

      setHold(updated);
      setChangeAssignment(null);
      setReplacementRoomId(null);
      setReplacementRooms([]);
      await load(propertyId);

      showToast({
        color: 'green',
        message: replacement
          ? `Room ${changeAssignment.roomNumber} changed to ${replacement.label.split(' - ')[0]}.`
          : `Room ${changeAssignment.roomNumber} was changed successfully.`,
        title: 'Room changed',
      });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to change room.',
        title: 'Room change failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmHold = async () => {
    if (!propertyId || !hold) return;
    setIsSaving(true);
    try {
      const updated = await confirmGroupHold(propertyId, hold.id);
      setHold(updated);
      showToast({
        color: 'green',
        message: `${updated.groupCode} is confirmed.`,
        title: 'Group confirmed',
      });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to confirm group.',
        title: 'Confirm failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const completeCheckout = async () => {
    if (!propertyId || !hold) return;
    setIsSaving(true);
    try {
      await completeGroupCheckout(propertyId, hold.id);
      await load(propertyId);
      setHold((current) => (current ? { ...current, status: 'CHECKED_OUT' } : current));
      showToast({
        color: 'green',
        message: 'Checkout completed and the folio is settled.',
        title: 'Checkout complete',
      });
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to complete checkout.',
        title: 'Checkout failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyVoucher = async () => {
    if (!hold) return;
    try {
      await navigator.clipboard.writeText(voucherText(hold));
      showToast({
        color: 'green',
        message: 'Confirmation text is ready to paste into WhatsApp, SMS, or email.',
        title: 'Voucher copied',
      });
    } catch {
      showToast({
        color: 'red',
        message: 'Clipboard access is unavailable in this browser context.',
        title: 'Copy failed',
      });
    }
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteOpened(false);
  };

  const deleteGroup = async () => {
    if (!propertyId || !hold || hold.status !== 'ON_HOLD') return;
    setIsDeleting(true);
    try {
      await deleteGroupHold(propertyId, hold.id);
      showToast({
        color: 'green',
        message: `${hold.groupCode} was permanently deleted.`,
        title: 'Group deleted',
      });
      setDeleteOpened(false);
      router.push('/reservations');
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to delete group.',
        title: 'Delete failed',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!backend.isOnline && backend.status === 'SERVER_STARTING')
    return (
      <ServerStarting
        onAction={() => void backend.retry()}
        onCheckStatus={() => void backend.checkHealth()}
      />
    );
  if (!backend.isOnline && backend.status !== 'CONNECTING')
    return (
      <BackendUnavailable
        onAction={() => void backend.retry()}
        onCheckStatus={() => void backend.checkHealth()}
      />
    );

  return (
    <Box
      py={spacing[5]}
      px={{ base: spacing[2], sm: spacing[4] }}
      style={{ background: '#fbfcff', minHeight: 'calc(100vh - 180px)' }}
    >
      <Stack gap={spacing[3]} maw={1080} mx="auto">
        <Group justify="space-between" align="flex-start" gap={spacing[2]} wrap="wrap">
          <Box style={{ minWidth: 0 }}>
            <Title order={1} c="#101828" style={{ fontSize: 32, fontWeight: 900 }}>
              {hold?.groupCode ?? 'Group Hold'}
            </Title>
            <Text c="#64748b" size="sm">
              {hold
                ? `${hold.groupName} - ${formatDate(hold.arrivalDate)} to ${formatDate(hold.departureDate)}`
                : 'Loading group hold...'}
            </Text>
          </Box>
          <Button component={Link} href="/reservations/group-quote" variant="light" color="gray">
            Back
          </Button>
        </Group>
        {error ? (
          <Alert color="red" variant="light" title="Could not load group hold">
            {error}
          </Alert>
        ) : null}
        {isLoading && !hold && !error ? (
          <Card radius={radius.lg} p={20} style={panelStyle}>
            <Text fw={850} c="#101828">
              Loading group hold…
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              Getting stay details, held inventory, room assignments, and readiness.
            </Text>
          </Card>
        ) : null}
        {hold ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Badge
                  color={
                    hold.status === 'CHECKED_OUT'
                      ? 'gray'
                      : hold.status === 'CHECKED_IN' || hold.status === 'CONFIRMED'
                        ? 'green'
                        : hold.status === 'CANCELLED'
                          ? 'red'
                          : 'yellow'
                  }
                  variant="light"
                >
                  {hold.status.replace(/_/g, ' ')}
                </Badge>
                <Title order={2} mt={8} c="#101828" style={{ fontSize: 18 }}>
                  Lead Contact
                </Title>
                <Text fw={800}>{hold.leadName}</Text>
                <Text c="#64748b" size="sm">
                  {hold.leadPhone}
                </Text>
                <Text c="#64748b" size="sm">
                  {hold.leadEmail ?? 'No email'}
                </Text>
              </Card>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                  Room Mix
                </Title>
                <Stack gap={6} mt={8}>
                  {hold.roomBlocks.map((block) => (
                    <Text key={block.id}>
                      {block.rooms} × {block.roomTypeName}
                    </Text>
                  ))}
                </Stack>
              </Card>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                  Assigned Rooms
                </Title>
                <Text fw={850} size="xl">
                  {hold.roomAssignments.length} /{' '}
                  {hold.roomBlocks.reduce((sum, block) => sum + block.rooms, 0)}
                </Text>
                <Text c="#64748b" size="sm">
                  Room numbers can be assigned before arrival.
                </Text>
              </Card>
            </SimpleGrid>

            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Group justify="space-between" align="flex-start" gap={spacing[2]} wrap="wrap">
                <Box style={{ minWidth: 0 }}>
                  <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                    Arrival Readiness
                  </Title>
                  <Text c="#64748b" size="sm">
                    Use this before confirming or preparing group check-in.
                  </Text>
                </Box>
                <Group gap={8} wrap="wrap">
                  <Button
                    leftSection={<Copy size={14} />}
                    variant="light"
                    color="gray"
                    onClick={() => void copyVoucher()}
                  >
                    Copy Voucher
                  </Button>
                  {hold.status === 'ON_HOLD' ? (
                    <Button
                      leftSection={<CheckCircle2 size={14} />}
                      color="stayosBrand"
                      loading={isSaving}
                      onClick={() => void confirmHold()}
                      disabled={!hold.readiness.canConfirm || isSaving}
                    >
                      Confirm Hold
                    </Button>
                  ) : null}
                  {hold.status === 'CONFIRMED' ? (
                    <Button
                      component={Link}
                      href={`/reservations/group-holds/${hold.id}/check-in`}
                      variant="light"
                      color="green"
                    >
                      Prepare Check-in
                    </Button>
                  ) : null}
                  {hold.status === 'CHECKED_IN' ? (
                    <Button
                      onClick={() => void completeCheckout()}
                      loading={isSaving}
                      variant="light"
                      color="red"
                      disabled={!checkoutAllowed || isSaving}
                    >
                      Complete Checkout
                    </Button>
                  ) : null}
                  {canExtendStay ? (
                    <Button
                      leftSection={<CalendarPlus size={14} />}
                      variant="light"
                      color="stayosBrand"
                      onClick={openExtendStay}
                    >
                      Extend Stay
                    </Button>
                  ) : null}
                  {hold.status === 'CHECKED_IN' || hold.status === 'CHECKED_OUT' ? (
                    <Button
                      component={Link}
                      href={`/reservations/group-holds/${hold.id}/master-folio`}
                      variant="light"
                      color="gray"
                    >
                      Open Folio
                    </Button>
                  ) : null}
                  {hold.status === 'ON_HOLD' ? (
                    <Button variant="light" color="red" onClick={() => setDeleteOpened(true)}>
                      Delete Group
                    </Button>
                  ) : null}
                </Group>
              </Group>
              {hold.status === 'CHECKED_IN' && !checkoutAllowed ? (
                <Alert color="yellow" variant="light" mt={spacing[3]}>
                  {Number(masterFolio?.checkoutSummary.balanceDue ?? 0) > 0.01
                    ? 'Checkout is blocked until the master folio balance is settled.'
                    : 'Checkout is not ready yet. Open the folio to review the remaining checkout requirements.'}
                </Alert>
              ) : null}
              <SimpleGrid cols={{ base: 1, md: 5 }} spacing={spacing[2]} mt={spacing[3]}>
                {[
                  ['Contact', hold.readiness.contactComplete],
                  ['Deposit Policy', true],
                  ['Release Date', hold.readiness.releaseDateSet],
                  ['Rooming List', hold.readiness.roomingListStarted],
                  ['Rooms Assigned', hold.readiness.fullyAssigned],
                ].map(([label, done]) => (
                  <Paper
                    key={String(label)}
                    radius={radius.md}
                    p={10}
                    style={{
                      background: done ? '#f0fdf4' : '#fff7ed',
                      border: `1px solid ${done ? '#bbf7d0' : '#fed7aa'}`,
                    }}
                  >
                    <Text fw={850} c={done ? '#166534' : '#9a3412'}>
                      {String(label)}
                    </Text>
                    <Text size="xs" c={done ? '#166534' : '#9a3412'}>
                      {done ? 'Ready' : 'Pending'}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
            </Card>

            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                    Room Assignments
                  </Title>
                  <Text c="#64748b" size="sm" mt={2}>
                    Assign rooms before arrival, or change an assigned room before check-in.
                  </Text>
                </Box>
                <Badge color={hold.readiness.fullyAssigned ? 'green' : 'yellow'} variant="light">
                  {hold.roomAssignments.length} / {totalHeldRooms} assigned
                </Badge>
              </Group>

              {canEditRoomAssignments && hasUnassignedRooms ? (
                <Group
                  justify="space-between"
                  align="flex-end"
                  gap={spacing[2]}
                  wrap="wrap"
                  mt={spacing[3]}
                >
                  <Select
                    label="Assign room"
                    data={assignableRooms}
                    value={roomId}
                    onChange={setRoomId}
                    searchable
                    placeholder={
                      assignableRooms.length ? 'Choose a room' : 'No assignable rooms available'
                    }
                    nothingFoundMessage="No assignable rooms found"
                    disabled={!assignableRooms.length || isSaving}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <Button
                    leftSection={<BedDouble size={16} />}
                    onClick={() => void assignRoom()}
                    loading={isSaving}
                    disabled={!roomId}
                  >
                    Assign Room
                  </Button>
                </Group>
              ) : null}

              {hold.roomAssignments.length ? (
                <SimpleGrid cols={{ base: 1, md: 2 }} mt={spacing[3]} spacing={spacing[2]}>
                  {hold.roomAssignments.map((assignment) => (
                    <Paper
                      key={assignment.id}
                      radius={radius.md}
                      p={12}
                      style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Box>
                          <Text fw={850}>Room {assignment.roomNumber}</Text>
                          <Text c="#64748b" size="sm">
                            {assignment.roomTypeName}
                          </Text>
                        </Box>
                        {canEditRoomAssignments ? (
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<ArrowRightLeft size={14} />}
                            onClick={() => void openChangeRoom(assignment)}
                          >
                            Change Room
                          </Button>
                        ) : (
                          <Badge color="gray" variant="light">
                            {hold.status === 'CHECKED_IN'
                              ? 'In house'
                              : hold.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              ) : (
                <Text c="#64748b" size="sm" mt={spacing[3]}>
                  No room numbers have been assigned yet.
                </Text>
              )}

              {!canEditRoomAssignments && hold.roomAssignments.length ? (
                <Alert color="blue" variant="light" mt={spacing[3]}>
                  Rooms can be reassigned while the group is on hold or confirmed. After check-in,
                  use the in-house room-move workflow instead.
                </Alert>
              ) : null}
            </Card>

            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Group justify="space-between" align="flex-start" gap={spacing[2]} wrap="wrap">
                <Box>
                  <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                    Rooming List
                  </Title>
                  <Text c="#64748b" size="sm" mt={2}>
                    Add guest or family names before group check-in.
                  </Text>
                </Box>
                <Badge color={hold.roomingList.length ? 'green' : 'gray'} variant="light">
                  {hold.roomingList.length} {hold.roomingList.length === 1 ? 'entry' : 'entries'}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 5 }} spacing={spacing[2]} mt={spacing[2]}>
                <TextInput
                  label="Guest/family name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.currentTarget.value)}
                  disabled={!canEditRoomAssignments || isSaving}
                />
                <TextInput
                  label="Phone"
                  value={phone}
                  onChange={(event) => setPhone(event.currentTarget.value)}
                  disabled={!canEditRoomAssignments || isSaving}
                />
                <NumberInput
                  label="Adults"
                  min={1}
                  value={adults}
                  onChange={(value) => setAdults(Number(value) || 1)}
                  disabled={!canEditRoomAssignments || isSaving}
                />
                <NumberInput
                  label="Children"
                  min={0}
                  value={children}
                  onChange={(value) => setChildren(Number(value) || 0)}
                  disabled={!canEditRoomAssignments || isSaving}
                />
                <TextInput
                  label="Notes"
                  value={notes}
                  onChange={(event) => setNotes(event.currentTarget.value)}
                  disabled={!canEditRoomAssignments || isSaving}
                />
              </SimpleGrid>
              <Button
                mt={spacing[2]}
                leftSection={<Plus size={16} />}
                onClick={() => void addGuest()}
                loading={isSaving}
                disabled={!guestName.trim() || !canEditRoomAssignments || isSaving}
              >
                Add to Rooming List
              </Button>
              {hold.roomingList.length ? (
                <Stack gap={8} mt={spacing[3]}>
                  {hold.roomingList.map((item) => (
                    <Paper
                      key={item.id}
                      radius={radius.md}
                      p={10}
                      style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Box>
                          <Text fw={850}>{item.guestName}</Text>
                          <Text c="#64748b" size="sm">
                            {item.adults} adults, {item.children} children{' '}
                            {item.phone ? `- ${item.phone}` : ''}
                          </Text>
                          {item.notes ? (
                            <Text c="#64748b" size="xs">
                              {item.notes}
                            </Text>
                          ) : null}
                        </Box>
                        {canEditRoomAssignments ? (
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="Edit guest">
                              <ActionIcon
                                aria-label={`Edit ${item.guestName}`}
                                variant="subtle"
                                color="gray"
                                onClick={() => openEditGuest(item)}
                              >
                                <Pencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete guest">
                              <ActionIcon
                                aria-label={`Delete ${item.guestName}`}
                                variant="subtle"
                                color="red"
                                onClick={() => setDeletingGuest(item)}
                              >
                                <Trash2 size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        ) : (
                          <Users size={16} />
                        )}
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Paper
                  radius={radius.md}
                  p={12}
                  mt={spacing[3]}
                  style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}
                >
                  <Text fw={800} c="#101828">
                    No guests added yet
                  </Text>
                  <Text c="#64748b" size="sm">
                    Add the lead guest, family names, or rooming-list contacts as details become
                    available.
                  </Text>
                </Paper>
              )}
            </Card>
          </>
        ) : null}
      </Stack>

      <Modal
        centered
        opened={Boolean(changeAssignment)}
        onClose={closeChangeRoom}
        title="Change Room"
      >
        <Stack gap={spacing[3]}>
          {changeAssignment ? (
            <Paper
              radius={radius.md}
              p={12}
              style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
            >
              <Text c="#64748b" size="xs" fw={700}>
                CURRENT ROOM
              </Text>
              <Text fw={850} mt={2}>
                Room {changeAssignment.roomNumber}
              </Text>
              <Text c="#64748b" size="sm">
                {changeAssignment.roomTypeName}
              </Text>
            </Paper>
          ) : null}

          <Select
            label="Replacement room"
            description="Only rooms that are safe to assign to this group are shown."
            data={replacementRooms}
            value={replacementRoomId}
            onChange={setReplacementRoomId}
            searchable
            clearable={false}
            placeholder={
              isLoadingReplacementRooms
                ? 'Loading replacement rooms...'
                : replacementRooms.length
                  ? 'Choose another room'
                  : 'No safe replacement rooms'
            }
            disabled={isLoadingReplacementRooms || !replacementRooms.length || isSaving}
          />

          {isLoadingReplacementRooms ? (
            <Alert color="blue" variant="light">
              Loading safe replacement rooms.
            </Alert>
          ) : null}

          {!isLoadingReplacementRooms && !replacementRooms.length ? (
            <Alert color="yellow" variant="light">
              No safe replacement room is currently available.
            </Alert>
          ) : null}

          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button variant="subtle" color="gray" onClick={closeChangeRoom} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              leftSection={<ArrowRightLeft size={15} />}
              onClick={() => void submitRoomChange()}
              loading={isSaving}
              disabled={!replacementRoomId || isLoadingReplacementRooms}
            >
              Change Room
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal centered opened={Boolean(editingGuest)} onClose={closeEditGuest} title="Edit Guest">
        <Stack gap={spacing[3]}>
          <TextInput
            label="Guest/family name"
            value={editGuestName}
            onChange={(event) => setEditGuestName(event.currentTarget.value)}
            disabled={isSaving}
          />
          <TextInput
            label="Phone"
            value={editPhone}
            onChange={(event) => setEditPhone(event.currentTarget.value)}
            disabled={isSaving}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <NumberInput
              label="Adults"
              min={1}
              value={editAdults}
              onChange={(value) => setEditAdults(Number(value) || 1)}
              disabled={isSaving}
            />
            <NumberInput
              label="Children"
              min={0}
              value={editChildren}
              onChange={(value) => setEditChildren(Number(value) || 0)}
              disabled={isSaving}
            />
          </SimpleGrid>
          <TextInput
            label="Notes"
            value={editNotes}
            onChange={(event) => setEditNotes(event.currentTarget.value)}
            disabled={isSaving}
          />

          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button variant="subtle" color="gray" onClick={closeEditGuest} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveGuest()}
              loading={isSaving}
              disabled={!editGuestName.trim()}
            >
              Save Guest
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        centered
        opened={Boolean(deletingGuest)}
        onClose={closeDeleteGuest}
        title="Delete Guest"
      >
        <Stack gap={spacing[3]}>
          <Alert color="red" variant="light" title="Permanent action">
            This deletes {deletingGuest?.guestName ?? 'this guest'} from the rooming list.
          </Alert>
          <Text c="#64748b" size="sm">
            The rooming-list count and readiness will update after deletion.
          </Text>

          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button variant="subtle" color="gray" onClick={closeDeleteGuest} disabled={isSaving}>
              Keep Guest
            </Button>
            <Button color="red" onClick={() => void deleteGuest()} loading={isSaving}>
              Delete Guest
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal centered opened={deleteOpened} onClose={closeDeleteModal} title="Delete Group">
        <Stack gap={spacing[3]}>
          <Alert color="red" variant="light" title="Permanent action">
            This permanently deletes {hold?.groupCode ?? 'this group'} and cannot be undone.
          </Alert>
          <Text c="#64748b" size="sm">
            Deletion is only available while the enquiry is still on hold. Confirmed bookings should
            remain in booking history and use the normal cancellation workflow instead.
          </Text>

          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button variant="subtle" color="gray" onClick={closeDeleteModal} disabled={isDeleting}>
              Keep Group
            </Button>
            <Button color="red" onClick={() => void deleteGroup()} loading={isDeleting}>
              Delete Group
            </Button>
          </Group>
        </Stack>
      </Modal>

      <GroupExtendStayModal
        opened={extendOpened}
        group={
          hold
            ? {
                arrivalDate: hold.arrivalDate,
                departureDate: hold.departureDate,
                groupCode: hold.groupCode,
                groupName: hold.groupName,
                roomCount: hold.roomAssignments.length,
              }
            : null
        }
        departureDate={extendDepartureDate}
        error={extendError}
        isLoading={isExtending}
        onClose={() => setExtendOpened(false)}
        onDepartureDateChange={setExtendDepartureDate}
        onSubmit={() => void submitExtendStay()}
      />
    </Box>
  );
}
