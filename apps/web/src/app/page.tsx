'use client';

import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  Group,
  Menu,
  Paper,
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
};

function buildQuickActions(onNewArrival: () => void): QuickAction[] {
  return [
    { label: 'New Arrival', subtitle: 'Guest is here now - book + check in', icon: <UserPlus size={18} />, onClick: onNewArrival, tone: 'green' },
    { label: 'New Booking', subtitle: 'Future reservation', icon: <CalendarPlus size={18} />, href: '/reservations/new', tone: 'purple' },
    { label: 'Check Out', subtitle: 'Departing guests', icon: <LogOut size={18} />, href: '/rooms', tone: 'amber' },
  ];
}

function buildSecondaryActions(): QuickAction[] {
  return [
    { label: 'Availability', icon: <ClipboardCheck size={18} />, href: '/reservations/availability', tone: 'blue' },
    { label: 'Find Guest', icon: <Users size={18} />, href: '/guests', tone: 'neutral' },
    { label: 'View Rooms', icon: <DoorOpen size={18} />, href: '/rooms', tone: 'blue' },
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
      href: '/reservations',
    },
    {
      label: 'Departures Today',
      value: loadingValue ?? String(departuresToday),
      icon: <Users size={16} />,
      tone: 'neutral',
      href: '/rooms',
    },
    {
      label: 'Guests In House',
      value: loadingValue ?? String(guestsInHouse),
      icon: <Users size={16} />,
      tone: 'blue',
      href: '/guests',
    },
    {
      label: 'Rooms To Clean',
      value: loadingValue ?? String(roomsToClean),
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
        <Box className={styles.quickText}>
          <Text className={styles.quickLabel}>{action.label}</Text>
          {action.subtitle ? <Text className={styles.quickSubtitle}>{action.subtitle}</Text> : null}
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

function QuickActions({ onNewArrival }: { onNewArrival: () => void }) {
  const quickActions = buildQuickActions(onNewArrival);
  const secondaryActions = buildSecondaryActions();

  return (
    <Box className={styles.quickActionsGrid}>
      {quickActions.map((action) => (
        <QuickActionCard key={action.label} action={action} />
      ))}
      <Menu shadow="md" width={220}>
        <Menu.Target>
          <UnstyledButton className={styles.cardLink}>
            <Paper className={`${styles.quickActionCard} ${toneClass('neutral')}`} radius={radius.lg}>
              <Group gap={spacing[3]} wrap="nowrap">
                <ThemeIcon className={styles.quickIcon} variant="light" radius={radius.md} size={34}>
                  <Plus size={18} />
                </ThemeIcon>
                <Box className={styles.quickText}>
                  <Text className={styles.quickLabel}>More</Text>
                  <Text className={styles.quickSubtitle}>Availability, guests, rooms</Text>
                </Box>
              </Group>
            </Paper>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {secondaryActions.map((action) => (
            <Menu.Item key={action.label} component={Link} href={action.href ?? '#'} leftSection={action.icon}>
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}

function SummaryStrip({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <Paper className={styles.summaryStrip} data-testid="front-desk-stats-strip" radius={radius.lg}>
      {metrics.map((metric) => (
        <Link key={metric.label} href={metric.href ?? '#'} className={styles.summaryStripItem}>
          <ThemeIcon className={`${styles.summaryStripIcon} ${toneClass(metric.tone)}`} variant="light" radius={radius.full} size={30}>
            {metric.icon}
          </ThemeIcon>
          <Text className={styles.summaryStripValue}>{metric.value}</Text>
          <Text className={styles.summaryStripLabel}>{metric.label}</Text>
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
          <SummaryStrip metrics={summaryMetrics} />
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
