'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  BedDouble,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  Hotel,
  KeyRound,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { brandPalettes, colors, radius, shadows, spacing, typography } from '@stayos/theme';
import { StayOSOperationsCard } from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';
import styles from './front-desk.module.css';

type QueueItem = {
  id: string;
  time: string;
  guest: string;
  bookingId: string;
  room: string;
  source: string;
  currentStatus: string;
  tags: string[];
  identity: string;
  nextAction: string;
  stayHref?: string;
  vip?: boolean;
};

type RoomStatus = {
  label: string;
  value: string;
  detail: string;
  tone: string;
  background: string;
};

const operations = [
  {
    label: 'Guests Arriving Today',
    value: '12',
    detail: 'Prepare welcome',
    icon: <DoorOpen size={17} />,
    tone: 'success',
  },
  {
    label: 'Guests Leaving Today',
    value: '11',
    detail: 'Review before checkout',
    icon: <CalendarCheck size={17} />,
    tone: 'attention',
  },
  {
    label: 'Occupancy',
    value: '78%',
    detail: 'Current house status',
    icon: <Hotel size={17} />,
    tone: 'muted',
  },
  {
    label: 'Rooms Being Prepared',
    value: '9',
    detail: 'Being cleaned',
    icon: <Sparkles size={17} />,
    tone: 'progress',
  },
  {
    label: 'Payments to Receive',
    value: '5',
    detail: 'Collect INR 38,400',
    icon: <CreditCard size={17} />,
    tone: 'danger',
  },
  {
    label: 'VIP Guests',
    value: '2',
    detail: 'High-touch service',
    icon: <Users size={17} />,
    tone: 'premium',
  },
];

const queueItems: QueueItem[] = [
  {
    id: 'q-1',
    time: '09:15',
    guest: 'Ananya Rao',
    bookingId: 'ST-1842',
    room: 'Suite 402',
    source: 'Booked Directly',
    currentStatus: 'Room Ready',
    tags: ['Payment Due', 'VIP', 'Early Arrival'],
    identity: 'ID Verified',
    nextAction: 'Check In',
    stayHref: '/guest-stay/ST1842',
    vip: true,
  },
  {
    id: 'q-2',
    time: '09:30',
    guest: 'Jaipur Textiles Group',
    bookingId: 'ST-1849',
    room: '5 Rooms',
    source: 'Corporate',
    currentStatus: 'Waiting at Reception',
    tags: ['Payment Due', 'Group Arrival'],
    identity: 'ID Verification Needed',
    nextAction: 'Receive Payment',
  },
  {
    id: 'q-3',
    time: '10:10',
    guest: 'Rhea Malhotra',
    bookingId: 'ST-1856',
    room: 'Premium King',
    source: 'OTA',
    currentStatus: 'Room Needed',
    tags: ['Choose Room', 'High Floor'],
    identity: 'Aadhaar Uploaded',
    nextAction: 'Choose Room',
  },
  {
    id: 'q-4',
    time: '11:30',
    guest: 'Mr Kapoor',
    bookingId: 'ST-1851',
    room: 'Suite 501',
    source: 'Booked Directly',
    currentStatus: 'Airport pickup confirmed',
    tags: ['VIP', 'Airport Pickup', 'Room Ready'],
    identity: 'Passport Uploaded',
    nextAction: 'View Booking',
    vip: true,
  },
];

const roomStatuses: RoomStatus[] = [
  {
    label: 'Available',
    value: '12',
    detail: 'Ready for Guests',
    tone: colors.semantic.success,
    background: colors.brand[50],
  },
  {
    label: 'Occupied',
    value: '42',
    detail: 'Guests In House',
    tone: colors.semantic.info,
    background: colors.surface.subtle,
  },
  {
    label: 'Reserved',
    value: '18',
    detail: 'Ready for Arrival',
    tone: colors.semantic.warning,
    background: colors.surface.subtle,
  },
  {
    label: 'Cleaning',
    value: '9',
    detail: 'Being Prepared',
    tone: colors.brand[500],
    background: colors.surface.subtle,
  },
  {
    label: 'Maintenance',
    value: '2',
    detail: 'Needs Attention',
    tone: colors.semantic.danger,
    background: colors.surface.subtle,
  },
];

const timeline = [
  {
    time: '09:30',
    title: 'Corporate Group Arrival',
    detail: 'Jaipur Textiles Group expected at front desk.',
  },
  {
    time: '10:00',
    title: 'Housekeeping Briefing',
    detail: 'Priority rooms 402, 501, and 214 review.',
  },
  { time: '11:30', title: 'Airport Pickup', detail: 'Driver confirmed for Mr Kapoor.' },
  { time: '13:00', title: 'VIP Arrival', detail: 'Suite 501 welcome setup should be complete.' },
  { time: '15:00', title: 'Group Checkout', detail: 'Invoices and luggage assistance needed.' },
  {
    time: '18:00',
    title: 'Night Shift Handover',
    detail: 'Payment follow-ups and late arrival notes.',
  },
];

