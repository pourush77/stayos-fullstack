'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Card, Stack, Title } from '@mantine/core';
import { ChevronLeft, CalendarDays } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { BookingForm } from './components/BookingForm';
import { friendlyBookingError, useBookingDetails, useBookings } from './hooks/useBookings';
import type { BookingFormValues } from './types/booking.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

export function BookingFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ reservationId?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGuestId = mode === 'create' ? searchParams.get('guestId') ?? undefined : undefined;
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const bookings = useBookings({ allowMockFallback, enabled: mode === 'create' && enabled });
  const details = useBookingDetails({ allowMockFallback, bookingId: params.reservationId, enabled: mode === 'edit' && enabled });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (mode === 'edit' && !allowMockFallback && details.error && !details.isLoading && !details.booking) return <GenericError onAction={() => void details.refreshBooking()} onCheckStatus={checkBackendStatus} />;
  if (mode === 'edit' && !details.booking) return <Alert color="blue" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>Loading booking...</Alert>;

  const submit = async (values: BookingFormValues) => {
    setIsSubmitting(true);
    try {
      const booking = mode === 'create' ? await bookings.createBooking(values) : await details.updateBooking(values);
      showToast({ color: 'green', title: mode === 'create' ? 'Booking created' : 'Booking updated', message: mode === 'create' ? 'Booking created successfully.' : 'Booking saved successfully.' });
      router.push(`/reservations/${booking.backendId}`);
    } catch (error) {
      showToast({ color: 'red', title: mode === 'create' ? 'Unable to create booking' : 'Unable to update booking', message: friendlyBookingError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack gap={spacing[3]}>
      <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={() => router.back()}>Back</Button>
      <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>{mode === 'create' ? 'New Booking' : 'Edit Booking'}</Title>
      <Card radius={radius.lg} p={20} style={cardStyle}>
        <BookingForm
          booking={details.booking}
          guests={mode === 'create' ? bookings.guests : details.guests}
          initialGuestId={initialGuestId}
          isEdit={mode === 'edit'}
          isSubmitting={isSubmitting}
          onCancel={() => router.back()}
          onSubmit={submit}
          roomTypes={mode === 'create' ? bookings.roomTypes : details.roomTypes}
        />
      </Card>
    </Stack>
  );
}
