'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Autocomplete, Box, Button, Card, Chip, Collapse, Group, Paper, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { CheckCircle2, ChevronDown, ChevronLeft, Mail, Phone, User, UserRound } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { friendlyGuestError, useGuestDetails, useGuests, type GuestFormValues } from '../../lib/guest-hooks';
import { GuestForm } from './components/GuestForm';
import { preferredLanguageOptions } from './constants/languages';
import { nationalityOptions } from './constants/nationalities';
import type { Guest } from './types/guest.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const quickCardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 32px rgba(15,23,42,0.06)',
};

function splitFullName(fullName: string) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const [firstName = '', ...rest] = trimmed.split(' ');

  return {
    displayName: trimmed,
    firstName,
    lastName: rest.join(' '),
  };
}

function nationalityFromPhone(phone: string) {
  const normalized = phone.replace(/\s+/g, '');
  if (normalized.startsWith('+91')) return 'Indian';
  if (normalized.startsWith('+1')) return 'American';
  if (normalized.startsWith('+44')) return 'British';
  if (normalized.startsWith('+61')) return 'Australian';
  if (normalized.startsWith('+971')) return 'Emirati';
  if (normalized.startsWith('+966')) return 'Saudi';
  if (normalized.startsWith('+65')) return 'Singaporean';
  if (normalized.startsWith('+60')) return 'Malaysian';
  if (normalized.startsWith('+66')) return 'Thai';
  if (normalized.startsWith('+977')) return 'Nepali';
  if (normalized.startsWith('+880')) return 'Bangladeshi';
  return '';
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      c="#64748b"
      pl={10}
      style={{
        borderLeft: '3px solid #7c3aed',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

function CreateGuestQuickForm({
  existingGuest,
  isSearching,
  isSubmitting,
  onCancel,
  onContinueCreating,
  onPhoneLookup,
  onSubmit,
}: {
  existingGuest?: Guest;
  isSearching: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onContinueCreating: () => void;
  onPhoneLookup: (phone: string) => void | (() => void);
  onSubmit: (values: GuestFormValues, redirectToBooking: boolean) => Promise<void>;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('English');
  const [showOtherLanguage, setShowOtherLanguage] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [email, setEmail] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [vipStatus, setVipStatus] = useState(false);
  const [blacklistStatus, setBlacklistStatus] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const suggestedNationality = useMemo(() => nationalityFromPhone(phone), [phone]);

  useEffect(() => {
    if (!nationality && suggestedNationality) setNationality(suggestedNationality);
  }, [nationality, suggestedNationality]);

  useEffect(() => onPhoneLookup(phone), [onPhoneLookup, phone]);

  const submit = async (redirectToBooking: boolean) => {
    const nameParts = splitFullName(fullName);
    const nextErrors = {
      fullName: nameParts.displayName ? undefined : 'Full name is required.',
      phone: phone.trim() ? undefined : 'Phone is required.',
    };
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.phone) return;

    await onSubmit(
      {
        alternatePhone,
        bedPreference: '',
        blacklistStatus,
        dietaryNotes: '',
        displayName: nameParts.displayName,
        email,
        firstName: nameParts.firstName,
        floorPreference: '',
        lastName: nameParts.lastName,
        nationality,
        notes: '',
        phone,
        preferredLanguage: language,
        roomPreference: '',
        smokingPreference: '',
        status: 'ACTIVE',
        vipStatus,
      },
      redirectToBooking,
    );
  };

  return (
    <Box
      py={spacing[5]}
      px={{ base: spacing[2], sm: spacing[4] }}
      style={{
        background: 'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)',
        minHeight: 'calc(100vh - 180px)',
      }}
    >
      <Stack gap={spacing[3]} maw={560} mx="auto">
        <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={onCancel}>
          Back
        </Button>
        <Card radius={radius.lg} p={{ base: 18, sm: 24 }} style={quickCardStyle}>
          <Stack gap={spacing[4]}>
            <Box>
              <Title order={1} c="#101828" style={{ fontSize: 28, fontWeight: 800 }}>New Guest</Title>
              <Text c="#64748b" size="sm" mt={4}>Fast capture for walk-ins and phone bookings.</Text>
            </Box>

            <Stack gap={spacing[3]}>
              <SectionLabel>Contact</SectionLabel>
              <TextInput
                autoFocus
                error={errors.fullName}
                label="Full name"
                leftSection={<User size={20} />}
                onChange={(event) => setFullName(event.currentTarget.value)}
                placeholder="Sachin Tendulkar"
                required
                size="xl"
                value={fullName}
              />
              <TextInput
                error={errors.phone}
                label="Phone"
                leftSection={<Phone size={18} />}
                onChange={(event) => setPhone(event.currentTarget.value)}
                placeholder="+91 98765 43210"
                required
                rightSection={isSearching ? <Text c="#64748b" size="xs">...</Text> : null}
                size="md"
                value={phone}
              />
              {existingGuest ? (
                <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Group justify="space-between" align="center" gap={spacing[2]}>
                    <Box>
                      <Text fw={800} size="sm">Guest exists: {existingGuest.fullName}</Text>
                      <Text c="#64748b" size="xs">{existingGuest.phone} - {existingGuest.email}</Text>
                    </Box>
                    <Group gap={6}>
                      <Button component="a" href={`/guests/${existingGuest.id}`} variant="light" color="stayosBrand" size="compact-sm">Use existing</Button>
                      <Button variant="subtle" color="gray" size="compact-sm" onClick={onContinueCreating}>Continue creating new</Button>
                    </Group>
                  </Group>
                </Paper>
              ) : null}
              <Stack gap={8}>
                <Text fw={700} size="sm">Language</Text>
                <Group gap={8}>
                  {['English', 'Hindi', 'हिन्दी'].map((option) => (
                    <Chip
                      key={option}
                      checked={language === option && !showOtherLanguage}
                      color="stayosBrand"
                      onChange={() => {
                        setLanguage(option);
                        setShowOtherLanguage(false);
                      }}
                      variant="light"
                    >
                      {option}
                    </Chip>
                  ))}
                  <Chip
                    checked={showOtherLanguage}
                    color="stayosBrand"
                    onChange={() => setShowOtherLanguage((current) => !current)}
                    variant="light"
                  >
                    Other
                  </Chip>
                </Group>
                <Collapse expanded={showOtherLanguage}>
                  <Autocomplete
                    data={preferredLanguageOptions}
                    label="Other language"
                    leftSection={<User size={16} />}
                    onChange={setLanguage}
                    value={language}
                  />
                </Collapse>
              </Stack>
            </Stack>

            <Stack gap={6}>
              <Button color="stayosBrand" loading={isSubmitting} onClick={() => void submit(true)} size="lg">
                Save & Create Booking →
              </Button>
              <Text c="#64748b" size="xs" ta="center">Guest saved. Booking form opens next.</Text>
              <Button variant="subtle" color="gray" loading={isSubmitting} onClick={() => void submit(false)}>
                Save only
              </Button>
              <Button
                variant="subtle"
                color="gray"
                justify="center"
                rightSection={<ChevronDown size={16} style={{ transform: showMore ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />}
                onClick={() => setShowMore((current) => !current)}
              >
                + Add more details
              </Button>
            </Stack>

            <Collapse expanded={showMore}>
              <Stack gap={spacing[3]} pt={spacing[2]}>
                <TextInput label="Email" leftSection={<Mail size={17} />} onChange={(event) => setEmail(event.currentTarget.value)} value={email} />
                <TextInput label="Alternate phone" leftSection={<Phone size={17} />} onChange={(event) => setAlternatePhone(event.currentTarget.value)} value={alternatePhone} />
                <Autocomplete
                  data={nationalityOptions}
                  label="Nationality"
                  leftSection={<User size={17} />}
                  onChange={setNationality}
                  placeholder={suggestedNationality ? `Suggested: ${suggestedNationality}` : 'Start typing nationality'}
                  value={nationality}
                />
                <Group grow>
                  <Switch checked={vipStatus} color="stayosBrand" label="VIP" onChange={(event) => setVipStatus(event.currentTarget.checked)} />
                  <Switch checked={blacklistStatus} color="red" label="Blacklisted" onChange={(event) => setBlacklistStatus(event.currentTarget.checked)} />
                </Group>
              </Stack>
            </Collapse>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}

export function GuestFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ guestId?: string }>();
  const router = useRouter();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guestList = useGuests({ allowMockFallback, enabled: mode === 'create' && enabled });
  const searchGuests = guestList.searchGuests;
  const guestDetails = useGuestDetails({ allowMockFallback, enabled: mode === 'edit' && enabled, guestId: params.guestId ?? '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchingGuest, setMatchingGuest] = useState<Guest | undefined>();
  const [ignoredMatchPhone, setIgnoredMatchPhone] = useState('');
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  const submit = async (values: GuestFormValues, redirectToBooking = false) => {
    setIsSubmitting(true);

    try {
      const guest = mode === 'create' ? await guestList.createGuest(values) : await guestDetails.updateGuest(values);
      showToast({
        autoClose: mode === 'create' ? 2000 : undefined,
        color: 'green',
        icon: <CheckCircle2 size={18} />,
        position: 'top-right',
        title: mode === 'create' ? 'Guest created' : 'Guest updated',
        message: `${guest.fullName} saved successfully.`,
      });
      if (mode === 'create') {
        window.setTimeout(() => {
          router.push(redirectToBooking ? `/reservations/new?guestId=${guest.id}` : `/guests/${guest.id}`);
        }, 2000);
      } else {
        router.push(`/guests/${guest.id}`);
      }
    } catch (error) {
      showToast({ color: 'red', title: mode === 'create' ? 'Unable to create guest' : 'Unable to update guest', message: friendlyGuestError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const searchExistingGuest = useCallback((phone: string) => {
    const trimmedPhone = phone.trim();
    if (mode !== 'create' || trimmedPhone.length < 4 || trimmedPhone === ignoredMatchPhone) {
      setMatchingGuest(undefined);
      setIsSearchingGuest(false);
      return;
    }

    setIsSearchingGuest(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void searchGuests(trimmedPhone, controller.signal)
        .then((guests) => setMatchingGuest(guests.find((guest) => guest.phone.replace(/\D/g, '').includes(trimmedPhone.replace(/\D/g, ''))) ?? guests[0]))
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setMatchingGuest(undefined);
        })
        .finally(() => setIsSearchingGuest(false));
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [ignoredMatchPhone, mode, searchGuests]);

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (mode === 'edit' && !allowMockFallback && guestDetails.error && !guestDetails.isLoading && !guestDetails.guest) {
    return <GenericError onAction={() => void guestDetails.refreshGuest()} onCheckStatus={checkBackendStatus} />;
  }

  if (mode === 'edit' && !guestDetails.guest) {
    return <Alert color="blue" variant="light" icon={<UserRound size={17} />} radius={radius.lg}>Loading guest profile...</Alert>;
  }

  if (mode === 'create') {
    return (
      <CreateGuestQuickForm
        existingGuest={matchingGuest}
        isSearching={isSearchingGuest}
        isSubmitting={isSubmitting}
        onCancel={() => router.back()}
        onContinueCreating={() => {
          setIgnoredMatchPhone(matchingGuest?.phone ?? '');
          setMatchingGuest(undefined);
        }}
        onPhoneLookup={searchExistingGuest}
        onSubmit={submit}
      />
    );
  }

  return (
    <Stack gap={spacing[3]}>
      <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={() => router.back()}>
        Back
      </Button>
      <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>
        Edit Guest
      </Title>
      <Card radius={radius.lg} p={20} style={cardStyle}>
        <GuestForm
          guest={guestDetails.guest}
          isSubmitting={isSubmitting}
          onCancel={() => router.back()}
          onSubmit={submit}
        />
      </Card>
    </Stack>
  );
}
