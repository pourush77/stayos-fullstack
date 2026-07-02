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
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import {
  BackendUnavailable,
  EmptyData,
  GenericError,
  ServerStarting,
  useBackendStatus,
} from '@stayos/ui';
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

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

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
  if (status === 'Paid') return { label: 'Paid', color: '#16a34a', background: '#f0fdf4' };
  if (status === 'Partially Paid') {
    return { label: 'Partial', color: '#d97706', background: '#fffbeb' };
  }
  return { label: 'Due', color: '#dc2626', background: '#fef2f2' };
}

function statusMeta(status: BookingStatus) {
  if (status === 'Confirmed') {
    return { label: 'Confirmed', color: '#16a34a', background: '#f0fdf4' };
  }
  if (status === 'Checked-in') {
    return { label: 'Checked-in', color: '#2563eb', background: '#eff6ff' };
  }
  if (status === 'Checked-out') {
    return { label: 'Checked-out', color: '#64748b', background: '#f8fafc' };
  }
  if (status === 'Cancelled') {
    return { label: 'Cancelled', color: '#dc2626', background: '#fef2f2' };
  }
  if (status === 'No-show') {
    return { label: 'No-show', color: '#dc2626', background: '#fef2f2' };
  }
  return { label: 'Pending', color: '#d97706', background: '#fffbeb' };
}

function TokenBadge({
  background,
  color,
  label,
}: {
  background: string;
  color: string;
  label: string;
}) {
  return (
    <Badge
      radius={radius.full}
      style={{
        background,
        border: '1px solid rgba(226, 232, 240, 0.9)',
        color,
        fontSize: 11,
        fontWeight: 600,
        height: 24,
        paddingInline: 10,
        textTransform: 'none',
      }}
    >
      {label}
    </Badge>
  );
}

function SummaryCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <Paper radius={radius.lg} p={15} style={{ ...cardStyle, minHeight: 84 }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c="#334155" style={{ fontSize: 12, fontWeight: 600, lineHeight: '15px' }}>
            {label}
          </Text>
          <Text c="#111827" mt={4} style={{ fontSize: 22, fontWeight: 700, lineHeight: '26px' }}>
            <CountUp value={value} />
          </Text>
          <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
            {detail}
          </Text>
        </Box>
        <Box
          aria-hidden
          style={{
            alignItems: 'center',
            background: `${tone}12`,
            borderRadius: radius.full,
            color: tone,
            display: 'flex',
            flex: '0 0 34px',
            height: 34,
            justifyContent: 'center',
            width: 34,
          }}
        >
          {icon}
        </Box>
      </Group>
    </Paper>
  );
}

