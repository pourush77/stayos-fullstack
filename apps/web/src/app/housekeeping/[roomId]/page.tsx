'use client';

import Link from 'next/link';
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import {
  Baby,
  BedDouble,
  Camera,
  Check,
  ChevronLeft,
  Gift,
  Plane,
  Shirt,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { radius, spacing } from '@stayos/theme';

type RoomSignal = {
  label: string;
  tone: 'amber' | 'green' | 'purple' | 'red' | 'neutral';
};

type CleaningChecklistItem = {
  complete: boolean;
  label: string;
};

type RoomTimelineItem = {
  label: string;
  time: string;
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const room = {
  arrival: '12:30 PM',
  assignedTo: 'Anita',
  eta: '25 min',
  lostFound: 'No items reported',
  notes: 'Airport pickup guest arriving at 12:30 PM. Please keep two water bottles and extra towels.',
  number: '302',
  status: 'Needs Cleaning',
  type: 'Premium King',
};

const roomSignals: RoomSignal[] = [
  { label: 'Checkout Today', tone: 'amber' },
  { label: 'Guest Waiting', tone: 'red' },
  { label: 'VIP', tone: 'purple' },
  { label: 'Laundry', tone: 'neutral' },
  { label: 'Extra Towels', tone: 'neutral' },
  { label: 'Baby Cot', tone: 'neutral' },
];

const checklist: CleaningChecklistItem[] = [
  { label: 'Bed Made', complete: true },
  { label: 'Bathroom Cleaned', complete: true },
  { label: 'Towels Replaced', complete: true },
  { label: 'Toiletries Restocked', complete: false },
  { label: 'Dusting Completed', complete: false },
  { label: 'Vacuum Completed', complete: false },
  { label: 'Mini Bar Checked', complete: false },
  { label: 'Final Inspection', complete: false },
];

const requests = ['VIP', 'Birthday', 'Baby Cot', 'Extra Towels', 'Airport Pickup', 'Vegetarian'];

const timeline: RoomTimelineItem[] = [
  { time: '10:05', label: 'Checkout completed' },
  { time: '10:12', label: 'Cleaning assigned' },
  { time: '10:20', label: 'Cleaning started' },
  { time: '10:31', label: 'Inspection pending' },
];

function toneForSignal(tone: RoomSignal['tone']) {
  if (tone === 'green') return { color: '#16a34a', background: '#f0fdf4' };
  if (tone === 'purple') return { color: '#6d5dfc', background: '#f5f3ff' };
  if (tone === 'red') return { color: '#dc2626', background: '#fef2f2' };
  if (tone === 'amber') return { color: '#d97706', background: '#fffbeb' };
  return { color: '#64748b', background: '#f8fafc' };
}

function TokenBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: RoomSignal['tone'] }) {
  const colors = toneForSignal(tone);

  return (
    <Badge
      radius={radius.full}
      style={{
        background: colors.background,
        border: '1px solid rgba(226, 232, 240, 0.9)',
        color: colors.color,
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

function SectionCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <Card radius={radius.lg} p={16} style={cardStyle}>
      <Group gap={10} align="center">
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}>
          {icon}
        </ThemeIcon>
        <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 700, lineHeight: '24px' }}>
          {title}
        </Title>
      </Group>
      <Box mt={14}>{children}</Box>
    </Card>
  );
}

function DetailTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
        {label}
      </Text>
      <Text c="#182230" mt={3} style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
        {value}
      </Text>
    </Paper>
  );
}

