'use client';

import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  AlertTriangle,
  BedDouble,
  BriefcaseBusiness,
  CalendarPlus,
  ClipboardCheck,
  CreditCard,
  Crown,
  DoorOpen,
  LogOut,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { ArrivalWorkspace } from '../features/arrivals/components/ArrivalWorkspace';
import { type FrontDeskTask, useFrontDeskData } from '../lib/front-desk-api';
import styles from './front-desk.module.css';

type Tone = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'neutral';
type QuickAction = {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  tone: Tone;
};

type SummaryMetric = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: Tone;
  href?: string;
};

function buildQuickActions(onNewArrival: () => void): QuickAction[] {
  return [
  { label: 'New Arrival', icon: <UserPlus size={18} />, onClick: onNewArrival, tone: 'green' },
  { label: 'New Booking', icon: <CalendarPlus size={18} />, href: '/reservations/new', tone: 'purple' },
  { label: 'Find Guest', icon: <Users size={18} />, href: '/guests', tone: 'neutral' },
  { label: 'Receive Payment', icon: <CreditCard size={18} />, href: '/requests', tone: 'red' },
  { label: 'View Rooms', icon: <DoorOpen size={18} />, href: '/rooms', tone: 'blue' },
  {
    label: 'Availability',
    icon: <ClipboardCheck size={18} />,
    href: '/reservations/availability',
    tone: 'blue',
  },
  { label: 'Check Out', icon: <LogOut size={18} />, href: '/rooms', tone: 'amber' },
  { label: 'More Actions', icon: <Plus size={18} />, tone: 'neutral' },
  ];
}