function SummaryStrip({
  reservationCount,
  summary,
}: {
  reservationCount: number;
  summary: ReservationSummary;
}) {
  const items = [
    {
      label: "Today's Arrivals",
      value: summary.todayArrivals,
      detail: 'Expected check-ins today',
      tone: '#2563eb',
      icon: <DoorOpen size={17} />,
    },
    {
      label: "Today's Departures",
      value: summary.departuresToday ?? 0,
      detail: 'Scheduled check-outs today',
      tone: '#64748b',
      icon: <XCircle size={17} />,
    },
    {
      label: 'Pending Payments',
      value: summary.pendingPayments,
      detail: 'Due or partial balances',
      tone: '#dc2626',
      icon: <Wallet size={17} />,
    },
    {
      label: 'Unassigned Rooms',
      value: summary.unassignedRooms,
      detail: 'Bookings need assignment',
      tone: '#d97706',
      icon: <BedDouble size={17} />,
    },
    {
      label: 'Total Bookings',
      value: reservationCount,
      detail: 'Bookings in this view',
      tone: '#6d5dfc',
      icon: <CalendarDays size={17} />,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing={spacing[3]}>
      {items.map((item) => (
        <SummaryCard key={item.label} {...item} />
      ))}
    </SimpleGrid>
  );
}

function Filters({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  return (
    <Card radius={radius.lg} p={12} style={cardStyle}>
      <Group gap={spacing[2]} align="center">
        <TextInput
          leftSection={<Search size={15} />}
          placeholder="Search guest, booking ID, phone or company..."
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 280 }}
          styles={{
            input: {
              borderColor: '#dbe3ef',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 400,
              minHeight: 38,
            },
          }}
        />
        <Select
          w={{ base: 140, md: 164 }}
          data={statusOptions}
          defaultValue="All"
          styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
        />
        <DatePickerInput
          w={{ base: 180, md: 220 }}
          type="range"
          placeholder="Date range"
          leftSection={<CalendarDays size={15} />}
          styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
        />
        <Popover width={300} position="bottom-end" shadow="md">
          <Popover.Target>
            <Button
              variant="light"
              color="stayosBrand"
              size="compact-md"
              leftSection={<SlidersHorizontal size={15} />}
              style={{ fontWeight: 600, height: 38 }}
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
            <Title order={2} style={{ fontSize: 28, fontWeight: 700, lineHeight: '36px' }}>
              {reservation.guest}
            </Title>
            {reservation.isVip ? (
              <Badge color="stayosBrand" variant="light" mt={spacing[2]} style={{ fontWeight: 600 }}>
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
              style={{ fontWeight: 600 }}
            >
              Open Guest 360
            </Button>
            <Text c={colors.text.muted} mt={spacing[1]} style={{ fontSize: 13, fontWeight: 500 }}>
              {reservation.id} - {reservation.phone}
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
                {reservation.room} - {reservation.roomType}
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
                <Badge key={request} color="stayosBrand" variant="light" style={{ fontWeight: 600 }}>
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

function PrimaryAction({ reservation }: { reservation: Reservation }) {
  if (reservation.stayHref) {
    return (
      <Button
        component={Link}
        href={reservation.stayHref}
        size="compact-sm"
        variant="light"
        color="stayosBrand"
        leftSection={<DoorOpen size={14} />}
        onClick={(event) => event.stopPropagation()}
        style={{ fontWeight: 600 }}
      >
        View Stay
      </Button>
    );
  }

  return (
    <Button
      size="compact-sm"
      variant="light"
      color="stayosBrand"
      onClick={(event) => event.stopPropagation()}
      style={{ fontWeight: 600 }}
    >
      {reservation.nextAction}
    </Button>
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
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
          Bookings
        </Title>
        <Text mt={spacing[1]} c="#64748b" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
          Manage arrivals, stays, payments and room assignments.
        </Text>
        <Text mt={spacing[2]} c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
          {reservations.length} bookings - {reservationsState.summary.pendingPayments} pending payments
        </Text>
      </Box>
      <Button
        component={Link}
        href="/reservations/availability"
        leftSection={<Plus size={16} />}
        color="stayosBrand"
        size="md"
        style={{ fontWeight: 600 }}
      >
        New Booking
      </Button>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <Stack gap={spacing[4]}>
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
      <Stack gap={spacing[4]}>
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
      <Stack gap={spacing[4]}>
        {pageHeader}
        <GenericError
          onAction={() => void reservationsState.refreshReservations()}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}

      <SummaryStrip reservationCount={reservations.length} summary={reservationsState.summary} />

      {reservationsState.isLoading ? (
        <Alert color="blue" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Loading live reservations...
        </Alert>
      ) : null}

      {reservationsState.isFallback && reservationsState.error ? (
        <Alert color="yellow" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Bookings is showing mock data while the backend is unavailable.
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
            <Card visibleFrom="md" p={0} radius={radius.lg} style={{ ...cardStyle, overflow: 'hidden' }}>
              <Table verticalSpacing={13} horizontalSpacing={18} highlightOnHover={false}>
                <Table.Thead bg="#f8fafc">
                  <Table.Tr>
                    {['Guest', 'Stay Dates', 'Booking', 'Source', 'Payment', 'Status', 'Next Action', ''].map(
                      (header) => (
                        <Table.Th
                          key={header}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            color: '#64748b',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: 0,
                            textTransform: 'none',
                          }}
                        >
                          {header}
                        </Table.Th>
                      ),
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredReservations.map((reservation) => (
                    <Table.Tr
                      key={reservation.id}
                      onClick={() => openReservation(reservation)}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = '#fbfdff';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = '#ffffff';
                      }}
                      style={{
                        background: '#ffffff',
                        borderBottom: '1px solid #edf2f7',
                        cursor: 'pointer',
                        transition: 'background 160ms ease',
                      }}
                    >
                      <Table.Td>
                        <Text
                          component={Link}
                          href={reservation.guestHref ?? '/guests'}
                          onClick={(event) => event.stopPropagation()}
                          c="#101828"
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: '18px',
                            textDecoration: 'none',
                          }}
                        >
                          {reservation.guest}
                        </Text>
                        {reservation.isVip ? (
                          <Badge color="stayosBrand" variant="light" mt={6} style={{ fontWeight: 600 }}>
                            VIP
                          </Badge>
                        ) : null}
                        <Text c="#526383" mt={6} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
                          {reservation.room}
                        </Text>
                        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '15px' }}>
                          {reservation.occupancy}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="#182230" style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>
                          {reservation.stayDates}
                        </Text>
                        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
                          {reservation.nights} nights
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="#182230" style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>
                          {reservation.id}
                        </Text>
                        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
                          {reservation.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '17px' }}>
                          {reservation.source}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <TokenBadge {...paymentMeta(reservation.payment)} />
                      </Table.Td>
                      <Table.Td>
                        <TokenBadge {...statusMeta(reservation.status)} />
                      </Table.Td>
                      <Table.Td>
                        <PrimaryAction reservation={reservation} />
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
                  <Card p={spacing[4]} radius={radius.lg} style={cardStyle}>
                    <Group justify="space-between" align="flex-start">
                      <Box>
                        <Text
                          component={Link}
                          href={reservation.guestHref ?? '/guests'}
                          onClick={(event) => event.stopPropagation()}
                          c="#101828"
                          style={{ fontSize: 16, fontWeight: 700, lineHeight: '22px', textDecoration: 'none' }}
                        >
                          {reservation.guest}
                        </Text>
                        {reservation.isVip ? (
                          <Badge color="stayosBrand" variant="light" mt={spacing[1]} style={{ fontWeight: 600 }}>
                            VIP
                          </Badge>
                        ) : null}
                        <Text c="#64748b" mt={spacing[1]} style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                          {reservation.id} - {reservation.stayDates}
                        </Text>
                      </Box>
                      <TokenBadge {...statusMeta(reservation.status)} />
                    </Group>
                    <Group mt={spacing[4]} justify="space-between">
                      <Text c="#526383" style={{ fontSize: 13, fontWeight: 400, lineHeight: '18px' }}>
                        {reservation.room} - {reservation.roomType}
                      </Text>
                      <TokenBadge {...paymentMeta(reservation.payment)} />
                    </Group>
                    <Box mt={spacing[3]}>
                      <PrimaryAction reservation={reservation} />
                    </Box>
                  </Card>
                </UnstyledButton>
              ))}
            </Stack>
          </>
        ) : (
          <Card p={spacing[8]} ta="center" radius={radius.lg} style={cardStyle}>
            <UserCheck size={30} color={colors.brand[500]} />
            <Title order={2} mt={spacing[4]} style={{ fontSize: 24, fontWeight: 700, lineHeight: '30px' }}>
              No bookings found
            </Title>
            <Text mt={spacing[2]} c="#64748b" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
              Try a different guest name, date, booking ID, or room filter.
            </Text>
          </Card>
        )}
      </Skeleton>

      <ReservationDrawer reservation={drawerReservation} opened={opened} onClose={close} />
    </Stack>
  );
}
