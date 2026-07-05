'use client';

import Link from 'next/link';
import { Alert, Avatar, Box, Button, Card, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useParams } from 'next/navigation';
import { AlertCircle, CalendarDays, ChevronLeft, Edit, FileText, IdCard, Languages, NotebookText, Sparkles, UserRound } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, useBackendStatus } from '@stayos/ui';
import { useGuestDetails } from '../../lib/guest-hooks';
import { documentPlaceholders, preferencePlaceholders } from './constants/guest.constants';
import { GuestStatusBadge } from './components/GuestStatusBadge';
import type { Guest } from './types/guest.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#64748b" style={{ fontSize: 11, fontWeight: 600 }}>{label}</Text>
      <Text c="#182230" mt={3} style={{ fontSize: 13, fontWeight: 700 }}>{value}</Text>
    </Paper>
  );
}

function Section({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <Card radius={radius.lg} p={16} style={cardStyle}>
      <Group gap={10}>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}>{icon}</ThemeIcon>
        <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>{title}</Title>
      </Group>
      <Box mt={14}>{children}</Box>
    </Card>
  );
}

function Header({ guest }: { guest: Guest }) {
  return (
    <Card radius={radius.lg} p={20} style={cardStyle}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Group align="flex-start" gap={spacing[4]} wrap="nowrap">
          <Avatar color="stayosBrand" radius={radius.lg} size={76}>{guest.initials}</Avatar>
          <Stack gap={8}>
            <Button component={Link} href="/guests" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">
              Back to Guests
            </Button>
            <Group gap={8}>
              <GuestStatusBadge status={guest.status} />
              {guest.vipStatus ? <Text c="#7c3aed" fw={800} size="xs">VIP</Text> : null}
            </Group>
            <Title order={1} c="#101828" style={{ fontSize: 34, fontWeight: 800 }}>{guest.fullName}</Title>
            <Text c="#64748b" style={{ fontSize: 14 }}>{guest.phone} - {guest.email} - {guest.nationality}</Text>
            <Text c="#64748b" style={{ fontSize: 13 }}>Preferred language: {guest.preferredLanguage}</Text>
          </Stack>
        </Group>
        <Group gap={8}>
          <Button component={Link} href={`/guests/${guest.id}/edit`} color="stayosBrand" leftSection={<Edit size={16} />}>Edit Guest</Button>
          <Button component={Link} href="/reservations/availability" variant="light" color="stayosBrand">Create Booking</Button>
          <Button component={Link} href="/check-in" variant="subtle" color="gray">Start Check-In</Button>
        </Group>
      </Group>
    </Card>
  );
}

function ProfileDetails({ guest }: { guest: Guest }) {
  return (
    <Section title="Profile Details" icon={<UserRound size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
        <DetailTile label="First name" value={guest.firstName} />
        <DetailTile label="Last name" value={guest.lastName} />
        <DetailTile label="Display name" value={guest.displayName} />
        <DetailTile label="Phone" value={guest.phone} />
        <DetailTile label="Alternate phone" value={guest.alternatePhone} />
        <DetailTile label="Email" value={guest.email} />
        <DetailTile label="Nationality" value={guest.nationality} />
        <DetailTile label="Preferred language" value={guest.preferredLanguage} />
        <DetailTile label="VIP" value={guest.vipStatus ? 'Yes' : 'No'} />
        <DetailTile label="Blacklisted" value={guest.blacklistStatus ? 'Yes' : 'No'} />
      </SimpleGrid>
    </Section>
  );
}

function Preferences() {
  return (
    <Section title="Preferences" icon={<Sparkles size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
        {preferencePlaceholders.map(([label, value]) => <DetailTile key={label} label={label} value={value} />)}
      </SimpleGrid>
    </Section>
  );
}

function Documents() {
  return (
    <Section title="Documents" icon={<IdCard size={17} />}>
      <Stack gap={spacing[2]}>
        {documentPlaceholders.map((document) => (
          <Paper key={document} radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Group justify="space-between">
              <Box>
                <Text fw={700} size="sm">{document}</Text>
                <Text c="#64748b" size="xs">Not uploaded</Text>
              </Box>
              <Button disabled variant="light" color="gray" size="compact-sm">Upload</Button>
            </Group>
          </Paper>
        ))}
        <Text c="#64748b" size="xs">This section will power Check-In document verification.</Text>
      </Stack>
    </Section>
  );
}

function Reservations({ guest }: { guest: Guest }) {
  return (
    <Section title="Reservations / Stay History" icon={<CalendarDays size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <DetailTile label="Upcoming bookings" value={guest.upcomingBooking} />
        <DetailTile label="Past stays" value={guest.lastStay} />
      </SimpleGrid>
    </Section>
  );
}

export default function GuestProfilePage() {
  const params = useParams<{ guestId: string }>();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuest = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guestState = useGuestDetails({ allowMockFallback, enabled: canLoadGuest, guestId: params.guestId });
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && guestState.error && !guestState.isLoading && !guestState.guest) return <GenericError onAction={() => void guestState.refreshGuest()} onCheckStatus={checkBackendStatus} />;

  if (!guestState.guest) {
    return <Alert color="blue" variant="light" icon={<UserRound size={17} />} radius={radius.lg}>Loading guest profile...</Alert>;
  }

  const guest = guestState.guest;

  return (
    <Stack gap={spacing[3]}>
      {guestState.isFallback && guestState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>Demo fallback is enabled, so this profile is sample data.</Alert>
      ) : null}
      <Header guest={guest} />
      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <ProfileDetails guest={guest} />
          <Preferences />
          <Documents />
          <Reservations guest={guest} />
        </Stack>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 4' }}>
          <Section title="Notes" icon={<NotebookText size={17} />}>
            <Text c="#334155" size="sm">{guest.notes}</Text>
          </Section>
          <Section title="Identity Summary" icon={<Languages size={17} />}>
            <Stack gap={spacing[2]}>
              <DetailTile label="Language" value={guest.preferredLanguage} />
              <DetailTile label="Document status" value="Not uploaded" />
              <DetailTile label="Check-in readiness" value="Profile ready for future check-in integration" />
            </Stack>
          </Section>
          <Section title="Future Check-In" icon={<FileText size={17} />}>
            <Text c="#64748b" size="sm">Identity, documents, VIP flag, and notes will connect to the Check-In Workspace later.</Text>
          </Section>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
