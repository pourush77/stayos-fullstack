'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  FileText,
  HeartHandshake,
  History,
  IdCard,
  IndianRupee,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';

type DocumentStatus = 'Verified' | 'Needs Update' | 'Expired' | 'Missing';
type RequestStatus = 'Open' | 'Resolved' | 'Follow-up';

const guest = {
  id: 'ananya-rao',
  name: 'Ananya Rao',
  mobile: '+91 98765 44220',
  email: 'ananya.rao@example.com',
  initials: 'AR',
  badges: ['VIP', 'Returning Guest', 'Corporate'],
  lastStay: 'March 2026',
  totalStays: '5 stays',
  lifetimeSpend: 'INR 1,42,800',
  preferredRoom: 'Suite / high floor',
  note: 'Welcome back. Ananya has stayed with us 5 times and prefers a quiet high-floor room.',
  snapshot: [
    ['Contact details', '+91 98765 44220 - ananya.rao@example.com'],
    ['Nationality', 'Indian'],
    ['DOB', '14 August'],
    ['Anniversary', '22 November'],
    ['Preferred language', 'English and Hindi'],
    ['Company', 'Jaipur Textiles Pvt Ltd'],
    ['GST details', 'GST invoice preferred'],
  ],
  documents: [
    ['Aadhaar', 'ID Verified', 'Verified'],
    ['Passport', 'Passport Expiring Soon', 'Needs Update'],
    ['Driving Licence', 'Not collected', 'Missing'],
    ['Visa / FRRO', 'Not required for this guest', 'Verified'],
  ] as [string, string, DocumentStatus][],
  stays: [
    {
      month: 'March 2026',
      room: 'Suite 402',
      nights: '3 nights',
      source: 'Corporate',
      amount: 'INR 18,500',
      feedback: 'Rated 5/5',
      note: 'Requested late checkout and vegetarian breakfast.',
    },
    {
      month: 'December 2025',
      room: 'Deluxe King 308',
      nights: '2 nights',
      source: 'Website',
      amount: 'INR 11,200',
      feedback: 'Appreciated front desk support',
      note: 'Prefers a room away from elevator.',
    },
    {
      month: 'August 2025',
      room: 'Suite 405',
      nights: '4 nights',
      source: 'Phone',
      amount: 'INR 24,400',
      feedback: 'Requested airport pickup',
      note: 'Family stay. Extra pillow was appreciated.',
    },
  ],
  requests: [
    ['Today', 'Extra towels', 'Open', 'Assigned to housekeeping.'],
    ['Mar 2026', 'Late checkout', 'Resolved', 'Resolved well. Guest appreciated support.'],
    ['Dec 2025', 'AC not cooling', 'Follow-up', 'Needs follow-up before next stay.'],
  ] as [string, string, RequestStatus, string][],
  financial: [
    ['Lifetime spend', 'INR 1,42,800'],
    ['Average booking value', 'INR 16,900'],
    ['Last payment method', 'Corporate credit'],
    ['Corporate billing', 'Enabled'],
    ['Outstanding balance', 'None'],
    ['GST invoice preference', 'Required'],
  ],
  timeline: [
    ['Today 09:15', 'Reservation opened by front desk'],
    ['Today 09:18', 'Guest preference reviewed'],
    ['Mar 2026', 'Payment received'],
    ['Mar 2026', 'Complaint resolved'],
    ['Mar 2026', 'Feedback received'],
    ['Dec 2025', 'Checked out'],
  ],
  insights: [
    'Returning guest. Prefers high floor.',
    'Birthday is next month.',
    'Usually requests late checkout.',
    'Corporate billing enabled.',
    'Passport expires soon.',
  ],
};

const initialPreferences = [
  'High Floor',
  'Quiet Room',
  'King Bed',
  'Vegetarian Breakfast',
  'Extra Pillow',
  'No Smoking',
  'Airport Pickup',
  'Late Checkout',
  'South Indian Breakfast',
  'Hindi Speaking Staff',
];

