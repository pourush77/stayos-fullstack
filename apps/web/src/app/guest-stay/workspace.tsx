'use client';

import Link from 'next/link';
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Menu,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BedDouble,
  BellRing,
  CalendarClock,
  Check,
  ChevronLeft,
  CreditCard,
  DoorOpen,
  FileText,
  Gift,
  KeyRound,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Printer,
  ReceiptText,
  RefreshCw,
  Shirt,
  Sparkles,
  Utensils,
  UserRound,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { brandPalettes, colors, radius, shadows, spacing, typography } from '@stayos/theme';
import { getOpenOperationalTasks, OperationalTaskCard } from '@stayos/ui';
import styles from './guest-stay.module.css';

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type TimelineItem = {
  time: string;
  title: string;
  detail: string;
  action: string;
};

type StatusItem = {
  label: string;
  status: string;
  tone: StatusTone;
};

type RequestItem = {
  title: string;
  detail: string;
  status: string;
  tone: StatusTone;
};

type ChargeStatus = 'Paid' | 'Pending' | 'Approved' | 'Automatically calculated' | 'Deposit Received';

type FolioCharge = {
  title: string;
  amount: string;
  status: ChargeStatus;
};

type DockAction = {
  label: string;
  icon: ReactNode;
  primary?: boolean;
  onClick?: () => void;
};

type CheckoutStep = 'review-stay' | 'review-charges' | 'receive-payment' | 'complete';

const guest = {
  name: 'Ananya Rao',
  room: 'Suite 402',
  roomType: 'Premium Suite',
  status: 'Checked In',
  arrivalDate: '28 Jun 2026',
  departureDate: '01 Jul 2026',
  nights: '3 Nights',
  stayProgress: 'Day 2 of 3',
  checkoutContext: 'Checkout Tomorrow',
  heroMessage: 'Welcome back. 2 nights remaining. Breakfast is included.',
  occupancy: '2 Adults, 1 Child',
};

const timeline: TimelineItem[] = [
  {
    time: '17:30',
    title: 'Laundry Requested',
    detail: 'Two garments requested for express service.',
    action: 'View Request',
  },
  {
    time: '13:40',
    title: 'Restaurant Charge',
    detail: 'Lunch posted to room account.',
    action: 'Open Bill',
  },
  {
    time: '11:05',
    title: 'Housekeeping Completed',
    detail: 'Room inspected after morning service.',
    action: 'View Details',
  },
  {
    time: '09:23',
    title: 'Room Keys Issued',
    detail: 'Two keys encoded for Suite 402.',
    action: 'View Keys',
  },
  {
    time: '09:21',
    title: 'Guest Photo Captured',
    detail: 'Photo saved to guest profile.',
    action: 'Open Profile',
  },
  {
    time: '09:18',
    title: 'Identity Verified',
    detail: 'Aadhaar verified at front desk.',
    action: 'View ID',
  },
  {
    time: '09:10',
    title: 'Checked In',
    detail: 'Guest arrived and stay was activated.',
    action: 'View Check-in',
  },
  {
    time: 'Tomorrow',
    title: 'Wake-up Call',
    detail: 'Requested for 06:30 AM.',
    action: 'Edit',
  },
];

const stayOverview = [
  ['Booking', 'ST-1842'],
  ['Room', 'Suite 402'],
  ['Rate Plan', 'Breakfast Included'],
  ['Package', 'Weekend Comfort'],
  ['Source', 'Booked Directly'],
  ['Expected Checkout', '01 Jul, 11:00 AM'],
  ['Late Checkout', 'Requested until 1:00 PM'],
  ['Current Occupancy', '2 Adults, 1 Child'],
];

const verification: StatusItem[] = [
  { label: 'Identity', status: 'Verified', tone: 'success' },
  { label: 'Guest Photo', status: 'Captured', tone: 'success' },
  { label: 'Registration Card', status: 'Signed', tone: 'success' },
  { label: 'Signature', status: 'Complete', tone: 'success' },
  { label: 'Police Verification', status: 'Not Required', tone: 'neutral' },
];

const finances = [
  ['Room Charges', 'INR 18,400'],
  ['Restaurant', 'INR 1,250'],
  ['Laundry', 'INR 450'],
  ['Mini Bar', 'INR 0'],
  ['Taxes', 'INR 2,412'],
  ['Discounts', 'INR 1,000'],
  ['Advance Paid', 'INR 20,000'],
];

