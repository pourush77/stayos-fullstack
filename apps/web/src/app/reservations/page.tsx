'use client';

import Link from 'next/link';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Menu,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import {
  BedDouble,
  CalendarDays,
  DoorOpen,
  Edit3,
  FileText,
  KeyRound,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  UserCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import {
  BackendUnavailable,
  EmptyData,
  GenericError,
  ServerStarting,
  StayOSOperationsCard,
  StayOSStatusBadge,
  useBackendStatus,
} from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';
import {
  type BookingStatus,
  type PaymentStatus,
  type Reservation,
  type ReservationSummary,
  useReservationDetails,
  useReservations,
} from '../../lib/reservation-hooks';

const statusOptions = ['All', 'Confirmed', 'Checked-in', 'Pending', 'Cancelled', 'No-show'];
const sourceOptions = ['All', 'Direct', 'Website', 'OTA', 'Corporate', 'Walk-in'];
const roomTypeOptions = [
  'All',
  'Standard',
  'Deluxe',
  'Premium King',
  'Suite',
  'Presidential Suite',
];

function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 420;
    const steps = 18;
    let current = 0;
    const interval = window.setInterval(() => {
      current += 1;
      setCount(Math.round((value * current) / steps));
      if (current >= steps) window.clearInterval(interval);
    }, duration / steps);

    return () => window.clearInterval(interval);
  }, [value]);

  return <>{count}</>;
}

function paymentMeta(status: PaymentStatus) {
  if (status === 'Paid') return { label: 'Paid', icon: '●', tone: 'success' as StayOSStatusTone };
  if (status === 'Partially Paid')
    return { label: 'Partial', icon: '●', tone: 'attention' as StayOSStatusTone };
  return { label: 'Due', icon: '●', tone: 'danger' as StayOSStatusTone };
}

function statusMeta(status: BookingStatus) {
  if (status === 'Confirmed')
    return { label: 'Confirmed', icon: '✓', tone: 'success' as StayOSStatusTone };
  if (status === 'Checked-in')
    return { label: 'Checked-in', icon: '⌂', tone: 'info' as StayOSStatusTone };
  if (status === 'Checked-out')
    return { label: 'Checked-out', icon: '↗', tone: 'muted' as StayOSStatusTone };
  if (status === 'Cancelled')
    return { label: 'Cancelled', icon: '×', tone: 'danger' as StayOSStatusTone };
  if (status === 'No-show')
    return { label: 'No-show', icon: '!', tone: 'danger' as StayOSStatusTone };
  return { label: 'Pending', icon: '●', tone: 'attention' as StayOSStatusTone };
}

function TokenBadge({
  label,
  icon,
  tone,
}: {
  label: string;
  icon: string;
  tone: StayOSStatusTone;
}) {
  return <StayOSStatusBadge tone={tone}>{`${icon} ${label}`}</StayOSStatusBadge>;
}

