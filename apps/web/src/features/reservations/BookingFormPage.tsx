'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Badge, Box, Button, Card, Collapse, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Baby, BedDouble, CalendarDays, ChevronDown, ChevronLeft, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getAvailableRooms } from '../../lib/operations-api';
import { BookingForm } from './components/BookingForm';
import { friendlyBookingError, useBookingDetails, useBookings } from './hooks/useBookings';
import type { BookingFormValues, BookingPaymentStatus, BookingSource, GuestOption, RoomTypeOption } from './types/booking.types';

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

function dateToValue(value: Date | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatShortDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { currency: 'INR', maximumFractionDigits: 0, style: 'currency' }).format(value);
}

function calculateNights(arrivalDate: string, departureDate: string) {
  if (!arrivalDate || !departureDate) return 0;
  const start = new Date(`${arrivalDate}T00:00:00`);
  const end = new Date(`${departureDate}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function StepSection({
  active,
  children,
  complete,
  number,
  subtitle,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  complete: boolean;
  number: number;
  subtitle?: string;
  title: string;
}) {
  return (
    <Card radius={radius.lg} p={20} style={quickCardStyle}>
      <Group align="flex-start" gap={spacing[3]} wrap="nowrap">
        <Badge circle color={complete ? 'green' : active ? 'stayosBrand' : 'gray'} size="lg">{number}</Badge>
        <Stack gap={spacing[3]} flex={1}>
          <Box pl={10} style={{ borderLeft: `3px solid ${active ? '#7c3aed' : '#cbd5e1'}` }}>
            <Title order={2} c="#101828" style={{ fontSize: 22, fontWeight: 800 }}>{title}</Title>
            {subtitle ? <Text c="#64748b" size="sm">{subtitle}</Text> : null}
          </Box>
          {children}
        </Stack>
      </Group>
    </Card>
  );
}

function QuickBookingForm({
  guests,
  initialGuestId,
  isSubmitting,
  onCancel,
  onSubmit,
  propertyId,
  roomTypes,
}: {
  guests: GuestOption[];
  initialGuestId?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: BookingFormValues) => Promise<void>;
  propertyId?: string;
  roomTypes: RoomTypeOption[];
}) {
  const roomsRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [source, setSource] = useState<BookingSource>('DIRECT');
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus>('PAYMENT_DUE');
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<{ dates?: string; roomTypeId?: string }>({});
  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const nights = calculateNights(arrivalDate, departureDate);
  const guest = guests.find((item) => item.id === initialGuestId);
  const selectedRoomType = roomTypes.find((item) => item.id === roomTypeId);
  const total = (selectedRoomType?.baseRate ?? 0) * nights;
  const datesComplete = nights > 0;
  const roomComplete = Boolean(roomTypeId);

  useEffect(() => {
    if (!datesComplete) return;
    roomsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [datesComplete]);

  useEffect(() => {
    if (!roomComplete) return;
    reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [roomComplete]);

  useEffect(() => {
    if (!propertyId || !arrivalDate || !departureDate) {
      setAvailabilityCounts({});
      return;
    }

    const controller = new AbortController();
    void getAvailableRooms(propertyId, { arrivalDate, departureDate, guestCount: adults + children }, controller.signal)
      .then((rooms) => {
        const counts: Record<string, number> = {};
        rooms.forEach((room) => {
          counts[room.roomType.id] = (counts[room.roomType.id] ?? 0) + 1;
        });
        setAvailabilityCounts(counts);
      })
      .catch(() => setAvailabilityCounts({}));

    return () => controller.abort();
  }, [adults, arrivalDate, children, departureDate, propertyId]);

  const submit = async () => {
    const nextErrors = {
      dates: datesComplete ? undefined : 'Pick arrival and departure dates.',
      roomTypeId: roomTypeId ? undefined : 'Choose a room type.',
    };
    setErrors(nextErrors);
    if (nextErrors.dates || nextErrors.roomTypeId || !initialGuestId) return;

    await onSubmit({
      adults,
      arrivalDate,
      children,
      departureDate,
      guestId: initialGuestId,
      notes,
      paymentStatus,
      roomTypeId,
      source,
      specialRequests,
    });
  };

  return (
    <Box py={spacing[5]} px={{ base: spacing[2], sm: spacing[4] }} style={{ background: 'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)', minHeight: 'calc(100vh - 180px)' }}>
      <Stack gap={spacing[3]} maw={640} mx="auto">
        <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={onCancel}>Back</Button>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>New Booking</Title>

        <StepSection active={!datesComplete} complete={datesComplete} number={1} subtitle="Pick your dates" title="When?">
          <DatePickerInput
            clearable
            error={errors.dates}
            fullWidth
            minDate={today()}
            onChange={(value) => {
              setDateRange(value as [Date | null, Date | null]);
              setErrors((current) => ({ ...current, dates: undefined }));
            }}
            size="xl"
            type="range"
            value={dateRange}
          />
          {datesComplete ? (
            <Group gap={8}>
              <Badge color="stayosBrand" variant="light">{nights} night{nights === 1 ? '' : 's'}</Badge>
              <Text c="#64748b" size="sm">{nights} night{nights === 1 ? '' : 's'} · {formatShortDate(arrivalDate)} → {formatShortDate(departureDate)}</Text>
            </Group>
          ) : null}
        </StepSection>

        <Box ref={roomsRef}>
          <StepSection active={datesComplete && !roomComplete} complete={roomComplete} number={2} title="Room?">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              {roomTypes.map((roomType) => {
                const selected = roomType.id === roomTypeId;
                const available = availabilityCounts[roomType.id] ?? 0;
                return (
                  <Card
                    key={roomType.id}
                    component="button"
                    onClick={() => {
                      setRoomTypeId(roomType.id);
                      setErrors((current) => ({ ...current, roomTypeId: undefined }));
                    }}
                    p={16}
                    radius={radius.lg}
                    style={{
                      background: selected ? '#f5f3ff' : '#ffffff',
                      border: `1px solid ${selected ? '#7c3aed' : '#e2e8f0'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Stack gap={8}>
                      <BedDouble size={24} color={selected ? '#7c3aed' : '#475569'} />
                      <Text fw={800}>{roomType.label}</Text>
                      <Text c="#64748b" size="sm">{available} available</Text>
                      <Text c="#64748b" size="sm">{formatCurrency(roomType.baseRate)} / night</Text>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
            {errors.roomTypeId ? <Text c="red" size="sm">{errors.roomTypeId}</Text> : null}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <NumberInput leftSection={<Users size={18} />} label="Adults" min={1} onChange={(value) => setAdults(Number(value) || 1)} size="lg" value={adults} />
              <NumberInput leftSection={<Baby size={18} />} label="Children" min={0} onChange={(value) => setChildren(Number(value) || 0)} size="lg" value={children} />
            </SimpleGrid>
          </StepSection>
        </Box>

        <Box ref={reviewRef}>
          <StepSection active={datesComplete && roomComplete} complete={false} number={3} title="Confirm">
            <Paper radius={radius.md} p={16} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Stack gap={8}>
                <Text fw={900} c="#101828">{guest?.label ?? 'Guest'} · {nights || 0} nights · {selectedRoomType?.label ?? 'Room type'} · {formatCurrency(total)}</Text>
                <Text c="#64748b" size="sm">{formatShortDate(arrivalDate)} → {formatShortDate(departureDate)} · {adults} adult{adults === 1 ? '' : 's'}{children ? ` · ${children} child${children === 1 ? '' : 'ren'}` : ''}</Text>
                <Group justify="space-between">
                  <Text c="#64748b" size="sm">Total</Text>
                  <Text fw={900} size="xl">{formatCurrency(total)}</Text>
                </Group>
              </Stack>
            </Paper>
            {!initialGuestId ? <Text c="red" size="sm">Create this booking from a guest profile so the guest is prefilled.</Text> : null}
            <Button variant="subtle" color="gray" rightSection={<ChevronDown size={16} />} onClick={() => setNotesOpen((current) => !current)}>+ Add notes / special requests</Button>
            <Collapse expanded={notesOpen}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Textarea label="Notes" minRows={3} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} />
                <Textarea label="Special requests" minRows={3} onChange={(event) => setSpecialRequests(event.currentTarget.value)} value={specialRequests} />
              </SimpleGrid>
            </Collapse>
            <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setAdvancedOpen((current) => !current)}>Change source/payment</Button>
            <Collapse expanded={advancedOpen}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Select data={[{ label: 'Direct', value: 'DIRECT' }, { label: 'Walk-in', value: 'WALK_IN' }, { label: 'OTA', value: 'OTA' }, { label: 'Corporate', value: 'CORPORATE' }]} label="Source" onChange={(value) => setSource((value as BookingSource | null) ?? 'DIRECT')} value={source} />
                <Select data={[{ label: 'Payment Due', value: 'PAYMENT_DUE' }, { label: 'Paid', value: 'PAID' }]} label="Payment status" onChange={(value) => setPaymentStatus((value as BookingPaymentStatus | null) ?? 'PAYMENT_DUE')} value={paymentStatus} />
              </SimpleGrid>
            </Collapse>
            <Stack gap={6}>
              <Button color="stayosBrand" disabled={!datesComplete || !roomComplete || !initialGuestId} fullWidth loading={isSubmitting} onClick={() => void submit()} size="lg">Create Booking →</Button>
              <Text c="#64748b" size="xs" ta="center">Booking confirmed. You can assign a room next.</Text>
            </Stack>
          </StepSection>
        </Box>
      </Stack>
    </Box>
  );
}

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

  if (mode === 'create') {
    return (
      <QuickBookingForm
        guests={bookings.guests}
        initialGuestId={initialGuestId}
        isSubmitting={isSubmitting}
        onCancel={() => router.back()}
        onSubmit={submit}
        propertyId={bookings.propertyId}
        roomTypes={bookings.roomTypes}
      />
    );
  }

  return (
    <Stack gap={spacing[3]}>
      <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={() => router.back()}>Back</Button>
      <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>Edit Booking</Title>
      <Card radius={radius.lg} p={20} style={cardStyle}>
        <BookingForm
          booking={details.booking}
          guests={details.guests}
          initialGuestId={initialGuestId}
          isEdit
          isSubmitting={isSubmitting}
          onCancel={() => router.back()}
          onSubmit={submit}
          roomTypes={details.roomTypes}
        />
      </Card>
    </Stack>
  );
}