const preferences = [
  'High Floor',
  'King Bed',
  'Vegetarian',
  'Airport Pickup',
  'No Smoking',
  'Extra Pillow',
  'Birthday',
  'Anniversary',
  'Returning Guest',
  'Loyalty Gold',
];

const requests: RequestItem[] = [
  { title: 'Extra Blanket', detail: 'Requested for child guest.', status: 'Assigned', tone: 'info' },
  { title: 'Wake-up Call', detail: 'Tomorrow at 06:30 AM.', status: 'Pending', tone: 'warning' },
  { title: 'Taxi at 5 PM', detail: 'Sedan requested for local travel.', status: 'Pending', tone: 'warning' },
  { title: 'Airport Drop', detail: 'Departure day transfer.', status: 'Assigned', tone: 'info' },
  { title: 'Late Checkout', detail: 'Until 1:00 PM if occupancy allows.', status: 'Pending', tone: 'warning' },
];

const housekeeping: StatusItem[] = [
  { label: 'Current Room Status', status: 'Clean', tone: 'success' },
  { label: 'Inspection', status: 'Inspected', tone: 'success' },
  { label: 'Laundry', status: 'Waiting', tone: 'warning' },
  { label: 'Mini Bar', status: 'Checked', tone: 'success' },
  { label: 'Maintenance', status: 'None', tone: 'success' },
  { label: 'Next Cleaning', status: 'Tomorrow 10:00 AM', tone: 'info' },
];

const folioCharges: FolioCharge[] = [
  { title: 'Room Charges', amount: 'INR 12,000', status: 'Paid' },
  { title: 'Restaurant', amount: 'INR 650', status: 'Pending' },
  { title: 'Laundry', amount: 'INR 420', status: 'Pending' },
  { title: 'Mini Bar', amount: 'INR 280', status: 'Pending' },
  { title: 'Airport Pickup', amount: 'INR 900', status: 'Pending' },
  { title: 'Discount', amount: '-INR 500', status: 'Approved' },
  { title: 'GST', amount: 'INR 1,250', status: 'Automatically calculated' },
];

const chargeTypes = [
  { label: 'Room Service', department: 'Food and Beverage', icon: Utensils },
  { label: 'Restaurant', department: 'Food and Beverage', icon: Utensils },
  { label: 'Laundry', department: 'Laundry', icon: Shirt },
  { label: 'Mini Bar', department: 'Rooms', icon: ReceiptText },
  { label: 'Spa', department: 'Spa', icon: Sparkles },
  { label: 'Airport Pickup', department: 'Concierge', icon: DoorOpen },
  { label: 'Taxi', department: 'Concierge', icon: DoorOpen },
  { label: 'Extra Bed', department: 'Rooms', icon: BedDouble },
  { label: 'Late Checkout', department: 'Front Desk', icon: CalendarClock },
  { label: 'Damage', department: 'Front Desk', icon: FileText },
  { label: 'Other', department: 'Front Desk', icon: Gift },
];

const checkoutCharges = [
  ['Room Charges', 'INR 12,000'],
  ['Restaurant', 'INR 650'],
  ['Laundry', 'INR 420'],
  ['Mini Bar', 'INR 280'],
  ['Airport Pickup', 'INR 900'],
  ['Discounts', '-INR 500'],
  ['Taxes', 'INR 1,250'],
  ['Deposit', '-INR 5,000'],
  ['Total Paid', '-INR 20,000'],
];

const checkoutSteps: { key: CheckoutStep; label: string }[] = [
  { key: 'review-stay', label: 'Review Stay' },
  { key: 'review-charges', label: 'Review Charges' },
  { key: 'receive-payment', label: 'Receive Payment' },
  { key: 'complete', label: 'Complete Checkout' },
];

function toneColor(tone: StatusTone) {
  if (tone === 'success') return colors.semantic.success;
  if (tone === 'warning') return colors.semantic.warning;
  if (tone === 'danger') return colors.semantic.danger;
  if (tone === 'info') return colors.semantic.info;
  return colors.text.body;
}

function toneBackground(tone: StatusTone) {
  if (tone === 'warning') return brandPalettes.gold[50];
  if (tone === 'info') return brandPalettes.blue[50];
  if (tone === 'danger') return colors.surface.subtle;
  if (tone === 'success') return colors.brand[50];
  return colors.surface.subtle;
}

