'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Box, Button, Card, Group, Select, Stack, Table, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { AlertCircle, CalendarDays, Edit, Plus, Search } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, EmptyData, GenericError, ServerStarting, useBackendStatus } from '@stayos/ui';
import { BookingStatusBadge, PaymentStatusBadge } from './components/BookingBadges';
import { bookingFilterOptions } from './constants/booking.constants';
import { useBookings } from './hooks/useBookings';
import type { Booking, BookingFilter } from './types/booking.types';
import { dateKey, formatStayDates, sourceLabel } from './utils/booking-formatters';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function nextAction(booking: Booking) {
  if (booking.status === 'PENDING') return 'Confirm Booking';
  if (booking.status === 'CONFIRMED' && booking.room === 'Unassigned') return 'Assign Room';
  if (booking.status === 'CONFIRMED') return 'Start Check In';
  if (booking.status === 'CHECKED_IN') return 'Open Stay';
  if (booking.status === 'CHECKED_OUT') return 'View Stay History';
  return 'View Only';
}

function matchesFilter(booking: Booking, filter: BookingFilter) {
  const today = dateKey(new Date());
  if (filter === 'arrivals-today') return booking.arrivalDate === today;
  if (filter === 'pending') return booking.status === 'PENDING';
  if (filter === 'confirmed') return booking.status === 'CONFIRMED';
  if (filter === 'checked-in') return booking.status === 'CHECKED_IN';
  if (filter === 'unassigned') return booking.room === 'Unassigned' && booking.status !== 'CANCELLED';
  if (filter === 'payment-due') return booking.paymentStatus === 'PAYMENT_DUE';
  if (filter === 'vip') return booking.isVip;
  if (filter === 'cancelled') return booking.status === 'CANCELLED';
  return true;
}

export default function BookingsPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const bookingState = useBookings({ allowMockFallback, enabled });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BookingFilter>('all');

  useEffect(() => {
    if (!enabled) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') void bookingState.refreshBookings();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [bookingState.refreshBookings, enabled]);

  const bookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookingState.bookings.filter((booking) => {
      const searchable = [booking.guestName, booking.bookingId, booking.phone, booking.roomType, sourceLabel(booking.source)].join(' ').toLowerCase();
      return (!normalized || searchable.includes(normalized)) && matchesFilter(booking, filter);
    });
  }, [bookingState.bookings, filter, query]);

  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();
  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>Bookings</Title>
        <Text c="#64748b" mt={spacing[1]} size="sm">Create bookings, assign rooms, start check-in, and track payment status.</Text>
        <Text c="#334155" mt={spacing[2]} size="sm" fw={600}>{bookingState.bookings.length} bookings - {bookingState.bookings.filter((booking) => booking.room === 'Unassigned').length} unassigned</Text>
      </Box>
      <Button component={Link} href="/reservations/new" color="stayosBrand" leftSection={<Plus size={16} />}>New Booking</Button>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') return <Stack gap={spacing[4]}>{pageHeader}<ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} /></Stack>;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') return <Stack gap={spacing[4]}>{pageHeader}<BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} /></Stack>;
  if (!allowMockFallback && bookingState.error && !bookingState.isLoading && bookingState.bookings.length === 0) return <Stack gap={spacing[4]}>{pageHeader}<GenericError onAction={() => void bookingState.refreshBookings()} onCheckStatus={checkBackendStatus} /></Stack>;

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}
      {bookingState.isLoading ? <Alert color="blue" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>Loading bookings...</Alert> : null}
      {bookingState.isFallback && bookingState.error ? <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>Demo fallback is enabled, so Bookings is showing sample data.</Alert> : null}

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} wrap="wrap">
          <TextInput leftSection={<Search size={15} />} placeholder="Search guest, booking ID, phone, room type or source..." value={query} onChange={(event) => setQuery(event.currentTarget.value)} style={{ flex: 1, minWidth: 280 }} />
          <Select data={bookingFilterOptions} value={filter} onChange={(value) => setFilter((value as BookingFilter | null) ?? 'all')} w={{ base: 180, md: 220 }} />
        </Group>
      </Card>

      {bookingState.bookings.length === 0 && !bookingState.isLoading ? (
        <EmptyData title="No bookings yet" detail="The active property has no bookings to show yet." />
      ) : bookings.length > 0 ? (
        <Card p={0} radius={radius.lg} style={{ ...cardStyle, overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={1080}>
            <Table verticalSpacing={13} horizontalSpacing={18}>
              <Table.Thead bg="#f8fafc">
                <Table.Tr>
                  {['Booking ID', 'Guest', 'Stay Dates', 'Room Type', 'Room', 'Status', 'Payment', 'Source', 'Next Action', 'Actions'].map((header) => (
                    <Table.Th key={header} style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>{header}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bookings.map((booking) => (
                  <Table.Tr key={booking.backendId}>
                    <Table.Td><Text component={Link} href={`/reservations/${booking.backendId}`} fw={800} c="#101828" style={{ textDecoration: 'none' }}>{booking.bookingId}</Text></Table.Td>
                    <Table.Td>
                      <Text fw={700}>{booking.guestName}</Text>
                      <Text c="#64748b" size="xs">{booking.phone}</Text>
                      {booking.isVip ? <Badge color="stayosBrand" variant="light" mt={5}>VIP</Badge> : null}
                    </Table.Td>
                    <Table.Td><Text size="sm">{formatStayDates(booking.arrivalDate, booking.departureDate)}</Text><Text c="#64748b" size="xs">{booking.nights} nights</Text></Table.Td>
                    <Table.Td><Text size="sm">{booking.roomType}</Text></Table.Td>
                    <Table.Td><Text size="sm">{booking.room}</Text></Table.Td>
                    <Table.Td><BookingStatusBadge status={booking.status} /></Table.Td>
                    <Table.Td><PaymentStatusBadge status={booking.paymentStatus} /></Table.Td>
                    <Table.Td><Text size="sm">{sourceLabel(booking.source)}</Text></Table.Td>
                    <Table.Td><Button component={Link} href={`/reservations/${booking.backendId}`} size="compact-sm" variant="light" color="stayosBrand">{nextAction(booking)}</Button></Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Button component={Link} href={`/reservations/${booking.backendId}`} size="compact-sm" variant="subtle" color="gray">View</Button>
                        <Button component={Link} href={`/reservations/${booking.backendId}/edit`} size="compact-sm" variant="subtle" color="gray" leftSection={<Edit size={14} />}>Edit</Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      ) : (
        <Card p={spacing[8]} ta="center" radius={radius.lg} style={cardStyle}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44} mx="auto"><Search size={20} /></ThemeIcon>
          <Title order={3} mt={spacing[4]} c="#101828">No bookings found</Title>
          <Text c="#64748b" mt={spacing[2]}>Try another guest, booking ID, source, or filter.</Text>
        </Card>
      )}
    </Stack>
  );
}
