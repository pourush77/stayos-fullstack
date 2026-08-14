'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
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
} from '@mantine/core';
import { ArrowRightLeft, BedDouble, CheckCircle2, Copy, Plus, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties } from '../../lib/inventory-api';
import {
  addGroupRoomingListItem,
  assignGroupRoom,
  changeGroupRoom,
  completeGroupCheckout,
  confirmGroupHold,
  getAvailableRooms,
  deleteGroupHold,
  getGroupHold,
  type GroupHoldDto,
} from '../../lib/operations-api';

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
  const [replacementRoomId, setReplacementRoomId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasValidGroupHoldId = Boolean(groupHoldId && groupHoldId !== 'undefined');

  const load = async (id = propertyId, signal?: AbortSignal) => {
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
    setRooms(
      roomRows.map((room) => ({
        label: `${room.roomNumber} - ${room.roomType.name || 'Room'}`,
        roomTypeId: room.roomType.id,
        value: room.roomId,
      })),
    );
  };

  useEffect(() => {
    if (!hasValidGroupHoldId) {
      setError('Group hold link is missing a valid id.');
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
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'Unable to load group hold.');
      });
    return () => controller.abort();
  }, [groupHoldId, hasValidGroupHoldId]);

  const assignableRooms = useMemo(() => {
    if (!hold) return [];
    const allowed = new Set(hold.roomBlocks.map((block) => block.roomTypeId));
    const assigned = new Set(hold.roomAssignments.map((assignment) => assignment.roomId));
    return rooms.filter((room) => allowed.has(room.roomTypeId) && !assigned.has(room.value));
  }, [hold, rooms]);

  const replacementRooms = useMemo(() => {
    if (!hold || !changeAssignment) return [];

    const assigned = new Set(hold.roomAssignments.map((assignment) => assignment.roomId));

    return rooms.filter(
      (room) =>
        room.roomTypeId === changeAssignment.roomTypeId &&
        room.value !== changeAssignment.roomId &&
        !assigned.has(room.value),
    );
  }, [changeAssignment, hold, rooms]);

  const canEditRoomAssignments = hold?.status === 'ON_HOLD' || hold?.status === 'CONFIRMED';

  const totalHeldRooms = hold?.roomBlocks.reduce((sum, block) => sum + block.rooms, 0) ?? 0;

  const hasUnassignedRooms = hold ? hold.roomAssignments.length < totalHeldRooms : false;

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

  const openChangeRoom = (assignment: GroupHoldDto['roomAssignments'][number]) => {
    setChangeAssignment(assignment);
    setReplacementRoomId(null);
  };

  const closeChangeRoom = () => {
    if (isSaving) return;
    setChangeAssignment(null);
    setReplacementRoomId(null);
  };

  const submitRoomChange = async () => {
    if (!propertyId || !hold || !changeAssignment || !replacementRoomId) return;

    setIsSaving(true);
    try {
      const updated = await changeGroupRoom(propertyId, groupHoldId, changeAssignment.id, {
        roomId: replacementRoomId,
      });

      const replacement = rooms.find((room) => room.value === replacementRoomId);

      setHold(updated);
      setChangeAssignment(null);
      setReplacementRoomId(null);

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
    await navigator.clipboard.writeText(voucherText(hold));
    showToast({ color: 'green', message: 'Confirmation text copied.', title: 'Voucher copied' });
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
        <Group justify="space-between">
          <Box>
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
        {error ? <Alert color="red">{error}</Alert> : null}
        {hold ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Badge color="yellow" variant="light">
                  {hold.status.replace('_', ' ')}
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
                  Held Inventory
                </Title>
                <Stack gap={6} mt={8}>
                  {hold.roomBlocks.map((block) => (
                    <Text key={block.id}>
                      {block.rooms} x {block.roomTypeName}
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
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                    Arrival Readiness
                  </Title>
                  <Text c="#64748b" size="sm">
                    Use this before confirming or preparing group check-in.
                  </Text>
                </Box>
                <Group gap={8}>
                  <Button
                    leftSection={<Copy size={14} />}
                    variant="light"
                    color="gray"
                    onClick={() => void copyVoucher()}
                  >
                    Copy Voucher
                  </Button>
                  <Button
                    leftSection={<CheckCircle2 size={14} />}
                    color="stayosBrand"
                    loading={isSaving}
                    onClick={() => void confirmHold()}
                    disabled={!hold.readiness.canConfirm}
                  >
                    Confirm Hold
                  </Button>
                  <Button
                    component={Link}
                    href={`/reservations/group-holds/${hold.id}/check-in`}
                    variant="light"
                    color="green"
                    disabled={hold.status !== 'CONFIRMED'}
                  >
                    Prepare Check-in
                  </Button>
                  <Button
                    onClick={() => void completeCheckout()}
                    loading={isSaving}
                    variant="light"
                    color="red"
                    disabled={hold.status !== 'CHECKED_IN'}
                  >
                    {hold.status === 'CHECKED_OUT' ? 'Checked Out' : 'Complete Checkout'}
                  </Button>
                  <Button
                    component={Link}
                    href={`/reservations/group-holds/${hold.id}/master-folio`}
                    variant="light"
                    color="gray"
                  >
                    Open Folio
                  </Button>
                  {hold.status === 'ON_HOLD' ? (
                    <Button variant="light" color="red" onClick={() => setDeleteOpened(true)}>
                      Delete Group
                    </Button>
                  ) : null}
                </Group>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 5 }} spacing={spacing[2]} mt={spacing[3]}>
                {[
                  ['Contact', hold.readiness.contactComplete],
                  ['Deposit Terms', hold.readiness.depositRequired],
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
                <Group justify="space-between" align="flex-end" mt={spacing[3]}>
                  <Select
                    label="Assign room"
                    data={assignableRooms}
                    value={roomId}
                    onChange={setRoomId}
                    searchable
                    placeholder="Choose a room"
                    style={{ flex: 1 }}
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
                            onClick={() => openChangeRoom(assignment)}
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
              <Title order={2} c="#101828" style={{ fontSize: 18 }}>
                Rooming List
              </Title>
              <SimpleGrid cols={{ base: 1, md: 5 }} spacing={spacing[2]} mt={spacing[2]}>
                <TextInput
                  label="Guest/family name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.currentTarget.value)}
                />
                <TextInput
                  label="Phone"
                  value={phone}
                  onChange={(event) => setPhone(event.currentTarget.value)}
                />
                <NumberInput
                  label="Adults"
                  min={1}
                  value={adults}
                  onChange={(value) => setAdults(Number(value) || 1)}
                />
                <NumberInput
                  label="Children"
                  min={0}
                  value={children}
                  onChange={(value) => setChildren(Number(value) || 0)}
                />
                <TextInput
                  label="Notes"
                  value={notes}
                  onChange={(event) => setNotes(event.currentTarget.value)}
                />
              </SimpleGrid>
              <Button
                mt={spacing[2]}
                leftSection={<Plus size={16} />}
                onClick={() => void addGuest()}
                loading={isSaving}
                disabled={!guestName.trim()}
              >
                Add to Rooming List
              </Button>
              <Stack gap={8} mt={spacing[3]}>
                {hold.roomingList.map((item) => (
                  <Paper
                    key={item.id}
                    radius={radius.md}
                    p={10}
                    style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
                  >
                    <Group justify="space-between">
                      <Box>
                        <Text fw={850}>{item.guestName}</Text>
                        <Text c="#64748b" size="sm">
                          {item.adults} adults, {item.children} children{' '}
                          {item.phone ? `- ${item.phone}` : ''}
                        </Text>
                      </Box>
                      <Users size={16} />
                    </Group>
                  </Paper>
                ))}
              </Stack>
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
            description="Only rooms of the same room type that are not already assigned to this group are shown."
            data={replacementRooms}
            value={replacementRoomId}
            onChange={setReplacementRoomId}
            searchable
            placeholder={
              replacementRooms.length ? 'Choose another room' : 'No compatible replacement rooms'
            }
            disabled={!replacementRooms.length || isSaving}
          />

          {!replacementRooms.length ? (
            <Alert color="yellow" variant="light">
              No compatible replacement room is available in the current room list. Try again after
              availability changes.
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={closeChangeRoom} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              leftSection={<ArrowRightLeft size={15} />}
              onClick={() => void submitRoomChange()}
              loading={isSaving}
              disabled={!replacementRoomId}
            >
              Change Room
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal centered opened={deleteOpened} onClose={closeDeleteModal} title="Delete Group">
        <Stack gap={spacing[3]}>
          <div>
            This will permanently delete {hold?.groupCode ?? 'this group'}. This action cannot be
            undone.
          </div>
          <div>
            If the group is already confirmed, use Cancel Group instead so the booking history is
            kept.
          </div>

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={closeDeleteModal} disabled={isDeleting}>
              Keep Group
            </Button>
            <Button color="red" onClick={() => void deleteGroup()} loading={isDeleting}>
              Delete Group
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
