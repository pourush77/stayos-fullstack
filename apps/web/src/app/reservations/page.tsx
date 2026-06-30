'use client';

import {
  ActionIcon,
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
import { StayOSOperationsCard, StayOSStatusBadge } from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';

type BookingStatus =
  'Confirmed' | 'Checked-in' | 'Checked-out' | 'Pending' | 'Cancelled' | 'No-show';
type PaymentStatus = 'Paid' | 'Payment Due' | 'Partially Paid';

type Reservation = {
  id: string;
  guest: string;
  phone: string;
  email: string;
  stayDates: string;
  nights: number;
  room: string;
  roomType: string;
  source: string;
  payment: PaymentStatus;
  amount: string;
  status: BookingStatus;
  nextAction: string;
  notes: string;
  requests: string[];
  timeline: string[];
};

const reservations: Reservation[] = [
  {
    id: 'ST1842',
    guest: 'Ananya Rao',
    phone: '+91 98765 22110',
    email: 'ananya.rao@example.com',
    stayDates: '28 Jun - 30 Jun',
    nights: 2,
    room: 'Suite 402',
    roomType: 'Suite',
    source: 'Direct',
    payment: 'Partially Paid',
    amount: 'INR 18,400',
    status: 'Confirmed',
    nextAction: 'Prepare early check-in',
    notes: 'Prefers a quiet floor and early tea service.',
    requests: ['Quiet floor', 'Early check-in', 'Airport pickup'],
    timeline: ['Booking created by Neha', 'Advance payment collected', 'Room 402 assigned'],
  },
  {
    id: 'ST1849',
    guest: 'Jaipur Textiles Group',
    phone: '+91 99887 43000',
    email: 'travel@jaipurtextiles.example',
    stayDates: '27 Jun - 28 Jun',
    nights: 1,
    room: '5 Rooms',
    roomType: 'Deluxe',
    source: 'Corporate',
    payment: 'Payment Due',
    amount: 'INR 42,000',
    status: 'Pending',
    nextAction: 'Collect payment before checkout',
    notes: 'Group checkout expected around 10:00 AM.',
    requests: ['GST invoice', 'Luggage assistance'],
    timeline: ['Group booking imported', 'Rooms assigned', 'Invoice pending'],
  },
  {
    id: 'ST1851',
    guest: 'Mr Kapoor',
    phone: '+91 90000 88221',
    email: 'kapoor@example.com',
    stayDates: '28 Jun - 01 Jul',
    nights: 3,
    room: 'Suite 501',
    roomType: 'Presidential Suite',
    source: 'Website',
    payment: 'Paid',
    amount: 'INR 76,500',
    status: 'Confirmed',
    nextAction: 'Confirm airport pickup',
    notes: 'VIP guest. Keep manager informed before arrival.',
    requests: ['Airport pickup', 'Fruit platter', 'Late checkout'],
    timeline: ['VIP flag added', 'Payment completed', 'Pickup pending'],
  },
  {
    id: 'ST1856',
    guest: 'Rhea Malhotra',
    phone: '+91 98220 44551',
    email: 'rhea.m@example.com',
    stayDates: '29 Jun - 02 Jul',
    nights: 3,
    room: 'Unassigned',
    roomType: 'Premium King',
    source: 'OTA',
    payment: 'Payment Due',
    amount: 'INR 24,800',
    status: 'Confirmed',
    nextAction: 'Assign room',
    notes: 'Arrives tomorrow evening.',
    requests: ['High floor'],
    timeline: ['Booking received from OTA', 'Payment pending', 'Room not assigned'],
  },
  {
    id: 'ST1838',
    guest: 'Dev Sharma',
    phone: '+91 98111 30444',
    email: 'dev.sharma@example.com',
    stayDates: '28 Jun - 29 Jun',
    nights: 1,
    room: 'Room 118',
    roomType: 'Standard',
    source: 'Walk-in',
    payment: 'Paid',
    amount: 'INR 6,200',
    status: 'Checked-in',
    nextAction: 'No action needed',
    notes: 'Checked in at 08:40 AM.',
    requests: ['Extra towel'],
    timeline: ['Walk-in booking created', 'Payment collected', 'Guest checked in'],
  },
  {
    id: 'ST1820',
    guest: 'Nikhil Arora',
    phone: '+91 97000 11122',
    email: 'nikhil@example.com',
    stayDates: '28 Jun - 30 Jun',
    nights: 2,
    room: 'Cancelled',
    roomType: 'Deluxe Twin',
    source: 'OTA',
    payment: 'Partially Paid',
    amount: 'INR 4,000 refund',
    status: 'Cancelled',
    nextAction: 'Review refund',
    notes: 'Cancelled this morning due to travel change.',
    requests: ['Refund confirmation'],
    timeline: ['Booking cancelled', 'Refund review required'],
  },
];

const summary = [
  {
    label: "Today's Arrivals",
    value: 12,
    detail: '6 ready now',
    tone: 'success',
    icon: <DoorOpen size={17} />,
  },
  {
    label: 'Tomorrow Arrivals',
    value: 18,
    detail: '9 rooms assigned',
    tone: 'info',
    icon: <CalendarDays size={17} />,
  },
  {
    label: 'Pending Payments',
    value: 5,
    detail: 'INR 38,400 due',
    tone: 'danger',
    icon: <Wallet size={17} />,
  },
  {
    label: 'Unassigned Rooms',
    value: 4,
    detail: 'Needs attention',
    tone: 'attention',
    icon: <BedDouble size={17} />,
  },
  {
    label: 'Cancelled',
    value: 2,
    detail: '1 refund review',
    tone: 'muted',
    icon: <XCircle size={17} />,
  },
  {
    label: 'VIP Bookings',
    value: 2,
    detail: 'Pickup required',
    tone: 'premium',
    icon: <UserCheck size={17} />,
  },
];

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
  if (status === 'Paid') return { label: 'Paid', icon: '●', tone: colors.semantic.success };
  if (status === 'Partially Paid')
    return { label: 'Partial', icon: '●', tone: colors.semantic.warning };
  return { label: 'Due', icon: '●', tone: colors.semantic.danger };
}

