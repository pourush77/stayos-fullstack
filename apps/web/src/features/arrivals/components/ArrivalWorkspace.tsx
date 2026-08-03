'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  DoorOpen,
  Search,
  UserRound,
  UserPlus,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { GuestForm } from '../../guests/components/GuestForm';
import { BookingForm } from '../../reservations/components/BookingForm';
import type { Booking } from '../../reservations/types/booking.types';
import { formatStayDates, sourceLabel } from '../../reservations/utils/booking-formatters';
import { useArrival } from '../hooks/useArrival';
import type { ArrivalFlow } from '../types/arrival.types';
import { bookingDefaultsForGuest } from '../utils/arrival-mapper';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function flowCopy(flow: ArrivalFlow) {
  if (flow === 'reservation') {
    return {
      title: 'Reservation Found',
      detail: 'Search today\'s bookings, then continue to room assignment or check-in.',
      icon: <CalendarCheck size={20} />,
    };
  }

  if (flow === 'returning') {
    return {
      title: 'Returning Guest',
      detail: 'Find an existing guest, create a booking, then continue arrival.',
      icon: <UserRound size={20} />,
    };
  }

  return {
    title: 'Walk-In Guest',
    detail: 'Create a guest profile, then build a walk-in booking with smart defaults.',
    icon: <UserPlus size={20} />,
  };
}

