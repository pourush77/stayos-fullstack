'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Box, Button, Card, Group, Modal, Paper, Select, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useParams } from 'next/navigation';
import { AlertCircle, BedDouble, CalendarDays, ChevronLeft, CreditCard, Edit, IdCard, NotebookText, UserRound, XCircle } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
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
  loading,
  onAssign,
  onClose,
  onLoadRooms,
  opened,
}: {
  loading: boolean;
  onAssign: (roomId: string) => Promise<void>;
  onClose: () => void;
  onLoadRooms: () => Promise<AvailableRoomOption[]>;
  opened: boolean;
}) {
  const [rooms, setRooms] = useState<AvailableRoomOption[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  const loadRooms = async () => {
    const nextRooms = await onLoadRooms();
    setRooms(nextRooms);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Assign Room" centered>
      <Stack gap={spacing[4]}>
        <Button variant="light" color="stayosBrand" onClick={() => void loadRooms()}>Load Available Rooms</Button>
        <Select data={rooms.map((room) => ({ label: `${room.label} - ${room.roomType}`, value: room.id }))} label="Room" onChange={setRoomId} value={roomId} />
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

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <Section title="Guest" icon={<UserRound size={17} />}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Guest name" value={booking.guestName} />
              <DetailTile label="Phone" value={booking.phone} />
              <DetailTile label="Email" value={booking.email} />
              <DetailTile label="Nationality" value={booking.nationality} />
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
              {booking.paymentStatus === 'PAYMENT_DUE' ? <Alert color="yellow" variant="light" radius={radius.md}>Payment is still pending.</Alert> : null}
              <Button disabled variant="light" color="gray">Collect Payment</Button>
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

      <AssignRoomModal loading={isActing} opened={assignOpened} onAssign={assignRoom} onClose={() => setAssignOpened(false)} onLoadRooms={bookingState.getRooms} />
    </Stack>
  );
}