function statusMeta(status: BookingStatus) {
  if (status === 'Confirmed')
    return { label: 'Confirmed', icon: '✓', tone: colors.semantic.success };
  if (status === 'Checked-in')
    return { label: 'Checked-in', icon: '⌂', tone: colors.semantic.success };
  if (status === 'Checked-out') return { label: 'Checked-out', icon: '↗', tone: colors.text.muted };
  if (status === 'Cancelled')
    return { label: 'Cancelled', icon: '×', tone: colors.semantic.danger };
  if (status === 'No-show') return { label: 'No-show', icon: '!', tone: colors.semantic.danger };
  return { label: 'Pending', icon: '●', tone: colors.semantic.warning };
}

function TokenBadge({ label }: { label: string; icon: string; tone: string }) {
  return <StayOSStatusBadge>{label}</StayOSStatusBadge>;
}

function SummaryStrip() {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
      {summary.map((item) => (
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
          placeholder="Search guest, booking ID, phone or room..."
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
        <Menu.Item component="a" href="/guests/ananya-rao" leftSection={<UserCheck size={14} />}>
          Open Guest 360
        </Menu.Item>
        {reservation.status === 'Checked-in' ? (
          <Menu.Item component="a" href="/guest-stay/ST1842" leftSection={<DoorOpen size={14} />}>
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
      title="Reservation details"
    >
      {reservation ? (
        <Stack gap={spacing[5]}>
          <Box>
            <Title order={2} style={typography.styles.h2}>
              {reservation.guest}
            </Title>
            <Button component="a" href="/guests/ananya-rao" mt={spacing[3]} size="xs" variant="light" color="stayosBrand">
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
            <Button
              component={reservation.status === 'Checked-in' ? 'a' : 'button'}
              href={reservation.status === 'Checked-in' ? '/guest-stay/ST1842' : undefined}
              leftSection={
                reservation.status === 'Checked-in' ? <DoorOpen size={16} /> : <KeyRound size={16} />
              }
              color="stayosBrand"
            >
              {reservation.status === 'Checked-in' ? 'Open Stay Workspace' : 'Check-in'}
            </Button>
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
  const [query, setQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

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
  }, [query]);

  const openReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    open();
  };

  return (
    <Stack gap={spacing[5]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Title order={1} style={typography.styles.h1}>
            Reservations
          </Title>
          <Text mt={spacing[1]} c={colors.text.body} style={typography.styles.body}>
            Manage upcoming stays, arrivals and bookings.
          </Text>
          <Text mt={spacing[3]} c={colors.text.strong} style={typography.styles.label}>
            12 Arrivals · 18 Tomorrow · 5 Pending Payments · 2 VIP
          </Text>
        </Box>
        <Button
          component="a"
          href="/reservations/availability"
          leftSection={<Plus size={16} />}
          color="stayosBrand"
          size="md"
        >
          New Booking
        </Button>
      </Group>

      <SummaryStrip />
      <Filters query={query} setQuery={setQuery} />

      <Skeleton visible={false} radius={radius.lg}>
        {filteredReservations.length > 0 ? (
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
                    <Table.Th>Next Action</Table.Th>
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
                          component="a"
                          href="/guests/ananya-rao"
                          onClick={(event) => event.stopPropagation()}
                          c={colors.text.strong}
                          style={{ ...typography.styles.h3, textDecoration: 'none' }}
                        >
                          {reservation.guest}
                        </Text>
                        <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
                          {reservation.room}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text style={typography.styles.label}>{reservation.stayDates}</Text>
                        <Text c={colors.text.muted} style={typography.styles.caption}>
                          {reservation.nights} night{reservation.nights > 1 ? 's' : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text style={typography.styles.label}>{reservation.id}</Text>
                        <Text c={colors.text.muted} style={typography.styles.caption}>
                          {reservation.phone}
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
                        {reservation.status === 'Checked-in' ? (
                          <Button
                            component="a"
                            href="/guest-stay/ST1842"
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
                          component="a"
                          href="/guests/ananya-rao"
                          onClick={(event) => event.stopPropagation()}
                          c={colors.text.strong}
                          style={{ ...typography.styles.h3, textDecoration: 'none' }}
                        >
                          {reservation.guest}
                        </Text>
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
                    {reservation.status === 'Checked-in' ? (
                      <Button
                        component="a"
                        href="/guest-stay/ST1842"
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
              No reservations found
            </Title>
            <Text mt={spacing[2]} c={colors.text.body} style={typography.styles.body}>
              Try a different guest name, date, booking ID, or room filter.
            </Text>
          </Card>
        )}
      </Skeleton>

      <ReservationDrawer reservation={selectedReservation} opened={opened} onClose={close} />
    </Stack>
  );
}