function FlowSelector({ onSelect }: { onSelect: (flow: ArrivalFlow) => void }) {
  return (
    <Stack gap={spacing[4]}>
      <Box>
        <Title order={2} c="#101828" style={{ fontSize: 24, fontWeight: 800 }}>
          How is the guest arriving?
        </Title>
        <Text c="#64748b" mt={spacing[1]} size="sm">
          Choose the path that matches the guest at the desk.
        </Text>
      </Box>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
        {(['reservation', 'returning', 'walk-in'] as ArrivalFlow[]).map((flow) => {
          const copy = flowCopy(flow);

          return (
            <UnstyledButton key={flow} onClick={() => onSelect(flow)}>
              <Card radius={radius.lg} p={16} style={{ ...cardStyle, height: '100%' }}>
                <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
                  {copy.icon}
                </ThemeIcon>
                <Text c="#101828" mt={spacing[3]} fw={800}>
                  {copy.title}
                </Text>
                <Text c="#64748b" mt={spacing[1]} size="sm">
                  {copy.detail}
                </Text>
              </Card>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

function BookingResult({
  booking,
  onContinue,
}: {
  booking: Booking;
  onContinue: (booking: Booking) => void;
}) {
  return (
    <Paper radius={radius.lg} p={14} style={cardStyle}>
      <Group justify="space-between" align="flex-start" gap={spacing[3]}>
        <Box>
          <Group gap={8}>
            <Text c="#101828" fw={800}>{booking.guestName}</Text>
            {booking.isVip ? <Badge color="stayosBrand" variant="light">VIP</Badge> : null}
          </Group>
          <Text c="#64748b" size="sm" mt={4}>{booking.bookingId} - {formatStayDates(booking.arrivalDate, booking.departureDate)}</Text>
          <Text c="#64748b" size="sm">{booking.roomType} - {booking.room}</Text>
          <Text c="#64748b" size="sm">Payment: {booking.paymentStatus === 'PAID' ? 'Paid' : 'Payment Due'} - Source: {sourceLabel(booking.source)}</Text>
        </Box>
        <Group>
          <Button component="a" href={`/reservations/${booking.backendId}`} variant="subtle" color="gray">Open Booking</Button>
          <Button color="stayosBrand" onClick={() => onContinue(booking)}>Continue Arrival</Button>
        </Group>
      </Group>
    </Paper>
  );
}

function SearchStep({
  arrival,
}: {
  arrival: ReturnType<typeof useArrival>;
}) {
  const [query, setQuery] = useState('');
  const bookingResults = arrival.searchBookings(query);
  const guestResults = arrival.searchGuests(query);

  if (arrival.flow === 'reservation') {
    return (
      <Stack gap={spacing[4]}>
        <TextInput leftSection={<Search size={16} />} label="Find Booking" placeholder="Booking ID, guest name, phone or email" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <Stack gap={spacing[3]}>
          {bookingResults.length > 0 ? bookingResults.map((booking) => <BookingResult key={booking.backendId} booking={booking} onContinue={arrival.selectBooking} />) : <Text c="#64748b" size="sm">No bookings found.</Text>}
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[4]}>
      <TextInput leftSection={<Search size={16} />} label="Find Guest" placeholder="Guest name, phone or email" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <Stack gap={spacing[3]}>
        {guestResults.length > 0 ? (
          guestResults.map((guest) => (
            <Paper key={guest.id} radius={radius.lg} p={14} style={cardStyle}>
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Group gap={8}>
                    <Text c="#101828" fw={800}>{guest.label}</Text>
                    {guest.isVip ? <Badge color="stayosBrand" variant="light">VIP</Badge> : null}
                  </Group>
                  <Text c="#64748b" size="sm" mt={4}>{guest.phone} - {guest.email}</Text>
                  <Text c="#64748b" size="sm">Last Stay: Not connected - Preferred Room: Not connected</Text>
                </Box>
                <Button color="stayosBrand" onClick={() => arrival.selectGuest(guest.id)}>Create Booking</Button>
              </Group>
            </Paper>
          ))
        ) : (
          <Text c="#64748b" size="sm">No guests found.</Text>
        )}
      </Stack>
    </Stack>
  );
}

function RoomStep({ arrival }: { arrival: ReturnType<typeof useArrival> }) {
  const [roomId, setRoomId] = useState<string | null>(arrival.selectedRoomId ?? null);
  const [loading, setLoading] = useState(false);

  const loadRooms = async () => {
    setLoading(true);
    try {
      await arrival.loadRooms();
    } catch {
      showToast({ color: 'red', title: 'Unable to load rooms', message: 'Available rooms are temporarily unavailable.' });
    } finally {
      setLoading(false);
    }
  };

  const assign = async () => {
    if (!roomId) {
      showToast({ color: 'yellow', title: 'Select a room', message: 'Please select a room before continuing.' });
      return;
    }

    setLoading(true);
    try {
      await arrival.assignRoom(roomId);
      showToast({ color: 'green', title: 'Room assigned', message: 'Room assigned successfully.' });
    } catch {
      showToast({ color: 'red', title: 'Unable to assign room', message: 'Please try another room.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap={spacing[4]}>
      <Alert color="blue" variant="light" radius={radius.lg}>
        Assign a room before check-in. This uses the same available-room workflow as Bookings.
      </Alert>
      <Button variant="light" color="stayosBrand" loading={loading} onClick={() => void loadRooms()} leftSection={<BedDouble size={16} />}>Load Available Rooms</Button>
      <Select
        data={arrival.roomOptions.map((room) => ({ label: `${room.label} - ${room.roomType}`, value: room.id }))}
        label="Available room"
        onChange={setRoomId}
        value={roomId}
      />
      <Group justify="flex-end">
        <Button color="stayosBrand" loading={loading} onClick={() => void assign()}>Assign Room</Button>
      </Group>
    </Stack>
  );
}

function CheckInStep({ arrival, onStart }: { arrival: ReturnType<typeof useArrival>; onStart: () => void }) {
  const start = () => {
    if (!arrival.booking || arrival.booking.room === 'Unassigned') {
      showToast({ color: 'yellow', title: 'Room required', message: 'Assign a room before check-in.' });
      return;
    }

    onStart();
  };

  return (
    <Stack gap={spacing[4]}>
      <Alert color="green" variant="light" radius={radius.lg}>
        Booking and room are ready. Complete check-in to create the active stay.
      </Alert>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
          <Text c="#64748b" size="xs" fw={700}>Booking</Text>
          <Text c="#101828" fw={800}>{arrival.booking?.bookingId}</Text>
        </Paper>
        <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
          <Text c="#64748b" size="xs" fw={700}>Room</Text>
          <Text c="#101828" fw={800}>{arrival.booking?.room}</Text>
        </Paper>
      </SimpleGrid>
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={start} leftSection={<DoorOpen size={16} />}>Start Check In</Button>
      </Group>
    </Stack>
  );
}

export function ArrivalWorkspace({
  initialFlow,
  onClose,
  opened,
}: {
  initialFlow?: ArrivalFlow;
  onClose: () => void;
  opened: boolean;
}) {
  const router = useRouter();
  const arrival = useArrival({ enabled: opened });
  const [submitting, setSubmitting] = useState(false);
  const bookingSeed = useMemo(
    () => arrival.guest ? bookingDefaultsForGuest(arrival.guest.id, arrival.roomTypes) : undefined,
    [arrival.guest, arrival.roomTypes],
  );

  const close = () => {
    arrival.reset();
    onClose();
  };

  useEffect(() => {
    if (opened && initialFlow && arrival.step === 'select') {
      arrival.selectFlow(initialFlow);
    }
  }, [arrival, initialFlow, opened]);

  return (
    <Modal
      opened={opened}
      onClose={close}
      centered
      size="min(96vw, 980px)"
      title={<Text fw={800}>{initialFlow === 'walk-in' ? 'Walk-in Arrival' : 'New Arrival'}</Text>}
    >
      <Stack gap={spacing[4]}>
        {!initialFlow ? (
          <Group gap={8}>
            {['select', 'search', 'guest', 'booking', 'room', 'check-in', 'complete'].map((step) => (
              <Badge key={step} color={arrival.step === step ? 'stayosBrand' : 'gray'} variant={arrival.step === step ? 'filled' : 'light'} radius={radius.full} style={{ textTransform: 'none' }}>
                {step === 'check-in' ? 'Check In' : step.replace('-', ' ')}
              </Badge>
            ))}
          </Group>
        ) : null}

        {arrival.step === 'select' && !initialFlow ? <FlowSelector onSelect={arrival.selectFlow} /> : null}
        {arrival.step === 'search' ? <SearchStep arrival={arrival} /> : null}
        {arrival.step === 'guest' ? (
          <GuestForm
            isSubmitting={submitting}
            onCancel={() => arrival.setStep('select')}
            onSubmit={async (values) => {
              setSubmitting(true);
              try {
                await arrival.createGuest(values);
                showToast({ color: 'green', title: 'Guest created', message: 'Continue with the walk-in booking.' });
              } finally {
                setSubmitting(false);
              }
            }}
          />
        ) : null}
        {arrival.step === 'booking' && bookingSeed ? (
          <BookingForm
            key={`${bookingSeed.guestId}-${bookingSeed.arrivalDate}`}
            booking={bookingSeed}
            guests={arrival.guestOptions}
            isSubmitting={submitting}
            onCancel={() => arrival.setStep(arrival.flow === 'walk-in' ? 'guest' : 'search')}
            onSubmit={async (values) => {
              setSubmitting(true);
              try {
                await arrival.createBooking(values);
                showToast({ color: 'green', title: 'Booking created', message: 'Assign a room to continue arrival.' });
              } finally {
                setSubmitting(false);
              }
            }}
            roomTypes={arrival.roomTypes}
          />
        ) : null}
        {arrival.step === 'room' ? <RoomStep arrival={arrival} /> : null}
        {arrival.step === 'check-in' ? (
          <CheckInStep
            arrival={arrival}
            onStart={() => {
              const reservationId = arrival.booking?.backendId;
              close();
              if (reservationId) router.push(`/check-in?reservation=${reservationId}`);
            }}
          />
        ) : null}
        {arrival.step === 'complete' ? (
          <Stack align="center" gap={spacing[4]} py={spacing[6]}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={64}>
              <CheckCircle2 size={34} />
            </ThemeIcon>
            <Title order={2}>Guest successfully checked in.</Title>
          </Stack>
        ) : null}
      </Stack>
    </Modal>
  );
}