function statusColor(status: DocumentStatus | RequestStatus) {
  if (status === 'Verified' || status === 'Resolved') return 'green';
  if (status === 'Needs Update' || status === 'Follow-up') return 'yellow';
  if (status === 'Expired') return 'red';
  return 'gray';
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group align="flex-start" gap={spacing[3]} wrap="nowrap">
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={40}>
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
        <Group gap={spacing[5]} align="flex-start" wrap="nowrap">
          <Avatar color="stayosBrand" radius={radius.lg} size={86}>
            {guest.initials}
          </Avatar>
          <Stack gap={spacing[3]}>
            <Button
              component="a"
              href="/reservations"
              variant="subtle"
              color="gray"
              leftSection={<ChevronLeft size={16} />}
              px={0}
              w="fit-content"
            >
              Back to Reservations
            </Button>
            <Group gap={spacing[2]}>
              {guest.badges.map((badge) => (
                <Badge key={badge} color="stayosBrand" variant="light" radius={radius.full}>
                  {badge}
                </Badge>
              ))}
            </Group>
            <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
              {guest.name}
            </Title>
            <Text c={colors.text.body} maw={720} style={typography.styles.bodyLarge}>
              {guest.note}
            </Text>
            <Group gap={spacing[4]} wrap="wrap">
              <Group gap={spacing[2]}>
                <Phone size={15} color={colors.text.muted} />
                <Text c={colors.text.muted} style={typography.styles.small}>
                  {guest.mobile}
                </Text>
              </Group>
              <Group gap={spacing[2]}>
                <Mail size={15} color={colors.text.muted} />
                <Text c={colors.text.muted} style={typography.styles.small}>
                  {guest.email}
                </Text>
              </Group>
            </Group>
          </Stack>
        </Group>
        <SimpleGrid cols={2} spacing={spacing[3]} miw={360}>
          {[
            ['Last stay', guest.lastStay],
            ['Total stays', guest.totalStays],
            ['Lifetime spend', guest.lifetimeSpend],
            ['Preferred room', guest.preferredRoom],
          ].map(([label, value]) => (
            <Paper key={label} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text c={colors.text.muted} style={typography.styles.caption}>
                {label}
              </Text>
              <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
                {value}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Group>
    </Card>
  );
}

function ProfileSnapshot() {
  return (
    <SectionCard title="Profile Snapshot" subtitle="Readable guest details, not a long form." icon={<UserRound size={19} />}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        {guest.snapshot.map(([label, value]) => (
          <Paper key={label} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {label}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </SectionCard>
  );
}

function IdentityDocuments() {
  return (
    <SectionCard title="Identity Documents" subtitle="Status only. Document images stay private." icon={<IdCard size={19} />}>
      <Stack gap={spacing[3]}>
        {guest.documents.map(([document, label, status]) => (
          <Paper key={document} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
            <Group justify="space-between" gap={spacing[3]}>
              <Box>
                <Text c={colors.text.strong} style={typography.styles.label}>
                  {document}
                </Text>
                <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                  {label}
                </Text>
              </Box>
              <Badge color={statusColor(status)} variant="light" radius={radius.full}>
                {status}
              </Badge>
            </Group>
          </Paper>
        ))}
        <Group gap={spacing[2]}>
          <Button variant="light" color="stayosBrand" leftSection={<FileText size={16} />}>
            View Documents
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Pencil size={16} />}>
            Update ID
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Send size={16} />}>
            Request from Guest
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function StayHistory() {
  return (
    <SectionCard title="Stay History" subtitle="Past stays with the details staff actually remember." icon={<History size={19} />}>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
        {guest.stays.map((stay) => (
          <Paper key={`${stay.month}-${stay.room}`} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
            <Text c={colors.brand[600]} style={typography.styles.label}>
              {stay.month}
            </Text>
            <Title order={3} c={colors.text.strong} mt={spacing[2]} style={typography.styles.h3}>
              {stay.room}
            </Title>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {stay.nights} - {stay.source} - {stay.amount}
            </Text>
            <Text c={colors.text.body} mt={spacing[3]} style={typography.styles.small}>
              {stay.feedback}
            </Text>
            <Text c={colors.text.strong} mt={spacing[2]} style={typography.styles.small}>
              {stay.note}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </SectionCard>
  );
}

function Preferences() {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [detailsOpened, { open, close }] = useDisclosure(false);

  const removePreference = (preference: string) => {
    setPreferences((current) => current.filter((item) => item !== preference));
  };

  const addPreference = () => {
    setPreferences((current) => (current.includes('Welcome Drink') ? current : [...current, 'Welcome Drink']));
  };

  return (
    <>
      <SectionCard title="Preferences" subtitle="Small details that make the stay feel personal." icon={<Sparkles size={19} />}>
        <Group gap={spacing[2]}>
          {preferences.map((preference) => (
            <Badge
              key={preference}
              color="stayosBrand"
              variant="light"
              radius={radius.full}
              rightSection={
                <Tooltip label="Remove preference">
                  <ActionIcon
                    size={16}
                    variant="transparent"
                    color="stayosBrand"
                    aria-label={`Remove ${preference}`}
                    onClick={() => removePreference(preference)}
                  >
                    x
                  </ActionIcon>
                </Tooltip>
              }
            >
              {preference}
            </Badge>
          ))}
          <Button size="xs" variant="light" color="stayosBrand" leftSection={<Plus size={14} />} onClick={addPreference}>
            Add preference
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={open}>
            More details
          </Button>
        </Group>
      </SectionCard>
      <Drawer opened={detailsOpened} onClose={close} position="right" title="Preference details" size="min(92vw, 460px)">
        <Stack gap={spacing[4]}>
          <Text c={colors.text.body} style={typography.styles.body}>
            This drawer will later show who added each preference, when it was last used, and whether it applies to every property.
          </Text>
          {preferences.map((preference) => (
            <Paper key={preference} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text c={colors.text.strong} style={typography.styles.label}>
                {preference}
              </Text>
              <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                Mock preference. No backend update has been made.
              </Text>
            </Paper>
          ))}
        </Stack>
      </Drawer>
    </>
  );
}

function RequestsAndComplaints() {
  return (
    <SectionCard title="Requests and Complaints" subtitle="Only service history that helps the next conversation." icon={<HeartHandshake size={19} />}>
      <Stack gap={spacing[3]}>
        {guest.requests.map(([date, title, status, note]) => (
          <Paper key={`${date}-${title}`} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
            <Group justify="space-between" align="flex-start" gap={spacing[3]}>
              <Box>
                <Text c={colors.text.strong} style={typography.styles.label}>
                  {title}
                </Text>
                <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                  {date} - {note}
                </Text>
              </Box>
              <Badge color={statusColor(status)} variant="light" radius={radius.full}>
                {status}
              </Badge>
            </Group>
          </Paper>
        ))}
      </Stack>
    </SectionCard>
  );
}

function FinancialSummary() {
  return (
    <SectionCard title="Financial Summary" subtitle="Simple billing context without accounting complexity." icon={<IndianRupee size={19} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
        {guest.financial.map(([label, value]) => (
          <Paper key={label} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {label}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </SectionCard>
  );
}

function GuestTimeline() {
  return (
    <SectionCard title="Guest Timeline" subtitle="The CRM activity history for this guest." icon={<CalendarDays size={19} />}>
      <Timeline active={guest.timeline.length - 1} bulletSize={26} lineWidth={2} color="stayosBrand">
        {guest.timeline.map(([time, event]) => (
          <Timeline.Item key={`${time}-${event}`} bullet={<BadgeCheck size={14} />}>
            <Text c={colors.text.strong} style={typography.styles.label}>
              {event}
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
              {time}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </SectionCard>
  );
}

function InsightPanel() {
  return (
    <Stack gap={spacing[4]}>
      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group gap={spacing[3]} align="flex-start">
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
            <Star size={17} />
          </ThemeIcon>
          <Box>
            <Text c={colors.text.strong} style={typography.styles.label}>
              Guest insights
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
              What helps the team serve better.
            </Text>
          </Box>
        </Group>
        <Stack mt={spacing[4]} gap={spacing[3]}>
          {guest.insights.map((insight) => (
            <Paper key={insight} p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
              <Text c={colors.text.body} style={typography.styles.small}>
                {insight}
              </Text>
            </Paper>
          ))}
        </Stack>
      </Card>

      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Text c={colors.text.strong} style={typography.styles.label}>
          Quick actions
        </Text>
        <Divider my={spacing[3]} color={colors.border.subtle} />
        <Stack gap={spacing[2]}>
          <Button component="a" href="/reservations/availability" color="stayosBrand" leftSection={<Plus size={16} />}>
            Create Reservation
          </Button>
          <Button component="a" href="/check-in" variant="light" color="stayosBrand" leftSection={<BadgeCheck size={16} />}>
            Start Check-in
          </Button>
          <Button component="a" href="/guest-stay/ST1842" variant="light" color="stayosBrand" leftSection={<ReceiptText size={16} />}>
            View Current Stay
          </Button>
          <Button component="a" href="/requests" variant="subtle" color="gray" leftSection={<MessageSquare size={16} />}>
            Add Request
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Sparkles size={16} />}>
            Update Preferences
          </Button>
          <Button component="a" href="/guest-stay/ST1842" variant="subtle" color="gray" leftSection={<IndianRupee size={16} />}>
            View Folio
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Send size={16} />}>
            Send Message
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

export default function GuestProfilePage() {
  return (
    <Stack gap={spacing[5]}>
      <Hero />
      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[5]}>
        <Stack gap={spacing[5]} style={{ gridColumn: 'span 8' }}>
          <ProfileSnapshot />
          <IdentityDocuments />
          <StayHistory />
          <Preferences />
          <RequestsAndComplaints />
          <FinancialSummary />
          <GuestTimeline />
        </Stack>
        <Box style={{ gridColumn: 'span 4' }}>
          <InsightPanel />
        </Box>
      </SimpleGrid>
    </Stack>
  );
}
