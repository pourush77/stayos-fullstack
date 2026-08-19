'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Baby, BedDouble, CalendarDays, ChevronLeft, Copy, RefreshCw, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getPropertyRoomTypes } from '../../lib/inventory-api';
import { getAvailableRooms } from '../../lib/operations-api';
import { quoteReservation, type ReservationQuoteDto } from '../../lib/reservation-api';
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
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

function formatShortDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
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
  const [propertyName, setPropertyName] = useState('this hotel');
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [quotes, setQuotes] = useState<Record<string, ReservationQuoteDto | null>>({});
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const start = today();
    const end = new Date(start.getTime() + 86_400_000);
    return [start, end];
  });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [isRoomTypesLoading, setIsRoomTypesLoading] = useState(true);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [roomTypesError, setRoomTypesError] = useState<string>();
  const [availabilityError, setAvailabilityError] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const nights = calculateNights(arrivalDate, departureDate);
  const hasValidStay = Boolean(arrivalDate && departureDate && nights > 0);

  const staySummary = useMemo(() => {
    if (!hasValidStay) return '';
    return `${formatShortDate(arrivalDate)} to ${formatShortDate(departureDate)} · ${adults} adult${
      adults === 1 ? '' : 's'
    }${children ? ` · ${children} child${children === 1 ? '' : 'ren'}` : ''}`;
  }, [adults, arrivalDate, children, departureDate, hasValidStay]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      setIsRoomTypesLoading(true);
      setRoomTypesError(undefined);

      try {
        const properties = await getProperties(controller.signal);
        const active =
          properties.find(
            (property) =>
              (typeof property.status === 'string' ? property.status.toUpperCase() : 'ACTIVE') ===
              'ACTIVE',
          ) ?? properties[0];

        const id = typeof active?.id === 'string' ? active.id : '';
        if (!id) throw new Error('No active property.');

        setPropertyId(id);

        const name =
          typeof active?.name === 'string'
            ? active.name
            : typeof active?.displayName === 'string'
              ? active.displayName
              : 'this hotel';
        setPropertyName(name);

        const result = await getPropertyRoomTypes(id, controller.signal);
        if (controller.signal.aborted) return;

        setRoomTypes(result.map(mapRoomTypeOption));
      } catch {
        if (controller.signal.aborted) return;
        setRoomTypes([]);
        setRoomTypesError('Unable to load room types. Try again.');
      } finally {
        if (!controller.signal.aborted) setIsRoomTypesLoading(false);
      }
    })();

    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!propertyId || !hasValidStay) {
      setAvailability({});
      setAvailabilityError(undefined);
      setIsAvailabilityLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsAvailabilityLoading(true);
    setAvailabilityError(undefined);

    void getAvailableRooms(
      propertyId,
      {
        adults,
        arrivalDate,
        children,
        departureDate,
        guestCount: adults + children,
      },
      controller.signal,
    )
      .then((rooms) => {
        if (controller.signal.aborted) return;

        const counts: Record<string, number> = {};
        rooms.forEach((room) => {
          counts[room.roomType.id] = (counts[room.roomType.id] ?? 0) + 1;
        });

        setAvailability(counts);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAvailability({});
        setAvailabilityError('Availability could not be checked. Try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAvailabilityLoading(false);
      });

    return () => controller.abort();
  }, [propertyId, arrivalDate, departureDate, adults, children, hasValidStay, refreshKey]);

  // Backend-authoritative quote per room type — the same pricing the booking
  // form and created reservation use. No local rate or tax rules are invented here.
  useEffect(() => {
    if (!propertyId || !hasValidStay || roomTypes.length === 0) {
      setQuotes({});
      setIsQuoteLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    // Clear previous quotes so stale rates never appear current after search inputs change.
    setQuotes({});
    setIsQuoteLoading(true);

    void Promise.all(
      roomTypes.map(async (roomType) => {
        try {
          const quote = await quoteReservation(
            propertyId,
            {
              arrivalDate,
              departureDate,
              adults,
              children,
              roomTypeId: roomType.id,
            },
            controller.signal,
          );
          return [roomType.id, quote] as const;
        } catch {
          return [roomType.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled || controller.signal.aborted) return;
      setQuotes(Object.fromEntries(entries));
      setIsQuoteLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    propertyId,
    arrivalDate,
    departureDate,
    adults,
    children,
    hasValidStay,
    roomTypes,
    refreshKey,
  ]);

  if (!backend.isOnline && backend.status === 'SERVER_STARTING') {
    return (
      <ServerStarting
        onAction={() => void backend.retry()}
        onCheckStatus={() => void backend.checkHealth()}
      />
    );
  }

  if (!backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <BackendUnavailable
        onAction={() => void backend.retry()}
        onCheckStatus={() => void backend.checkHealth()}
      />
    );
  }

  const retry = () => setRefreshKey((current) => current + 1);

  const bookNow = (roomTypeId: string) => {
    if (!hasValidStay || isAvailabilityLoading || availabilityError) return;

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
    const quote = quotes[roomType.id];

    if (!quote || quote.pricingStatus !== 'PRICED') {
      showToast({
        color: 'red',
        title: 'Live rate unavailable',
        message: 'This room type cannot be quoted for the selected stay yet.',
      });
      return;
    }

    const perNight = quote.nights > 0 ? Number(quote.roomCharges) / quote.nights : 0;
    const total = Number(quote.grandTotal);
    const taxText = quote.tax.applied ? ' incl. GST' : '';

    const message =
      `Hi! Here's your quote for ${propertyName}:\n` +
      `${roomType.label} · ${formatShortDate(arrivalDate)} to ${formatShortDate(departureDate)} ` +
      `(${nights} night${nights === 1 ? '' : 's'})\n` +
      `${formatCurrency(perNight)}/night · Total ${formatCurrency(total)}${taxText}\n` +
      `Subject to availability until booked.`;

    try {
      await navigator.clipboard.writeText(message);
      showToast({
        color: 'green',
        title: 'Quote copied',
        message: 'Paste it into WhatsApp, SMS or email.',
      });
    } catch {
      showToast({
        color: 'red',
        title: 'Unable to copy quote',
        message: 'Copying is not available in this browser context.',
      });
    }
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
      <Stack gap={spacing[3]} maw={960} mx="auto">
        <Group justify="space-between" align="flex-start" gap={spacing[3]} wrap="wrap">
          <Box style={{ minWidth: 0 }}>
            <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>
              Check Availability
            </Title>
            <Text c="#64748b" size="sm" mt={2}>
              Give a quick live quote for walk-in or phone enquiries. Nothing is booked until you
              choose Book now.
            </Text>
          </Box>

          <Group gap={8} wrap="wrap">
            <Button
              component={Link}
              href="/"
              variant="light"
              color="gray"
              leftSection={<ChevronLeft size={16} />}
            >
              Front Desk
            </Button>
            <Button
              component={Link}
              href="/reservations/group-quote"
              variant="light"
              color="stayosBrand"
            >
              Group Quote
            </Button>
          </Group>
        </Group>

        <Card radius={radius.lg} p={20} style={quickCardStyle}>
          <Stack gap={spacing[3]}>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
              <DatePickerInput
                clearable
                data-testid="availability-date-range"
                label="Stay dates"
                leftSection={<CalendarDays size={18} />}
                minDate={today()}
                onChange={(value) => setDateRange(value as [Date | null, Date | null])}
                placeholder="Choose arrival and departure"
                size="md"
                type="range"
                value={dateRange}
              />
              <NumberInput
                data-testid="availability-adults"
                label="Adults"
                leftSection={<Users size={16} />}
                min={1}
                onChange={(value) => setAdults(Math.max(1, Number(value) || 1))}
                size="md"
                value={adults}
              />
              <NumberInput
                data-testid="availability-children"
                label="Children"
                leftSection={<Baby size={16} />}
                min={0}
                onChange={(value) => setChildren(Math.max(0, Number(value) || 0))}
                size="md"
                value={children}
              />
            </SimpleGrid>

            {hasValidStay ? (
              <Group gap={8} wrap="wrap">
                <Badge color="stayosBrand" variant="light">
                  {nights} night{nights === 1 ? '' : 's'}
                </Badge>
                <Text c="#64748b" size="sm">
                  {staySummary}
                </Text>
                {isAvailabilityLoading || isQuoteLoading ? (
                  <Group gap={6} ml="auto">
                    <Loader size="xs" color="stayosBrand" />
                    <Text c="#64748b" size="xs">
                      Updating live results…
                    </Text>
                  </Group>
                ) : null}
              </Group>
            ) : (
              <Text c="#b45309" size="sm">
                Choose an arrival and a later departure date to check availability.
              </Text>
            )}
          </Stack>
        </Card>

        {roomTypesError ? (
          <Alert color="red" variant="light" title="Room types unavailable" withCloseButton={false}>
            <Group justify="space-between" gap={spacing[2]} wrap="wrap">
              <Text size="sm">{roomTypesError}</Text>
              <Button
                variant="subtle"
                color="red"
                size="compact-sm"
                leftSection={<RefreshCw size={14} />}
                onClick={retry}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : null}

        {availabilityError && !roomTypesError ? (
          <Alert color="orange" variant="light" title="Availability check failed">
            <Group justify="space-between" gap={spacing[2]} wrap="wrap">
              <Text size="sm">
                {availabilityError} No room is being shown as sold out until availability is
                confirmed.
              </Text>
              <Button
                variant="subtle"
                color="orange"
                size="compact-sm"
                leftSection={<RefreshCw size={14} />}
                onClick={retry}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : null}

        <Stack gap={8} aria-live="polite">
          {isRoomTypesLoading ? (
            <Paper
              radius={radius.lg}
              p={24}
              style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}
            >
              <Group justify="center" gap={8}>
                <Loader size="sm" color="stayosBrand" />
                <Text c="#64748b" size="sm">
                  Loading room types…
                </Text>
              </Group>
            </Paper>
          ) : null}

          {!isRoomTypesLoading &&
            roomTypes.map((roomType) => {
              const availabilityKnown =
                hasValidStay && !isAvailabilityLoading && !availabilityError;
              const available = availability[roomType.id] ?? 0;
              const soldOut = availabilityKnown && available === 0;
              const quote = quotes[roomType.id];
              const priced = quote?.pricingStatus === 'PRICED';
              const perNight =
                priced && quote.nights > 0 ? Number(quote.roomCharges) / quote.nights : 0;
              const total = priced ? Number(quote.grandTotal) : 0;
              const quotePending = hasValidStay && isQuoteLoading && !quote;
              const quoteUnavailable = hasValidStay && !isQuoteLoading && Boolean(quote) && !priced;
              const canBook =
                hasValidStay && availabilityKnown && !soldOut && !isAvailabilityLoading;

              let availabilityLabel = '';
              let availabilityColor: 'gray' | 'orange' | 'green' = 'gray';

              if (hasValidStay) {
                if (isAvailabilityLoading) {
                  availabilityLabel = 'Checking…';
                } else if (availabilityError) {
                  availabilityLabel = 'Not checked';
                  availabilityColor = 'orange';
                } else if (soldOut) {
                  availabilityLabel = 'Sold out';
                } else {
                  availabilityLabel = `${available} available`;
                  availabilityColor = available <= 2 ? 'orange' : 'green';
                }
              }

              return (
                <Card
                  key={roomType.id}
                  radius={radius.lg}
                  p={16}
                  style={{ ...quickCardStyle, opacity: soldOut ? 0.68 : 1 }}
                  data-testid={`availability-room-${roomType.id}`}
                >
                  <Group justify="space-between" gap={spacing[3]} align="center" wrap="wrap">
                    <Group gap={12} wrap="nowrap" style={{ minWidth: 220, flex: 1 }}>
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

                      <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                        <Group gap={8} wrap="wrap">
                          <Text fw={800} c="#101828" lineClamp={1}>
                            {roomType.label}
                          </Text>
                          {availabilityLabel ? (
                            <Badge size="sm" variant="light" color={availabilityColor}>
                              {availabilityLabel}
                            </Badge>
                          ) : null}
                        </Group>

                        <Text c="#64748b" size="sm">
                          {!hasValidStay
                            ? 'Choose dates to see live availability and price.'
                            : quotePending
                              ? 'Getting live price…'
                              : priced
                                ? `${formatCurrency(perNight)} / night · ${formatCurrency(total)} total${
                                    quote.tax.applied ? ' incl. GST' : ''
                                  }`
                                : quoteUnavailable
                                  ? quote?.blocker || 'Rate is not available for this stay.'
                                  : 'Live price could not be loaded.'}
                        </Text>
                      </Stack>
                    </Group>

                    <Group gap={8} wrap="wrap">
                      <Button
                        variant="subtle"
                        color="gray"
                        leftSection={<Copy size={14} />}
                        size="sm"
                        onClick={() => void copyQuote(roomType)}
                        disabled={!hasValidStay || !priced}
                        data-testid={`availability-quote-${roomType.id}`}
                      >
                        Copy quote
                      </Button>
                      <Button
                        color="stayosBrand"
                        size="sm"
                        onClick={() => bookNow(roomType.id)}
                        disabled={!canBook}
                        data-testid={`availability-book-${roomType.id}`}
                      >
                        {soldOut ? 'Sold out' : 'Book now'}
                      </Button>
                    </Group>
                  </Group>
                </Card>
              );
            })}

          {!isRoomTypesLoading && !roomTypesError && roomTypes.length === 0 ? (
            <Paper
              radius={radius.lg}
              p={20}
              style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}
            >
              <Text c="#64748b" size="sm" ta="center">
                No active room types are available for this property.
              </Text>
            </Paper>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

export default AvailabilityPage;