function SoftBadge({ children, tone = 'success' }: { children: ReactNode; tone?: StatusTone }) {
  return (
    <Badge
      radius={radius.full}
      variant="light"
      styles={{
        root: {
          background: toneBackground(tone),
          color: toneColor(tone),
          fontWeight: typography.weights.semibold,
          textTransform: 'none',
        },
      }}
    >
      {children}
    </Badge>
  );
}

function chargeStatusTone(status: ChargeStatus) {
  if (status === 'Paid') return colors.semantic.success;
  if (status === 'Pending') return colors.semantic.warning;
  if (status === 'Deposit Received') return colors.semantic.info;
  if (status === 'Approved') return colors.text.body;
  return colors.semantic.info;
}

function chargeStatusBackground(status: ChargeStatus) {
  if (status === 'Paid') return colors.brand[50];
  if (status === 'Pending') return brandPalettes.gold[50];
  if (status === 'Deposit Received') return brandPalettes.blue[50];
  return colors.surface.subtle;
}

function WorkspaceCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      className={styles.stayCard}
      p={spacing[5]}
      radius={radius.lg}
      shadow="xs"
      style={
        {
          '--stay-card-shadow': shadows.sm,
          border: 'none',
        } as CSSProperties
      }
    >
      <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={38}>
          {icon}
        </ThemeIcon>
        <Box>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            {title}
          </Title>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
            {subtitle}
          </Text>
        </Box>
      </Group>
      <Box mt={spacing[5]}>{children}</Box>
    </Card>
  );
}

function Hero() {
  return (
    <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between" align="flex-start" gap={spacing[5]}>
        <Stack gap={spacing[3]}>
          <Button
            component={Link}
            href="/"
            variant="subtle"
            color="gray"
            leftSection={<ChevronLeft size={16} />}
            px={0}
            w="fit-content"
          >
            Back to Front Desk
          </Button>
          <Group gap={spacing[2]}>
            <SoftBadge>VIP</SoftBadge>
            <SoftBadge>Returning Guest</SoftBadge>
            <SoftBadge tone="info">Loyalty Gold</SoftBadge>
          </Group>
          <Button
            component={Link}
            href="/guests/ananya-rao"
            variant="light"
            color="stayosBrand"
            w="fit-content"
          >
            Open Guest 360
          </Button>
          <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
            {guest.name}
          </Title>
          <Text c={colors.text.body} style={typography.styles.bodyLarge}>
            {guest.heroMessage}
          </Text>
          <Group gap={spacing[4]} wrap="wrap">
            <Text c={colors.text.muted} style={typography.styles.small}>
              Arrived {guest.arrivalDate}
            </Text>
            <Text c={colors.text.muted} style={typography.styles.small}>
              Departs {guest.departureDate}
            </Text>
            <Text c={colors.text.muted} style={typography.styles.small}>
              {guest.nights}
            </Text>
            <Text c={colors.text.muted} style={typography.styles.small}>
              {guest.occupancy}
            </Text>
          </Group>
        </Stack>
        <Paper p={spacing[5]} radius={radius.lg} bg={colors.brand[50]} miw={260}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Current Stay
          </Text>
          <Group mt={spacing[2]} gap={spacing[2]}>
            <Box
              aria-hidden
              style={{
                background: colors.semantic.success,
                borderRadius: radius.full,
                height: 9,
                width: 9,
              }}
            />
            <Text c={colors.brand[600]} style={typography.styles.h3}>
              {guest.status}
            </Text>
          </Group>
          <Group mt={spacing[4]} gap={spacing[2]}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
              <BedDouble size={16} />
            </ThemeIcon>
            <Text c={colors.text.strong} style={typography.styles.h3}>
              {guest.room}
            </Text>
          </Group>
          <Divider my={spacing[3]} color={colors.border.subtle} />
          <Stack gap={spacing[1]}>
            <Text c={colors.text.body} style={typography.styles.label}>
              {guest.stayProgress}
            </Text>
            <Text c={colors.semantic.warning} style={typography.styles.label}>
              {guest.checkoutContext}
            </Text>
          </Stack>
        </Paper>
      </Group>
    </Card>
  );
}

