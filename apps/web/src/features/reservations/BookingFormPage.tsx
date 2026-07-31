'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Autocomplete, Avatar, Badge, Box, Button, Card, Collapse, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title, UnstyledButton } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Baby, BedDouble, CalendarDays, Check, ChevronDown, ChevronLeft, Mail, Phone, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { createPropertyGuest } from '../../lib/guest-api';
import { friendlyGuestError } from '../../lib/guest-hooks';
import { getAvailableRooms } from '../../lib/operations-api';
import { nationalityOptions } from '../guests/constants/nationalities';
import { BookingForm } from './components/BookingForm';
import { friendlyBookingError, useBookingDetails, useBookings } from './hooks/useBookings';
import type { BookingFormValues, BookingPaymentStatus, BookingSource, GuestOption, RoomTypeOption } from './types/booking.types';
import { mapGuestOption } from './utils/booking-mappers';

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

function initialsFor(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const phoneCountryOptions = [
  { code: '+91', label: 'India', length: 10, value: 'IN' },
  { code: '+1', label: 'United States', length: 10, value: 'US' },
  { code: '+44', label: 'United Kingdom', length: 10, value: 'GB' },
  { code: '+971', label: 'United Arab Emirates', length: 9, value: 'AE' },
  { code: '+65', label: 'Singapore', length: 8, value: 'SG' },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function CountryFlag({ country }: { country: string }) {
  const baseStyle = {
    border: '1px solid #cbd5e1',
    borderRadius: 3,
    height: 14,
    overflow: 'hidden',
    position: 'relative' as const,
    width: 20,
  };

  if (country === 'IN') {
    return (
      <Box
        aria-label="India flag"
        style={{
          ...baseStyle,
          background: 'linear-gradient(180deg, #ff9933 0 33%, #ffffff 33% 66%, #138808 66% 100%)',
        }}
      >
        <Box
          style={{
            background: '#000080',
            borderRadius: 999,
            height: 4,
            left: '50%',
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 4,
          }}
        />
      </Box>
    );
  }

  if (country === 'US') {
    return (
      <Box
        aria-label="United States flag"
        style={{
          ...baseStyle,
          background: 'repeating-linear-gradient(180deg, #b22234 0 2px, #ffffff 2px 4px)',
        }}
      >
        <Box style={{ background: '#3c3b6e', height: 8, left: 0, position: 'absolute', top: 0, width: 9 }} />
      </Box>
    );
  }

  if (country === 'GB') {
    return (
      <Box
        aria-label="United Kingdom flag"
        style={{
          ...baseStyle,
          background:
            'linear-gradient(90deg, transparent 42%, #ffffff 42% 58%, transparent 58%), linear-gradient(180deg, transparent 38%, #ffffff 38% 62%, transparent 62%), linear-gradient(90deg, transparent 46%, #c8102e 46% 54%, transparent 54%), linear-gradient(180deg, transparent 44%, #c8102e 44% 56%, transparent 56%), #012169',
        }}
      />
    );
  }

  if (country === 'AE') {
    return (
      <Box aria-label="United Arab Emirates flag" style={{ ...baseStyle, background: 'linear-gradient(90deg, #ff0000 0 25%, transparent 25%), linear-gradient(180deg, #00732f 0 33%, #ffffff 33% 66%, #000000 66% 100%)' }} />
    );
  }

  if (country === 'SG') {
    return (
      <Box aria-label="Singapore flag" style={{ ...baseStyle, background: 'linear-gradient(180deg, #ef3340 0 50%, #ffffff 50% 100%)' }}>
        <Box style={{ background: '#ffffff', borderRadius: 999, height: 5, left: 4, position: 'absolute', top: 2, width: 5 }} />
        <Box style={{ background: '#ef3340', borderRadius: 999, height: 5, left: 6, position: 'absolute', top: 2, width: 5 }} />
      </Box>
    );
  }

  return (
    <Box
      aria-label={`${country} country code`}
      style={{
        alignItems: 'center',
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: 4,
        color: '#475569',
        display: 'flex',
        fontSize: 9,
        fontWeight: 800,
        height: 16,
        justifyContent: 'center',
        width: 22,
      }}
    >
      {country}
    </Box>
  );
}

function calculateNights(arrivalDate: string, departureDate: string) {
  if (!arrivalDate || !departureDate) return 0;
  const start = new Date(`${arrivalDate}T00:00:00`);
  const end = new Date(`${departureDate}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function capacityMessage(roomType: RoomTypeOption, adults: number, children: number) {
  if (adults + children > roomType.capacity) {
    return `${roomType.label} fits up to ${roomType.capacity} guest${roomType.capacity === 1 ? '' : 's'}.`;
  }
  if (adults > roomType.maxAdults) {
    return `${roomType.label} allows up to ${roomType.maxAdults} adult${roomType.maxAdults === 1 ? '' : 's'}.`;
  }
  if (children > roomType.maxChildren) {
    return `${roomType.label} allows up to ${roomType.maxChildren} child${roomType.maxChildren === 1 ? '' : 'ren'}.`;
  }
  return undefined;
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
  initialArrival,
  initialDeparture,
  initialRoomTypeId,
  initialAdults,
  initialChildren,
  isSubmitting,
  onCancel,
  onSubmit,
  propertyId,
  roomTypes,
}: {
  guests: GuestOption[];
  initialGuestId?: string;
  initialArrival?: string;
  initialDeparture?: string;
  initialRoomTypeId?: string;
  initialAdults?: number;
  initialChildren?: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: BookingFormValues) => Promise<void>;
  propertyId?: string;
  roomTypes: RoomTypeOption[];
}) {
  const datesRef = useRef<HTMLDivElement>(null);
  const roomsRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const initialGuestWasProvided = useRef(Boolean(initialGuestId));
  const [guestId, setGuestId] = useState(initialGuestId ?? '');
  const [createdGuests, setCreatedGuests] = useState<GuestOption[]>([]);
  const [newGuestOpen, setNewGuestOpen] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState('');
  const [newGuestLastName, setNewGuestLastName] = useState('');
  const [newGuestCountry, setNewGuestCountry] = useState('IN');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [newGuestNationality, setNewGuestNationality] = useState('Indian');
  const [newGuestError, setNewGuestError] = useState('');
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const parse = (v?: string) => (v ? new Date(`${v}T00:00:00`) : null);
    return [parse(initialArrival), parse(initialDeparture)];
  });
  const [roomTypeId, setRoomTypeId] = useState(initialRoomTypeId ?? '');
  const [adults, setAdults] = useState(initialAdults ?? 1);
  const [children, setChildren] = useState(initialChildren ?? 0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [source, setSource] = useState<BookingSource>('DIRECT');
  const [paymentIntent, setPaymentIntent] = useState<'CHECKOUT' | 'FULL' | 'PARTIAL'>('CHECKOUT');
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus>('PAYMENT_DUE');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'WALLET' | 'OTHER'>('CASH');
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<{ dates?: string; roomTypeId?: string }>({});
  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const nights = calculateNights(arrivalDate, departureDate);
  const allGuests = useMemo(() => [...createdGuests, ...guests], [createdGuests, guests]);
  const guest = allGuests.find((item) => item.id === guestId);
  const selectedPhoneCountry = phoneCountryOptions.find((item) => item.value === newGuestCountry) ?? phoneCountryOptions[0];
  const selectedRoomType = roomTypes.find((item) => item.id === roomTypeId);
  const total = (selectedRoomType?.baseRate ?? 0) * nights;
  const guestComplete = Boolean(guestId);
  const datesComplete = nights > 0;
  const roomComplete = Boolean(roomTypeId);

  useEffect(() => {
    if (!guestId || initialGuestWasProvided.current) return;
    datesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [guestId]);

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
    void getAvailableRooms(propertyId, { adults, arrivalDate, children, departureDate, guestCount: adults + children }, controller.signal)
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

  const createInlineGuest = async () => {
    const firstName = newGuestFirstName.trim();
    const lastName = newGuestLastName.trim();
    const phoneDigits = digitsOnly(newGuestPhone);
    if (!firstName || !lastName || !phoneDigits) {
      setNewGuestError('First name, last name, and phone are required.');
      return;
    }
    if (phoneDigits.length !== selectedPhoneCountry.length) {
      setNewGuestError(`${selectedPhoneCountry.label} mobile numbers must be ${selectedPhoneCountry.length} digits.`);
      return;
    }
    if (newGuestEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newGuestEmail.trim())) {
      setNewGuestError('Enter a valid email address.');
      return;
    }
    if (!propertyId) {
      setNewGuestError('Property is still loading. Try again in a moment.');
      return;
    }

    setIsCreatingGuest(true);
    setNewGuestError('');
    try {
      const phone = `${selectedPhoneCountry.code}${phoneDigits}`;
      const createdGuest = mapGuestOption(await createPropertyGuest(propertyId, {
        email: newGuestEmail.trim().toLowerCase() || undefined,
        firstName,
        lastName,
        nationality: newGuestNationality.trim() || 'Indian',
        phone,
      }));
      setCreatedGuests((current) => [createdGuest, ...current.filter((item) => item.id !== createdGuest.id)]);
      setGuestId(createdGuest.id);
      setNewGuestOpen(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestNationality('Indian');
      setNewGuestPhone('');
      showToast({ color: 'green', title: 'Guest created', message: `${createdGuest.label} added to this booking.` });
    } catch (error) {
      const message = friendlyGuestError(error);
      setNewGuestError(message);
      showToast({ color: 'red', title: 'Unable to create guest', message });
    } finally {
      setIsCreatingGuest(false);
    }
  };

  const submit = async () => {
    const nextErrors = {
      dates: datesComplete ? undefined : 'Pick arrival and departure dates.',
      roomTypeId: !roomTypeId
        ? 'Choose a room type.'
        : selectedRoomType
          ? capacityMessage(selectedRoomType, adults, children)
          : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.dates || nextErrors.roomTypeId || !guestId) return;

    await onSubmit({
      adults,
      arrivalDate,
      children,
      departureDate,
      guestId,
      notes,
      paymentStatus,
      roomTypeId,
      source,
      specialRequests,
      deposit: paymentIntent !== 'CHECKOUT' && paymentAmount > 0
        ? { amount: paymentAmount, method: paymentMethod }
        : undefined,
    });
  };

  return (
    <Box py={spacing[5]} px={{ base: spacing[2], sm: spacing[4] }} style={{ background: 'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)', minHeight: 'calc(100vh - 180px)' }}>
      <Stack gap={spacing[3]} maw={820} mx="auto">
        <Button variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content" onClick={onCancel}>Back</Button>
        <Group justify="space-between" align="center" gap={spacing[2]}>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>New Booking</Title>
          {guest ? (
            <Badge
              color="stayosBrand"
              leftSection={<Avatar color="stayosBrand" radius="xl" size={20}>{initialsFor(guest.label)}</Avatar>}
              radius="xl"
              size="lg"
              variant="light"
            >
              {guest.label}
            </Badge>
          ) : null}
        </Group>

        <StepSection active={!guestComplete} complete={guestComplete} number={1} subtitle="Guest for this booking" title="Who?">
          {guest ? (
            <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Group justify="space-between" gap={spacing[2]}>
                <Group gap={10}>
                  <Avatar color="stayosBrand" radius="xl" size={34}>{initialsFor(guest.label)}</Avatar>
                  <Box>
                    <Text fw={800} size="sm">{guest.label}</Text>
                    <Text c="#64748b" size="xs">{guest.phone}</Text>
                  </Box>
                </Group>
                <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setGuestId('')}>
                  Change
                </Button>
              </Group>
            </Paper>
          ) : (
            <Select
              clearable
              data={allGuests.map((item) => ({
                label: `${item.label} - ${item.phone}`,
                value: item.id,
              }))}
              data-testid="booking-guest-select"
              label="Guest"
              nothingFoundMessage="No guests found"
              onChange={(value) => setGuestId(value ?? '')}
              placeholder="Search guest by name or phone"
              searchable
              value={guestId}
            />
          )}
          <Button
            data-testid="booking-guest-add-toggle"
            variant="subtle"
            color="gray"
            size="compact-sm"
            w="fit-content"
            onClick={() => {
              setNewGuestOpen((current) => !current);
              setNewGuestError('');
            }}
          >
            + Add new guest
          </Button>
          <Collapse expanded={newGuestOpen}>
            <Stack gap={spacing[2]}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <TextInput
                  data-testid="booking-new-guest-first-name"
                  label="First name"
                  onChange={(event) => setNewGuestFirstName(event.currentTarget.value)}
                  required
                  value={newGuestFirstName}
                />
                <TextInput
                  data-testid="booking-new-guest-last-name"
                  label="Last name"
                  onChange={(event) => setNewGuestLastName(event.currentTarget.value)}
                  required
                  value={newGuestLastName}
                />
                <TextInput
                  data-testid="booking-new-guest-email"
                  label="Email"
                  leftSection={<Mail size={16} />}
                  onChange={(event) => {
                    setNewGuestEmail(event.currentTarget.value);
                    setNewGuestError('');
                  }}
                  type="email"
                  value={newGuestEmail}
                />
                <Autocomplete
                  data={nationalityOptions}
                  data-testid="booking-new-guest-nationality"
                  label="Nationality"
                  onChange={(value) => setNewGuestNationality(value)}
                  value={newGuestNationality}
                />
              </SimpleGrid>
              <Box>
                <Text c="#212529" fw={500} size="sm" mb={4}>Mobile number <Text span c="red">*</Text></Text>
                <Group gap={spacing[2]} align="flex-start" wrap="nowrap">
                  <Select
                    data={phoneCountryOptions.map((item) => ({
                      label: `${item.label} ${item.code}`,
                      value: item.value,
                    }))}
                    renderOption={({ option }) => {
                      const country = phoneCountryOptions.find((item) => item.value === option.value);
                      return (
                        <Group gap={8} wrap="nowrap">
                          <CountryFlag country={option.value} />
                          <Text size="sm">{country ? `${country.label} ${country.code}` : option.label}</Text>
                        </Group>
                      );
                    }}
                    onChange={(value) => {
                      setNewGuestCountry(value ?? 'IN');
                      setNewGuestPhone('');
                      setNewGuestError('');
                    }}
                    leftSection={<CountryFlag country={selectedPhoneCountry.value} />}
                    styles={{ input: { paddingLeft: 42 } }}
                    value={newGuestCountry}
                    w={{ base: 220, sm: 235 }}
                  />
                  <TextInput
                    data-testid="booking-new-guest-phone"
                    error={newGuestError}
                    inputMode="numeric"
                    leftSection={<Phone size={16} />}
                    maxLength={selectedPhoneCountry.length}
                    onChange={(event) => {
                      setNewGuestPhone(digitsOnly(event.currentTarget.value).slice(0, selectedPhoneCountry.length));
                      setNewGuestError('');
                    }}
                    placeholder={`${selectedPhoneCountry.length} digit mobile number`}
                    required
                    style={{ flex: 1 }}
                    value={newGuestPhone}
                  />
                </Group>
              </Box>
              <Group justify="flex-end">
                <Button
                  data-testid="booking-new-guest-cancel"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setNewGuestOpen(false);
                    setNewGuestError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  color="stayosBrand"
                  data-testid="booking-new-guest-submit"
                  loading={isCreatingGuest}
                  onClick={() => void createInlineGuest()}
                >
                  Create guest
                </Button>
              </Group>
            </Stack>
          </Collapse>
        </StepSection>

        <Box ref={datesRef}>
        <StepSection active={guestComplete && !datesComplete} complete={datesComplete} number={2} subtitle="Pick your dates" title="When?">
          <DatePickerInput
            clearable
            error={errors.dates}
            leftSection={<CalendarDays size={18} />}
            minDate={today()}
            onChange={(value) => {
              setDateRange(value as [Date | null, Date | null]);
              setErrors((current) => ({ ...current, dates: undefined }));
            }}
            placeholder="Select arrival -> departure"
            size="xl"
            type="range"
            value={dateRange}
            w="100%"
          />
          {datesComplete ? (
            <Group gap={8}>
              <Badge color="stayosBrand" variant="light">{nights} night{nights === 1 ? '' : 's'}</Badge>
              <Text c="#64748b" size="sm">{nights} night{nights === 1 ? '' : 's'} · {formatShortDate(arrivalDate)} → {formatShortDate(departureDate)}</Text>
            </Group>
          ) : null}
        </StepSection>
        </Box>

        <Box ref={roomsRef}>
          <StepSection active={datesComplete && !roomComplete} complete={roomComplete} number={3} title="Room?">
            <Stack gap={8}>
              {roomTypes.map((roomType) => {
                const selected = roomType.id === roomTypeId;
                const available = availabilityCounts[roomType.id] ?? 0;
                const showAvailability = datesComplete && Object.keys(availabilityCounts).length > 0;
                const unavailableByCapacity = Boolean(capacityMessage(roomType, adults, children));
                const soldOut = unavailableByCapacity || (showAvailability && available === 0);
                return (
                  <UnstyledButton
                    key={roomType.id}
                    disabled={soldOut}
                    data-testid={`room-type-option-${roomType.id}`}
                    onClick={() => {
                      setRoomTypeId(roomType.id);
                      setErrors((current) => ({ ...current, roomTypeId: undefined }));
                    }}
                    style={{
                      background: selected ? '#f6f1ff' : '#ffffff',
                      border: `1px solid ${selected ? '#7d4dd6' : '#e2e8f0'}`,
                      borderRadius: 14,
                      cursor: soldOut ? 'not-allowed' : 'pointer',
                      opacity: soldOut ? 0.5 : 1,
                      padding: '12px 14px',
                      transition: 'background 120ms ease, border-color 120ms ease',
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap" gap={12}>
                      <Group gap={12} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        <Box
                          style={{
                            alignItems: 'center',
                            background: selected ? '#ede2ff' : '#f1f5f9',
                            borderRadius: 10,
                            display: 'flex',
                            flexShrink: 0,
                            height: 36,
                            justifyContent: 'center',
                            width: 36,
                          }}
                        >
                          <BedDouble size={18} color={selected ? '#6536b5' : '#475569'} />
                        </Box>
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Text fw={700} c="#101828" size="sm" lineClamp={1}>{roomType.label}</Text>
                          <Text c="#64748b" size="xs">{formatCurrency(roomType.baseRate)} / night</Text>
                        </Stack>
                      </Group>
                      <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                        {showAvailability ? (
                          <Badge
                            size="sm"
                            variant="light"
                            color={soldOut ? 'gray' : available <= 2 ? 'orange' : 'green'}
                          >
                            {unavailableByCapacity ? `Max ${roomType.maxAdults}A/${roomType.maxChildren}C` : soldOut ? 'Sold out' : `${available} left`}
                          </Badge>
                        ) : null}
                        <Box
                          style={{
                            alignItems: 'center',
                            background: selected ? '#7d4dd6' : 'transparent',
                            border: `1.5px solid ${selected ? '#7d4dd6' : '#cbd5e1'}`,
                            borderRadius: 999,
                            display: 'flex',
                            height: 20,
                            justifyContent: 'center',
                            transition: 'background 120ms ease, border-color 120ms ease',
                            width: 20,
                          }}
                        >
                          {selected ? <Check size={12} color="#ffffff" strokeWidth={3} /> : null}
                        </Box>
                      </Group>
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Stack>
            {errors.roomTypeId ? <Text c="red" size="sm">{errors.roomTypeId}</Text> : null}
            <SimpleGrid cols={{ base: 2 }} spacing={spacing[3]}>
              <NumberInput leftSection={<Users size={16} />} label="Adults" min={1} onChange={(value) => setAdults(Number(value) || 1)} size="md" value={adults} />
              <NumberInput leftSection={<Baby size={16} />} label="Children" min={0} onChange={(value) => setChildren(Number(value) || 0)} size="md" value={children} />
            </SimpleGrid>
          </StepSection>
        </Box>

        <Box ref={reviewRef}>
          <StepSection active={datesComplete && roomComplete} complete={false} number={4} title="Confirm">
            {datesComplete && roomComplete ? (
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
            ) : (
              <Paper radius={radius.md} p={16} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                <Text c="#64748b" size="sm">Pick dates and a room to see the total.</Text>
              </Paper>
            )}
            <Button variant="subtle" color="gray" rightSection={<ChevronDown size={16} />} onClick={() => setNotesOpen((current) => !current)}>+ Add notes / special requests</Button>
            <Collapse expanded={notesOpen}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Textarea label="Notes" minRows={3} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} />
                <Textarea label="Special requests" minRows={3} onChange={(event) => setSpecialRequests(event.currentTarget.value)} value={specialRequests} />
              </SimpleGrid>
            </Collapse>
            {/* Payment intent chooser — visible in Step 4 */}
            <Stack gap={8}>
              <Text fw={700} c="#101828" size="sm">How is the guest paying?</Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={8}>
                {[
                  { key: 'CHECKOUT' as const, label: 'Pay at checkout', hint: 'Collect the whole bill on the way out', status: 'PAYMENT_DUE' as BookingPaymentStatus },
                  { key: 'PARTIAL' as const, label: 'Partial deposit now', hint: 'Advance / holding amount', status: 'PARTIALLY_PAID' as BookingPaymentStatus },
                  { key: 'FULL' as const, label: 'Prepay full now', hint: 'Booking marked Paid', status: 'PAID' as BookingPaymentStatus },
                ].map((opt) => {
                  const selected = paymentIntent === opt.key;
                  return (
                    <UnstyledButton
                      key={opt.key}
                      onClick={() => {
                        setPaymentIntent(opt.key);
                        setPaymentStatus(opt.status);
                        if (opt.key === 'CHECKOUT') setPaymentAmount(0);
                        else if (opt.key === 'FULL') setPaymentAmount(total);
                        else if (opt.key === 'PARTIAL' && paymentAmount === 0) setPaymentAmount(Math.round(total * 0.3));
                      }}
                      data-testid={`booking-payment-intent-${opt.key.toLowerCase()}`}
                      style={{
                        background: selected ? '#f6f1ff' : '#ffffff',
                        border: `1px solid ${selected ? '#7d4dd6' : '#e2e8f0'}`,
                        borderRadius: 12,
                        padding: 12,
                        transition: 'background 120ms ease, border-color 120ms ease',
                      }}
                    >
                      <Text fw={700} c="#101828" size="sm">{opt.label}</Text>
                      <Text c="#64748b" size="xs">{opt.hint}</Text>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
              {paymentIntent !== 'CHECKOUT' ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                  <NumberInput
                    label="Amount to collect now"
                    min={0}
                    max={paymentIntent === 'FULL' ? undefined : total}
                    value={paymentAmount}
                    onChange={(v) => setPaymentAmount(Number(v) || 0)}
                    data-testid="booking-deposit-amount"
                  />
                  <Select
                    label="Method"
                    value={paymentMethod}
                    onChange={(v) => setPaymentMethod((v as typeof paymentMethod) ?? 'CASH')}
                    data={[
                      { label: 'Cash', value: 'CASH' },
                      { label: 'Card', value: 'CARD' },
                      { label: 'UPI', value: 'UPI' },
                      { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
                      { label: 'Wallet', value: 'WALLET' },
                      { label: 'Other', value: 'OTHER' },
                    ]}
                    data-testid="booking-deposit-method"
                  />
                </SimpleGrid>
              ) : null}
            </Stack>
            <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setAdvancedOpen((current) => !current)}>Change booking source</Button>
            <Collapse expanded={advancedOpen}>
              <Select data={[{ label: 'Direct', value: 'DIRECT' }, { label: 'Walk-in', value: 'WALK_IN' }, { label: 'OTA', value: 'OTA' }, { label: 'Corporate', value: 'CORPORATE' }]} label="Source" onChange={(value) => setSource((value as BookingSource | null) ?? 'DIRECT')} value={source} />
            </Collapse>
            <Stack gap={6}>
              <Button color="stayosBrand" disabled={!guestId || !datesComplete || !roomComplete} fullWidth loading={isSubmitting} onClick={() => void submit()} size="lg">Create Booking →</Button>
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
  const initialArrival = mode === 'create' ? searchParams.get('arrivalDate') ?? undefined : undefined;
  const initialDeparture = mode === 'create' ? searchParams.get('departureDate') ?? undefined : undefined;
  const initialRoomTypeId = mode === 'create' ? searchParams.get('roomTypeId') ?? undefined : undefined;
  const initialAdults = mode === 'create' ? Number(searchParams.get('adults')) || undefined : undefined;
  const initialChildren = mode === 'create' ? Number(searchParams.get('children')) || undefined : undefined;
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
        initialArrival={initialArrival}
        initialDeparture={initialDeparture}
        initialRoomTypeId={initialRoomTypeId}
        initialAdults={initialAdults}
        initialChildren={initialChildren}
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
