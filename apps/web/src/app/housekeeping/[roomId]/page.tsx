'use client';

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
  Title,
} from '@mantine/core';
import {
  Baby,
  BedDouble,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Gift,
  Shirt,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react';
import { brandPalettes, colors, radius, spacing, typography } from '@stayos/theme';

const room = {
  number: '302',
  type: 'Premium King',
  guestStaying: false,
  checkoutToday: true,
  vip: true,
  doNotDisturb: false,
  laundryRequested: true,
  extraTowels: true,
  babyCot: true,
  anniversary: false,
  birthday: true,
  maintenance: 'No active issue',
  notes: 'Airport pickup guest arriving at 12:30 PM. Please keep two water bottles and extra towels.',
  lostFound: 'No items reported',
};

const checklist = [
  'Bed Made',
  'Bathroom Cleaned',
  'Towels Replaced',
  'Toiletries Restocked',
  'Dusting Completed',
  'Vacuum Completed',
  'Mini Bar Checked',
  'Curtains Opened',
  'Temperature Checked',
  'Final Inspection',
];

const completedItems = new Set(['Bed Made', 'Bathroom Cleaned', 'Towels Replaced']);

const timeline = [
  '10:05 Checkout completed',
  '10:12 Cleaning assigned to Anita',
  '10:20 Linen trolley dispatched',
  '10:31 Guest arrival marked priority',
];

const requests = [
  'High Floor',
  'Baby Cot',
  'Airport Pickup',
  'Vegetarian',
  'Late Checkout',
  'VIP',
  'Returning Guest',
  'Birthday',
];

function RequestBadge({ label }: { label: string }) {
  const isPriority = label === 'VIP' || label === 'Birthday' || label === 'Airport Pickup';

  return (
    <Badge
      radius={radius.full}
      variant="light"
      styles={{
        root: {
          background: isPriority ? brandPalettes.gold[50] : colors.brand[50],
          color: isPriority ? colors.semantic.warning : colors.brand[600],
          fontWeight: typography.weights.semibold,
          textTransform: 'none',
        },
      }}
    >
      {label}
    </Badge>
  );
}

export default function HousekeepingRoomPage() {
  const progress = Math.round((completedItems.size / checklist.length) * 100);

  return (
    <Stack gap={spacing[5]}>
      <Button
        component="a"
        href="/housekeeping"
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        w="fit-content"
      >
        Back to Housekeeping
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
                {room.type} housekeeping workspace
              </Text>
            </Box>
          </Group>
          <Badge color="yellow" variant="light" radius={radius.full} styles={{ root: { textTransform: 'none' } }}>
            Needs Cleaning
          </Badge>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing={spacing[4]}>
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            Room Signals
          </Title>
          <Stack mt={spacing[4]} gap={spacing[3]}>
            {[
              ['Guest Staying?', room.guestStaying ? 'Yes' : 'No', <UserRound size={16} />],
              ['Checkout Today?', room.checkoutToday ? 'Yes' : 'No', <CheckCircle2 size={16} />],
              ['VIP?', room.vip ? 'Yes' : 'No', <Gift size={16} />],
              ['Do Not Disturb?', room.doNotDisturb ? 'Yes' : 'No', <Sparkles size={16} />],
              ['Laundry Requested?', room.laundryRequested ? 'Yes' : 'No', <Shirt size={16} />],
              ['Extra Towels?', room.extraTowels ? 'Yes' : 'No', <Sparkles size={16} />],
              ['Baby Cot?', room.babyCot ? 'Yes' : 'No', <Baby size={16} />],
              ['Maintenance Issues?', room.maintenance, <Wrench size={16} />],
            ].map(([label, value, icon]) => (
              <Group key={String(label)} justify="space-between" wrap="nowrap">
                <Group gap={spacing[2]}>
                  <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={28}>
                    {icon}
                  </ThemeIcon>
                  <Text c={colors.text.body} style={typography.styles.small}>
                    {label}
                  </Text>
                </Group>
                <Text c={colors.text.strong} style={typography.styles.label}>
                  {value}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>

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
            Requests
          </Title>
          <Group mt={spacing[4]} gap={spacing[2]}>
            {requests.map((request) => (
              <RequestBadge key={request} label={request} />
            ))}
          </Group>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Group justify="space-between" align="center">
            <Box>
              <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
                Cleaning Checklist
              </Title>
              <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                Progress updates automatically.
              </Text>
            </Box>
            <Text c={colors.brand[600]} style={typography.styles.h3}>
              {progress}%
            </Text>
          </Group>
          <Progress mt={spacing[4]} value={progress} color="stayosBrand" radius={radius.full} />
          <SimpleGrid mt={spacing[5]} cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
            {checklist.map((item) => (
              <Checkbox
                key={item}
                label={item}
                defaultChecked={completedItems.has(item)}
                color="stayosBrand"
              />
            ))}
          </SimpleGrid>
        </Card>

        <Stack gap={spacing[4]}>
          <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
            <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
              Housekeeping Notes
            </Title>
            <Text c={colors.text.body} mt={spacing[3]} style={typography.styles.body}>
              {room.notes}
            </Text>
          </Card>

          <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
            <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
              Lost and Found
            </Title>
            <Text c={colors.text.body} mt={spacing[3]} style={typography.styles.body}>
              {room.lostFound}
            </Text>
          </Card>

          <Paper p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
            <Group gap={spacing[3]}>
              <ThemeIcon color="stayosBrand" variant="light" radius={radius.full}>
                <Camera size={16} />
              </ThemeIcon>
              <Text c={colors.text.muted} style={typography.styles.small}>
                Photos can be added here in a future iteration.
              </Text>
            </Group>
          </Paper>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
