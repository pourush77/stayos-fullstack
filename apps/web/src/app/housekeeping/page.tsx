'use client';

import Link from 'next/link';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Brush,
  CheckCircle2,
  Clock,
  Eye,
  Search,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';

type HousekeepingStatus = 'dirty' | 'cleaning' | 'inspection' | 'ready' | 'out-of-order';
type Priority = 'guest-waiting' | 'vip' | 'arrival-soon' | 'checkout-dirty' | 'normal' | 'refresh' | 'maintenance';

type HousekeepingTask = {
  action: string;
  arrivalContext?: string;
  assignedStaff: string;
  eta: string;
  floor: string;
  href: string;
  priority: Priority;
  room: string;
  roomType: string;
  specialRequest?: string;
  status: HousekeepingStatus;
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const tasks: HousekeepingTask[] = [
  {
    action: 'Start Cleaning',
    arrivalContext: 'Guest waiting',
    assignedStaff: 'Anita',
    eta: '25 min',
    floor: 'Third Floor',
    href: '/housekeeping/302',
    priority: 'guest-waiting',
    room: '302',
    roomType: 'Premium King',
    specialRequest: 'Airport pickup guest',
    status: 'dirty',
  },
  {
    action: 'Inspect Room',
    arrivalContext: 'VIP arrival at 2:00 PM',
    assignedStaff: 'Supervisor Neha',
    eta: '10 min',
    floor: 'Fourth Floor',
    href: '/housekeeping/406',
    priority: 'vip',
    room: '406',
    roomType: 'Premium Suite',
    specialRequest: 'VIP setup',
    status: 'inspection',
  },
  {
    action: 'Start Cleaning',
    arrivalContext: 'Checkout dirty',
    assignedStaff: 'Ravi',
    eta: '20 min',
    floor: 'Second Floor',
    href: '/housekeeping/221',
    priority: 'checkout-dirty',
    room: '221',
    roomType: 'Deluxe Twin',
    status: 'dirty',
  },
  {
    action: 'Mark Ready',
    assignedStaff: 'Anita',
    eta: '8 min',
    floor: 'Fourth Floor',
    href: '/housekeeping/402',
    priority: 'refresh',
    room: '402',
    roomType: 'Premium Suite',
    specialRequest: 'Fresh towels',
    status: 'cleaning',
  },
  {
    action: 'Send for Inspection',
    arrivalContext: 'Arrival at 5:00 PM',
    assignedStaff: 'Meena',
    eta: '15 min',
    floor: 'Fifth Floor',
    href: '/housekeeping/502',
    priority: 'arrival-soon',
    room: '502',
    roomType: 'Suite',
    status: 'cleaning',
  },
  {
    action: 'View Room',
    assignedStaff: 'Engineering',
    eta: 'Expected 3 PM',
    floor: 'Fifth Floor',
    href: '/housekeeping/504',
    priority: 'maintenance',
    room: '504',
    roomType: 'Suite',
    specialRequest: 'AC repair',
    status: 'out-of-order',
  },
];

function statusLabel(status: HousekeepingStatus) {
  const labels: Record<HousekeepingStatus, string> = {
    cleaning: 'Cleaning',
    dirty: 'Dirty',
    inspection: 'Inspection',
    'out-of-order': 'Out of Order',
    ready: 'Ready',
  };

  return labels[status];
}

function statusTone(status: HousekeepingStatus) {
  if (status === 'ready') return { color: '#16a34a', background: '#f0fdf4' };
  if (status === 'cleaning') return { color: '#2563eb', background: '#eff6ff' };
  if (status === 'inspection') return { color: '#6d5dfc', background: '#f5f3ff' };
  if (status === 'out-of-order') return { color: '#dc2626', background: '#fef2f2' };
  return { color: '#d97706', background: '#fffbeb' };
}

function StatusBadge({ children, status }: { children: ReactNode; status?: HousekeepingStatus }) {
  const tone = status ? statusTone(status) : { color: '#64748b', background: '#f8fafc' };

  return (
    <Badge
      radius={radius.full}
      style={{
        background: tone.background,
        border: '1px solid rgba(226, 232, 240, 0.9)',
        color: tone.color,
        fontSize: 11,
        fontWeight: 600,
        height: 24,
        paddingInline: 10,
        textTransform: 'none',
      }}
    >
      {children}
    </Badge>
  );
}

function statusIcon(status: HousekeepingStatus): ReactNode {
  if (status === 'ready') return <CheckCircle2 size={17} />;
  if (status === 'cleaning') return <Brush size={17} />;
  if (status === 'inspection') return <Eye size={17} />;
  if (status === 'out-of-order') return <Wrench size={17} />;
  return <Sparkles size={17} />;
}

function priorityRank(priority: Priority) {
  const order: Record<Priority, number> = {
    'guest-waiting': 0,
    vip: 1,
    'arrival-soon': 2,
    'checkout-dirty': 3,
    normal: 4,
    refresh: 5,
    maintenance: 6,
  };

  return order[priority];
}

function SummaryCard({
  detail,
  icon,
  label,
  status,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  status: HousekeepingStatus;
  value: number;
}) {
  const tone = statusTone(status);

  return (
    <Paper radius={radius.lg} p={15} style={{ ...cardStyle, minHeight: 84 }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c="#334155" style={{ fontSize: 12, fontWeight: 600, lineHeight: '15px' }}>
            {label}
          </Text>
          <Text c="#111827" mt={4} style={{ fontSize: 22, fontWeight: 700, lineHeight: '26px' }}>
            {value}
          </Text>
          <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
            {detail}
          </Text>
        </Box>
        <Box
          aria-hidden
          style={{
            alignItems: 'center',
            background: tone.background,
            borderRadius: radius.full,
            color: tone.color,
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

function TaskCard({ task }: { task: HousekeepingTask }) {
  return (
    <Paper radius={radius.lg} p={16} style={cardStyle}>
      <Group justify="space-between" align="flex-start" gap={spacing[3]}>
        <Box>
          <Text c="#101828" style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>
            Room {task.room}
          </Text>
          <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
            {task.roomType} - {task.floor}
          </Text>
        </Box>
        <StatusBadge status={task.status}>{statusLabel(task.status)}</StatusBadge>
      </Group>

      <SimpleGrid mt={12} cols={{ base: 1, sm: 2 }} spacing={8}>
        <Box>
          <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
            Assigned Staff
          </Text>
          <Text c="#182230" mt={2} style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
            {task.assignedStaff}
          </Text>
        </Box>
        <Box>
          <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
            ETA
          </Text>
          <Text c="#182230" mt={2} style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
            {task.eta}
          </Text>
        </Box>
        <Box>
          <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
            Context
          </Text>
          <Text c="#182230" mt={2} lineClamp={1} style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
            {task.arrivalContext ?? 'Normal cleaning'}
          </Text>
        </Box>
        <Box>
          <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
            Request
          </Text>
          <Text c="#182230" mt={2} lineClamp={1} style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
            {task.specialRequest ?? 'None'}
          </Text>
        </Box>
      </SimpleGrid>

      <Group mt={14} justify="space-between" gap={spacing[3]}>
        <Group gap={8}>
          <UserRound size={15} color="#64748b" />
          <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
            Priority: {task.priority.replace(/-/g, ' ')}
          </Text>
        </Group>
        <Button component={Link} href={task.href} color="stayosBrand" size="compact-sm" style={{ fontWeight: 600 }}>
          {task.action}
        </Button>
      </Group>
    </Paper>
  );
}

export default function HousekeepingPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [floor, setFloor] = useState('all');
  const [staff, setStaff] = useState('all');
  const [priority, setPriority] = useState('all');
  const [arrivalToday, setArrivalToday] = useState(false);

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const matchesQuery = normalized ? task.room.toLowerCase().includes(normalized) : true;
        const matchesStatus = status === 'all' || task.status === status;
        const matchesFloor = floor === 'all' || task.floor === floor;
        const matchesStaff = staff === 'all' || task.assignedStaff === staff;
        const matchesPriority = priority === 'all' || task.priority === priority;
        const matchesArrival = !arrivalToday || Boolean(task.arrivalContext?.toLowerCase().includes('arrival') || task.arrivalContext?.toLowerCase().includes('waiting'));

        return matchesQuery && matchesStatus && matchesFloor && matchesStaff && matchesPriority && matchesArrival;
      })
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  }, [arrivalToday, floor, priority, query, staff, status]);

  const completed = 12;
  const remaining = 6;
  const floors = Array.from(new Set(tasks.map((task) => task.floor)));
  const staffOptions = Array.from(new Set(tasks.map((task) => task.assignedStaff)));

  const summary = [
    { label: 'Dirty', value: tasks.filter((task) => task.status === 'dirty').length, detail: 'Needs cleaning.', status: 'dirty' as const, icon: statusIcon('dirty') },
    { label: 'Cleaning', value: tasks.filter((task) => task.status === 'cleaning').length, detail: 'In progress.', status: 'cleaning' as const, icon: statusIcon('cleaning') },
    { label: 'Inspection', value: tasks.filter((task) => task.status === 'inspection').length, detail: 'Supervisor review.', status: 'inspection' as const, icon: statusIcon('inspection') },
    { label: 'Ready', value: tasks.filter((task) => task.status === 'ready').length, detail: 'Ready for assignment.', status: 'ready' as const, icon: statusIcon('ready') },
    { label: 'Out of Order', value: tasks.filter((task) => task.status === 'out-of-order').length, detail: 'Unavailable rooms.', status: 'out-of-order' as const, icon: statusIcon('out-of-order') },
  ];

  return (
    <Stack gap={spacing[3]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
            Housekeeping
          </Title>
          <Text mt={spacing[1]} c="#64748b" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
            Manage cleaning, inspections and room readiness.
          </Text>
          <Text mt={spacing[2]} c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
            18 rooms assigned today - {completed} completed - {remaining} remaining
          </Text>
        </Box>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </SimpleGrid>

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} align="center">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder="Search room number..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 180 }}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 140, md: 160 }}
            data={[
              { label: 'All Statuses', value: 'all' },
              ...(['dirty', 'cleaning', 'inspection', 'ready', 'out-of-order'] as HousekeepingStatus[]).map((item) => ({
                label: statusLabel(item),
                value: item,
              })),
            ]}
            value={status}
            onChange={(value) => setStatus(value ?? 'all')}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 140, md: 160 }}
            data={[{ label: 'All Floors', value: 'all' }, ...floors.map((item) => ({ label: item, value: item }))]}
            value={floor}
            onChange={(value) => setFloor(value ?? 'all')}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 150, md: 170 }}
            data={[{ label: 'All Staff', value: 'all' }, ...staffOptions.map((item) => ({ label: item, value: item }))]}
            value={staff}
            onChange={(value) => setStaff(value ?? 'all')}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 150, md: 170 }}
            data={[
              { label: 'All Priorities', value: 'all' },
              { label: 'Guest waiting', value: 'guest-waiting' },
              { label: 'VIP', value: 'vip' },
              { label: 'Arrival soon', value: 'arrival-soon' },
              { label: 'Checkout dirty', value: 'checkout-dirty' },
              { label: 'Normal', value: 'normal' },
              { label: 'Refresh', value: 'refresh' },
              { label: 'Maintenance', value: 'maintenance' },
            ]}
            value={priority}
            onChange={(value) => setPriority(value ?? 'all')}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Button
            variant={arrivalToday ? 'light' : 'subtle'}
            color="stayosBrand"
            size="compact-md"
            onClick={() => setArrivalToday((value) => !value)}
            style={{ fontWeight: 600, height: 38 }}
          >
            Arrival Today
          </Button>
        </Group>
      </Card>

      <Card radius={radius.lg} p={0} style={{ ...cardStyle, overflow: 'hidden' }}>
        <Group justify="space-between" align="center" p={16} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <Box>
            <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 700, lineHeight: '24px' }}>
              Cleaning Queue
            </Title>
            <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
              What room should housekeeping handle next?
            </Text>
          </Box>
          <Group gap={8}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.full}>
              <Clock size={16} />
            </ThemeIcon>
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              Priority ordered
            </Text>
          </Group>
        </Group>

        <ScrollArea h={520} type="hover" scrollbarSize={6}>
          <Stack gap={0}>
            {filteredTasks.map((task) => (
              <Box key={task.room} p={12} style={{ borderBottom: '1px solid #edf2f7' }}>
                <TaskCard task={task} />
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </Card>
    </Stack>
  );
}
