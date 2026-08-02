'use client';

import Link from 'next/link';
import { Alert, Avatar, Badge, Box, Button, Card, FileButton, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useParams } from 'next/navigation';
import { AlertCircle, CalendarDays, ChevronLeft, Edit, FileText, IdCard, Languages, NotebookText, Sparkles, Trash2, Upload, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { useGuestDetails } from '../../lib/guest-hooks';
import { deleteIdentityDocument, getCheckInWorkspace, uploadIdentityDocument, type LooseRecord } from '../check-in/check-in-api';
import { useAuth } from '../auth/auth-context';
import { getFolioForReservation } from '../billing/api/billing-api';
import type { Folio } from '../billing/types/billing.types';
import { documentPlaceholders } from './constants/guest.constants';
import { GuestStatusBadge } from './components/GuestStatusBadge';
import type { Guest, GuestReservationSummary } from './types/guest.types';

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

function normalizeReservationStatus(reservation: GuestReservationSummary) {
  return reservation.status.toUpperCase().replace(/[\s-]/g, '_');
}

function normalizePaymentStatus(status: string) {
  return status.toUpperCase().replace(/[\s-]/g, '_');
}

function readableStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getGuestActionState(guest: Guest) {
  const reservations = [...(guest.reservations ?? [])].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  const checkedIn = reservations.find((reservation) => normalizeReservationStatus(reservation) === 'CHECKED_IN');
  const activeBooking = reservations.find((reservation) => ['RESERVED', 'CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(normalizeReservationStatus(reservation)));

  if (checkedIn) {
    return {
      helper: 'Next step: view the active stay for this guest.',
      primary: { href: `/guest-stay/${checkedIn.id}`, label: 'View Stay' },
      secondary: { href: `/guests/${guest.id}/edit`, label: 'Edit Guest' },
      tertiary: undefined,
    };
  }

  if (activeBooking) {
    return {
      helper: 'Next step: start check-in for the active booking.',
      primary: { href: `/check-in?reservation=${activeBooking.id}`, label: 'Start Check-In' },
      secondary: { href: `/guests/${guest.id}/edit`, label: 'Edit Guest' },
      tertiary: { href: `/reservations/${activeBooking.id}`, label: 'View Booking' },
    };
  }

  return {
    helper: 'Next step: create a booking for this guest.',
    primary: { href: `/reservations/new?guestId=${guest.id}`, label: 'Create Booking' },
    secondary: { href: `/guests/${guest.id}/edit`, label: 'Edit Guest' },
    tertiary: undefined,
  };
}

function Header({ guest }: { guest: Guest }) {
  const actionState = getGuestActionState(guest);

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
        <Stack gap={6} align="flex-end">
          <Group gap={8} justify="flex-end">
            <Button component={Link} href={actionState.primary.href} color="stayosBrand">
              {actionState.primary.label}
            </Button>
            <Button component={Link} href={actionState.secondary.href} variant="light" color="stayosBrand" leftSection={<Edit size={16} />}>
              {actionState.secondary.label}
            </Button>
            {actionState.tertiary ? (
              <Button component={Link} href={actionState.tertiary.href} variant="subtle" color="gray">
                {actionState.tertiary.label}
              </Button>
            ) : null}
          </Group>
          <Text c="#64748b" size="xs">{actionState.helper}</Text>
        </Stack>
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

function Preferences({ guest }: { guest: Guest }) {
  const preferences = [
    ['Room preference', guest.roomPreference],
    ['Bed preference', guest.bedPreference],
    ['Smoking preference', guest.smokingPreference],
    ['Floor preference', guest.floorPreference],
    ['Dietary notes', guest.dietaryNotes],
    ['Special notes', guest.notes],
  ];

  return (
    <Section title="Preferences" icon={<Sparkles size={17} />}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
        {preferences.map(([label, value]) => <DetailTile key={label} label={label} value={value} />)}
      </SimpleGrid>
    </Section>
  );
}

type GuestDocument = {
  createdAt: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  side: string;
};

function getArray(record: LooseRecord | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function mapDocuments(workspace: LooseRecord | undefined): GuestDocument[] {
  return getArray(workspace, ['documents'])
    .map((item) => (item && typeof item === 'object' ? item as LooseRecord : undefined))
    .filter((item): item is LooseRecord => Boolean(item))
    .map((item) => ({
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
      id: typeof item.id === 'string' ? item.id : '',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : '',
      originalFilename: typeof item.originalFilename === 'string' ? item.originalFilename : 'Identity document',
      side: typeof item.side === 'string' ? item.side : '',
    }))
    .filter((item) => item.id);
}

function Documents({
  canManageGuests,
  guest,
  onRefreshGuest,
  propertyId,
}: {
  canManageGuests: boolean;
  guest: Guest;
  onRefreshGuest: () => Promise<void>;
  propertyId?: string;
}) {
  const latestReservation = useMemo(
    () => [...(guest.reservations ?? [])].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate))[0],
    [guest.reservations],
  );
  const [documents, setDocuments] = useState<GuestDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const canUpload = Boolean(propertyId && latestReservation?.id && canManageGuests);

  const refreshDocuments = useCallback(async () => {
    if (!propertyId || !latestReservation?.id) {
      setDocuments([]);
      return;
    }
    const workspace = await getCheckInWorkspace(propertyId, latestReservation.id).catch(() => undefined);
    setDocuments(mapDocuments(workspace));
  }, [latestReservation?.id, propertyId]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const uploadDocument = async (file: File | null) => {
    if (!file || !propertyId || !latestReservation?.id) return;
    setIsUploading(true);
    try {
      await uploadIdentityDocument(propertyId, latestReservation.id, 'front', file);
      await Promise.all([refreshDocuments(), onRefreshGuest()]);
      showToast({ color: 'green', title: 'Document uploaded', message: 'Identity document uploaded successfully.' });
    } catch {
      showToast({ color: 'red', title: 'Upload failed', message: 'Unable to upload this document.' });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!propertyId || !latestReservation?.id) return;
    setIsDeleting(documentId);
    try {
      await deleteIdentityDocument(propertyId, latestReservation.id, documentId);
      await refreshDocuments();
      showToast({ color: 'green', title: 'Document deleted', message: 'Identity document removed.' });
    } catch {
      showToast({ color: 'red', title: 'Delete failed', message: 'Unable to delete this document.' });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Section title="Documents" icon={<IdCard size={17} />}>
      <Stack gap={spacing[2]}>
        <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
          <Group justify="space-between">
            <Box>
              <Text fw={700} size="sm">Identity document</Text>
              <Text c="#64748b" size="xs">
                {latestReservation ? `Linked to latest reservation from ${latestReservation.arrivalDate}` : 'No reservation available'}
              </Text>
            </Box>
            <FileButton onChange={(file) => void uploadDocument(file)} accept="image/*,application/pdf">
              {(props) => (
                <Button
                  {...props}
                  disabled={!canUpload}
                  loading={isUploading}
                  variant="light"
                  color="stayosBrand"
                  size="compact-sm"
                  leftSection={<Upload size={14} />}
                >
                  Upload
                </Button>
              )}
            </FileButton>
          </Group>
        </Paper>
        {documents.length > 0 ? (
          documents.map((document) => (
            <Paper key={document.id} radius={radius.md} p={12} style={{ background: '#ffffff', border: '1px solid #eef2f7' }}>
              <Group justify="space-between">
                <Box>
                  <Text fw={700} size="sm">{document.originalFilename}</Text>
                  <Text c="#64748b" size="xs">{document.side.replace('ID_', '')} - {document.mimeType || 'Uploaded document'}</Text>
                </Box>
                <Button
                  disabled={!canManageGuests}
                  loading={isDeleting === document.id}
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  leftSection={<Trash2 size={14} />}
                  onClick={() => void deleteDocument(document.id)}
                >
                  Delete
                </Button>
              </Group>
            </Paper>
          ))
        ) : (
          <Text c="#64748b" size="xs">{documentPlaceholders.join(', ')} not uploaded.</Text>
        )}
        {!canManageGuests ? <Text c="#64748b" size="xs">Guests manage permission is required to upload or delete documents.</Text> : null}
      </Stack>
    </Section>
  );
}

function Reservations({ foliosByReservationId, guest }: { foliosByReservationId: Record<string, Folio>; guest: Guest }) {
  const reservations = [...(guest.reservations ?? [])].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));

  return (
    <Section title="Reservations / Stay History" icon={<CalendarDays size={17} />}>
      {reservations.length > 0 ? (
        <Stack gap={spacing[2]}>
          {reservations.map((reservation) => {
            const status = normalizeReservationStatus(reservation);
            const folio = foliosByReservationId[reservation.id];
            const folioBalance = Number(folio?.totals.balance ?? Number.NaN);
            const folioPaid = Number(folio?.totals.paid ?? 0);
            const paymentStatus = folio?.status === 'SETTLED' || (Number.isFinite(folioBalance) && folioBalance <= 0.01 && folioPaid > 0)
              ? 'PAID'
              : normalizePaymentStatus(reservation.paymentStatus);
            const isStay = ['CHECKED_IN', 'CHECKED_OUT'].includes(status);
            const href = isStay ? `/guest-stay/${reservation.id}` : `/reservations/${reservation.id}`;
            const folioNumber = folio?.folioNumber || reservation.folioNumber;
            return (
              <Paper key={reservation.id} radius={radius.md} p={12} style={{ background: '#ffffff', border: '1px solid #eef2f7' }}>
                <Group justify="space-between" align="flex-start" gap={spacing[3]}>
                  <Box>
                    <Group gap={8} mb={4}>
                      <Text c="#101828" fw={800} size="sm">
                        {reservation.reservationCode || reservation.id}
                      </Text>
                      <Badge color={status === 'CHECKED_OUT' ? 'gray' : status === 'CHECKED_IN' ? 'blue' : 'yellow'} variant="light">
                        {reservation.status.replace(/_/g, ' ')}
                      </Badge>
                      <Badge color={paymentStatus === 'PAID' ? 'green' : paymentStatus === 'PARTIALLY_PAID' ? 'yellow' : 'red'} variant="light">
                        {readableStatus(paymentStatus)}
                      </Badge>
                    </Group>
                    <Text c="#64748b" size="xs">
                      {reservation.arrivalDate} to {reservation.departureDate || '-'} - Room {reservation.roomNumber} - {reservation.roomType}
                      {folioNumber ? ` - Folio ${folioNumber}` : ''}
                    </Text>
                  </Box>
                  <Group gap={8}>
                    <Button component={Link} href={href} variant="light" color="stayosBrand" size="compact-sm">
                      {isStay ? 'View Stay' : 'View Booking'}
                    </Button>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <DetailTile label="Upcoming bookings" value={guest.upcomingBooking} />
          <DetailTile label="Past stays" value={guest.lastStay} />
        </SimpleGrid>
      )}
    </Section>
  );
}

export default function GuestProfilePage() {
  const params = useParams<{ guestId: string }>();
  const backend = useBackendStatus();
  const auth = useAuth();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuest = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guestState = useGuestDetails({ allowMockFallback, enabled: canLoadGuest, guestId: params.guestId });
  const [foliosByReservationId, setFoliosByReservationId] = useState<Record<string, Folio>>({});
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  useEffect(() => {
    const guest = guestState.guest;
    const reservations = guest?.reservations ?? [];
    if (!guestState.propertyId || !reservations.length) {
      setFoliosByReservationId({});
      return;
    }

    let cancelled = false;
    async function loadFolios() {
      const entries = await Promise.all(
        reservations.map(async (reservation) => {
          try {
            const folio = await getFolioForReservation(guestState.propertyId!, reservation.id);
            return [reservation.id, folio] as const;
          } catch {
            return undefined;
          }
        }),
      );
      if (cancelled) return;
      setFoliosByReservationId(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, Folio]>));
    }

    void loadFolios();
    return () => {
      cancelled = true;
    };
  }, [guestState.guest, guestState.propertyId]);

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && guestState.error && !guestState.isLoading && !guestState.guest) return <GenericError onAction={() => void guestState.refreshGuest()} onCheckStatus={checkBackendStatus} />;

  if (!guestState.guest) {
    return <Alert color="blue" variant="light" icon={<UserRound size={17} />} radius={radius.lg}>Loading guest profile...</Alert>;
  }

  const guest = guestState.guest;
  const canManageGuests = Boolean(auth.user?.permissions.includes('guests.manage') || auth.user?.permissions.includes('*'));

  return (
    <Stack gap={spacing[3]}>
      {guestState.isFallback && guestState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>Demo fallback is enabled, so this profile is sample data.</Alert>
      ) : null}
      <Header guest={guest} />
      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <ProfileDetails guest={guest} />
          <Preferences guest={guest} />
          <Documents
            canManageGuests={canManageGuests}
            guest={guest}
            onRefreshGuest={guestState.refreshGuest}
            propertyId={guestState.propertyId}
          />
          <Reservations foliosByReservationId={foliosByReservationId} guest={guest} />
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
