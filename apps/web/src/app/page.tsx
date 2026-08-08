'use client';

import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  Group,
  Paper,
  SegmentedControl,
  Skeleton,
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
  Crown,
  DoorOpen,
  LogOut,
  Search,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { type FrontDeskTask, useFrontDeskData } from '../lib/front-desk-api';
import styles from './front-desk.module.css';

type Tone = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'neutral';
type QuickAction = {
  destination: string;
  href?: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  subtitle?: string;
  tone: Tone;
};

type SummaryMetric = {
  label: string;
  value: string;
  icon: ReactNode;
  tone: Tone;
  href?: string;
  routeHint: string;
};

function buildQuickActions(): QuickAction[] {
  return [
    {
      label: 'New Booking',
      subtitle: 'Single guest or walk-in',
      destination: 'Opens booking form',
      icon: <CalendarPlus size={18} />,
      href: '/reservations/new',
      tone: 'green',
    },
    {
      label: 'Assign Room',
      subtitle: 'Ready rooms only',
      destination: 'Shows assignable rooms',
      icon: <DoorOpen size={18} />,
      href: '/rooms?mode=assign&status=ready',
      tone: 'red',
    },
    {
      label: 'Group / Block',
      subtitle: 'Multiple rooms or event',
      destination: 'Opens group quote',
      icon: <BriefcaseBusiness size={18} />,
      href: '/reservations/group-quote',
      tone: 'blue',
    },
    {
      label: 'Availability',
      subtitle: 'Room mix + dates',
      destination: 'Opens calendar',
      icon: <ClipboardCheck size={18} />,
      href: '/reservations/availability',
      tone: 'blue',
    },
    {
      label: 'Find Guest',
      subtitle: 'Profile or stay',
      destination: 'Opens guest search',
      icon: <Search size={18} />,
      href: '/guests',
      tone: 'neutral',
    },
    {
      label: 'Check Out',
      subtitle: 'Departures due',
      destination: 'Shows due checkouts',
      icon: <LogOut size={18} />,
      href: '/reservations?filter=departures-today',
      tone: 'amber',
    },
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

function taskIcon(item: FrontDeskTask) {
  switch (item.category) {
    case 'Arrival':
      return <BriefcaseBusiness size={18} />;
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
  arrivalsToday,
  departuresToday,
  guestsInHouse,
  roomsToClean,
}: {
  arrivalsToday: number;
  departuresToday: number;
  guestsInHouse: number;
  isLoading: boolean;
  roomsToClean: number;
}): SummaryMetric[] {
  const loadingValue = isLoading ? '--' : undefined;

  return [
    {
      label: 'Arrivals Today',
      value: loadingValue ?? String(arrivalsToday),
      icon: <Users size={16} />,
      tone: 'blue',
      href: '/reservations?filter=arrivals-today',
      routeHint: 'Opens arrivals list',
    },
    {
      label: 'Departures Today',
      value: loadingValue ?? String(departuresToday),
      icon: <Users size={16} />,
      tone: 'neutral',
      href: '/reservations?filter=departures-today',
      routeHint: 'Opens checkout list',
    },
    {
      label: 'Guests In House',
      value: loadingValue ?? String(guestsInHouse),
      icon: <Users size={16} />,
      tone: 'blue',
      href: '/reservations?filter=checked-in',
      routeHint: 'Opens in-house stays',
    },
    {
      label: 'Rooms To Clean',
      value: loadingValue ?? String(roomsToClean),
      icon: <ClipboardCheck size={16} />,
      tone: 'amber',
      href: '/rooms?status=needs-cleaning',
      routeHint: 'Opens rooms to clean',
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
        <Box className={styles.quickText}>
          <Text className={styles.quickLabel}>{action.label}</Text>
          {action.subtitle ? <Text className={styles.quickSubtitle}>{action.subtitle}</Text> : null}
          <Text className={styles.quickDestination}>{action.destination}</Text>
        </Box>
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

function QuickActions() {
  const quickActions = buildQuickActions();

  return (
    <Box className={styles.quickActionsGrid}>
      {quickActions.map((action) => (
        <QuickActionCard key={action.label} action={action} />
      ))}
    </Box>
  );
}

function SummaryStrip({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <Paper className={styles.summaryStrip} data-testid="front-desk-stats-strip" radius={radius.lg}>
      {metrics.map((metric) => (
        <Link key={metric.label} href={metric.href ?? '#'} className={styles.summaryStripItem}>
          <ThemeIcon
            className={`${styles.summaryStripIcon} ${toneClass(metric.tone)}`}
            variant="light"
            radius={radius.full}
            size={30}
          >
            {metric.icon}
          </ThemeIcon>
          <Box className={styles.summaryStripText}>
            <Group gap={7} wrap="nowrap">
              <Text className={styles.summaryStripValue}>{metric.value}</Text>
              <Text className={styles.summaryStripLabel}>{metric.label}</Text>
            </Group>
            <Text className={styles.summaryStripHint}>{metric.routeHint}</Text>
          </Box>
        </Link>
      ))}
    </Paper>
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
  const [filter, setFilter] = useState('all');
  const arrivalCount = items.filter((item) => item.category === 'Arrival').length;
  const roomCount = items.filter(
    (item) => item.category === 'Room Ready' || item.category === 'Maintenance',
  ).length;
  const vipCount = items.filter((item) => item.category === 'VIP').length;
  const visibleItems =
    filter === 'all'
      ? items
      : items.filter((item) => {
          if (filter === 'arrivals') return item.category === 'Arrival';
          if (filter === 'rooms')
            return item.category === 'Room Ready' || item.category === 'Maintenance';
          return item.category === 'VIP';
        });

  return (
    <Card className={styles.sectionCard} radius={radius.lg} p={0}>
      <Group justify="space-between" align="center" className={styles.sectionHeader} wrap="nowrap">
        <Box>
          <Group gap={spacing[2]}>
            <Title order={2} className={styles.sectionTitle}>
              Action Queue
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

        <SegmentedControl
          className={styles.queueFilters}
          size="xs"
          value={filter}
          onChange={setFilter}
          data={[
            { label: `All ${items.length}`, value: 'all' },
            { label: `Arrivals ${arrivalCount}`, value: 'arrivals' },
            { label: `Rooms ${roomCount}`, value: 'rooms' },
            { label: `VIP ${vipCount}`, value: 'vip' },
          ]}
        />
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

function QuickActionsSkeleton() {
  return (
    <Box className={styles.quickActionsGrid} aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <Paper
          key={`quick-skeleton-${index}`}
          className={styles.quickActionCard}
          radius={radius.lg}
        >
          <Group gap={spacing[3]} wrap="nowrap">
            <Skeleton height={34} width={34} radius={radius.md} />
            <Stack gap={5} style={{ flex: 1 }}>
              <Skeleton height={14} width="48%" radius="sm" />
              <Skeleton height={11} width="72%" radius="sm" />
              <Skeleton height={10} width="58%" radius="sm" />
            </Stack>
          </Group>
        </Paper>
      ))}
    </Box>
  );
}

function SummaryStripSkeleton() {
  return (
    <Paper
      className={styles.summaryStrip}
      data-testid="front-desk-stats-strip-loading"
      radius={radius.lg}
      aria-hidden
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <Box key={`summary-skeleton-${index}`} className={styles.summaryStripItem}>
          <Skeleton height={30} width={30} radius={radius.full} />
          <Box className={styles.summaryStripText} style={{ flex: 1 }}>
            <Group gap={7} wrap="nowrap">
              <Skeleton height={18} width={24} radius="sm" />
              <Skeleton height={13} width={100} radius="sm" />
            </Group>
            <Skeleton mt={5} height={10} width={120} radius="sm" />
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

function ActionQueueSkeleton() {
  return (
    <Card className={styles.sectionCard} radius={radius.lg} p={0} aria-hidden>
      <Group justify="space-between" align="center" className={styles.sectionHeader} wrap="nowrap">
        <Box>
          <Skeleton height={20} width={125} radius="sm" />
          <Skeleton mt={7} height={11} width={105} radius="sm" />
        </Box>

        <Group gap={4}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`filter-skeleton-${index}`} height={28} width={62} radius="md" />
          ))}
        </Group>
      </Group>

      <Stack gap={0} className={styles.attentionList}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Paper
            key={`queue-skeleton-${index}`}
            className={styles.attentionCard}
            radius={radius.lg}
          >
            <Group className={styles.attentionGrid} wrap="nowrap">
              <Skeleton height={38} width={38} radius={radius.md} />

              <Box className={styles.attentionBody} style={{ flex: 1 }}>
                <Group gap={spacing[2]} wrap="nowrap">
                  <Skeleton height={10} width={58} radius="sm" />
                  <Skeleton height={10} width={74} radius="sm" />
                </Group>

                <Skeleton mt={7} height={15} width="32%" radius="sm" />
                <Skeleton mt={6} height={11} width="48%" radius="sm" />
                <Skeleton mt={5} height={10} width="62%" radius="sm" />
              </Box>

              <Skeleton height={30} width={105} radius="md" />
            </Group>
          </Paper>
        ))}
      </Stack>
    </Card>
  );
}

function FrontDeskLoading() {
  return (
    <Stack
      gap={spacing[3]}
      className={styles.pageShell}
      aria-label="Loading front desk"
      aria-busy="true"
    >
      <QuickActionsSkeleton />

      <Box className={styles.desktopGrid}>
        <Stack gap={spacing[3]} className={styles.mainColumn}>
          <SummaryStripSkeleton />
          <ActionQueueSkeleton />
        </Stack>
      </Box>
    </Stack>
  );
}

export default function HomePage() {
  const frontDesk = useFrontDeskData();

  if (frontDesk.isLoading) {
    return <FrontDeskLoading />;
  }

  const summaryMetrics = buildSummaryMetrics({
    ...frontDesk.summary,
    isLoading: false,
  });

  return (
    <Stack gap={spacing[3]} className={styles.pageShell}>
      <QuickActions />

      <Box className={styles.desktopGrid}>
        <Stack gap={spacing[3]} className={styles.mainColumn}>
          <SummaryStrip metrics={summaryMetrics} />
          <NeedsAttention
            error={frontDesk.error}
            isLoading={frontDesk.isLoading}
            items={frontDesk.tasks}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
