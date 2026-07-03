'use client';

import Link from 'next/link';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  BadgeCheck,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  CreditCard,
  HeartHandshake,
  IdCard,
  IndianRupee,
  MessageSquare,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, useBackendStatus } from '@stayos/ui';
import { type Guest, useGuestDetails } from '../../../lib/guest-hooks';

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function isReturningGuest(guest: Guest) {
  return guest.badges.includes('Returning Guest') || !['Not connected', '0 stays', '1 stay'].includes(guest.totalStays);
}

function isCorporateGuest(guest: Guest) {
  return Boolean(guest.companyName) || guest.badges.includes('Corporate');
}

function tokenTone(label: string) {
  if (label === 'VIP') return { color: '#6d5dfc', background: '#f5f3ff' };
  if (label === 'Corporate') return { color: '#2563eb', background: '#eff6ff' };
  if (label === 'Returning Guest') return { color: '#16a34a', background: '#f0fdf4' };
  if (label === 'Outstanding') return { color: '#dc2626', background: '#fef2f2' };
  return { color: '#64748b', background: '#f8fafc' };
}

function TokenBadge({ children }: { children: ReactNode }) {
  const tone = tokenTone(String(children));

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

function SectionCard({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
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

function ComingSoonCard({ label }: { label: string }) {
  return (
    <Paper radius={radius.md} p={14} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
        {label} coming soon
      </Text>
      <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
        This section will populate automatically when the backend endpoint is available.
      </Text>
    </Paper>
  );
}

function guestTags(guest: Guest) {
  return Array.from(
    new Set([
      guest.isVip ? 'VIP' : '',
      isReturningGuest(guest) ? 'Returning Guest' : '',
      isCorporateGuest(guest) ? 'Corporate' : '',
      ...guest.badges.filter((badge) => ['VIP', 'Returning Guest', 'Corporate'].includes(badge)),
    ].filter(Boolean)),
  );
}

function outstandingBalance(guest: Guest) {
  const spend = guest.lifetimeSpend.toLowerCase();
  if (spend.includes('not connected')) return 'Not connected';
  return 'Not connected';
}

function Hero({ guest }: { guest: Guest }) {
  const tags = guestTags(guest);

  return (
    <Card radius={radius.lg} p={20} style={cardStyle}>
      <Group justify="space-between" align="flex-start" gap={spacing[5]}>
        <Group gap={16} align="flex-start" wrap="nowrap">
          <Avatar color="stayosBrand" radius={radius.lg} size={78}>
            {guest.initials}
          </Avatar>
          <Stack gap={10}>
            <Button
              component={Link}
              href="/guests"
              variant="subtle"
              color="gray"
              leftSection={<ChevronLeft size={16} />}
              px={0}
              w="fit-content"
              style={{ fontWeight: 600 }}
            >
              Back to Guests
            </Button>
            <Group gap={6}>
              {tags.map((tag) => (
                <TokenBadge key={tag}>{tag}</TokenBadge>
              ))}
              {outstandingBalance(guest) !== 'Not connected' ? <TokenBadge>Outstanding</TokenBadge> : null}
            </Group>
            <Title order={1} c="#101828" style={{ fontSize: 34, fontWeight: 700, lineHeight: '42px' }}>
              {guest.name}
            </Title>
            <Text c="#64748b" maw={680} style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
              {guest.note}
            </Text>
            <Group gap={spacing[3]} wrap="wrap">
              <Text c="#526383" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                Current Room: {guest.preferredRoom}
              </Text>
              <Text c="#526383" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                Outstanding: {outstandingBalance(guest)}
              </Text>
            </Group>
          </Stack>
        </Group>

        <Group gap={8}>
          <Button component={Link} href="/reservations/availability" color="stayosBrand" leftSection={<Plus size={16} />} style={{ fontWeight: 600 }}>
            New Reservation
          </Button>
          <Button component={Link} href="/check-in" variant="light" color="stayosBrand" leftSection={<BadgeCheck size={16} />} style={{ fontWeight: 600 }}>
            Start Check-in
          </Button>
          <Button component={Link} href="/requests" variant="subtle" color="gray" leftSection={<MessageSquare size={16} />} style={{ fontWeight: 600 }}>
            Add Request
          </Button>
        </Group>
      </Group>
    </Card>
  );
}

function StaySnapshot({ guest }: { guest: Guest }) {
  const loyaltyTier = guest.isVip ? 'VIP' : guest.badges.find((badge) => badge.toLowerCase().includes('loyal')) ?? 'Not connected';

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing={spacing[3]}>
      <DetailTile label="Current Room" value={guest.preferredRoom} />
      <DetailTile label="Lifetime Stays" value={guest.totalStays} />
      <DetailTile label="Lifetime Revenue" value={guest.lifetimeSpend} />
      <DetailTile label="Last Stay" value={guest.lastStay} />
      <DetailTile label="Loyalty Tier" value={loyaltyTier} />
    </SimpleGrid>
  );
}

function CurrentStay({ guest }: { guest: Guest }) {
  return (
    <SectionCard title="Current Stay" icon={<BedDouble size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={spacing[3]}>
        <DetailTile label="Reservation" value="Not connected" />
        <DetailTile label="Arrival" value="Not connected" />
        <DetailTile label="Departure" value="Not connected" />
        <DetailTile label="Room" value={guest.preferredRoom} />
        <DetailTile label="Adults" value="Not connected" />
        <DetailTile label="Children" value="Not connected" />
        <DetailTile label="Rate Plan" value="Not connected" />
        <DetailTile label="Outstanding" value={outstandingBalance(guest)} />
        <DetailTile label="Housekeeping" value="Not connected" />
        <DetailTile label="Room Status" value="Not connected" />
        <DetailTile label="Expected Checkout" value="Not connected" />
      </SimpleGrid>
    </SectionCard>
  );
}

function Preferences({ guest }: { guest: Guest }) {
  const preferences = guest.preferences.filter((item) => !item.toLowerCase().includes('no backend'));

  return (
    <SectionCard title="Preferences" icon={<Sparkles size={17} />}>
      {preferences.length > 0 ? (
        <Group gap={6}>
          {preferences.map((preference) => (
            <TokenBadge key={preference}>{preference}</TokenBadge>
          ))}
        </Group>
      ) : (
        <Group gap={6}>
          {['King Bed', 'High Floor', 'Vegetarian', 'Airport Pickup', 'Late Checkout', 'Extra Pillow'].map((preference) => (
            <TokenBadge key={preference}>{preference}</TokenBadge>
          ))}
        </Group>
      )}
    </SectionCard>
  );
}

function ActivityTimeline() {
  return (
    <SectionCard title="Timeline" icon={<CalendarDays size={17} />}>
      <ComingSoonCard label="Guest activity timeline" />
    </SectionCard>
  );
}

function FinancialSummary({ guest }: { guest: Guest }) {
  return (
    <SectionCard title="Financial" icon={<IndianRupee size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
        <DetailTile label="Outstanding" value={outstandingBalance(guest)} />
        <DetailTile label="Invoices" value="Not connected" />
        <DetailTile label="Payments" value="Not connected" />
        <DetailTile label="Refunds" value="Not connected" />
        <DetailTile label="Deposits" value="Not connected" />
        <DetailTile label="Corporate Billing" value={guest.companyName ?? 'Not connected'} />
      </SimpleGrid>
    </SectionCard>
  );
}

function Documents() {
  return (
    <SectionCard title="Documents" icon={<IdCard size={17} />}>
      <ComingSoonCard label="Passport, visa, PAN, GST and Aadhaar documents" />
    </SectionCard>
  );
}

function NotesAndRequests({ guest }: { guest: Guest }) {
  return (
    <SectionCard title="Notes & Requests" icon={<HeartHandshake size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <DetailTile label="Internal Notes" value={guest.note} />
        <DetailTile label="Complaints" value="Not connected" />
        <DetailTile label="Special Requests" value={guest.preferences.slice(0, 3).join(', ') || 'Not connected'} />
        <DetailTile label="Service Recovery" value="Not connected" />
      </SimpleGrid>
    </SectionCard>
  );
}

function StayHistory() {
  return (
    <SectionCard title="Stay History" icon={<ReceiptText size={17} />}>
      <ComingSoonCard label="Stay history" />
    </SectionCard>
  );
}

function RightSidebar({ guest }: { guest: Guest }) {
  return (
    <Stack gap={spacing[3]}>
      <Card p={16} radius={radius.lg} style={cardStyle}>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          Quick Actions
        </Text>
        <Divider my={spacing[3]} color="#eef1f6" />
        <Stack gap={spacing[2]}>
          <Button component={Link} href="/reservations/availability" color="stayosBrand" leftSection={<Plus size={16} />} style={{ fontWeight: 600 }}>
            Create Reservation
          </Button>
          <Button component={Link} href="/check-in" variant="light" color="stayosBrand" leftSection={<BadgeCheck size={16} />} style={{ fontWeight: 600 }}>
            Start Check-in
          </Button>
          <Button component={Link} href="/requests" variant="subtle" color="gray" leftSection={<MessageSquare size={16} />} style={{ fontWeight: 600 }}>
            Add Request
          </Button>
          <Button variant="subtle" color="gray" leftSection={<Send size={16} />} style={{ fontWeight: 600 }}>
            Send Message
          </Button>
        </Stack>
      </Card>

      <Card p={16} radius={radius.lg} style={cardStyle}>
        <Group gap={10} align="center">
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}>
            <Star size={17} />
          </ThemeIcon>
          <Box>
            <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
              AI Guest Insights
            </Text>
            <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
              Service cues for this guest.
            </Text>
          </Box>
        </Group>
        <Stack mt={12} gap={spacing[2]}>
          {guest.insights.map((insight) => (
            <Paper key={insight} p={12} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
              <Text c="#334155" style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
                {insight}
              </Text>
            </Paper>
          ))}
        </Stack>
      </Card>

      <Card p={16} radius={radius.lg} style={cardStyle}>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          Current Stay Summary
        </Text>
        <Stack mt={12} gap={spacing[2]}>
          <DetailTile label="Room" value={guest.preferredRoom} />
          <DetailTile label="Company" value={guest.companyName ?? 'Not connected'} />
          <DetailTile label="Last Stay" value={guest.lastStay} />
        </Stack>
      </Card>

      <Card p={16} radius={radius.lg} style={cardStyle}>
        <Group justify="space-between" align="center">
          <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
            Outstanding Balance
          </Text>
          <CreditCard size={17} color="#dc2626" />
        </Group>
        <Text c="#dc2626" mt={12} style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>
          {outstandingBalance(guest)}
        </Text>
        <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
          Billing endpoint not connected yet.
        </Text>
      </Card>
    </Stack>
  );
}

export default function GuestProfilePage() {
  const params = useParams<{ guestId: string }>();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuest =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
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

  if (
    !allowMockFallback &&
    backend.status === 'CONNECTING' &&
    backend.lastSuccessfulConnection === null &&
    !guestState.guest
  ) {
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
    <Stack gap={spacing[3]}>
      {guestState.isFallback && guestState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Guest 360 is showing a mock profile while the backend is unavailable.
        </Alert>
      ) : null}

      <Hero guest={guest} />
      <StaySnapshot guest={guest} />

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <CurrentStay guest={guest} />
          <StayHistory />
          <Preferences guest={guest} />
          <ActivityTimeline />
          <FinancialSummary guest={guest} />
          <Documents />
          <NotesAndRequests guest={guest} />
        </Stack>
        <Box style={{ gridColumn: 'span 4' }}>
          <RightSidebar guest={guest} />
        </Box>
      </SimpleGrid>
    </Stack>
  );
}
