'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Group, Loader, Modal, Paper, Popover, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { useParams } from 'next/navigation';
import { AlertCircle, BedDouble, CalendarDays, Check, ChevronLeft, CreditCard, Edit, IdCard, NotebookText, ReceiptIndianRupee, UserRound, XCircle } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { updatePropertyGuest } from '../../lib/guest-api';
import { friendlyGuestError } from '../../lib/guest-hooks';
import { BookingStatusBadge, PaymentStatusBadge } from './components/BookingBadges';
import { friendlyBookingError, useBookingDetails } from './hooks/useBookings';
import type { AvailableRoomOption, Booking } from './types/booking.types';
import { bookingStatusLabel, formatStayDates, paymentStatusLabel, sourceLabel } from './utils/booking-formatters';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function DetailTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#64748b" size="xs" fw={700}>{label}</Text>
      <Text c="#182230" mt={3} size="sm" fw={700}>{value}</Text>
    </Paper>
  );
}

function isMissing(value: string) {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === 'not recorded' || normalized === 'guest not connected';
}

function BookingProgressStepper({ booking }: { booking: Booking }) {
  const hasRoom = booking.room !== 'Unassigned';
  const steps = [
    { complete: booking.status !== 'PENDING', current: booking.status === 'PENDING', label: 'Booked' },
    { complete: hasRoom, current: booking.status === 'CONFIRMED' && !hasRoom, label: 'Room Assigned' },
    { complete: booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT', current: booking.status === 'CONFIRMED' && hasRoom, label: 'Checked In' },
    { complete: booking.status === 'CHECKED_OUT', current: booking.status === 'CHECKED_IN', label: 'Checked Out' },
  ];

  return (
    <Paper data-testid="booking-progress-stepper" radius={radius.lg} p={10} style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
      <SimpleGrid cols={{ base: 1, sm: 4 }} spacing={8}>
        {steps.map((step) => (
          <Group
            key={step.label}
            gap={8}
            wrap="nowrap"
            p={10}
            style={{
              background: step.complete ? '#ecfdf3' : step.current ? '#f5f3ff' : '#f8fafc',
              border: `1px solid ${step.complete ? '#bbf7d0' : step.current ? '#ddd6fe' : '#e2e8f0'}`,
              borderRadius: radius.md,
            }}
          >
            <ThemeIcon color={step.complete ? 'green' : step.current ? 'stayosBrand' : 'gray'} radius="xl" size={24} variant={step.complete || step.current ? 'filled' : 'light'}>
              {step.complete ? <Check size={14} /> : null}
            </ThemeIcon>
            <Text c={step.complete ? '#166534' : step.current ? '#5b21b6' : '#64748b'} fw={800} size="sm">{step.label}</Text>
          </Group>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

function GuestFieldEditor({
  disabled,
  field,
  label,
  onSave,
  value,
}: {
  disabled: boolean;
  field: 'phone' | 'email' | 'nationality';
  label: string;
  onSave: (field: 'phone' | 'email' | 'nationality', value: string) => Promise<void>;
  value: string;
}) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isMissing(value)) return <>{value}</>;

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onSave(field, draft.trim());
      setOpened(false);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={260}>
      <Popover.Target>
        <Button
          data-testid={`booking-guest-add-${field}`}
          disabled={disabled}
          size="compact-sm"
          variant="subtle"
          color="stayosBrand"
          px={0}
          onClick={() => setOpened((current) => !current)}
        >
          + Add {label.toLowerCase()}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={spacing[2]}>
          <TextInput autoFocus label={label} onChange={(event) => setDraft(event.currentTarget.value)} value={draft} />
          <Button color="stayosBrand" loading={saving} disabled={!draft.trim()} onClick={() => void save()}>Save</Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function NextActionHero({
  booking,
  isActing,
  onAssignRoom,
  onCheckIn,
  onCheckOut,
}: {
  booking: Booking;
  isActing: boolean;
  onAssignRoom: () => void;
  onCheckIn: () => Promise<void>;
  onCheckOut: () => Promise<void>;
}) {
  if (booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') return null;

  const unassigned = booking.room === 'Unassigned';
  const title = unassigned ? 'Assign a room' : booking.status === 'CHECKED_IN' ? 'Ready for stay actions' : 'Start check-in';
  const explainer = unassigned
    ? 'Guest is expected today. Assign a room to continue.'
    : booking.status === 'CHECKED_IN'
      ? 'Guest is in-house. Keep billing and checkout close at hand.'
      : 'Room is assigned. Start check-in when the guest arrives.';

  return (
    <Card radius={radius.lg} p={20} style={{ background: '#6d28d9', border: '1px solid #5b21b6', color: '#ffffff' }}>
      <Group justify="space-between" align="center" gap={spacing[3]}>
        <Box>
          <Text fw={900} size="xl">{title}</Text>
          <Text c="rgba(255,255,255,0.82)" size="sm">{explainer}</Text>
        </Box>
        <Group gap={8}>
          {unassigned ? (
            <Button data-testid="booking-next-action-cta" color="white" c="#5b21b6" h={56} onClick={onAssignRoom}>Assign Room</Button>
          ) : booking.status === 'CHECKED_IN' ? (
            <>
              <Button component={Link} href={`/guest-stay/${booking.backendId}`} color="white" c="#5b21b6" h={56}>Add Charge</Button>
              <Button data-testid="booking-next-action-cta" variant="white" color="red" h={56} loading={isActing} onClick={() => void onCheckOut()}>Check Out</Button>
            </>
          ) : (
            <Button data-testid="booking-next-action-cta" color="white" c="#5b21b6" h={56} loading={isActing} onClick={() => void onCheckIn()}>Start Check-In</Button>
          )}
        </Group>
      </Group>
    </Card>
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

function primaryAction(booking: Booking) {
  if (booking.status === 'PENDING') return 'Confirm Booking';
  if (booking.status === 'CONFIRMED' && booking.room === 'Unassigned') return 'Assign Room';
  if (booking.status === 'CONFIRMED') return 'Start Check In';
  if (booking.status === 'CHECKED_IN') return 'Open Stay';
  if (booking.status === 'CHECKED_OUT') return 'View Stay History';
  return 'View Only';
}

function AssignRoomModal({
  booking,
  loading,
  onAssign,
  onClose,
  onLoadRooms,
  opened,
}: {
  booking: Booking;
  loading: boolean;
  onAssign: (roomId: string) => Promise<void>;
  onClose: () => void;
  onLoadRooms: () => Promise<AvailableRoomOption[]>;
  opened: boolean;
}) {
  const [rooms, setRooms] = useState<AvailableRoomOption[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!opened) return;

    let mounted = true;
    setIsLoadingRooms(true);
    setLoadError('');
    setRoomId(null);

    onLoadRooms()
      .then((nextRooms) => {
        if (!mounted) return;
        setRooms(nextRooms);
      })
      .catch(() => {
        if (!mounted) return;
        setRooms([]);
        setLoadError('Unable to load available rooms. Try again.');
      })
      .finally(() => {
        if (mounted) setIsLoadingRooms(false);
      });

    return () => {
      mounted = false;
    };
  }, [onLoadRooms, opened]);

  const emptyMessage = `${booking.roomType} has no ready rooms available for ${booking.adults + booking.children} guest${booking.adults + booking.children === 1 ? '' : 's'} from ${booking.arrivalDate} to ${booking.departureDate}. Try a different room type, reduce guest count, or mark a suitable room Ready from Rooms/Housekeeping.`;

  const retry = async () => {
    setIsLoadingRooms(true);
    setLoadError('');
    try {
      const nextRooms = await onLoadRooms();
      setRooms(nextRooms);
      setRoomId(null);
    } catch {
      setRooms([]);
      setLoadError('Unable to load available rooms. Try again.');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Assign Room" centered>
      <Stack gap={spacing[4]}>
        <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Text fw={800} size="sm">{booking.roomType}</Text>
          <Text c="#64748b" size="xs">{booking.arrivalDate} to {booking.departureDate} - {booking.adults} adult{booking.adults === 1 ? '' : 's'}{booking.children ? `, ${booking.children} child${booking.children === 1 ? '' : 'ren'}` : ''}</Text>
        </Paper>
        {isLoadingRooms ? (
          <Group gap={10}><Loader color="stayosBrand" size="sm" /><Text c="#64748b" size="sm">Checking ready rooms...</Text></Group>
        ) : loadError ? (
          <Alert color="red" radius={radius.md} title="Rooms could not be loaded">
            <Stack gap={spacing[2]}>
              <Text size="sm">{loadError}</Text>
              <Button color="red" variant="light" w="fit-content" onClick={() => void retry()}>Retry</Button>
            </Stack>
          </Alert>
        ) : rooms.length === 0 ? (
          <Alert color="yellow" radius={radius.md} title="No assignable rooms">
            {emptyMessage}
          </Alert>
        ) : (
          <Select data={rooms.map((room) => ({ label: `${room.label} - ${room.roomType}`, value: room.id }))} label="Room" onChange={setRoomId} placeholder="Choose a ready room" value={roomId} />
        )}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button color="stayosBrand" loading={loading} disabled={!roomId} onClick={() => roomId && void onAssign(roomId)}>Assign Room</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function BookingDetailPage() {
  const params = useParams<{ reservationId: string }>();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const bookingState = useBookingDetails({ allowMockFallback, bookingId: params.reservationId, enabled });
  const [cancelOpened, setCancelOpened] = useState(false);
  const [assignOpened, setAssignOpened] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && bookingState.error && !bookingState.isLoading && !bookingState.booking) return <GenericError onAction={() => void bookingState.refreshBooking()} onCheckStatus={checkBackendStatus} />;
  if (!bookingState.booking) return <Alert color="blue" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>Loading booking...</Alert>;

  const booking = bookingState.booking;
  const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const canChangeRoom = booking.status !== 'CHECKED_IN' && booking.status !== 'CHECKED_OUT' && booking.status !== 'CANCELLED';
  const guestFieldsDisabled = !booking.guestId || !bookingState.propertyId || bookingState.isFallback;

  const cancelBooking = async () => {
    setIsActing(true);
    try {
      await bookingState.cancelBooking();
      showToast({ color: 'green', title: 'Booking cancelled', message: 'The booking has been cancelled.' });
      setCancelOpened(false);
    } catch (error) {
      showToast({ color: 'red', title: 'Unable to cancel booking', message: friendlyBookingError(error) });
    } finally {
      setIsActing(false);
    }
  };

  const assignRoom = async (roomId: string) => {
    setIsActing(true);
    try {
      await bookingState.assignRoom(roomId);
      showToast({ color: 'green', title: 'Room assigned', message: 'Room assigned successfully.' });
      setAssignOpened(false);
    } catch (error) {
      showToast({ color: 'red', title: 'Unable to assign room', message: friendlyBookingError(error) });
    } finally {
      setIsActing(false);
    }
  };

  const checkInBooking = async () => {
    setIsActing(true);
    try {
      await bookingState.checkInBooking();
      showToast({ color: 'green', title: 'Checked in', message: 'The guest is now checked in.' });
    } catch (error) {
      showToast({ color: 'red', title: 'Unable to check in', message: friendlyBookingError(error) });
    } finally {
      setIsActing(false);
    }
  };

  const checkOutBooking = async () => {
    setIsActing(true);
    try {
      await bookingState.checkOutBooking();
      showToast({ color: 'green', title: 'Checked out', message: 'The guest is now checked out.' });
    } catch (error) {
      showToast({ color: 'red', title: 'Unable to check out', message: friendlyBookingError(error) });
    } finally {
      setIsActing(false);
    }
  };

  const saveGuestField = async (field: 'phone' | 'email' | 'nationality', value: string) => {
    if (!bookingState.propertyId || !booking.guestId) return;
    try {
      await updatePropertyGuest(bookingState.propertyId, booking.guestId, { [field]: value });
      await bookingState.refreshBooking();
      showToast({ color: 'green', title: 'Guest updated', message: `${field[0].toUpperCase()}${field.slice(1)} saved.` });
    } catch (error) {
      showToast({ color: 'red', title: 'Unable to update guest', message: friendlyGuestError(error) });
    }
  };

  return (
    <Stack gap={spacing[3]}>
      {bookingState.isFallback && bookingState.error ? <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>Demo fallback is enabled, so this booking is sample data.</Alert> : null}

      <Card radius={radius.lg} p={20} style={cardStyle}>
        <Group justify="space-between" align="flex-start" gap={spacing[4]}>
          <Stack gap={8}>
            <Button component={Link} href="/reservations" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">Back to Bookings</Button>
            <Group gap={8}><BookingStatusBadge status={booking.status} /><PaymentStatusBadge status={booking.paymentStatus} />{booking.isVip ? <Text c="#7c3aed" size="xs" fw={800}>VIP</Text> : null}</Group>
            <Title order={1} c="#101828" style={{ fontSize: 34, fontWeight: 800 }}>{booking.bookingId}</Title>
            <Text c="#64748b" size="sm">{booking.guestName} - {formatStayDates(booking.arrivalDate, booking.departureDate)}</Text>
          </Stack>
          <Group gap={8}>
            {booking.status === 'CHECKED_IN' ? (
              <Button component={Link} href={`/guest-stay/${booking.backendId}`} color="stayosBrand">
                {primaryAction(booking)}
              </Button>
            ) : (
              <Button color="stayosBrand" onClick={() => booking.room === 'Unassigned' ? setAssignOpened(true) : undefined}>{primaryAction(booking)}</Button>
            )}
            <Button component={Link} href={`/reservations/${booking.backendId}/edit`} variant="light" color="stayosBrand" leftSection={<Edit size={16} />}>Edit Booking</Button>
            {canCancel ? <Button variant="subtle" color="red" leftSection={<XCircle size={16} />} onClick={() => setCancelOpened(true)}>Cancel Booking</Button> : null}
          </Group>
        </Group>
      </Card>

      <BookingProgressStepper booking={booking} />
      <NextActionHero
        booking={booking}
        isActing={isActing}
        onAssignRoom={() => setAssignOpened(true)}
        onCheckIn={checkInBooking}
        onCheckOut={checkOutBooking}
      />

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <Section title="Guest" icon={<UserRound size={17} />}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Guest name" value={booking.guestName} />
              <DetailTile label="Phone" value={<GuestFieldEditor disabled={guestFieldsDisabled} field="phone" label="Phone" onSave={saveGuestField} value={booking.phone} />} />
              <DetailTile label="Email" value={<GuestFieldEditor disabled={guestFieldsDisabled} field="email" label="Email" onSave={saveGuestField} value={booking.email} />} />
              <DetailTile label="Nationality" value={<GuestFieldEditor disabled={guestFieldsDisabled} field="nationality" label="Nationality" onSave={saveGuestField} value={booking.nationality} />} />
            </SimpleGrid>
            <Button component={Link} href={booking.guestId ? `/guests/${booking.guestId}` : '/guests'} mt={spacing[3]} variant="light" color="stayosBrand">Open Guest Profile</Button>
          </Section>

          <Section title="Stay Details" icon={<CalendarDays size={17} />}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
              <DetailTile label="Arrival date" value={booking.arrivalDate} />
              <DetailTile label="Departure date" value={booking.departureDate} />
              <DetailTile label="Nights" value={`${booking.nights}`} />
              <DetailTile label="Adults" value={`${booking.adults}`} />
              <DetailTile label="Children" value={`${booking.children}`} />
              <DetailTile label="Room type" value={booking.roomType} />
              <DetailTile label="Assigned room" value={booking.room} />
              <DetailTile label="Source" value={sourceLabel(booking.source)} />
              <DetailTile label="Special requests" value={booking.specialRequests || 'None'} />
            </SimpleGrid>
          </Section>

          <Section title="Room Assignment" icon={<BedDouble size={17} />}>
            {booking.status === 'CHECKED_IN' ? (
              <Alert color="blue" variant="light" radius={radius.md}>Room changes after check-in should happen from Stay.</Alert>
            ) : booking.room === 'Unassigned' ? (
              <Button color="stayosBrand" onClick={() => setAssignOpened(true)}>Assign Room</Button>
            ) : (
              <Group justify="space-between"><Text fw={700}>{booking.room}</Text>{canChangeRoom ? <Button variant="light" color="stayosBrand" onClick={() => setAssignOpened(true)}>Change Room</Button> : null}</Group>
            )}
          </Section>
        </Stack>

        <Stack gap={spacing[3]} style={{ gridColumn: 'span 4' }}>
          <Section title="Payment" icon={<CreditCard size={17} />}>
            <Stack gap={spacing[2]}>
              <PaymentStatusBadge status={booking.paymentStatus} />
              {booking.paymentStatus === 'PAYMENT_DUE' ? (
                <Button component={Link} href="/billing" data-testid="booking-collect-payment" color="stayosBrand" leftSection={<ReceiptIndianRupee size={16} />}>
                  Collect payment
                </Button>
              ) : null}
            </Stack>
          </Section>
          <Section title="Notes" icon={<NotebookText size={17} />}><Text size="sm" c="#334155">{booking.notes}</Text></Section>
          <Section title="Timeline" icon={<IdCard size={17} />}>
            <Stack gap={spacing[2]}>
              {['Booking created', booking.room !== 'Unassigned' ? 'Room assigned' : 'Room assignment pending', `${bookingStatusLabel(booking.status)} status`, `${paymentStatusLabel(booking.paymentStatus)} payment`].map((item) => <Text key={item} size="sm" c="#334155">- {item}</Text>)}
            </Stack>
          </Section>
        </Stack>
      </SimpleGrid>

      <Modal opened={cancelOpened} onClose={() => setCancelOpened(false)} centered title="Cancel booking?">
        <Stack gap={spacing[4]}>
          <Text>This will cancel the booking and release any assigned room. This cannot be used after check-in.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCancelOpened(false)}>Keep Booking</Button>
            <Button color="red" loading={isActing} onClick={() => void cancelBooking()}>Cancel Booking</Button>
          </Group>
        </Stack>
      </Modal>

      <AssignRoomModal booking={booking} loading={isActing} opened={assignOpened} onAssign={assignRoom} onClose={() => setAssignOpened(false)} onLoadRooms={bookingState.getRooms} />
    </Stack>
  );
}
