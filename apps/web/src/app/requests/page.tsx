'use client';

import {
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Bell,
  CheckCircle2,
  Clock,
  ConciergeBell,
  Flower2,
  MessageSquarePlus,
  Search,
  Shirt,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { StayOSOperationsCard, StayOSStatusBadge } from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';

type RequestStatus = 'Requested' | 'Accepted' | 'In Progress' | 'Completed' | 'Delayed';
type Priority = 'Normal' | 'High' | 'VIP';

type GuestRequest = {
  room: string;
  guest: string;
  request: string;
  department: string;
  requestedAt: string;
  elapsed: string;
  priority: Priority;
  staff: string;
  status: RequestStatus;
  nextAction: string;
};

const suggestions = [
  'Extra Towels',
  'Extra Pillow',
  'Water Bottles',
  'Laundry Pickup',
  'Wake-up Call',
  'Airport Pickup',
  'Taxi',
  'Baby Cot',
  'Extra Bed',
  'Hair Dryer',
  'Iron Board',
  'Room Cleaning',
  'AC Problem',
  'TV Problem',
  'Wi-Fi Issue',
  'Luggage Assistance',
  'Special Decoration',
  'Flowers',
  'Cake',
];

const requests: GuestRequest[] = [
  {
    room: '402',
    guest: 'Ananya Rao',
    request: 'Extra Towels',
    department: 'Housekeeping',
    requestedAt: '10:12 AM',
    elapsed: '18 min',
    priority: 'VIP',
    staff: 'Anita',
    status: 'In Progress',
    nextAction: 'Mark Delivered',
  },
  {
    room: '305',
    guest: 'Rahul Mehta',
    request: 'AC not cooling',
    department: 'Maintenance',
    requestedAt: '09:48 AM',
    elapsed: '42 min',
    priority: 'High',
    staff: 'Irfan',
    status: 'Delayed',
    nextAction: 'Escalate',
  },
  {
    room: '510',
    guest: 'Nisha Kapoor',
    request: 'Laundry Pickup',
    department: 'Laundry',
    requestedAt: '10:28 AM',
    elapsed: '6 min',
    priority: 'Normal',
    staff: 'Meena',
    status: 'Accepted',
    nextAction: 'Start Pickup',
  },
  {
    room: '118',
    guest: 'Dev Sharma',
    request: 'Wake-up Call',
    department: 'Reception',
    requestedAt: '08:40 AM',
    elapsed: 'Scheduled',
    priority: 'Normal',
    staff: 'Aarav',
    status: 'Requested',
    nextAction: 'Accept',
  },
  {
    room: '501',
    guest: 'Mr Kapoor',
    request: 'Airport Pickup',
    department: 'Concierge',
    requestedAt: '07:55 AM',
    elapsed: 'Completed',
    priority: 'VIP',
    staff: 'Sahil',
    status: 'Completed',
    nextAction: 'View',
  },
];

const assignmentRules: Record<string, string> = {
  'Extra Towels': 'Housekeeping',
  'Extra Pillow': 'Housekeeping',
  'Water Bottles': 'Housekeeping',
  'Laundry Pickup': 'Laundry',
  Taxi: 'Concierge',
  'Airport Pickup': 'Concierge',
  'AC Problem': 'Maintenance',
  'TV Problem': 'Maintenance',
  'Wi-Fi Issue': 'Maintenance',
  'Baby Cot': 'Housekeeping',
  'Wake-up Call': 'Reception',
  Flowers: 'Concierge',
  Cake: 'Concierge',
};

function statusToneName(status: RequestStatus): StayOSStatusTone {
  if (status === 'Completed') return 'success';
  if (status === 'Accepted' || status === 'Requested') return 'info';
  if (status === 'In Progress') return 'progress';
  return 'danger';
}

function priorityToneName(priority: Priority): StayOSStatusTone {
  if (priority === 'VIP') return 'premium';
  if (priority === 'High') return 'danger';
  return 'muted';
}

function departmentIcon(department: string): ReactNode {
  if (department === 'Housekeeping') return <Sparkles size={17} />;
  if (department === 'Maintenance') return <Wrench size={17} />;
  if (department === 'Laundry') return <Shirt size={17} />;
  if (department === 'Concierge') return <ConciergeBell size={17} />;
  return <Bell size={17} />;
}

function SummaryCard({
  title,
  count,
  detail,
  tone,
  icon,
}: {
  title: string;
  count: number;
  detail: string;
  tone: StayOSStatusTone;
  icon: ReactNode;
}) {
  return <StayOSOperationsCard title={title} value={count} detail={detail} icon={icon} tone={tone} />;
}

function RequestCard({ request }: { request: GuestRequest }) {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Group gap={spacing[4]} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
            {departmentIcon(request.department)}
          </ThemeIcon>
          <Box>
            <Text c={colors.brand[600]} style={typography.styles.h3}>
              Room {request.room}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.h3}>
              {request.request}
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              <Text
                component="a"
                href="/guests/ananya-rao"
                c={colors.brand[600]}
                style={{ ...typography.styles.small, textDecoration: 'none' }}
              >
                {request.guest}
              </Text>{' '}
              - {request.department} - {request.requestedAt}
            </Text>
          </Box>
        </Group>
        <Stack align="flex-end" gap={spacing[2]}>
          <StayOSStatusBadge tone={statusToneName(request.status)}>
            {request.status}
          </StayOSStatusBadge>
          <StayOSStatusBadge tone={priorityToneName(request.priority)}>
            {request.priority}
          </StayOSStatusBadge>
        </Stack>
      </Group>

      <SimpleGrid mt={spacing[5]} cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Elapsed
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {request.elapsed}
          </Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Owner
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {request.staff}
          </Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Next
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {request.nextAction}
          </Text>
        </Paper>
      </SimpleGrid>

      <Group mt={spacing[5]} justify="flex-end">
        <Button color="stayosBrand">{request.nextAction}</Button>
      </Group>
    </Card>
  );
}

