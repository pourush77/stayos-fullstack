'use client';

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
} from '@mantine/core';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Droplets,
  Eye,
  Hotel,
  RefreshCw,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { brandPalettes, colors, radius, spacing, typography } from '@stayos/theme';
import { StayOSOperationsCard, StayOSStatusBadge } from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';

type TaskStatus =
  | 'needs-cleaning'
  | 'cleaning-in-progress'
  | 'inspection-pending'
  | 'ready'
  | 'quick-refresh'
  | 'out-of-service'
  | 'unavailable';

type HousekeepingTask = {
  room: string;
  status: TaskStatus;
  priority: 'High' | 'Medium' | 'Normal';
  roomType: string;
  arrival?: string;
  request?: string;
  estimate: string;
  assignedTo: string;
  action: string;
};

const tasks: HousekeepingTask[] = [
  {
    room: '302',
    status: 'needs-cleaning',
    priority: 'High',
    roomType: 'Premium King',
    arrival: 'Guest arriving at 12:30 PM',
    request: 'Airport pickup guest',
    estimate: '25 min',
    assignedTo: 'Anita',
    action: 'Start Cleaning',
  },
  {
    room: '406',
    status: 'inspection-pending',
    priority: 'High',
    roomType: 'Premium Suite',
    arrival: 'Arrival at 2:00 PM',
    request: 'VIP setup',
    estimate: '10 min',
    assignedTo: 'Supervisor Neha',
    action: 'Inspect Room',
  },
  {
    room: '221',
    status: 'needs-cleaning',
    priority: 'Medium',
    roomType: 'Deluxe Twin',
    estimate: '20 min',
    assignedTo: 'Ravi',
    action: 'Start Cleaning',
  },
  {
    room: '402',
    status: 'quick-refresh',
    priority: 'Medium',
    roomType: 'Premium Suite',
    request: 'Fresh towels, water bottles, bathroom refresh',
    estimate: '8 min',
    assignedTo: 'Anita',
    action: 'Complete Refresh',
  },
  {
    room: '502',
    status: 'cleaning-in-progress',
    priority: 'Normal',
    roomType: 'Suite',
    arrival: 'Arrival at 5:00 PM',
    estimate: '15 min left',
    assignedTo: 'Meena',
    action: 'Mark Ready for Inspection',
  },
  {
    room: '504',
    status: 'out-of-service',
    priority: 'High',
    roomType: 'Suite',
    request: 'AC repair',
    estimate: 'Expected 3 PM',
    assignedTo: 'Engineering',
    action: 'View Issue',
  },
];

const statusLabels: Record<TaskStatus, string> = {
  'needs-cleaning': 'Needs Cleaning',
  'cleaning-in-progress': 'Cleaning In Progress',
  'inspection-pending': 'Inspection Pending',
  ready: 'Ready',
  'quick-refresh': 'Quick Refresh',
  'out-of-service': 'Out Of Service',
  unavailable: 'Unavailable',
};

function statusBackground(status: TaskStatus) {
  if (status === 'ready') return colors.brand[50];
  if (status === 'needs-cleaning' || status === 'inspection-pending' || status === 'quick-refresh')
    return brandPalettes.gold[50];
  if (status === 'cleaning-in-progress') return colors.surface.subtle;
  return colors.surface.subtle;
}

function statusIcon(status: TaskStatus): ReactNode {
  if (status === 'ready') return <CheckCircle2 size={17} />;
  if (status === 'needs-cleaning') return <Sparkles size={17} />;
  if (status === 'cleaning-in-progress') return <Droplets size={17} />;
  if (status === 'inspection-pending') return <Eye size={17} />;
  if (status === 'quick-refresh') return <RefreshCw size={17} />;
  if (status === 'out-of-service') return <Wrench size={17} />;
  return <AlertCircle size={17} />;
}

function statusToneName(status: TaskStatus): StayOSStatusTone {
  if (status === 'ready') return 'success';
  if (status === 'cleaning-in-progress') return 'progress';
  if (status === 'out-of-service' || status === 'unavailable') return 'danger';
  return 'attention';
}

function priorityToneName(priority: HousekeepingTask['priority']): StayOSStatusTone {
  if (priority === 'High') return 'danger';
  if (priority === 'Medium') return 'attention';
  return 'muted';
}

