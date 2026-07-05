'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button, Card, Stack, Title } from '@mantine/core';
import { ChevronLeft, UserRound } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { friendlyGuestError, useGuestDetails, useGuests, type GuestFormValues } from '../../lib/guest-hooks';
import { GuestForm } from './components/GuestForm';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

export function GuestFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ guestId?: string }>();
  const router = useRouter();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guestList = useGuests({ allowMockFallback, enabled: mode === 'create' && enabled });
  const guestDetails = useGuestDetails({ allowMockFallback, enabled: mode === 'edit' && enabled, guestId: params.guestId ?? '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  const submit = async (values: GuestFormValues) => {
    setIsSubmitting(true);

    try {
      const guest = mode === 'create' ? await guestList.createGuest(values) : await guestDetails.updateGuest(values);
      showToast({ color: 'green', title: mode === 'create' ? 'Guest created' : 'Guest updated', message: `${guest.fullName} saved successfully.` });
      router.push(`/guests/${guest.id}`);
    } catch (error) {
      showToast({ color: 'red', title: mode === 'create' ? 'Unable to create guest' : 'Unable to update guest', message: friendlyGuestError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (mode === 'edit' && !allowMockFallback && guestDetails.error && !guestDetails.isLoading && !guestDetails.guest) {
    return <GenericError onAction={() => void guestDetails.refreshGuest()} onCheckStatus={checkBackendStatus} />;
  }

  if (mode === 'edit' && !guestDetails.guest) {
    return <Alert color="blue" variant="light" icon={<UserRound size={17} />} radius={radius.lg}>Loading guest profile...</Alert>;
  }

  return (
    <Stack gap={spacing[3]}>
      <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={() => router.back()}>
        Back
      </Button>
      <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>
        {mode === 'create' ? 'New Guest' : 'Edit Guest'}
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
