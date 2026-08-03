'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { BedDouble, CheckCircle2, Copy, Plus, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties, getPropertyRooms } from '../../lib/inventory-api';
import {
  addGroupRoomingListItem,
  assignGroupRoom,
  completeGroupCheckout,
  confirmGroupHold,
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

export function GroupHoldDetailPage({ groupHoldId }: { groupHoldId: string }) {
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [hold, setHold] = useState<GroupHoldDto | undefined>();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = async (id = propertyId) => {
    if (!id) return;
    const [nextHold, roomRows] = await Promise.all([
      getGroupHold(id, groupHoldId),
      getPropertyRooms(id),
    ]);
    setHold(nextHold);
    setRooms(
      (roomRows as Array<Record<string, unknown>>).map((room) => ({
        label: `${String(room.roomNumber)} - ${String((room.roomType as { name?: string } | undefined)?.name ?? 'Room')}`,
        roomTypeId: String(
          (room.roomType as { id?: string } | undefined)?.id ?? room.roomTypeId ?? '',
        ),
        value: String(room.id),
      })),
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    getProperties(controller.signal)
      .then(async (properties) => {
        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        setPropertyId(id);
        await load(id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load group hold.'));
    return () => controller.abort();
  }, [groupHoldId]);

  const assignableRooms = useMemo(() => {
    if (!hold) return [];
    const allowed = new Set(hold.roomBlocks.map((block) => block.roomTypeId));
    const assigned = new Set(hold.roomAssignments.map((assignment) => assignment.roomId));
    return rooms.filter((room) => allowed.has(room.roomTypeId) && !assigned.has(room.value));
  }, [hold, rooms]);

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
              <Group justify="space-between" align="flex-end">
                <Select
                  label="Assign room"
                  data={assignableRooms}
                  value={roomId}
                  onChange={setRoomId}
                  searchable
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
              <SimpleGrid cols={{ base: 1, md: 3 }} mt={spacing[3]}>
                {hold.roomAssignments.map((assignment) => (
                  <Paper
                    key={assignment.id}
                    radius={radius.md}
                    p={10}
                    style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
                  >
                    <Text fw={850}>{assignment.roomNumber}</Text>
                    <Text c="#64748b" size="sm">
                      {assignment.roomTypeName}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
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
    </Box>
  );
}