function RequestDrawer({
  opened,
  onClose,
  selectedRequest,
}: {
  opened: boolean;
  onClose: () => void;
  selectedRequest: string;
}) {
  const department = assignmentRules[selectedRequest] ?? 'Reception';

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(92vw, 480px)"
      title="Create guest request"
    >
      <Stack gap={spacing[4]}>
        <Text c={colors.text.muted} style={typography.styles.small}>
          One guest. One request. One owner.
        </Text>
        <TextInput label="Room" defaultValue="402" />
        <TextInput label="Guest" defaultValue="Ananya Rao" />
        <TextInput label="Request Type" value={selectedRequest} readOnly />
        <Textarea label="Optional Notes" placeholder="Add anything the team should know" minRows={3} />
        <Select label="Priority" data={['Normal', 'High', 'VIP']} defaultValue="Normal" />
        <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Smart Assignment
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            StayOS will assign this to {department}.
          </Text>
        </Paper>
        <Button color="stayosBrand" leftSection={<CheckCircle2 size={16} />}>
          Done
        </Button>
      </Stack>
    </Drawer>
  );
}

export default function GuestRequestsPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedRequest, setSelectedRequest] = useState('Extra Towels');
  const [query, setQuery] = useState('');

  const summary = [
    {
      title: 'Active Requests',
      count: 18,
      detail: 'Currently being handled',
      tone: 'info' as const,
      icon: <MessageSquarePlus size={17} />,
    },
    {
      title: 'Awaiting Action',
      count: 6,
      detail: 'Waiting for team acceptance',
      tone: 'attention' as const,
      icon: <Clock size={17} />,
    },
    {
      title: 'Completed Today',
      count: 42,
      detail: 'Guests assisted successfully',
      tone: 'success' as const,
      icon: <CheckCircle2 size={17} />,
    },
    {
      title: 'High Priority',
      count: 3,
      detail: 'Requires immediate attention',
      tone: 'danger' as const,
      icon: <Bell size={17} />,
    },
    {
      title: 'VIP Requests',
      count: 4,
      detail: 'High-touch guest care',
      tone: 'premium' as const,
      icon: <Flower2 size={17} />,
    },
    {
      title: 'Scheduled Requests',
      count: 9,
      detail: 'Planned for later today',
      tone: 'muted' as const,
      icon: <Clock size={17} />,
    },
  ];

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return requests;

    return requests.filter((request) =>
      [request.room, request.guest, request.request, request.department, request.status]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  const startRequest = (request: string) => {
    setSelectedRequest(request);
    open();
  };

  return (
    <Stack gap={spacing[6]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
            Guest Requests
          </Title>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
            Every guest request in one calm, organized workspace.
          </Text>
          <Text c={colors.text.strong} mt={spacing[3]} style={typography.styles.label}>
            Good Afternoon. Today you have 18 active requests, 12 completed, and 3 high priority.
          </Text>
        </Box>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.title} {...item} />
        ))}
      </SimpleGrid>

      <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
          What does the guest need?
        </Title>
        <TextInput
          mt={spacing[4]}
          leftSection={<Search size={16} />}
          placeholder="What does the guest need?"
          size="lg"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Group mt={spacing[5]} gap={spacing[2]}>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="light"
              color="stayosBrand"
              radius={radius.full}
              onClick={() => startRequest(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, xl: 12 }} spacing={spacing[5]}>
        <Stack gap={spacing[4]} style={{ gridColumn: 'span 8' }}>
          <Box>
            <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
              Active Requests
            </Title>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              Who needs what, who owns it, and what happens next.
            </Text>
          </Box>
          {filteredRequests.map((request) => (
            <RequestCard key={`${request.room}-${request.request}`} request={request} />
          ))}
        </Stack>

        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none', gridColumn: 'span 4' }}>
          <Text c={colors.text.strong} style={typography.styles.label}>
            Future realtime notifications
          </Text>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
            Designed for WebSockets later.
          </Text>
          <Stack mt={spacing[5]} gap={spacing[3]}>
            {[
              ['Housekeeping receives', 'Room 402 - Extra Towels'],
              ['Maintenance receives', 'Room 305 - AC not cooling'],
              ['Laundry receives', 'Room 510 - Laundry Pickup'],
              ['Reception receives', 'Extra towels delivered - Room 402'],
            ].map(([title, detail]) => (
              <Paper key={title} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
                <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
                  <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
                    <Bell size={15} />
                  </ThemeIcon>
                  <Box>
                    <Text c={colors.text.strong} style={typography.styles.label}>
                      {title}
                    </Text>
                    <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
                      {detail}
                    </Text>
                  </Box>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <RequestDrawer opened={opened} onClose={close} selectedRequest={selectedRequest} />
    </Stack>
  );
}
