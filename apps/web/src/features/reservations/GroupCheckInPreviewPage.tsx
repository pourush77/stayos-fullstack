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
  Modal,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { BedDouble, CheckCircle2, CircleAlert, CreditCard, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties } from '../../lib/inventory-api';
import {
  checkInGroup,
  getGroupCheckInPreview,
  type GroupCheckInPreviewDto,
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatTime(value: string) {
  const [hour = '0', minute = '0'] = value.split(':');
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(`2026-01-01T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`));
}

function roomBadge(room: GroupCheckInPreviewDto['rooms'][number]) {
  if (room.readinessStatus === 'READY') return { color: 'green', label: 'READY' };
  if (room.readinessStatus === 'BLOCKED') return { color: 'red', label: 'BLOCKED' };
  return { color: 'orange', label: 'NOT READY' };
}

export function GroupCheckInPreviewPage({ groupHoldId }: { groupHoldId: string }) {
  const backend = useBackendStatus();
  const router = useRouter();
  const [propertyId, setPropertyId] = useState('');
  const [preview, setPreview] = useState<GroupCheckInPreviewDto | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [confirmOpened, setConfirmOpened] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(undefined);

    getProperties(controller.signal)
      .then(async (properties) => {
        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        if (!id) throw new Error('No active property is available.');

        setPropertyId(id);
        const nextPreview = await getGroupCheckInPreview(id, groupHoldId, controller.signal);
        if (!controller.signal.aborted) setPreview(nextPreview);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load group check-in.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [groupHoldId]);

  const totalRooms = useMemo(
    () => preview?.group.roomBlocks.reduce((sum, block) => sum + block.rooms, 0) ?? 0,
    [preview],
  );

  const assignedRoomNumbers = preview?.rooms.map((room) => room.roomNumber).join(', ') ?? '';

  const finalCheckIn = async () => {
    if (!preview || !propertyId) return;
    if (!preview.canCheckIn) return;
    setConfirmOpened(false);

    setIsCheckingIn(true);
    try {
      const checkedIn = await checkInGroup(propertyId, groupHoldId);
      showToast({
        color: 'green',
        message: `${checkedIn.group.groupCode} checked in with rooms ${checkedIn.occupiedRooms.join(', ')}.`,
        title: 'Group checked in',
      });
      router.push(`/reservations/group-holds/${groupHoldId}`);
    } catch (err) {
      showToast({
        color: 'red',
        message: err instanceof Error ? err.message : 'Unable to check in group.',
        title: 'Check-in failed',
      });
    } finally {
      setIsCheckingIn(false);
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
      <Stack gap={spacing[3]} maw={1120} mx="auto">
        <Group justify="space-between" align="flex-start" gap={spacing[2]} wrap="wrap">
          <Box style={{ minWidth: 0 }}>
            <Title order={1} c="#101828" style={{ fontSize: 32, fontWeight: 900 }}>
              Group Check-in
            </Title>
            <Text c="#64748b" size="sm">
              {preview
                ? `${preview.group.groupCode} · ${preview.group.groupName}`
                : 'Loading group arrival...'}
            </Text>
          </Box>
          <Button
            component={Link}
            href={`/reservations/group-holds/${groupHoldId}`}
            variant="light"
            color="gray"
          >
            Back to Group
          </Button>
        </Group>

        {error ? (
          <Alert color="red" variant="light" title="Could not prepare group check-in">
            {error}
          </Alert>
        ) : null}

        {isLoading && !preview && !error ? (
          <Card radius={radius.lg} p={20} style={panelStyle}>
            <Text fw={850} c="#101828">
              Preparing group check-in…
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              Checking room readiness, assignments, payment status, and arrival requirements.
            </Text>
          </Card>
        ) : null}

        {preview ? (
          <>
            {preview.previewStatus === 'ALREADY_CHECKED_IN' ? (
              <Alert color="blue" icon={<CheckCircle2 size={17} />}>
                This group is already checked in. Return to group detail for in-house actions.
              </Alert>
            ) : (
              <Alert
                color={preview.canCheckIn ? 'green' : 'red'}
                icon={preview.canCheckIn ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
              >
                {preview.canCheckIn
                  ? 'All required rooms are ready for final group check-in.'
                  : 'Resolve blockers before final group check-in.'}
              </Alert>
            )}

            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={2} c="#101828" style={{ fontSize: 20 }}>
                    Arrival Summary
                  </Title>
                  <Text fw={850} mt={6}>
                    {preview.group.groupCode} · {preview.group.groupName}
                  </Text>
                  <Text c="#64748b" size="sm">
                    {formatDate(preview.group.arrivalDate)} to{' '}
                    {formatDate(preview.group.departureDate)}
                  </Text>
                </Box>
                <Badge color="stayosBrand" variant="light">
                  {preview.group.status.replace(/_/g, ' ')}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 2, md: 5 }} spacing={spacing[2]} mt={spacing[3]}>
                <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                  <Text size="xs" c="#64748b" fw={800}>
                    GUESTS
                  </Text>
                  <Text fw={850}>
                    {preview.group.adults} adults, {preview.group.children} children
                  </Text>
                </Paper>
                <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                  <Text size="xs" c="#64748b" fw={800}>
                    ROOMS
                  </Text>
                  <Text fw={850}>
                    {preview.rooms.length} / {totalRooms} assigned
                  </Text>
                </Paper>
                <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                  <Text size="xs" c="#64748b" fw={800}>
                    LEAD
                  </Text>
                  <Text fw={850}>{preview.group.leadName}</Text>
                  <Text c="#64748b" size="sm">
                    {preview.group.leadPhone}
                  </Text>
                </Paper>
                <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                  <Text size="xs" c="#64748b" fw={800}>
                    FOLIO
                  </Text>
                  <Text fw={850}>{preview.folioMode.replaceAll('_', ' ')}</Text>
                </Paper>
                <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                  <Text size="xs" c="#64748b" fw={800}>
                    PAYMENT
                  </Text>
                  <Text fw={850}>{preview.paymentSummary.paymentStatus.replace(/_/g, ' ')}</Text>
                </Paper>
              </SimpleGrid>
            </Card>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Group gap={8}>
                  <BedDouble size={18} />
                  <Title order={2} c="#101828" style={{ fontSize: 20 }}>
                    Room Readiness
                  </Title>
                </Group>
                <Stack gap={8} mt={spacing[3]}>
                  {preview.rooms.map((room) => {
                    const badge = roomBadge(room);
                    return (
                      <Paper
                        key={room.roomId}
                        radius={radius.md}
                        p={12}
                        style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
                      >
                        <Group justify="space-between">
                          <Box>
                            <Text fw={850}>Room {room.roomNumber}</Text>
                            <Text c="#64748b" size="sm">
                              {room.roomTypeName}
                            </Text>
                            {room.issue ? (
                              <Text c="#9a3412" size="sm">
                                {room.issue}
                              </Text>
                            ) : null}
                          </Box>
                          <Stack gap={4} align="flex-end">
                            <Badge color={badge.color} variant="light">
                              {badge.label}
                            </Badge>
                            <Text c="#64748b" size="xs">
                              {room.operationalStatus.replaceAll('_', ' ')}
                            </Text>
                          </Stack>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Card>

              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Group gap={8}>
                  <Users size={18} />
                  <Title order={2} c="#101828" style={{ fontSize: 20 }}>
                    Rooming List / Guests
                  </Title>
                </Group>
                <Stack gap={8} mt={spacing[3]}>
                  {preview.group.roomingList.map((item) => {
                    const assignment = preview.group.roomAssignments.find(
                      (room) => room.roomId === item.assignedRoomId,
                    );
                    return (
                      <Paper
                        key={item.id}
                        radius={radius.md}
                        p={12}
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
                          <Badge color="gray" variant="light">
                            {assignment ? `Room ${assignment.roomNumber}` : 'Room pending'}
                          </Badge>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Group gap={8}>
                  <CreditCard size={18} />
                  <Title order={2} c="#101828" style={{ fontSize: 20 }}>
                    Payment / Deposit Summary
                  </Title>
                </Group>
                <Stack gap={8} mt={spacing[3]}>
                  {[
                    ['Estimated total', preview.paymentSummary.estimatedTotal],
                    ['Deposit required', preview.paymentSummary.depositRequired],
                    ['Deposit received', preview.paymentSummary.depositPaid],
                    ['Total paid', preview.paymentSummary.totalPaid],
                    ['Balance due', preview.paymentSummary.balanceDue],
                  ].map(([label, value]) => (
                    <Group key={String(label)} justify="space-between">
                      <Text c="#64748b">{label}</Text>
                      <Text fw={850}>{formatMoney(Number(value))}</Text>
                    </Group>
                  ))}
                </Stack>
              </Card>

              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Title order={2} c="#101828" style={{ fontSize: 20 }}>
                  Arrival Details
                </Title>
                <SimpleGrid cols={2} spacing={spacing[2]} mt={spacing[3]}>
                  <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                    <Text size="xs" c="#64748b" fw={800}>
                      STANDARD CHECK-IN
                    </Text>
                    <Text fw={850}>{formatTime(preview.arrivalDetails.standardCheckInTime)}</Text>
                  </Paper>
                  <Paper radius={radius.md} p={10} style={{ background: '#f8fafc' }}>
                    <Text size="xs" c="#64748b" fw={800}>
                      STANDARD CHECKOUT
                    </Text>
                    <Text fw={850}>{formatTime(preview.arrivalDetails.standardCheckOutTime)}</Text>
                  </Paper>
                </SimpleGrid>
                <Divider my={spacing[3]} />
                <Group justify="space-between">
                  <Text c="#64748b">Actual check-in</Text>
                  <Text fw={850}>
                    {new Date(preview.arrivalDetails.actualCheckInTime).toLocaleString('en-IN')}
                  </Text>
                </Group>
                <Group justify="space-between" mt={8}>
                  <Text c="#64748b">Early check-in</Text>
                  <Badge
                    color={preview.arrivalDetails.earlyCheckIn ? 'orange' : 'green'}
                    variant="light"
                  >
                    {preview.arrivalDetails.earlyCheckIn ? 'Yes' : 'No'}
                  </Badge>
                </Group>
              </Card>
            </SimpleGrid>

            {preview.blockers.length || preview.warnings.length ? (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
                {preview.blockers.length ? (
                  <Alert color="red" title="Resolve before check-in">
                    <Stack gap={4}>
                      {preview.blockers.map((item) => (
                        <Text key={item}>{item}</Text>
                      ))}
                    </Stack>
                  </Alert>
                ) : null}
                {preview.warnings.length ? (
                  <Alert color="yellow" title="Review before check-in">
                    <Stack gap={4}>
                      {preview.warnings.map((item) => (
                        <Text key={item}>{item}</Text>
                      ))}
                    </Stack>
                  </Alert>
                ) : null}
              </SimpleGrid>
            ) : null}

            {preview.previewStatus !== 'ALREADY_CHECKED_IN' ? (
              <Group justify="flex-end" gap={8} wrap="wrap">
                <Button
                  color="stayosBrand"
                  size="md"
                  leftSection={<CheckCircle2 size={16} />}
                  loading={isCheckingIn}
                  disabled={!preview.canCheckIn || isCheckingIn}
                  onClick={() => setConfirmOpened(true)}
                >
                  Check In {preview.rooms.length} {preview.rooms.length === 1 ? 'Room' : 'Rooms'}
                </Button>
              </Group>
            ) : (
              <Group justify="flex-end">
                <Button
                  component={Link}
                  href={`/reservations/group-holds/${groupHoldId}`}
                  color="stayosBrand"
                >
                  Return to Group
                </Button>
              </Group>
            )}
          </>
        ) : null}
      </Stack>

      <Modal
        centered
        opened={confirmOpened}
        onClose={() => {
          if (!isCheckingIn) setConfirmOpened(false);
        }}
        title="Confirm group check-in"
      >
        <Stack gap={spacing[3]}>
          <Alert color="blue" variant="light">
            This will check in the group and occupy all assigned rooms.
          </Alert>
          <Box>
            <Text fw={850}>
              {preview?.group.groupCode} · {preview?.group.groupName}
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              {preview?.rooms.length ?? 0} {(preview?.rooms.length ?? 0) === 1 ? 'room' : 'rooms'}:{' '}
              {assignedRoomNumbers || 'No rooms assigned'}
            </Text>
          </Box>
          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button
              variant="subtle"
              color="gray"
              disabled={isCheckingIn}
              onClick={() => setConfirmOpened(false)}
            >
              Go back
            </Button>
            <Button
              color="stayosBrand"
              leftSection={<CheckCircle2 size={16} />}
              loading={isCheckingIn}
              disabled={!preview?.canCheckIn}
              onClick={() => void finalCheckIn()}
            >
              Confirm check-in
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