function softTone(label: string) {
  if (label.includes('Payment')) return colors.semantic.danger;
  if (label.includes('VIP')) return colors.brand[500];
  if (label.includes('Room')) return colors.semantic.success;
  if (label.includes('ID Verification')) return colors.semantic.warning;
  return colors.text.body;
}

function chipBackground(label: string) {
  if (label.includes('Payment')) return `color-mix(in srgb, ${colors.semantic.danger} 9%, ${colors.surface.base})`;
  if (label.includes('ID Verification')) return brandPalettes.gold[50];
  if (label.includes('VIP')) return colors.brand[50];
  if (label.includes('Room') || label.includes('Ready')) return colors.brand[50];
  return colors.surface.subtle;
}

function StatusChip({ children, tone }: { children: ReactNode; tone: string }) {
  const label = typeof children === 'string' ? children : '';

  return (
    <Badge
      radius={radius.full}
      variant="light"
      styles={{
        root: {
          background: chipBackground(label),
          color: tone,
          fontWeight: typography.weights.semibold,
          textTransform: 'none',
        },
      }}
    >
      {children}
    </Badge>
  );
}

function FrontDeskHero() {
  const currentDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <Card
      p={spacing[6]}
      radius={radius.lg}
      shadow="xs"
      style={{ minHeight: 252, overflow: 'hidden', position: 'relative' }}
    >
      <img
        alt=""
        aria-hidden="true"
        src="/images/reception-hero.png"
        style={{
          height: '100%',
          inset: 0,
          objectFit: 'cover',
          objectPosition: 'center right',
          position: 'absolute',
          width: '100%',
          zIndex: 0,
        }}
      />
      <Box
        aria-hidden
        style={{
          background: `linear-gradient(90deg, ${colors.surface.base} 0%, ${colors.surface.base} 34%, rgba(255,255,255,0.92) 48%, rgba(255,255,255,0) 68%)`,
          inset: 0,
          position: 'absolute',
          zIndex: 1,
        }}
      />
      <Stack
        gap={spacing[2]}
        justify="center"
        mih={204}
        style={{ position: 'relative', zIndex: 2 }}
      >
        <Group gap={spacing[2]}>
          <Text c={colors.text.strong} style={typography.styles.h3}>
            Good Morning, Aarav
          </Text>
          <img
            alt=""
            aria-hidden="true"
            src="/images/handwave.png"
            style={{ height: 30, width: 30 }}
          />
        </Group>
        <Title order={1} c={colors.text.strong} style={typography.styles.display}>
          Everything is under control.
        </Title>
        <Text c={colors.text.body} style={typography.styles.body}>
          {currentDate} - Bloom Residency
        </Text>
        <Text c={colors.text.muted} style={typography.styles.small}>
          Morning Shift - 07:00 AM - 03:00 PM
        </Text>
        <Text mt={spacing[2]} c={colors.text.strong} style={typography.styles.label}>
          12 arrivals - 8 guests waiting - 4 rooms ready
        </Text>
      </Stack>
    </Card>
  );
}

function OperationsStrip() {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
      {operations.map((item) => (
          <StayOSOperationsCard
            key={item.label}
            title={item.label}
            value={item.value}
            detail={item.detail}
            icon={item.icon}
            tone={item.tone as StayOSStatusTone}
          />
      ))}
    </SimpleGrid>
  );
}