function StayTimeline() {
  return (
    <Card className={styles.timelineRail} p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Stay Timeline
      </Text>
      <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
        Newest activity first.
      </Text>
      <Stack mt={spacing[5]} gap={spacing[4]}>
        {timeline.map((event) => (
          <UnstyledButton
            key={`${event.time}-${event.title}`}
            className={styles.timelineItem}
            style={
              {
                '--timeline-hover': colors.surface.subtle,
                width: '100%',
              } as CSSProperties
            }
          >
            <Group align="flex-start" gap={spacing[3]} wrap="nowrap">
              <Text c={colors.brand[600]} w={70} style={typography.styles.caption}>
                {event.time}
              </Text>
              <Box
                aria-hidden
                mt={5}
                style={{
                  background: colors.brand[500],
                  borderRadius: radius.full,
                  flex: '0 0 8px',
                  height: 8,
                  width: 8,
                }}
              />
              <Box style={{ minWidth: 0 }}>
                <Text c={colors.text.strong} style={typography.styles.label}>
                  {event.title}
                </Text>
                <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
                  {event.detail}
                </Text>
                <Text c={colors.brand[600]} mt={spacing[1]} style={typography.styles.caption}>
                  {event.action}
                </Text>
              </Box>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Card>
  );
}

function StayOverviewCard() {
  return (
    <WorkspaceCard
      title="Stay Overview"
      subtitle="The operational facts for this stay."
      icon={<FileText size={18} />}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        {stayOverview.map(([label, value]) => (
          <Paper key={label} p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {label}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </WorkspaceCard>
  );
}

function VerificationCard() {
  return (
    <WorkspaceCard
      title="Verification"
      subtitle="Compliance and guest profile readiness."
      icon={<UserRound size={18} />}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        {verification.map((item) => (
          <Group key={item.label} justify="space-between" p={spacing[3]} bg={colors.surface.subtle} style={{ borderRadius: radius.md }}>
            <Text c={colors.text.body} style={typography.styles.small}>
              {item.label}
            </Text>
            <SoftBadge tone={item.tone}>{item.status}</SoftBadge>
          </Group>
        ))}
      </SimpleGrid>
    </WorkspaceCard>
  );
}

function FinancialSummaryCard() {
  return (
    <WorkspaceCard
      title="Financial Summary"
      subtitle="No mental calculation required."
      icon={<ReceiptText size={18} />}
    >
      <Paper p={spacing[5]} radius={radius.lg} bg={brandPalettes.gold[50]}>
        <Text c={colors.text.muted} style={typography.styles.caption}>
          Outstanding Balance
        </Text>
        <Text c={colors.semantic.warning} mt={spacing[1]} style={typography.styles.h1}>
          INR 1,700
        </Text>
      </Paper>
      <SimpleGrid mt={spacing[4]} cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        {finances.map(([label, value]) => (
          <Group key={label} justify="space-between">
            <Text c={colors.text.body} style={typography.styles.small}>
              {label}
            </Text>
            <Text c={colors.text.strong} style={typography.styles.label}>
              {value}
            </Text>
          </Group>
        ))}
      </SimpleGrid>
    </WorkspaceCard>
  );
}

function PreferencesCard() {
  return (
    <WorkspaceCard
      title="Guest Preferences"
      subtitle="Make the stay feel remembered."
      icon={<Sparkles size={18} />}
    >
      <Group gap={spacing[2]}>
        {preferences.map((preference) => (
          <SoftBadge key={preference} tone={preference.includes('Birthday') || preference.includes('Anniversary') ? 'info' : 'success'}>
            {preference}
          </SoftBadge>
        ))}
      </Group>
    </WorkspaceCard>
  );
}

function RequestsCard() {
  return (
    <WorkspaceCard
      title="Guest Requests"
      subtitle="Open requests without a heavy table."
      icon={<BellRing size={18} />}
    >
      <Stack gap={spacing[3]}>
        {requests.map((request) => (
          <Paper key={request.title} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
            <Group justify="space-between" align="flex-start" gap={spacing[3]}>
              <Box>
                <Text c={colors.text.strong} style={typography.styles.label}>
                  {request.title}
                </Text>
                <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
                  {request.detail}
                </Text>
              </Box>
              <SoftBadge tone={request.tone}>{request.status}</SoftBadge>
            </Group>
          </Paper>
        ))}
      </Stack>
    </WorkspaceCard>
  );
}

function HousekeepingCard() {
  return (
    <WorkspaceCard
      title="Housekeeping"
      subtitle="Room readiness and services at a glance."
      icon={<Sparkles size={18} />}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        {housekeeping.map((item) => (
          <Paper key={item.label} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {item.label}
            </Text>
            <Text c={toneColor(item.tone)} mt={spacing[1]} style={typography.styles.label}>
              {item.status}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </WorkspaceCard>
  );
}

function ReceptionAssistant() {
  const tasks = getOpenOperationalTasks({ reservation: 'ST1842', limit: 3 });

  return (
    <Card className={styles.assistantRail} p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Reception Assistant
      </Text>
      <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
        Contextual tasks for this stay.
      </Text>
      <Stack mt={spacing[5]} gap={spacing[3]}>
        {tasks.map((task) => (
          <OperationalTaskCard key={task.id} task={task} compact />
        ))}
      </Stack>
    </Card>
  );
}

function FolioDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(94vw, 560px)"
      title="Guest Folio"
    >
      <Stack gap={spacing[5]}>
        <Box>
          <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
            {guest.name}
          </Title>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
            {guest.room} - {guest.arrivalDate} to {guest.departureDate}
          </Text>
        </Box>

        <SimpleGrid cols={2} spacing={spacing[3]}>
          {[
            ['Current Balance', 'INR 22,700', 'warning'],
            ['Deposit', 'INR 5,000', 'info'],
            ['Paid Amount', 'INR 20,000', 'success'],
            ['Outstanding', 'INR 1,700', 'warning'],
          ].map(([label, value, tone]) => (
            <Paper key={label} p={spacing[4]} radius={radius.lg} bg={toneBackground(tone as StatusTone)}>
              <Text c={colors.text.muted} style={typography.styles.caption}>
                {label}
              </Text>
              <Text c={toneColor(tone as StatusTone)} mt={spacing[1]} style={typography.styles.h3}>
                {value}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>

        <Paper p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
          <Group justify="space-between">
            <Text c={colors.text.strong} style={typography.styles.label}>
              Status
            </Text>
            <Badge
              radius={radius.full}
              variant="light"
              styles={{
                root: {
                  background: brandPalettes.gold[50],
                  color: colors.semantic.warning,
                  textTransform: 'none',
                },
              }}
            >
              Partially Paid
            </Badge>
          </Group>
        </Paper>

        <Box>
          <Text c={colors.text.strong} style={typography.styles.label}>
            Charges
          </Text>
          <Stack mt={spacing[3]} gap={spacing[3]}>
            {folioCharges.map((charge) => (
              <Paper key={charge.title} p={spacing[4]} radius={radius.lg} bg={colors.surface.base}>
                <Group justify="space-between" align="flex-start" gap={spacing[3]}>
                  <Box>
                    <Text c={colors.text.strong} style={typography.styles.label}>
                      {charge.title}
                    </Text>
                    <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
                      Chronological folio entry
                    </Text>
                  </Box>
                  <Stack align="flex-end" gap={spacing[2]}>
                    <Text c={colors.text.strong} style={typography.styles.label}>
                      {charge.amount}
                    </Text>
                    <Badge
                      radius={radius.full}
                      variant="light"
                      styles={{
                        root: {
                          background: chargeStatusBackground(charge.status),
                          color: chargeStatusTone(charge.status),
                          textTransform: 'none',
                        },
                      }}
                    >
                      {charge.status}
                    </Badge>
                  </Stack>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
          <Text c={colors.text.strong} style={typography.styles.label}>
            Payment placeholders
          </Text>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
            Cash, Card, UPI, Bank Transfer, Corporate, and Mixed Payment will connect later.
          </Text>
        </Paper>
      </Stack>
    </Drawer>
  );
}

function PostChargeDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(94vw, 560px)"
      title="Post Charge"
    >
      <Stack gap={spacing[5]}>
        <Text c={colors.text.muted} style={typography.styles.small}>
          Record the service provided. StayOS fills guest, room, date, user, and department.
        </Text>

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={spacing[3]}>
          {chargeTypes.map((type) => (
            <Paper key={type.label} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
              <Group gap={spacing[3]} wrap="nowrap">
                <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
                  <type.icon size={16} />
                </ThemeIcon>
                <Box>
                  <Text c={colors.text.strong} style={typography.styles.label}>
                    {type.label}
                  </Text>
                  <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
                    {type.department}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        <SimpleGrid cols={2} spacing={spacing[3]}>
          <TextInput label="Guest" value={guest.name} readOnly />
          <TextInput label="Room" value={guest.room} readOnly />
          <TextInput label="Date" value="Today" readOnly />
          <TextInput label="User" value="Aarav Mehta" readOnly />
        </SimpleGrid>

        <TextInput label="Amount" placeholder="INR 0" />
        <Textarea label="Notes" placeholder="Optional notes" minRows={3} />

        <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
          <Text c={colors.text.strong} style={typography.styles.label}>
            Smart defaults
          </Text>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
            Department, guest, room, date, and posting user are automatically determined.
          </Text>
        </Paper>

        <Button color="stayosBrand" leftSection={<CreditCard size={16} />}>
          Done
        </Button>
      </Stack>
    </Drawer>
  );
}

function CheckoutDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [step, setStep] = useState<CheckoutStep>('review-stay');
  const [acknowledged, setAcknowledged] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [completed, setCompleted] = useState(false);
  const currentStepIndex = checkoutSteps.findIndex((item) => item.key === step);
  const outstandingBalance = paymentReceived ? 'INR 0' : 'INR 1,700';
  const hasPaymentPending = !paymentReceived;

  const goNext = () => {
    if (step === 'review-stay') setStep('review-charges');
    if (step === 'review-charges') setStep(hasPaymentPending ? 'receive-payment' : 'complete');
    if (step === 'receive-payment') setStep('complete');
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(96vw, 680px)"
      title="Checkout Journey"
    >
      <SimpleGrid cols={{ base: 1, sm: 12 }} spacing={spacing[5]}>
        <Stack gap={spacing[2]} style={{ gridColumn: 'span 4' }}>
          {checkoutSteps.map((item, index) => {
            const isActive = item.key === step;
            const isDone = index < currentStepIndex || completed;

            return (
              <Paper
                key={item.key}
                p={spacing[3]}
                radius={radius.md}
                bg={isActive ? colors.brand[50] : colors.surface.subtle}
              >
                <Group gap={spacing[3]} wrap="nowrap">
                  <ThemeIcon
                    color={isDone || isActive ? 'stayosBrand' : 'gray'}
                    variant={isDone || isActive ? 'light' : 'subtle'}
                    radius={radius.full}
                    size={28}
                  >
                    {isDone ? <Check size={14} /> : <Text style={typography.styles.caption}>{index + 1}</Text>}
                  </ThemeIcon>
                  <Text c={colors.text.strong} style={typography.styles.label}>
                    {item.label}
                  </Text>
                </Group>
              </Paper>
            );
          })}
        </Stack>

        <Stack gap={spacing[5]} style={{ gridColumn: 'span 8' }}>
          {completed ? (
            <Stack gap={spacing[5]} align="center" ta="center">
              <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={72}>
                <Check size={34} />
              </ThemeIcon>
              <Box>
                <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
                  Thank you for staying with us.
                </Title>
                <Text c={colors.text.body} mt={spacing[2]} style={typography.styles.body}>
                  We hope to welcome you again soon.
                </Text>
              </Box>
              <Stack gap={spacing[3]} w="100%">
                {[
                  'Room 402 has been released.',
                  'Housekeeping has been notified.',
                  'Invoice has been prepared.',
                  'Room Operations now shows Needs Cleaning.',
                ].map((item) => (
                  <Paper key={item} p={spacing[3]} radius={radius.md} bg={colors.brand[50]}>
                    <Text c={colors.text.strong} style={typography.styles.label}>
                      {item}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          ) : null}

          {!completed && step === 'review-stay' ? (
            <Stack gap={spacing[5]}>
              <Box>
                <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
                  Review Stay
                </Title>
                <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
                  We're almost done. Confirm the stay is ready to close.
                </Text>
              </Box>
              <SimpleGrid cols={2} spacing={spacing[3]}>
                {[
                  ['Guest', guest.name],
                  ['Room', guest.room],
                  ['Stay Dates', `${guest.arrivalDate} - ${guest.departureDate}`],
                  ['Nights', guest.nights],
                  ['Guests', guest.occupancy],
                  ['Current Balance', outstandingBalance],
                  ['Status', guest.status],
                  ['Profile', 'VIP - Returning Guest'],
                ].map(([label, value]) => (
                  <Paper key={label} p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
                    <Text c={colors.text.muted} style={typography.styles.caption}>
                      {label}
                    </Text>
                    <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
                      {value}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
              <Stack gap={spacing[3]}>
                {['Guest Services Completed', 'Housekeeping Updated', 'Identity Verified', 'Requests Closed'].map(
                  (item) => (
                    <Group key={item} gap={spacing[3]}>
                      <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={26}>
                        <Check size={14} />
                      </ThemeIcon>
                      <Text c={colors.text.strong} style={typography.styles.label}>
                        {item}
                      </Text>
                    </Group>
                  ),
                )}
              </Stack>
              <Paper p={spacing[4]} radius={radius.lg} bg={brandPalettes.gold[50]}>
                <Text c={colors.semantic.warning} style={typography.styles.label}>
                  Mini Bar not checked.
                </Text>
                <Button
                  mt={spacing[3]}
                  size="xs"
                  variant="light"
                  color="stayosBrand"
                  onClick={() => setAcknowledged(true)}
                >
                  Acknowledge
                </Button>
              </Paper>
              <Button color="stayosBrand" disabled={!acknowledged} onClick={goNext}>
                Continue
              </Button>
            </Stack>
          ) : null}

          {!completed && step === 'review-charges' ? (
            <Stack gap={spacing[5]}>
              <Box>
                <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
                  Review Charges
                </Title>
                <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
                  Confirm the folio before collecting final payment.
                </Text>
              </Box>
              <Paper
                p={spacing[5]}
                radius={radius.lg}
                bg={
                  hasPaymentPending
                    ? `color-mix(in srgb, ${colors.semantic.danger} 9%, ${colors.surface.base})`
                    : colors.brand[50]
                }
              >
                <Text c={colors.text.muted} style={typography.styles.caption}>
                  Outstanding Balance
                </Text>
                <Text c={hasPaymentPending ? colors.semantic.danger : colors.semantic.success} mt={spacing[1]} style={typography.styles.h1}>
                  {outstandingBalance}
                </Text>
              </Paper>
              <Stack gap={spacing[3]}>
                {checkoutCharges.map(([label, value]) => (
                  <Paper key={label} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
                    <Group justify="space-between">
                      <Text c={colors.text.strong} style={typography.styles.label}>
                        {label}
                      </Text>
                      <Text c={colors.text.body} style={typography.styles.label}>
                        {value}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
              <Button color="stayosBrand" onClick={goNext}>
                {hasPaymentPending ? 'Receive Payment' : 'Continue'}
              </Button>
            </Stack>
          ) : null}

          {!completed && step === 'receive-payment' ? (
            <Stack gap={spacing[5]}>
              <Box>
                <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
                  Receive Payment
                </Title>
                <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
                  Choose how the guest is settling the remaining balance.
                </Text>
              </Box>
              <SimpleGrid cols={3} spacing={spacing[3]}>
                {[
                  ['Amount Due', 'INR 1,700'],
                  ['Amount Received', paymentReceived ? 'INR 1,700' : 'INR 0'],
                  ['Balance After Payment', outstandingBalance],
                ].map(([label, value]) => (
                  <Paper key={label} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
                    <Text c={colors.text.muted} style={typography.styles.caption}>
                      {label}
                    </Text>
                    <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.h3}>
                      {value}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
              <Group gap={spacing[3]}>
                {['Cash', 'Card', 'UPI', 'Corporate Billing', 'Bank Transfer', 'Mixed Payment'].map((method) => (
                  <Button key={method} variant="light" color="stayosBrand" onClick={() => setPaymentReceived(true)}>
                    {method}
                  </Button>
                ))}
              </Group>
              <Button color="stayosBrand" disabled={!paymentReceived} onClick={goNext}>
                Continue
              </Button>
            </Stack>
          ) : null}

          {!completed && step === 'complete' ? (
            <Stack gap={spacing[5]}>
              <Box>
                <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
                  Complete Checkout
                </Title>
                <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
                  Final confirmation before the guest leaves.
                </Text>
              </Box>
              <Stack gap={spacing[3]}>
                {['Payment Complete', 'Invoice Ready', 'Guest Checked Out', 'Room Released'].map((item) => (
                  <Group key={item} gap={spacing[3]}>
                    <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={26}>
                      <Check size={14} />
                    </ThemeIcon>
                    <Text c={colors.text.strong} style={typography.styles.label}>
                      {item}
                    </Text>
                  </Group>
                ))}
              </Stack>
              <Button color="stayosBrand" onClick={() => setCompleted(true)}>
                Complete Checkout
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </SimpleGrid>
    </Drawer>
  );
}

function ActionDock({
  onViewFolio,
  onPostCharge,
  onCheckout,
}: {
  onViewFolio: () => void;
  onPostCharge: () => void;
  onCheckout: () => void;
}) {
  const stayActions: DockAction[] = [
    { label: 'Check Out', icon: <DoorOpen size={17} />, primary: true, onClick: onCheckout },
    { label: 'Extend Stay', icon: <CalendarClock size={17} /> },
    { label: 'Change Room', icon: <RefreshCw size={17} /> },
  ];
  const billingActions: DockAction[] = [
    { label: 'View Folio', icon: <ReceiptText size={17} />, onClick: onViewFolio },
    { label: 'Post Charge', icon: <CreditCard size={17} />, onClick: onPostCharge },
    { label: 'Print Registration', icon: <Printer size={17} /> },
    { label: 'Print Invoice', icon: <ReceiptText size={17} /> },
  ];
  const serviceActions: DockAction[] = [
    { label: 'Add Request', icon: <MessageSquare size={17} /> },
    { label: 'Wake-up Call', icon: <Moon size={17} /> },
    { label: 'Issue Extra Key', icon: <KeyRound size={17} /> },
  ];

  return (
    <Stack
      className={styles.actionDock}
      gap={spacing[2]}
      style={
        {
          '--dock-background': colors.surface.base,
          '--dock-border': colors.border.subtle,
          '--dock-radius': radius.lg,
          '--dock-shadow': shadows.md,
        } as CSSProperties
      }
    >
      <Group gap={spacing[4]} wrap="wrap" align="flex-end">
        {[
          { group: 'Stay', actions: stayActions },
          { group: 'Billing', actions: billingActions },
          { group: 'Guest Services', actions: serviceActions },
        ].map(({ group, actions }) => (
          <Stack key={group} gap={spacing[1]}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {group}
            </Text>
            <Group gap={spacing[2]} wrap="wrap">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  color={action.primary ? 'stayosBrand' : 'gray'}
                  variant={action.primary ? 'filled' : 'light'}
                  leftSection={action.icon}
                  onClick={'onClick' in action ? action.onClick : undefined}
                >
                  {action.label}
                </Button>
              ))}
            </Group>
          </Stack>
        ))}
        <Stack gap={spacing[1]}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            More
          </Text>
          <Menu position="top-end" shadow="md" width={220}>
            <Menu.Target>
              <Button variant="subtle" color="gray" leftSection={<MoreHorizontal size={17} />}>
                More Actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>Send Message</Menu.Item>
              <Menu.Item component={Link} href="/guests/ananya-rao">
                Open Guest Profile
              </Menu.Item>
              <Menu.Item>Audit Stay</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Stack>
      </Group>
    </Stack>
  );
}

export default function GuestStayWorkspacePage() {
  const [folioOpened, { open: openFolio, close: closeFolio }] = useDisclosure(false);
  const [postChargeOpened, { open: openPostCharge, close: closePostCharge }] =
    useDisclosure(false);
  const [checkoutOpened, { open: openCheckout, close: closeCheckout }] = useDisclosure(false);

  return (
    <Box pb={96}>
      <Stack gap={spacing[5]}>
        <Hero />
        <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[5]}>
          <Box style={{ gridColumn: 'span 3' }}>
            <StayTimeline />
          </Box>
          <Stack gap={spacing[5]} style={{ gridColumn: 'span 6' }}>
            <StayOverviewCard />
            <VerificationCard />
            <FinancialSummaryCard />
            <PreferencesCard />
            <RequestsCard />
            <HousekeepingCard />
          </Stack>
          <Box style={{ gridColumn: 'span 3' }}>
            <ReceptionAssistant />
          </Box>
        </SimpleGrid>
      </Stack>
      <ActionDock
        onViewFolio={openFolio}
        onPostCharge={openPostCharge}
        onCheckout={openCheckout}
      />
      <FolioDrawer opened={folioOpened} onClose={closeFolio} />
      <PostChargeDrawer opened={postChargeOpened} onClose={closePostCharge} />
      <CheckoutDrawer opened={checkoutOpened} onClose={closeCheckout} />
    </Box>
  );
}
