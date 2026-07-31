'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Box, Button, Card, Group, NumberInput, Paper, Stack, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Baby, BedDouble, CalendarDays, Copy, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getPropertyRoomTypes } from '../../lib/inventory-api';
import { getAvailableRooms } from '../../lib/operations-api';
import { getProperties } from '../../lib/guest-api';
import { mapRoomTypeOption } from './utils/booking-mappers';
import type { RoomTypeOption } from './types/booking.types';

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

function calculateNights(arrival: string, departure: string) {
  if (!arrival || !departure) return 0;
  const start = new Date(`${arrival}T00:00:00`);
  const end = new Date(`${departure}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function AvailabilityPage() {
  const router = useRouter();
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const start = today();
    const end = new Date(start.getTime() + 86_400_000);
    return [start, end];
  });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const nights = calculateNights(arrivalDate, departureDate);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const properties = await getProperties(controller.signal);
        const active = properties.find((p) => (typeof p.status === 'string' ? p.status.toUpperCase() : 'ACTIVE') === 'ACTIVE') ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        if (!id) throw new Error('No active property.');
        setPropertyId(id);
        const rts = await getPropertyRoomTypes(id, controller.signal);
        setRoomTypes(rts.map(mapRoomTypeOption));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError('Unable to load room types.');
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!propertyId || !arrivalDate || !departureDate) {
      setAvailability({});
      return;
    }
    setIsLoading(true);
    const controller = new AbortController();
    getAvailableRooms(propertyId, { arrivalDate, departureDate, guestCount: adults + children }, controller.signal)
      .then((rooms) => {
        const counts: Record<string, number> = {};
        rooms.forEach((room) => {
          counts[room.roomType.id] = (counts[room.roomType.id] ?? 0) + 1;
        });
        setAvailability(counts);
        setLoadError(undefined);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError('Unable to fetch availability.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [propertyId, arrivalDate, departureDate, adults, children]);

  const propertyName = useMemo(() => 'The Oberoi Grand', []);

  if (!backend.isOnline && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;
  if (!backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;

  const bookNow = (roomTypeId: string) => {
    const params = new URLSearchParams({
      arrivalDate,
      departureDate,
      adults: String(adults),
      children: String(children),
      roomTypeId,
    });
    router.push(`/reservations/new?${params.toString()}`);
  };

  const copyQuote = async (roomType: RoomTypeOption) => {
    const total = roomType.baseRate * nights;
    const message = `Hi! Here's your quote for ${propertyName}:\n${roomType.label} · ${formatShortDate(arrivalDate)} → ${formatShortDate(departureDate)} (${nights} night${nights === 1 ? '' : 's'})\n${formatCurrency(roomType.baseRate)}/night · Total ${formatCurrency(total)}\nReply YES to hold this rate.`;
    try {
      await navigator.clipboard.writeText(message);
      showToast({ color: 'green', title: 'Quote copied', message: 'Paste it into WhatsApp or SMS.' });
    } catch {
      showToast({ color: 'red', title: 'Copy failed', message: 'Try again from a secure origin.' });
    }
  };

  return (
    <Box py={spacing[5]} px={{ base: spacing[2], sm: spacing[4] }} style={{ background: 'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)', minHeight: 'calc(100vh - 180px)' }}>
      <Stack gap={spacing[3]} maw={960} mx="auto">
        <Stack gap={4}>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>Check Availability</Title>
          <Text c="#64748b" size="sm">Quick quote for walk-in and phone enquiries — no booking is created until you click Book.</Text>
        </Stack>

        <Card radius={radius.lg} p={20} style={quickCardStyle}>
          <Stack gap={spacing[3]}>
            <Group grow align="flex-end">
              <DatePickerInput
                clearable
                data-testid="availability-date-range"
                label="Stay dates"
                leftSection={<CalendarDays size={18} />}
                minDate={today()}
                onChange={(value) => setDateRange(value as [Date | null, Date | null])}
                placeholder="Select arrival → departure"
                size="md"
                type="range"
                value={dateRange}
              />
              <NumberInput
                data-testid="availability-adults"
                label="Adults"
                leftSection={<Users size={16} />}
                min={1}
                onChange={(value) => setAdults(Number(value) || 1)}
                size="md"
                value={adults}
              />
              <NumberInput
                data-testid="availability-children"
                label="Children"
                leftSection={<Baby size={16} />}
                min={0}
                onChange={(value) => setChildren(Number(value) || 0)}
                size="md"
                value={children}
              />
            </Group>
            {nights > 0 ? (
              <Group gap={8}>
                <Badge color="stayosBrand" variant="light">{nights} night{nights === 1 ? '' : 's'}</Badge>
                <Text c="#64748b" size="sm">
                  {formatShortDate(arrivalDate)} → {formatShortDate(departureDate)} · {adults} adult{adults === 1 ? '' : 's'}{children ? ` · ${children} child${children === 1 ? '' : 'ren'}` : ''}
                </Text>
              </Group>
            ) : null}
          </Stack>
        </Card>

        {loadError ? <Alert color="red" variant="light">{loadError}</Alert> : null}

        <Stack gap={8}>
          {roomTypes.map((roomType) => {
            const available = availability[roomType.id] ?? 0;
            const soldOut = nights > 0 && available === 0 && !isLoading;
            const total = roomType.baseRate * nights;
            return (
              <Card
                key={roomType.id}
                radius={radius.lg}
                p={16}
                style={{ ...quickCardStyle, opacity: soldOut ? 0.6 : 1 }}
                data-testid={`availability-room-${roomType.id}`}
              >
                <Group justify="space-between" wrap="nowrap" gap={16} align="center">
                  <Group gap={12} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    <Box
                      style={{
                        alignItems: 'center',
                        background: '#ede2ff',
                        borderRadius: 12,
                        display: 'flex',
                        flexShrink: 0,
                        height: 44,
                        justifyContent: 'center',
                        width: 44,
                      }}
                    >
                      <BedDouble size={20} color="#6536b5" />
                    </Box>
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Group gap={8}>
                        <Text fw={800} c="#101828">{roomType.label}</Text>
                        {nights > 0 ? (
                          <Badge
                            size="sm"
                            variant="light"
                            color={soldOut ? 'gray' : available <= 2 ? 'orange' : 'green'}
                          >
                            {soldOut ? 'Sold out' : `${available} available`}
                          </Badge>
                        ) : null}
                      </Group>
                      <Text c="#64748b" size="sm">
                        {formatCurrency(roomType.baseRate)} / night
                        {nights > 0 ? ` · Total ${formatCurrency(total)} for ${nights} night${nights === 1 ? '' : 's'}` : ''}
                      </Text>
                    </Stack>
                  </Group>

                  <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Button
                      variant="subtle"
                      color="gray"
                      leftSection={<Copy size={14} />}
                      size="sm"
                      onClick={() => void copyQuote(roomType)}
                      disabled={nights === 0}
                      data-testid={`availability-quote-${roomType.id}`}
                    >
                      Copy quote
                    </Button>
                    <Button
                      color="stayosBrand"
                      size="sm"
                      onClick={() => bookNow(roomType.id)}
                      disabled={soldOut || nights === 0}
                      data-testid={`availability-book-${roomType.id}`}
                    >
                      Book now →
                    </Button>
                  </Group>
                </Group>
              </Card>
            );
          })}
          {roomTypes.length === 0 && !loadError ? (
            <Paper radius={radius.lg} p={20} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
              <Text c="#64748b" size="sm" ta="center">Loading room types...</Text>
            </Paper>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

export default AvailabilityPage;