function SummaryStrip({ summary }: { summary: ReservationSummary }) {
  const items = [
    {
      label: "Today's Arrivals",
      value: summary.todayArrivals,
      detail: 'Confirmed and pending arrivals today',
      tone: 'success',
      icon: <DoorOpen size={17} />,
    },
    {
      label: 'Tomorrow Arrivals',
      value: summary.tomorrowArrivals,
      detail: 'Confirmed and pending arrivals tomorrow',
      tone: 'info',
      icon: <CalendarDays size={17} />,
    },
    {
      label: 'Pending Payments',
      value: summary.pendingPayments,
      detail: 'Payment due or partial balance',
      tone: 'danger',
      icon: <Wallet size={17} />,
    },
    {
      label: 'Unassigned Rooms',
      value: summary.unassignedRooms,
      detail: 'Bookings without a room assigned',
      tone: 'attention',
      icon: <BedDouble size={17} />,
    },
    {
      label: 'Today’s Departures',
      value: summary.departuresToday ?? 0,
      detail: 'Departures scheduled for today',
      tone: 'muted',
      icon: <XCircle size={17} />,
    },
    {
      label: 'Checked-in Today',
      value: summary.checkedInToday ?? 0,
      detail: 'Guests checked in today',
      tone: 'info',
      icon: <UserCheck size={17} />,
    },
    {
      label: 'VIP Bookings',
      value: summary.vipBookings,
      detail: 'VIP guests only',
      tone: 'premium',
      icon: <UserCheck size={17} />,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
      {items.map((item) => (
        <StayOSOperationsCard
          key={item.label}
          title={item.label}
          value={<CountUp value={item.value} />}
          detail={item.detail}
          icon={item.icon}
          tone={item.tone as StayOSStatusTone}
        />
      ))}
    </SimpleGrid>
  );
}

function Filters({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  return (
    <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group gap={spacing[3]} align="center">
        <TextInput
          leftSection={<Search size={16} />}
          placeholder="Search booking ID, guest, phone or company..."
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 280 }}
          styles={{ input: { minHeight: 44 } }}
        />
        <Select w={{ base: 150, md: 180 }} data={statusOptions} defaultValue="All" />
        <DatePickerInput
          w={{ base: 190, md: 230 }}
          type="range"
          placeholder="Date range"
          leftSection={<CalendarDays size={16} />}
        />
        <Popover width={300} position="bottom-end" shadow="md">
          <Popover.Target>
            <Button
              variant="light"
              color="stayosBrand"
              leftSection={<SlidersHorizontal size={16} />}
            >
              More filters
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap={spacing[3]}>
              <Select label="Source" data={sourceOptions} defaultValue="All" />
              <Select label="Room type" data={roomTypeOptions} defaultValue="All" />
              <Select
                label="Payment"
                data={['All', 'Paid', 'Payment Due', 'Partially Paid']}
                defaultValue="All"
              />
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </Card>
  );
}