function toneClass(tone: Tone) {
  return styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}`];
}

// function priorityLabel(priority: AttentionPriority) {
//   switch (priority) {
//     case 'critical':
//       return 'P1';
//     case 'high':
//       return 'P2';
//     default:
//       return 'P3';
//   }
// }

function buttonColor(tone: Tone) {
  switch (tone) {
    case 'amber':
      return 'orange';
    case 'purple':
      return 'violet';
    default:
      return tone;
  }
}

function buttonVariant(tone: Tone) {
  switch (tone) {
    case 'red':
      return 'filled';
    case 'amber':
      return 'light';
    case 'green':
      return 'light';
    case 'purple':
      return 'light';
    default:
      return 'outline';
  }
}

function formatCurrency(value: number) {
  if (value <= 0) return 'INR 0';
  return `INR ${value.toLocaleString('en-IN')}`;
}

function taskIcon(item: FrontDeskTask) {
  switch (item.category) {
    case 'Arrival':
      return <BriefcaseBusiness size={18} />;
    case 'Payment':
      return <CreditCard size={18} />;
    case 'Room Ready':
      return <BedDouble size={18} />;
    case 'VIP':
      return <Crown size={18} />;
    case 'Maintenance':
      return <AlertTriangle size={18} />;
    case 'Checkout':
      return <LogOut size={18} />;
    default:
      return <Users size={18} />;
  }
}

function buildSummaryMetrics({
  isLoading,
  paymentsDue,
  arrivalsToday,
  departuresToday,
  guestsInHouse,
  roomsToClean,
}: {
  arrivalsToday: number;
  departuresToday: number;
  guestsInHouse: number;
  isLoading: boolean;
  paymentsDue: number;
  roomsToClean: number;
}): SummaryMetric[] {
  const loadingValue = isLoading ? '--' : undefined;

  return [
    {
      label: 'Arrivals Today',
      value: loadingValue ?? String(arrivalsToday),
      detail: arrivalsToday === 0 && !isLoading ? 'No arrivals today' : 'Expected check-ins today',
      icon: <Users size={16} />,
      tone: 'blue',
      href: '/reservations',
    },
    {
      label: 'Departures Today',
      value: loadingValue ?? String(departuresToday),
      detail: departuresToday === 0 && !isLoading ? 'No departures today' : 'Scheduled check-outs today',
      icon: <Users size={16} />,
      tone: 'neutral',
      href: '/rooms',
    },
    {
      label: 'Guests In House',
      value: loadingValue ?? String(guestsInHouse),
      detail: 'Active checked-in stays',
      icon: <Users size={16} />,
      tone: 'blue',
      href: '/guests',
    },
    {
      label: 'Payments Due',
      value: loadingValue ?? formatCurrency(paymentsDue),
      detail: paymentsDue === 0 && !isLoading ? 'No pending balances' : 'Open guest balances',
      icon: <AlertTriangle size={16} />,
      tone: 'red',
      href: '/requests',
    },
    {
      label: 'Rooms To Clean',
      value: loadingValue ?? String(roomsToClean),
      detail: roomsToClean === 0 && !isLoading ? 'Housekeeping clear' : 'Dirty or cleaning rooms',
      icon: <ClipboardCheck size={16} />,
      tone: 'amber',
      href: '/rooms',
    },
  ];
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const content = (
    <Paper className={`${styles.quickActionCard} ${toneClass(action.tone)}`} radius={radius.lg}>
      <Group gap={spacing[3]} wrap="nowrap">
        <ThemeIcon className={styles.quickIcon} variant="light" radius={radius.md} size={34}>
          {action.icon}
        </ThemeIcon>
        <Text className={styles.quickLabel}>{action.label}</Text>
      </Group>
    </Paper>
  );

  return action.href ? (
    <Link href={action.href} className={styles.cardLink}>
      {content}
    </Link>
  ) : action.onClick ? (
    <UnstyledButton onClick={action.onClick} className={styles.cardLink}>
      {content}
    </UnstyledButton>
  ) : (
    content
  );
}

function QuickActions({ onNewArrival }: { onNewArrival: () => void }) {
  const quickActions = buildQuickActions(onNewArrival);

  return (
    <SimpleGrid
      cols={{ base: 2, sm: 3, lg: 4, xl: 4 }}
      spacing={spacing[3]}
      className={styles.quickActionsGrid}
    >
      {quickActions.map((action) => (
        <QuickActionCard key={action.label} action={action} />
      ))}
    </SimpleGrid>
  );
}

function SummaryCard({ metric }: { metric: SummaryMetric }) {
  const card = (
    <Paper className={`${styles.summaryCard} ${toneClass(metric.tone)}`} radius={radius.lg}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text className={styles.summaryLabel}>{metric.label}</Text>
          <Text className={styles.summaryValue}>{metric.value}</Text>
          <Text className={styles.summaryDetail}>{metric.detail}</Text>
        </Box>
        <ThemeIcon className={styles.summaryIcon} variant="light" radius={radius.full} size={34}>
          {metric.icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );

  return metric.href ? (
    <Link href={metric.href} className={styles.cardLink}>
      {card}
    </Link>
  ) : (
    card
  );
}

function SummaryCards({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <SimpleGrid
      cols={{ base: 1, sm: 2, xl: 3 }}
      spacing={spacing[3]}
      className={styles.summaryGrid}
    >
      {metrics.map((metric) => (
        <SummaryCard key={metric.label} metric={metric} />
      ))}
    </SimpleGrid>
  );
}

function AttentionCard({ item }: { item: FrontDeskTask }) {
  const actionButton = (
    <Button
      className={styles.attentionActionButton}
      variant={buttonVariant(item.tone)}
      color={buttonColor(item.tone)}
      size="compact-sm"
    >
      {item.action}
    </Button>
  );

  return (
    <Paper className={`${styles.attentionCard} ${toneClass(item.tone)}`} radius={radius.lg}>
      <Group className={styles.attentionGrid} wrap="nowrap">
        {/* <Box className={styles.attentionPriority}>{priorityLabel(item.priority)}</Box> */}

        <ThemeIcon className={styles.attentionIcon} variant="light" radius={radius.md} size={38}>
          {taskIcon(item)}
        </ThemeIcon>

        <Box className={styles.attentionBody}>
          <Group gap={spacing[2]} wrap="nowrap">
            <Text className={styles.attentionSignal}>{item.signal}</Text>
            <Text className={styles.attentionCategory}>{item.category}</Text>
          </Group>

          <Text className={styles.attentionSubject}>{item.title}</Text>
          <Text className={styles.attentionMeta}>{item.subtitle}</Text>
          <Text className={styles.attentionDetail}>{item.message}</Text>
        </Box>

        {item.href ? (
          <Link href={item.href} className={styles.cardLink}>
            {actionButton}
          </Link>
        ) : (
          actionButton
        )}
      </Group>
    </Paper>
  );
}

function NeedsAttention({
  error,
  isLoading,
  items,
}: {
  error?: string;
  isLoading: boolean;
  items: FrontDeskTask[];
}) {
  const visibleItems = items;
  ///const totalTasks = 12;
  //const criticalTasks = attentionItems.filter((item) => item.priority === 'critical').length;

  return (
    <Card className={styles.sectionCard} radius={radius.lg} p={0}>
      <Group justify="space-between" align="center" className={styles.sectionHeader}>
        <Box>
          <Group gap={spacing[2]}>
            <Title order={2} className={styles.sectionTitle}>
              Needs Attention
            </Title>
          </Group>
          <Text className={styles.sectionSubtitle}>
            {error
              ? 'Live queue unavailable'
              : isLoading
                ? 'Loading live queue'
                : visibleItems.length > 0
                  ? `${visibleItems.length} tasks require action`
                  : 'No urgent tasks'}
          </Text>
        </Box>

        <Button variant="subtle" size="compact-sm">
          View Queue
        </Button>
      </Group>

      <Stack gap={0} className={styles.attentionList}>
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => <AttentionCard key={item.id} item={item} />)
        ) : (
          <Box className={styles.emptyQueue}>
            <Text className={styles.attentionSubject}>
              {isLoading ? 'Loading front desk queue...' : 'No urgent tasks'}
            </Text>
            <Text className={styles.attentionDetail}>
              {error ?? 'New arrivals, payments, and room issues will appear here.'}
            </Text>
          </Box>
        )}
      </Stack>
    </Card>
  );
}

export default function HomePage() {
  const frontDesk = useFrontDeskData();
  const [arrivalOpened, setArrivalOpened] = useState(false);
  const summaryMetrics = buildSummaryMetrics({ ...frontDesk.summary, isLoading: frontDesk.isLoading });

  return (
    <Stack gap={spacing[3]} className={styles.pageShell}>
      <QuickActions onNewArrival={() => setArrivalOpened(true)} />

      <Box className={styles.desktopGrid}>
        <Stack gap={spacing[3]} className={styles.mainColumn}>
          <SummaryCards metrics={summaryMetrics} />
          <NeedsAttention
            error={frontDesk.error}
            isLoading={frontDesk.isLoading}
            items={frontDesk.tasks}
          />
        </Stack>
      </Box>
      <ArrivalWorkspace opened={arrivalOpened} onClose={() => setArrivalOpened(false)} />
    </Stack>
  );
}