function SummaryCard({
  label,
  count,
  detail,
  status,
}: {
  label: string;
  count: number;
  detail: string;
  status: TaskStatus;
}) {
  return (
    <StayOSOperationsCard
      title={label}
      value={count}
      detail={detail}
      icon={statusIcon(status)}
      tone={statusToneName(status)}
    />
  );
}

function TaskCard({ task }: { task: HousekeepingTask }) {
  return (
    <Card
      p={spacing[5]}
      radius={radius.lg}
      shadow="xs"
      style={{ background: statusBackground(task.status), border: 'none' }}
    >
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Text c={colors.brand[600]} style={typography.styles.h1}>
            Room {task.room}
          </Text>
          <Group mt={spacing[2]} gap={spacing[2]}>
            <StayOSStatusBadge tone={statusToneName(task.status)}>
              {statusLabels[task.status]}
            </StayOSStatusBadge>
            <StayOSStatusBadge tone={priorityToneName(task.priority)}>
              Priority {task.priority}
            </StayOSStatusBadge>
          </Group>
        </Box>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={40}>
          {statusIcon(task.status)}
        </ThemeIcon>
      </Group>

      <SimpleGrid mt={spacing[5]} cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.base}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Room Type
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {task.roomType}
          </Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.base}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Estimated Time
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {task.estimate}
          </Text>
        </Paper>
        {task.arrival ? (
          <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.base}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              Expected Arrival
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
              {task.arrival}
            </Text>
          </Paper>
        ) : null}
        {task.request ? (
          <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.base}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              Special Request
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
              {task.request}
            </Text>
          </Paper>
        ) : null}
      </SimpleGrid>

      <Group mt={spacing[5]} justify="space-between" gap={spacing[3]}>
        <Group gap={spacing[2]}>
          <UserRound size={15} color={colors.text.muted} />
          <Text c={colors.text.body} style={typography.styles.small}>
            Assigned to {task.assignedTo}
          </Text>
        </Group>
        <Button component="a" href={`/housekeeping/${task.room}`} color="stayosBrand">
          {task.action}
        </Button>
      </Group>
    </Card>
  );
}

export default function HousekeepingPage() {
  const completed = 12;
  const remaining = 6;
  const summary = [
    {
      label: 'Needs Cleaning',
      count: 18,
      detail: 'Checkout completed. Cleaning required.',
      status: 'needs-cleaning' as TaskStatus,
    },
    {
      label: 'Cleaning In Progress',
      count: 6,
      detail: 'Rooms currently being cleaned.',
      status: 'cleaning-in-progress' as TaskStatus,
    },
    {
      label: 'Inspection Pending',
      count: 4,
      detail: 'Supervisor review required.',
      status: 'inspection-pending' as TaskStatus,
    },
    {
      label: 'Ready',
      count: 32,
      detail: 'Ready for arriving guests.',
      status: 'ready' as TaskStatus,
    },
    {
      label: 'Quick Refresh',
      count: 5,
      detail: 'In-house guest refresh requests.',
      status: 'quick-refresh' as TaskStatus,
    },
    {
      label: 'Out Of Service',
      count: 2,
      detail: 'Engineering action required.',
      status: 'out-of-service' as TaskStatus,
    },
    {
      label: 'Unavailable',
      count: 1,
      detail: 'Blocked from assignment.',
      status: 'unavailable' as TaskStatus,
    },
  ];

  return (
    <Stack gap={spacing[6]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Group gap={spacing[3]} align="flex-start">
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44}>
            <Hotel size={21} />
          </ThemeIcon>
          <Box>
            <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
              Housekeeping
            </Title>
            <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
              Everything your housekeeping team needs today.
            </Text>
            <Text c={colors.text.strong} mt={spacing[3]} style={typography.styles.label}>
              Good Morning, Anita. 18 rooms assigned today. {completed} completed. {remaining} remaining.
            </Text>
          </Box>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 7 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </SimpleGrid>

      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group justify="space-between" align="flex-start" gap={spacing[4]} mb={spacing[5]}>
          <Box>
            <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
              Today's Tasks
            </Title>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              What should be cleaned next, ordered by operational urgency.
            </Text>
          </Box>
          <Group gap={spacing[2]}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.full}>
              <Clock size={16} />
            </ThemeIcon>
            <Text c={colors.text.muted} style={typography.styles.small}>
              Next action only
            </Text>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing={spacing[4]}>
          {tasks.map((task) => (
            <TaskCard key={task.room} task={task} />
          ))}
        </SimpleGrid>
      </Card>
    </Stack>
  );
}