function ReservationActions({ reservation }: { reservation: Reservation }) {
  return (
    <Menu position="bottom-end" shadow="md" width={180}>
      <Menu.Target>
        <ActionIcon
          aria-label={`Actions for ${reservation.id}`}
          color="gray"
          variant="subtle"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
        <Menu.Item leftSection={<FileText size={14} />}>View Booking</Menu.Item>
        <Menu.Item
          component={Link}
          href={reservation.guestHref ?? '/guests'}
          leftSection={<UserCheck size={14} />}
        >
          Open Guest 360
        </Menu.Item>
        {reservation.stayHref ? (
          <Menu.Item
            component={Link}
            href={reservation.stayHref}
            leftSection={<DoorOpen size={14} />}
          >
            Open Stay Workspace
          </Menu.Item>
        ) : (
          <Menu.Item leftSection={<KeyRound size={14} />}>Check-in</Menu.Item>
        )}
        <Menu.Item leftSection={<BedDouble size={14} />}>Assign Room</Menu.Item>
        <Menu.Item leftSection={<Wallet size={14} />}>Invoice</Menu.Item>
        <Menu.Item leftSection={<Printer size={14} />}>Print</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<XCircle size={14} />}>
          Cancel
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function ReservationDrawer({
  reservation,
  opened,
  onClose,
}: {
  reservation: Reservation | null;
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(92vw, 520px)"
      title="Booking details"
    >
      {reservation ? (
        <Stack gap={spacing[5]}>
          <Box>
            <Title order={2} style={typography.styles.h2}>
              {reservation.guest}
            </Title>
            {reservation.isVip ? (
              <Badge color="stayosBrand" variant="light" mt={spacing[2]}>
                VIP
              </Badge>
            ) : null}
            <Button
              component={Link}
              href={reservation.guestHref ?? '/guests'}
              mt={spacing[3]}
              size="xs"
              variant="light"
              color="stayosBrand"
            >
              Open Guest 360
            </Button>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {reservation.id} · {reservation.phone}
            </Text>
          </Box>

          <SimpleGrid cols={2} spacing={spacing[3]}>
            <Paper p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text style={typography.styles.caption} c={colors.text.muted}>
                Stay dates
              </Text>
              <Text mt={spacing[1]} style={typography.styles.label}>
                {reservation.stayDates}
              </Text>
            </Paper>
            <Paper p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text style={typography.styles.caption} c={colors.text.muted}>
                Room
              </Text>
              <Text mt={spacing[1]} style={typography.styles.label}>
                {reservation.room} · {reservation.roomType}
              </Text>
            </Paper>
            <Paper p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text style={typography.styles.caption} c={colors.text.muted}>
                Payment
              </Text>
              <Group mt={spacing[1]} gap={spacing[2]}>
                <TokenBadge {...paymentMeta(reservation.payment)} />
              </Group>
            </Paper>
            <Paper p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text style={typography.styles.caption} c={colors.text.muted}>
                Amount
              </Text>
              <Text mt={spacing[1]} style={typography.styles.label}>
                {reservation.amount}
              </Text>
            </Paper>
          </SimpleGrid>

          <Box>
            <Text style={typography.styles.label}>Notes</Text>
            <Text mt={spacing[2]} c={colors.text.body} style={typography.styles.small}>
              {reservation.notes}
            </Text>
          </Box>

          <Box>
            <Text style={typography.styles.label}>Special requests</Text>
            <Group mt={spacing[2]} gap={spacing[2]}>
              {reservation.requests.map((request) => (
                <Badge key={request} color="stayosBrand" variant="light">
                  {request}
                </Badge>
              ))}
            </Group>
          </Box>

          <Box>
            <Text style={typography.styles.label}>Timeline</Text>
            <Stack mt={spacing[2]} gap={spacing[2]}>
              {reservation.timeline.map((item) => (
                <Group key={item} gap={spacing[2]} wrap="nowrap">
                  <Box w={7} h={7} bg={colors.brand[500]} style={{ borderRadius: radius.full }} />
                  <Text c={colors.text.body} style={typography.styles.small}>
                    {item}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>

          <Divider />

          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={spacing[3]}>
            {reservation.stayHref ? (
              <Button
                component={Link}
                href={reservation.stayHref}
                leftSection={<DoorOpen size={16} />}
                color="stayosBrand"
              >
                Open Stay Workspace
              </Button>
            ) : (
              <Button leftSection={<KeyRound size={16} />} color="stayosBrand">
                Check-in
              </Button>
            )}
            <Button leftSection={<Edit3 size={16} />} variant="light" color="stayosBrand">
              Edit Booking
            </Button>
            <Button leftSection={<Wallet size={16} />} variant="light" color="stayosBrand">
              Collect Payment
            </Button>
            <Button leftSection={<BedDouble size={16} />} variant="light" color="stayosBrand">
              Assign Room
            </Button>
            <Button leftSection={<XCircle size={16} />} variant="subtle" color="red">
              Cancel Booking
            </Button>
          </SimpleGrid>
        </Stack>
      ) : null}
    </Drawer>
  );
}

export default function ReservationsPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadReservations =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const reservationsState = useReservations({
    allowMockFallback,
    enabled: canLoadReservations,
  });
  const reservations = reservationsState.reservations;
  const [query, setQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const reservationDetails = useReservationDetails({
    allowMockFallback,
    enabled: canLoadReservations && opened,
    reservationId: selectedReservation?.backendId,
  });
  const drawerReservation = reservationDetails.reservation ?? selectedReservation;

  const filteredReservations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return reservations;

    return reservations.filter((reservation) =>
      [
        reservation.id,
        reservation.guest,
        reservation.phone,
        reservation.room,
        reservation.roomType,
        reservation.source,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, reservations]);

  const openReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    open();
  };

  const retryBackend = () => {
    void backend.retry();
  };

  const checkBackendStatus = () => {
    void backend.checkHealth();
  };

  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title order={1} style={typography.styles.h1}>
          Bookings
        </Title>
        <Text mt={spacing[1]} c={colors.text.body} style={typography.styles.body}>
          Manage upcoming stays, arrivals and bookings.
        </Text>
        <Text mt={spacing[3]} c={colors.text.strong} style={typography.styles.label}>
          {reservations.length} bookings · {reservationsState.summary.pendingPayments} pending
          payments · {reservationsState.summary.vipBookings} VIP
        </Text>
      </Box>
      <Button
        component={Link}
        href="/reservations/availability"
        leftSection={<Plus size={16} />}
        color="stayosBrand"
        size="md"
      >
        New Booking
      </Button>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return (
      <Stack gap={spacing[5]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <Stack gap={spacing[5]}>
        {pageHeader}
        <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (
    !allowMockFallback &&
    backend.status === 'CONNECTING' &&
    backend.lastSuccessfulConnection === null &&
    reservations.length === 0
  ) {
    return (
      <Stack gap={spacing[5]}>
        {pageHeader}
        <ServerStarting
          title="Connecting to StayOS"
          detail="We are checking the hotel server before loading live reservations."
          onAction={retryBackend}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  if (
    !allowMockFallback &&
    reservationsState.error &&
    !reservationsState.isLoading &&
    reservations.length === 0
  ) {
    return (
      <Stack gap={spacing[5]}>
        {pageHeader}
        <GenericError
          onAction={() => void reservationsState.refreshReservations()}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[5]}>
      {pageHeader}

      <SummaryStrip summary={reservationsState.summary} />

      {reservationsState.isLoading ? (
        <Alert color="blue" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Loading live reservations...
        </Alert>
      ) : null}

      {reservationsState.isFallback && reservationsState.error ? (
        <Alert color="yellow" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Bookings is showing mock data while the backend is
          unavailable.
        </Alert>
      ) : null}
      <Filters query={query} setQuery={setQuery} />

      <Skeleton visible={false} radius={radius.lg}>
        {reservations.length === 0 && !reservationsState.isLoading ? (
          <EmptyData
            title="No bookings yet"
            detail="The active property has no bookings to show yet."
          />
        ) : filteredReservations.length > 0 ? (
          <>
            <Card
              visibleFrom="md"
              p={0}
              radius={radius.lg}
              shadow="xs"
              style={{ border: 'none', overflow: 'hidden' }}
            >
              <Table verticalSpacing={spacing[5]} horizontalSpacing={spacing[5]} highlightOnHover>
                <Table.Thead bg={colors.surface.subtle}>
                  <Table.Tr>
                    <Table.Th>Guest</Table.Th>
                    <Table.Th>Stay Dates</Table.Th>
                    <Table.Th>Booking</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Payment</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Next action</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredReservations.map((reservation) => (
                    <Table.Tr
                      key={reservation.id}
                      onClick={() => openReservation(reservation)}
                      style={{
                        borderLeft: `3px solid ${colors.brand[500]}`,
                        cursor: 'pointer',
                        transition:
                          'box-shadow 200ms ease, transform 200ms ease, background 200ms ease',
                      }}
                    >
                      <Table.Td>
                        <Text
                          component={Link}
                          href={reservation.guestHref ?? '/guests'}
                          onClick={(event) => event.stopPropagation()}
                          c={colors.text.strong}
                          style={{ ...typography.styles.h3, textDecoration: 'none' }}
                        >
                          {reservation.guest}
                        </Text>
                        {reservation.isVip ? (
                          <Badge color="stayosBrand" variant="light" mt={spacing[1]}>
                            VIP
                          </Badge>
                        ) : null}
                        <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
                          {reservation.room}
                        </Text>
                        <Text
                          c={colors.text.muted}
                          mt={spacing[1]}
                          style={typography.styles.caption}
                        >
                          {reservation.occupancy}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text style={typography.styles.label}>{reservation.stayDates}</Text>
                        <Text c={colors.text.muted} style={typography.styles.caption}>
                          {reservation.nights} Nights
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text style={typography.styles.label}>{reservation.id}</Text>
                        <Text
                          c={colors.text.muted}
                          mt={spacing[1]}
                          style={typography.styles.caption}
                        >
                          📞 {reservation.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>{reservation.source}</Table.Td>
                      <Table.Td>
                        <TokenBadge {...paymentMeta(reservation.payment)} />
                      </Table.Td>
                      <Table.Td>
                        <TokenBadge {...statusMeta(reservation.status)} />
                      </Table.Td>
                      <Table.Td>
                        {reservation.stayHref ? (
                          <Button
                            component={Link}
                            href={reservation.stayHref}
                            size="xs"
                            variant="light"
                            color="stayosBrand"
                            leftSection={<DoorOpen size={14} />}
                            onClick={(event) => event.stopPropagation()}
                          >
                            View Stay
                          </Button>
                        ) : (
                          <Text c={colors.text.strong} style={typography.styles.label}>
                            {reservation.nextAction}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <ReservationActions reservation={reservation} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>

            <Stack hiddenFrom="md" gap={spacing[3]}>
              {filteredReservations.map((reservation) => (
                <UnstyledButton key={reservation.id} onClick={() => openReservation(reservation)}>
                  <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
                    <Group justify="space-between" align="flex-start">
                      <Box>
                        <Text
                          component={Link}
                          href={reservation.guestHref ?? '/guests'}
                          onClick={(event) => event.stopPropagation()}
                          c={colors.text.strong}
                          style={{ ...typography.styles.h3, textDecoration: 'none' }}
                        >
                          {reservation.guest}
                        </Text>
                        {reservation.isVip ? (
                          <Badge color="stayosBrand" variant="light" mt={spacing[1]}>
                            VIP
                          </Badge>
                        ) : null}
                        <Text
                          c={colors.text.muted}
                          mt={spacing[1]}
                          style={typography.styles.caption}
                        >
                          {reservation.id} · {reservation.stayDates}
                        </Text>
                      </Box>
                      <TokenBadge {...statusMeta(reservation.status)} />
                    </Group>
                    <Group mt={spacing[4]} justify="space-between">
                      <Text c={colors.text.body} style={typography.styles.small}>
                        {reservation.room} · {reservation.roomType}
                      </Text>
                      <TokenBadge {...paymentMeta(reservation.payment)} />
                    </Group>
                    {reservation.stayHref ? (
                      <Button
                        component={Link}
                        href={reservation.stayHref}
                        mt={spacing[3]}
                        size="xs"
                        variant="light"
                        color="stayosBrand"
                        leftSection={<DoorOpen size={14} />}
                        onClick={(event) => event.stopPropagation()}
                      >
                        View Stay
                      </Button>
                    ) : (
                      <Text mt={spacing[3]} c={colors.text.strong} style={typography.styles.label}>
                        Next: {reservation.nextAction}
                      </Text>
                    )}
                  </Card>
                </UnstyledButton>
              ))}
            </Stack>
          </>
        ) : (
          <Card
            p={spacing[12]}
            ta="center"
            radius={radius.lg}
            shadow="xs"
            style={{ border: 'none' }}
          >
            <UserCheck size={34} color={colors.brand[500]} />
            <Title order={2} mt={spacing[4]} style={typography.styles.h2}>
              No bookings found
            </Title>
            <Text mt={spacing[2]} c={colors.text.body} style={typography.styles.body}>
              Try a different guest name, date, booking ID, or room filter.
            </Text>
          </Card>
        )}
      </Skeleton>

      <ReservationDrawer reservation={drawerReservation} opened={opened} onClose={close} />
    </Stack>
  );
}
