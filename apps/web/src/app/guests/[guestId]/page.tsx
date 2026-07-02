'use client';

import Link from 'next/link';
import {
  ActionIcon,
  Alert,
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
import { useParams } from 'next/navigation';
import {
  AlertCircle,
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
import { useEffect, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, useBackendStatus } from '@stayos/ui';
import { type Guest, useGuestDetails } from '../../../lib/guest-hooks';

type DocumentStatus = 'Verified' | 'Needs Update' | 'Expired' | 'Missing';
type RequestStatus = 'Open' | 'Resolved' | 'Follow-up';

const placeholderDocuments = [
  ['Identity documents', 'Documents API not wired yet', 'Missing'],
  ['GST documents', 'Billing documents API not wired yet', 'Missing'],
] as [string, string, DocumentStatus][];

const placeholderRequests = [
  ['Not connected', 'Requests API not wired yet', 'Open', 'Service history will appear here later.'],
] as [string, string, RequestStatus, string][];

const placeholderFinancial = [
  ['Lifetime spend', 'Not connected'],
  ['Average booking value', 'Not connected'],
  ['Last payment method', 'Not connected'],
  ['Corporate billing', 'Not connected'],
  ['Outstanding balance', 'Not connected'],
  ['GST invoice preference', 'Not connected'],
] as [string, string][];

const placeholderTimeline = [
  ['Not connected', 'Guest timeline API not wired yet'],
] as [string, string][];

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

function Hero({ guest }: { guest: Guest }) {
  return (
    <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between" align="flex-start" gap={spacing[5]}>
        <Group gap={spacing[5]} align="flex-start" wrap="nowrap">
          <Avatar color="stayosBrand" radius={radius.lg} size={86}>
            {guest.initials}
          </Avatar>
          <Stack gap={spacing[3]}>
            <Button
              component={Link}
              href="/guests"
              variant="subtle"
              color="gray"
              leftSection={<ChevronLeft size={16} />}
              px={0}
              w="fit-content"
            >
              Back to Guests
            </Button>
            <Group gap={spacing[2]}>
              {guest.badges.map((badge) => (
                <Badge key={badge} color={badge === 'VIP' ? 'stayosBrand' : 'gray'} variant="light" radius={radius.full}>
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

function ProfileSnapshot({ guest }: { guest: Guest }) {
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
    <SectionCard title="Identity Documents" subtitle="Placeholder state. Documents API is not wired yet." icon={<IdCard size={19} />}>
      <Stack gap={spacing[3]}>
        {placeholderDocuments.map(([document, label, status]) => (
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
          <Button variant="light" color="stayosBrand" leftSection={<FileText size={16} />} disabled>
            View Documents
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Pencil size={16} />} disabled>
            Update ID
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Send size={16} />} disabled>
            Request from Guest
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function StayHistory() {
  return (
    <SectionCard title="Stay History" subtitle="Placeholder state. Stays and reservations are not wired yet." icon={<History size={19} />}>
      <Paper p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
        <Text c={colors.text.strong} style={typography.styles.label}>
          Stay history not connected
        </Text>
        <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
          Past stays, rooms, spend, and feedback will appear here after stay history APIs are wired.
        </Text>
      </Paper>
    </SectionCard>
  );
}

function Preferences({ guest }: { guest: Guest }) {
  const [preferences, setPreferences] = useState(guest.preferences);
  const [detailsOpened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    setPreferences(guest.preferences);
  }, [guest.preferences]);

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
            Preference updates are local only until the guest preference write API is available.
          </Text>
          {preferences.map((preference) => (
            <Paper key={preference} p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
              <Text c={colors.text.strong} style={typography.styles.label}>
                {preference}
              </Text>
              <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                Loaded from backend guest details when available.
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
    <SectionCard title="Requests and Complaints" subtitle="Placeholder state. Requests API is not wired yet." icon={<HeartHandshake size={19} />}>
      <Stack gap={spacing[3]}>
        {placeholderRequests.map(([date, title, status, note]) => (
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
    <SectionCard title="Financial Summary" subtitle="Placeholder state. Billing is not wired yet." icon={<IndianRupee size={19} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
        {placeholderFinancial.map(([label, value]) => (
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
    <SectionCard title="Guest Timeline" subtitle="Placeholder state. Timeline API is not wired yet." icon={<CalendarDays size={19} />}>
      <Timeline active={placeholderTimeline.length - 1} bulletSize={26} lineWidth={2} color="stayosBrand">
        {placeholderTimeline.map(([time, event]) => (
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

function InsightPanel({ guest }: { guest: Guest }) {
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
          <Button component={Link} href="/reservations/availability" color="stayosBrand" leftSection={<Plus size={16} />}>
            Create Reservation
          </Button>
          <Button component={Link} href="/check-in" variant="light" color="stayosBrand" leftSection={<BadgeCheck size={16} />}>
            Start Check-in
          </Button>
          <Button variant="light" color="stayosBrand" leftSection={<ReceiptText size={16} />} disabled>
            View Current Stay
          </Button>
          <Button component={Link} href="/requests" variant="subtle" color="gray" leftSection={<MessageSquare size={16} />}>
            Add Request
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Sparkles size={16} />}>
            Update Preferences
          </Button>
          <Button variant="subtle" color="gray" leftSection={<IndianRupee size={16} />} disabled>
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
  const params = useParams<{ guestId: string }>();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuest = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guestState = useGuestDetails({
    allowMockFallback,
    enabled: canLoadGuest,
    guestId: params.guestId,
  });

  const retryBackend = () => {
    void backend.retry();
  };

  const checkBackendStatus = () => {
    void backend.checkHealth();
  };

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  }

  if (!allowMockFallback && backend.status === 'CONNECTING' && backend.lastSuccessfulConnection === null && !guestState.guest) {
    return (
      <ServerStarting
        title="Connecting to StayOS"
        detail="We are checking the hotel server before loading this guest profile."
        onAction={retryBackend}
        onCheckStatus={checkBackendStatus}
      />
    );
  }

  if (!allowMockFallback && guestState.error && !guestState.isLoading && !guestState.guest) {
    return <GenericError onAction={() => void guestState.refreshGuest()} onCheckStatus={checkBackendStatus} />;
  }

  if (!guestState.guest) {
    return (
      <Alert color="blue" variant="light" icon={<UserRound size={17} />} radius={radius.lg}>
        Loading guest profile from the active property...
      </Alert>
    );
  }

  const guest = guestState.guest;

  return (
    <Stack gap={spacing[5]}>
      {guestState.isFallback && guestState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Guest 360 is showing a mock profile while the backend is unavailable.
        </Alert>
      ) : null}
      <Hero guest={guest} />
      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[5]}>
        <Stack gap={spacing[5]} style={{ gridColumn: 'span 8' }}>
          <ProfileSnapshot guest={guest} />
          <IdentityDocuments />
          <StayHistory />
          <Preferences guest={guest} />
          <RequestsAndComplaints />
          <FinancialSummary />
          <GuestTimeline />
        </Stack>
        <Box style={{ gridColumn: 'span 4' }}>
          <InsightPanel guest={guest} />
        </Box>
      </SimpleGrid>
    </Stack>
  );
}