export default function HousekeepingRoomPage() {
  const completed = checklist.filter((item) => item.complete).length;
  const progress = Math.round((completed / checklist.length) * 100);

  return (
    <Stack gap={spacing[3]}>
      <Button
        component={Link}
        href="/housekeeping"
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        w="fit-content"
        style={{ fontWeight: 600 }}
      >
        Back to Housekeeping
      </Button>

      <Card radius={radius.lg} p={18} style={cardStyle}>
        <Group justify="space-between" align="flex-start" gap={spacing[5]}>
          <Group gap={14} align="flex-start">
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={46}>
              <BedDouble size={22} />
            </ThemeIcon>
            <Box>
              <Group gap={8}>
                <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
                  Room {room.number}
                </Title>
                <TokenBadge tone="amber">{room.status}</TokenBadge>
              </Group>
              <Text c="#64748b" mt={2} style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
                {room.type} housekeeping workspace
              </Text>
            </Box>
          </Group>
        </Group>
      </Card>

      <Paper radius={radius.lg} p={16} style={cardStyle}>
        <Group justify="space-between" align="center" gap={spacing[4]}>
          <Box>
            <Text c="#101828" style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>
              Room {room.number}
            </Text>
            <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
              {room.status}. Arrival at {room.arrival}.
            </Text>
          </Box>
          <Group gap={8}>
            <DetailTile label="Assigned to" value={room.assignedTo} />
            <DetailTile label="ETA" value={room.eta} />
          </Group>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <SectionCard title="Cleaning Checklist" icon={<Check size={17} />}>
            <Group justify="space-between" align="center">
              <Box>
                <Text c="#101828" style={{ fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>
                  {completed} of {checklist.length} complete
                </Text>
                <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
                  Complete the room and send it for inspection.
                </Text>
              </Box>
              <Text c="#6d5dfc" style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>
                {progress}%
              </Text>
            </Group>
            <Progress mt={12} value={progress} color="stayosBrand" radius={radius.full} size={8} />
            <SimpleGrid mt={14} cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
              {checklist.map((item) => (
                <Paper key={item.label} radius={radius.md} p={10} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
                  <Checkbox
                    checked={item.complete}
                    readOnly
                    color="stayosBrand"
                    label={
                      <Text c={item.complete ? '#16a34a' : '#334155'} style={{ fontSize: 13, fontWeight: item.complete ? 600 : 500 }}>
                        {item.label}
                      </Text>
                    }
                  />
                </Paper>
              ))}
            </SimpleGrid>
            <Group mt={14} justify="flex-end">
              <Button color="stayosBrand" style={{ fontWeight: 600 }}>
                Send for Inspection
              </Button>
            </Group>
          </SectionCard>

          <SectionCard title="Timeline" icon={<Sparkles size={17} />}>
            <Timeline active={timeline.length - 1} bulletSize={18} lineWidth={1}>
              {timeline.map((item) => (
                <Timeline.Item key={`${item.time}-${item.label}`} title={item.time}>
                  <Text c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
                    {item.label}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </SectionCard>

          <SectionCard title="Notes" icon={<Gift size={17} />}>
            <Text c="#334155" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
              {room.notes}
            </Text>
          </SectionCard>
        </Stack>

        <Stack gap={spacing[3]} style={{ gridColumn: 'span 4' }}>
          <SectionCard title="Room Signals" icon={<Sparkles size={17} />}>
            <Group gap={6}>
              {roomSignals.map((signal) => (
                <TokenBadge key={signal.label} tone={signal.tone}>
                  {signal.label}
                </TokenBadge>
              ))}
            </Group>
          </SectionCard>

          <SectionCard title="Requests" icon={<Plane size={17} />}>
            <Group gap={6}>
              {requests.map((request) => (
                <TokenBadge key={request} tone={request === 'VIP' || request === 'Birthday' ? 'purple' : 'neutral'}>
                  {request}
                </TokenBadge>
              ))}
            </Group>
          </SectionCard>

          <SectionCard title="Lost & Found" icon={<Shirt size={17} />}>
            <Text c="#334155" style={{ fontSize: 13, fontWeight: 400, lineHeight: '18px' }}>
              {room.lostFound}
            </Text>
            <Button mt={spacing[3]} variant="light" color="gray" size="compact-sm" style={{ fontWeight: 600 }}>
              Report Item
            </Button>
          </SectionCard>

          <SectionCard title="Photos" icon={<Camera size={17} />}>
            <SimpleGrid cols={1} spacing={spacing[2]}>
              {['Before photo', 'After photo', 'Damage photo'].map((label) => (
                <Paper key={label} radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                  <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                    {label}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>
          </SectionCard>

          <Card radius={radius.lg} p={16} style={cardStyle}>
            <Stack gap={spacing[2]}>
              <Button color="stayosBrand" style={{ fontWeight: 600 }}>
                Complete Room
              </Button>
              <Button variant="light" color="orange" leftSection={<Wrench size={16} />} style={{ fontWeight: 600 }}>
                Report Maintenance
              </Button>
              <Button variant="subtle" color="gray" leftSection={<Baby size={16} />} style={{ fontWeight: 600 }}>
                Add Lost & Found
              </Button>
              <Button variant="subtle" color="gray" leftSection={<Camera size={16} />} style={{ fontWeight: 600 }}>
                Add Photo
              </Button>
            </Stack>
          </Card>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
