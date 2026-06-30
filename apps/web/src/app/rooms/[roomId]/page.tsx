'use client';

import {
  Badge,
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
  BedDouble,
  Brush,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  DoorOpen,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { colors, radius, spacing, typography } from '@stayos/theme';

const room = {
  number: '402',
  type: 'Premium Suite',
  status: 'Guest Staying',
  guest: 'Ananya Rao',
  housekeeping: 'Clean and inspected',
  arrival: '28 Jun, 09:10 AM',
  departure: '01 Jul, 11:00 AM',
  maintenance: 'No active issues',
  notes: 'Guest prefers high floor, vegetarian meals, and extra pillow.',
};

const timeline = [
  '09:10 Guest checked in',
  '09:23 Room keys issued',
  '11:05 Housekeeping completed',
  '17:30 Laundry requested',
];

export default function RoomWorkspacePlaceholderPage() {
  return (
    <Stack gap={spacing[5]}>
      <Button
        component="a"
        href="/rooms"
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        w="fit-content"
      >
        Back to Room Operations
      </Button>

      <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group justify="space-between" align="flex-start" gap={spacing[5]}>
          <Group gap={spacing[4]} align="flex-start">
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={52}>
              <BedDouble size={24} />
            </ThemeIcon>
            <Box>
              <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
                Room {room.number}
              </Title>
              <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.bodyLarge}>
                {room.type}
              </Text>
            </Box>
          </Group>
          <Badge
            radius={radius.full}
            variant="light"
            color="stayosBrand"
            styles={{ root: { textTransform: 'none' } }}
          >
            {room.status}
          </Badge>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing={spacing[4]}>
        {[
          ['Current Guest', room.guest, <DoorOpen size={17} />],
          ['Housekeeping', room.housekeeping, <Brush size={17} />],
          ['Arrival / Departure', `${room.arrival} - ${room.departure}`, <CalendarClock size={17} />],
          ['Maintenance', room.maintenance, <Wrench size={17} />],
          ['Room Notes', room.notes, <ClipboardList size={17} />],
        ].map(([label, value, icon]) => (
          <Paper key={String(label)} p={spacing[4]} radius={radius.lg} bg={colors.surface.base}>
            <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
              <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
                {icon}
              </ThemeIcon>
              <Box>
                <Text c={colors.text.muted} style={typography.styles.caption}>
                  {label}
                </Text>
                <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
                  {value}
                </Text>
              </Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            Timeline
          </Title>
          <Stack mt={spacing[4]} gap={spacing[3]}>
            {timeline.map((item) => (
              <Text key={item} c={colors.text.body} style={typography.styles.small}>
                {item}
              </Text>
            ))}
          </Stack>
        </Card>

        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            Quick Actions
          </Title>
          <Group mt={spacing[4]} gap={spacing[3]}>
            <Button component="a" href="/guest-stay/ST1842" color="stayosBrand" leftSection={<DoorOpen size={16} />}>
              View Stay
            </Button>
            <Button variant="light" color="stayosBrand" leftSection={<Brush size={16} />}>
              Housekeeping
            </Button>
            <Button variant="light" color="stayosBrand" leftSection={<CreditCard size={16} />}>
              Billing
            </Button>
            <Button variant="subtle" color="gray" leftSection={<MessageSquare size={16} />}>
              Add Note
            </Button>
          </Group>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