function GuestInitials({ guest, vip }: { guest: string; vip?: boolean }) {
  const initials = guest
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <Box
      aria-hidden
      style={{
        alignItems: 'center',
        background: vip ? colors.brand[100] : colors.surface.subtle,
        borderRadius: radius.full,
        color: colors.brand[600],
        display: 'flex',
        flex: '0 0 44px',
        height: 44,
        justifyContent: 'center',
        width: 44,
      }}
    >
      {initials}
    </Box>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const actionHref = item.nextAction === 'Check In' ? '/check-in' : undefined;

  return (
    <Paper
      className={styles.queueCard}
      p={spacing[4]}
      radius={radius.lg}
      shadow="xs"
      style={
        {
          '--queue-accent': item.vip ? colors.brand[500] : colors.semantic.info,
          '--queue-hover-bg': colors.surface.base,
          '--queue-hover-shadow': shadows.sm,
          cursor: 'pointer',
        } as CSSProperties
      }
    >
      <Group justify="space-between" align="center" gap={spacing[4]} wrap="nowrap">
        <Group gap={spacing[4]} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <Text c={colors.brand[600]} style={typography.styles.label} w={52}>
            {item.time}
          </Text>
          <GuestInitials guest={item.guest} vip={item.vip} />
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Group gap={spacing[2]} wrap="wrap">
              <Text c={colors.text.strong} style={typography.styles.h3}>
                {item.guest}
              </Text>
              <StatusChip tone={colors.text.body}>{item.currentStatus}</StatusChip>
            </Group>
            <Text mt={spacing[1]} c={colors.text.muted} style={typography.styles.small}>
              {item.bookingId} - {item.room} - {item.source}
            </Text>
            <Group mt={spacing[3]} gap={spacing[2]}>
              {item.tags.map((tag) => (
                <StatusChip key={tag} tone={softTone(tag)}>
                  {tag}
                </StatusChip>
              ))}
              <StatusChip
                tone={
                  item.identity.includes('Needed')
                    ? colors.semantic.warning
                    : colors.semantic.success
                }
              >
                {item.identity}
              </StatusChip>
            </Group>
          </Box>
        </Group>
        <Group gap={spacing[2]} wrap="nowrap">
          {item.stayHref ? (
            <Button component="a" href={item.stayHref} variant="light" color="stayosBrand">
              View Stay
            </Button>
          ) : null}
          <Button
            color="stayosBrand"
            component={actionHref ? 'a' : 'button'}
            href={actionHref}
            leftSection={<KeyRound size={16} />}
          >
            {item.nextAction}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

function ReceptionQueue() {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between" mb={spacing[4]}>
        <Box>
          <Title order={2} style={typography.styles.h3}>
            Reception Queue
          </Title>
          <Text c={colors.text.muted} style={typography.styles.small}>
            Guests and blockers that need front desk attention.
          </Text>
        </Box>
      </Group>
      <Stack gap={spacing[3]}>
        {queueItems.map((item) => (
          <QueueCard key={item.id} item={item} />
        ))}
      </Stack>
    </Card>
  );
}

function RoomStatusPanel() {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Title order={2} style={typography.styles.h3}>
        Room Status
      </Title>
      <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
        Current room readiness across the property.
      </Text>
      <SimpleGrid mt={spacing[4]} cols={{ base: 1, xs: 2, lg: 1 }} spacing={spacing[3]}>
        {roomStatuses.map((room) => (
          <Paper
            key={room.label}
            p={spacing[4]}
            radius={radius.lg}
            style={{ background: room.background }}
          >
            <Text c={colors.text.body} style={typography.styles.label}>
              {room.label}
            </Text>
            <Text mt={spacing[2]} c={colors.text.strong} style={typography.styles.display}>
              {room.value}
            </Text>
            <Text c={room.tone} style={typography.styles.caption}>
              {room.detail}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </Card>
  );
}

function TodayTimeline() {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Title order={2} style={typography.styles.h3}>
        Today's Timeline
      </Title>
      <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
        Property events that shape front desk operations today.
      </Text>
      <Stack mt={spacing[5]} gap={spacing[4]}>
        {timeline.map((event) => (
          <Group
            key={`${event.time}-${event.title}`}
            align="flex-start"
            gap={spacing[4]}
            wrap="nowrap"
          >
            <Text c={colors.brand[600]} style={typography.styles.label} w={56}>
              {event.time}
            </Text>
            <Box
              aria-hidden
              mt={6}
              style={{
                background: colors.brand[500],
                borderRadius: radius.full,
                height: 9,
                width: 9,
              }}
            />
            <Box>
              <Text c={colors.text.strong} style={typography.styles.label}>
                {event.title}
              </Text>
              <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
                {event.detail}
              </Text>
            </Box>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

function FloatingShortcuts() {
  const actions = [
    { label: 'Walk-in', icon: <UserPlus size={15} /> },
    { label: 'Check In', icon: <KeyRound size={15} />, href: '/check-in' },
    { label: 'Check Out', icon: <DoorOpen size={15} /> },
    { label: 'Choose Room', icon: <BedDouble size={15} /> },
    { label: 'Block Room', icon: <Wrench size={15} /> },
    { label: 'Housekeeping Request', icon: <Sparkles size={15} /> },
  ];

  return (
    <Card
      p={spacing[3]}
      radius={radius.lg}
      shadow="md"
      style={{ bottom: spacing[6], position: 'fixed', right: spacing[6], zIndex: 120 }}
    >
      <Menu position="top-end" shadow="md" width={240}>
        <Menu.Target>
          <Button color="stayosBrand" leftSection={<Plus size={16} />}>
            Quick Action
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {actions.map((action) => (
            <Menu.Item
              key={action.label}
              component={action.href ? 'a' : 'button'}
              href={action.href}
              leftSection={action.icon}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Card>
  );
}

export default function HomePage() {
  return (
    <Stack gap={spacing[6]}>
      <FrontDeskHero />
      <OperationsStrip />

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[5]}>
        <Box style={{ gridColumn: 'span 8' }}>
          <ReceptionQueue />
        </Box>
        <Box style={{ gridColumn: 'span 4' }}>
          <RoomStatusPanel />
        </Box>
      </SimpleGrid>

      <TodayTimeline />
      <FloatingShortcuts />
    </Stack>
  );
}
