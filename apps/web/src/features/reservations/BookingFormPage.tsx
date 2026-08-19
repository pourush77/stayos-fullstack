'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  Baby,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  Mail,
  Phone,
  Users,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import {
  BackendUnavailable,
  GenericError,
  ServerStarting,
  showToast,
  useBackendStatus,
} from '@stayos/ui';
import { createPropertyGuest } from '../../lib/guest-api';
import { friendlyGuestError } from '../../lib/guest-hooks';
import { getAvailableRooms } from '../../lib/operations-api';
import { getGuestPricingPolicy, type GuestPricingPolicyResponse } from '../rates/api/rates-api';
import { nationalityOptions } from '../guests/constants/nationalities';
import { BookingForm } from './components/BookingForm';
import { friendlyBookingError, useBookingDetails, useBookings } from './hooks/useBookings';
import type {
  BookingFormValues,
  BookingPaymentStatus,
  BookingSource,
  GuestOption,
  RoomTypeOption,
} from './types/booking.types';
import { mapGuestOption } from './utils/booking-mappers';
import { useReservationQuote } from './hooks/useReservationQuote';
import { roomCapacityLabel, roomCapacityMessage } from './utils/room-capacity';

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
  if (typeof value === 'string')
    return /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10)) ? value.slice(0, 10) : '';
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseDateValue(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || dateToValue(parsed) !== value) return null;
  return parsed;
}

function formatShortDate(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
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
        <Box
          style={{
            background: '#3c3b6e',
            height: 8,
            left: 0,
            position: 'absolute',
            top: 0,
            width: 9,
          }}
        />
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
      <Box
        aria-label="United Arab Emirates flag"
        style={{
          ...baseStyle,
          background:
            'linear-gradient(90deg, #ff0000 0 25%, transparent 25%), linear-gradient(180deg, #00732f 0 33%, #ffffff 33% 66%, #000000 66% 100%)',
        }}
      />
    );
  }

  if (country === 'SG') {
    return (
      <Box
        aria-label="Singapore flag"
        style={{
          ...baseStyle,
          background: 'linear-gradient(180deg, #ef3340 0 50%, #ffffff 50% 100%)',
        }}
      >
        <Box
          style={{
            background: '#ffffff',
            borderRadius: 999,
            height: 5,
            left: 4,
            position: 'absolute',
            top: 2,
            width: 5,
          }}
        />
        <Box
          style={{
            background: '#ef3340',
            borderRadius: 999,
            height: 5,
            left: 6,
            position: 'absolute',
            top: 2,
            width: 5,
          }}
        />
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

function resolveChildAgeLabel(
  age: number | undefined,
  policyResponse: GuestPricingPolicyResponse | null,
) {
  if (age === undefined || !Number.isInteger(age) || age < 0) return '';
  const policy = policyResponse?.policy;
  if (!policy?.ageBasedChildPricingEnabled || !policy.isActive) return '';
  if (age > policy.maximumChildAge) return 'Adult pricing applies';
  const band = policyResponse?.childAgeBands.find(
    (item) => item.isActive && age >= item.minAge && age <= item.maxAge,
  );
  if (!band) return 'No matching child age band';
  if (band.pricingMode === 'FREE') return 'No child charge';
  if (band.pricingMode === 'FIXED_PER_NIGHT') return 'Fixed child rate applies';
  if (band.pricingMode === 'PERCENT_OF_ROOM_RATE') {
    return `${Number(band.percentage ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}% of room rate`;
  }
  return 'Adult pricing applies';
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
        <Badge circle color={complete ? 'green' : active ? 'stayosBrand' : 'gray'} size="lg">
          {number}
        </Badge>
        <Stack gap={spacing[3]} flex={1}>
          <Box pl={10} style={{ borderLeft: `3px solid ${active ? '#7c3aed' : '#cbd5e1'}` }}>
            <Title order={2} c="#101828" style={{ fontSize: 22, fontWeight: 800 }}>
              {title}
            </Title>
            {subtitle ? (
              <Text c="#64748b" size="sm">
                {subtitle}
              </Text>
            ) : null}
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
  const [newGuestFieldErrors, setNewGuestFieldErrors] = useState<{
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>({});
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => [
    parseDateValue(initialArrival),
    parseDateValue(initialDeparture),
  ]);
  const [roomTypeId, setRoomTypeId] = useState(initialRoomTypeId ?? '');
  const [adults, setAdults] = useState(initialAdults ?? 1);
  const [children, setChildren] = useState(initialChildren ?? 0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [guestPricingPolicy, setGuestPricingPolicy] = useState<GuestPricingPolicyResponse | null>(
    null,
  );
  const [guestPricingPolicyLoadFailed, setGuestPricingPolicyLoadFailed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [source, setSource] = useState<BookingSource>('DIRECT');
  const [paymentIntent, setPaymentIntent] = useState<'CHECKOUT' | 'FULL' | 'PARTIAL'>('CHECKOUT');
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus>('PAYMENT_DUE');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'WALLET' | 'OTHER'
  >('CASH');
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<string, number>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [errors, setErrors] = useState<{
    childAges?: string;
    dates?: string;
    guestId?: string;
    roomTypeId?: string;
  }>({});
  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const nights = calculateNights(arrivalDate, departureDate);
  const allGuests = useMemo(() => [...createdGuests, ...guests], [createdGuests, guests]);
  const guest = allGuests.find((item) => item.id === guestId);
  const selectedPhoneCountry =
    phoneCountryOptions.find((item) => item.value === newGuestCountry) ?? phoneCountryOptions[0];
  const selectedRoomType = roomTypes.find((item) => item.id === roomTypeId);
  const selectedRoomCapacityError = selectedRoomType
    ? roomCapacityMessage(selectedRoomType, adults, children)
    : undefined;
  const childAgesReady =
    children === 0 ||
    (childAges.length === children && childAges.every((age) => Number.isInteger(age) && age >= 0));
  const {
    quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useReservationQuote({
    propertyId,
    arrivalDate,
    departureDate,
    adults,
    children,
    childAges,
    roomTypeId,
    enabled: nights > 0 && Boolean(roomTypeId) && childAgesReady,
  });
  const money = (value?: string) => Number(value ?? '0');
  const quotePriced = quote?.pricingStatus === 'PRICED';
  const quoteBlocker = quote?.blocker ?? null;
  const roomSubtotal = quote ? money(quote.roomCharges) + money(quote.extraAdultCharges) : 0;
  const childSubtotal = quote ? money(quote.childCharges) : 0;
  const subtotal = quote ? money(quote.taxableSubtotal) : 0;
  const taxAmount = quote ? money(quote.tax.totalTax) : 0;
  const total = quote ? money(quote.grandTotal) : 0;
  const depositSuggestion = quote ? money(quote.deposit.suggestedAmount) : 0;
  const taxLabel =
    quote && quote.tax.applied
      ? `GST ${Number(quote.tax.totalRate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`
      : 'GST';
  const guestComplete = Boolean(guestId);
  const datesComplete = nights > 0;
  const roomComplete = Boolean(roomTypeId);
  const childAgesRequired =
    Boolean(guestPricingPolicy?.policy.ageBasedChildPricingEnabled) && children > 0;
  const childAgesInvalid =
    childAgesRequired &&
    (childAges.length !== children || childAges.some((age) => !Number.isInteger(age) || age < 0));
  const selectedRoomInvalid = Boolean(selectedRoomCapacityError);
  const paymentAmountInvalid =
    paymentIntent !== 'CHECKOUT' &&
    (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > total);
  const remainingAfterPayment = Math.max(0, total - paymentAmount);

  useEffect(() => {
    setChildAges((current) => {
      if (children <= 0) return [];
      const next = current.slice(0, children);
      while (next.length < children) next.push(NaN);
      return next;
    });
  }, [children]);

  useEffect(() => {
    if (!propertyId) {
      setGuestPricingPolicy(null);
      setGuestPricingPolicyLoadFailed(false);
      return;
    }

    const controller = new AbortController();
    void getGuestPricingPolicy(propertyId, controller.signal)
      .then((policy) => {
        setGuestPricingPolicy(policy);
        setGuestPricingPolicyLoadFailed(false);
      })
      .catch(() => {
        setGuestPricingPolicy(null);
        setGuestPricingPolicyLoadFailed(true);
      });

    return () => controller.abort();
  }, [propertyId]);

  useEffect(() => {
    if (paymentIntent === 'FULL') {
      setPaymentAmount(total);
      setPaymentError('');
      return;
    }
    if (paymentIntent === 'CHECKOUT') {
      setPaymentAmount(0);
      setPaymentError('');
      return;
    }
    if (total > 0 && paymentAmount > total) {
      setPaymentAmount(total);
      setPaymentError('');
    }
  }, [paymentAmount, paymentIntent, total]);

  useEffect(() => {
    if (!guestId || initialGuestWasProvided.current) return;

    // Creating an inline guest closes the guest form at the same time that Step 2
    // becomes active. Wait until that collapse has finished, then scroll to an
    // explicit page position. Avoid focusing the date input here because browser
    // focus/datepicker behaviour can trigger a second scroll and push the page down.
    const handle = window.setTimeout(
      () => {
        const datesSection = datesRef.current;
        if (!datesSection) return;

        const headerOffset = 24;
        const targetTop = Math.max(
          0,
          window.scrollY + datesSection.getBoundingClientRect().top - headerOffset,
        );

        window.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        });
      },
      newGuestOpen ? 420 : 0,
    );

    return () => window.clearTimeout(handle);
  }, [guestId, newGuestOpen]);

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
      setAvailabilityError('');
      setAvailabilityLoading(false);
      return;
    }

    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError('');

    void getAvailableRooms(
      propertyId,
      { adults, arrivalDate, children, departureDate, guestCount: adults + children },
      controller.signal,
    )
      .then((rooms) => {
        const counts: Record<string, number> = {};
        rooms.forEach((room) => {
          counts[room.roomType.id] = (counts[room.roomType.id] ?? 0) + 1;
        });
        setAvailabilityCounts(counts);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAvailabilityCounts({});
        setAvailabilityError(
          'Room availability could not be checked. Pricing will confirm whether this stay can be booked.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      });

    return () => controller.abort();
  }, [adults, arrivalDate, children, departureDate, propertyId]);

  const createInlineGuest = async () => {
    const firstName = newGuestFirstName.trim();
    const lastName = newGuestLastName.trim();
    const phoneDigits = digitsOnly(newGuestPhone);
    const email = newGuestEmail.trim();

    const nextFieldErrors: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    } = {};

    if (!firstName) nextFieldErrors.firstName = 'First name is required.';
    if (!lastName) nextFieldErrors.lastName = 'Last name is required.';

    if (!phoneDigits) {
      nextFieldErrors.phone = 'Mobile number is required.';
    } else if (phoneDigits.length !== selectedPhoneCountry.length) {
      nextFieldErrors.phone = `${selectedPhoneCountry.label} mobile numbers must be ${selectedPhoneCountry.length} digits.`;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextFieldErrors.email = 'Enter a valid email address.';
    }

    setNewGuestFieldErrors(nextFieldErrors);
    setNewGuestError('');

    if (Object.keys(nextFieldErrors).length > 0) return;

    if (!propertyId) {
      setNewGuestError('Property is still loading. Try again in a moment.');
      return;
    }

    setIsCreatingGuest(true);
    setNewGuestError('');
    try {
      const phone = `${selectedPhoneCountry.code}${phoneDigits}`;
      const createdGuest = mapGuestOption(
        await createPropertyGuest(propertyId, {
          email: email.toLowerCase() || undefined,
          firstName,
          lastName,
          nationality: newGuestNationality.trim() || 'Indian',
          phone,
        }),
      );
      setCreatedGuests((current) => [
        createdGuest,
        ...current.filter((item) => item.id !== createdGuest.id),
      ]);
      setGuestId(createdGuest.id);
      setNewGuestOpen(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestNationality('Indian');
      setNewGuestPhone('');
      setNewGuestFieldErrors({});
      setNewGuestError('');
      showToast({
        color: 'green',
        title: 'Guest created',
        message: `${createdGuest.label} added to this booking.`,
      });
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
      childAges: childAgesInvalid ? 'Enter a whole age for every child.' : undefined,
      dates: datesComplete ? undefined : 'Pick arrival and departure dates.',
      guestId: guestId ? undefined : 'Select a guest before creating the booking.',
      roomTypeId: !roomTypeId
        ? 'Choose a room type.'
        : selectedRoomType
          ? selectedRoomCapacityError
          : undefined,
    };
    setErrors(nextErrors);
    const firstError =
      nextErrors.guestId ?? nextErrors.dates ?? nextErrors.roomTypeId ?? nextErrors.childAges;
    if (firstError) {
      showToast({
        color: 'red',
        title: 'Booking needs attention',
        message: firstError,
      });
      return;
    }

    if (paymentAmountInvalid) {
      const message =
        total <= 0
          ? 'Wait for the live total before recording a payment.'
          : `Enter an amount greater than ₹0 and not more than ${formatCurrency(total)}.`;
      setPaymentError(message);
      showToast({ color: 'red', title: 'Check payment amount', message });
      return;
    }

    setPaymentError('');
    await onSubmit({
      adults,
      arrivalDate,
      children,
      childAges: children > 0 ? childAges : undefined,
      departureDate,
      guestId,
      notes,
      paymentStatus,
      roomTypeId,
      ratePlanId: quote?.ratePlan?.id,
      source,
      specialRequests,
      deposit:
        paymentIntent !== 'CHECKOUT' && paymentAmount > 0
          ? { amount: paymentAmount, method: paymentMethod }
          : undefined,
    });
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
      <Stack gap={spacing[3]} maw={820} mx="auto">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<ChevronLeft size={16} />}
          px={0}
          w="fit-content"
          onClick={onCancel}
        >
          Back
        </Button>
        <Group justify="space-between" align="center" gap={spacing[2]}>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>
            New Booking
          </Title>
          {guest ? (
            <Badge
              color="stayosBrand"
              leftSection={
                <Avatar color="stayosBrand" radius="xl" size={20}>
                  {initialsFor(guest.label)}
                </Avatar>
              }
              radius="xl"
              size="lg"
              variant="light"
            >
              {guest.label}
            </Badge>
          ) : null}
        </Group>

        <StepSection
          active={!guestComplete}
          complete={guestComplete}
          number={1}
          subtitle="Guest for this booking"
          title="Who?"
        >
          {guest ? (
            <Paper
              radius={radius.md}
              p={12}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <Group justify="space-between" gap={spacing[2]}>
                <Group gap={10}>
                  <Avatar color="stayosBrand" radius="xl" size={34}>
                    {initialsFor(guest.label)}
                  </Avatar>
                  <Box>
                    <Text fw={800} size="sm">
                      {guest.label}
                    </Text>
                    <Text c="#64748b" size="xs">
                      {guest.phone}
                    </Text>
                  </Box>
                </Group>
                <Button
                  variant="subtle"
                  color="gray"
                  size="compact-sm"
                  onClick={() => setGuestId('')}
                >
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
              error={errors.guestId}
              label="Guest"
              nothingFoundMessage="No guests found"
              onChange={(value) => {
                setGuestId(value ?? '');
                setErrors((current) => ({ ...current, guestId: undefined }));
              }}
              placeholder="Search by name or mobile number"
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
              setNewGuestFieldErrors({});
            }}
          >
            Add new guest
          </Button>
          <Collapse expanded={newGuestOpen}>
            <Stack gap={spacing[2]}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <TextInput
                  data-testid="booking-new-guest-first-name"
                  error={newGuestFieldErrors.firstName}
                  label="First name"
                  onChange={(event) => {
                    setNewGuestFirstName(event.currentTarget.value);
                    setNewGuestFieldErrors((current) => ({ ...current, firstName: undefined }));
                  }}
                  required
                  value={newGuestFirstName}
                />
                <TextInput
                  data-testid="booking-new-guest-last-name"
                  error={newGuestFieldErrors.lastName}
                  label="Last name"
                  onChange={(event) => {
                    setNewGuestLastName(event.currentTarget.value);
                    setNewGuestFieldErrors((current) => ({ ...current, lastName: undefined }));
                  }}
                  required
                  value={newGuestLastName}
                />
                <TextInput
                  data-testid="booking-new-guest-email"
                  error={newGuestFieldErrors.email}
                  label="Email"
                  leftSection={<Mail size={16} />}
                  onChange={(event) => {
                    setNewGuestEmail(event.currentTarget.value);
                    setNewGuestFieldErrors((current) => ({ ...current, email: undefined }));
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
                <Text c="#212529" fw={500} size="sm" mb={4}>
                  Mobile number{' '}
                  <Text span c="red">
                    *
                  </Text>
                </Text>
                <Group gap={spacing[2]} align="flex-start" wrap="nowrap">
                  <Select
                    data={phoneCountryOptions.map((item) => ({
                      label: `${item.label} ${item.code}`,
                      value: item.value,
                    }))}
                    renderOption={({ option }) => {
                      const country = phoneCountryOptions.find(
                        (item) => item.value === option.value,
                      );
                      return (
                        <Group gap={8} wrap="nowrap">
                          <CountryFlag country={option.value} />
                          <Text size="sm">
                            {country ? `${country.label} ${country.code}` : option.label}
                          </Text>
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
                    error={newGuestFieldErrors.phone}
                    inputMode="numeric"
                    leftSection={<Phone size={16} />}
                    maxLength={selectedPhoneCountry.length}
                    onChange={(event) => {
                      setNewGuestPhone(
                        digitsOnly(event.currentTarget.value).slice(0, selectedPhoneCountry.length),
                      );
                      setNewGuestFieldErrors((current) => ({ ...current, phone: undefined }));
                      setNewGuestError('');
                    }}
                    placeholder={`${selectedPhoneCountry.length} digit mobile number`}
                    required
                    style={{ flex: 1 }}
                    value={newGuestPhone}
                  />
                </Group>
              </Box>
              {newGuestError ? (
                <Alert color="red" variant="light">
                  {newGuestError}
                </Alert>
              ) : null}
              <Group justify="flex-end">
                <Button
                  data-testid="booking-new-guest-cancel"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setNewGuestOpen(false);
                    setNewGuestError('');
                    setNewGuestFieldErrors({});
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

        <Box ref={datesRef} style={{ scrollMarginTop: 24 }}>
          <StepSection
            active={guestComplete && !datesComplete}
            complete={datesComplete}
            number={2}
            subtitle="Pick your dates"
            title="When?"
          >
            <DatePickerInput
              clearable
              error={errors.dates}
              leftSection={<CalendarDays size={18} />}
              minDate={today()}
              onChange={(value) => {
                setDateRange(value as [Date | null, Date | null]);
                setAvailabilityError('');
                setErrors((current) => ({ ...current, dates: undefined, roomTypeId: undefined }));
              }}
              placeholder="Choose check-in and check-out dates"
              size="xl"
              type="range"
              value={dateRange}
              w="100%"
            />
            {datesComplete ? (
              <Group gap={8}>
                <Badge color="stayosBrand" variant="light">
                  {nights} night{nights === 1 ? '' : 's'}
                </Badge>
                <Text c="#64748b" size="sm">
                  {nights} night{nights === 1 ? '' : 's'} · {formatShortDate(arrivalDate)} →{' '}
                  {formatShortDate(departureDate)}
                </Text>
              </Group>
            ) : null}
          </StepSection>
        </Box>

        <Box ref={roomsRef}>
          <StepSection
            active={datesComplete && !roomComplete}
            complete={roomComplete && !selectedRoomInvalid}
            number={3}
            subtitle="Choose a room type and confirm occupancy"
            title="Which room?"
          >
            <Stack gap={8}>
              {roomTypes.map((roomType) => {
                const selected = roomType.id === roomTypeId;
                const available = availabilityCounts[roomType.id] ?? 0;
                const showAvailability =
                  datesComplete &&
                  !availabilityLoading &&
                  !availabilityError &&
                  Object.keys(availabilityCounts).length > 0;
                const capacityError = roomCapacityMessage(roomType, adults, children);
                const unavailableByCapacity = Boolean(capacityError);
                const unavailable = unavailableByCapacity;
                const selectionInvalid = selected && unavailableByCapacity;
                return (
                  <UnstyledButton
                    key={roomType.id}
                    disabled={unavailable && !selected}
                    data-testid={`room-type-option-${roomType.id}`}
                    onClick={() => {
                      setRoomTypeId(roomType.id);
                      setErrors((current) => ({ ...current, roomTypeId: undefined }));
                    }}
                    style={{
                      background: selected ? (selectionInvalid ? '#fff7ed' : '#f6f1ff') : '#ffffff',
                      border: `1px solid ${
                        selectionInvalid ? '#f59e0b' : selected ? '#7d4dd6' : '#e2e8f0'
                      }`,
                      borderRadius: 14,
                      cursor: unavailable && !selected ? 'not-allowed' : 'pointer',
                      opacity: unavailable && !selected ? 0.5 : 1,
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
                          <Text fw={700} c="#101828" size="sm" lineClamp={1}>
                            {roomType.label}
                          </Text>
                          <Text c="#64748b" size="xs">
                            {roomCapacityLabel(roomType)}
                          </Text>
                        </Stack>
                      </Group>
                      <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                        {showAvailability || unavailableByCapacity ? (
                          <Badge
                            size="sm"
                            variant="light"
                            color={
                              unavailableByCapacity ? 'orange' : available <= 2 ? 'orange' : 'green'
                            }
                          >
                            {unavailableByCapacity
                              ? roomCapacityLabel(roomType)
                              : `${available} assignable`}
                          </Badge>
                        ) : null}
                        <Box
                          style={{
                            alignItems: 'center',
                            background: selected
                              ? selectionInvalid
                                ? '#f59e0b'
                                : '#7d4dd6'
                              : 'transparent',
                            border: `1.5px solid ${
                              selected ? (selectionInvalid ? '#f59e0b' : '#7d4dd6') : '#cbd5e1'
                            }`,
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
            {datesComplete && availabilityLoading ? (
              <Group gap={8} role="status" aria-live="polite">
                <Loader size="xs" color="stayosBrand" />
                <Text c="#64748b" size="sm">
                  Checking room assignment options…
                </Text>
              </Group>
            ) : null}
            {datesComplete && availabilityError ? (
              <Alert color="yellow" variant="light" radius={radius.md}>
                {availabilityError}
              </Alert>
            ) : null}
            {errors.roomTypeId ? (
              <Text c="red" size="sm">
                {errors.roomTypeId}
              </Text>
            ) : null}
            {selectedRoomCapacityError ? (
              <small style={{ color: '#b45309', display: 'block' }}>
                {selectedRoomCapacityError}
              </small>
            ) : null}
            <SimpleGrid cols={{ base: 2 }} spacing={spacing[3]}>
              <NumberInput
                leftSection={<Users size={16} />}
                label="Adults"
                min={1}
                max={20}
                clampBehavior="strict"
                onChange={(value) => {
                  setAdults(Number(value) || 1);
                  setErrors((current) => ({ ...current, roomTypeId: undefined }));
                }}
                size="md"
                value={adults}
              />
              <NumberInput
                leftSection={<Baby size={16} />}
                label="Children"
                min={0}
                max={20}
                clampBehavior="strict"
                onChange={(value) => {
                  setChildren(Number(value) || 0);
                  setErrors((current) => ({
                    ...current,
                    childAges: undefined,
                    roomTypeId: undefined,
                  }));
                }}
                size="md"
                value={children}
              />
            </SimpleGrid>
            {children > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                }}
              >
                {Array.from({ length: children }).map((_, index) => {
                  const age = childAges[index];
                  const label = resolveChildAgeLabel(age, guestPricingPolicy);
                  return (
                    <div key={index}>
                      <NumberInput
                        label={`Child ${index + 1} age`}
                        min={0}
                        max={guestPricingPolicy?.policy.maximumChildAge ?? 17}
                        clampBehavior="strict"
                        step={1}
                        allowDecimal={false}
                        value={Number.isNaN(age) ? undefined : age}
                        onChange={(value) => {
                          const numericValue = typeof value === 'number' ? value : Number(value);
                          setChildAges((current) => {
                            const next = current.slice(0, children);
                            next[index] = Number.isFinite(numericValue) ? numericValue : NaN;
                            return next;
                          });
                          setErrors((current) => ({ ...current, childAges: undefined }));
                        }}
                      />
                      {label ? (
                        <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>
                          {label}
                        </small>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {errors.childAges || childAgesInvalid ? (
              <small style={{ color: '#dc2626', display: 'block' }}>
                {errors.childAges ?? 'Enter a whole age for every child.'}
              </small>
            ) : null}
            {children > 0 && guestPricingPolicyLoadFailed ? (
              <small style={{ color: '#b45309', display: 'block' }}>
                Child pricing policy could not be loaded for this preview.
              </small>
            ) : null}
          </StepSection>
        </Box>

        <Box ref={reviewRef}>
          <StepSection
            active={datesComplete && roomComplete}
            complete={false}
            number={4}
            subtitle="Review price, payment and booking details"
            title="Review & create"
          >
            {datesComplete && roomComplete ? (
              <Paper
                radius={radius.md}
                p={16}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              >
                <Stack gap={8}>
                  <Text fw={900} c="#101828">
                    {guest?.label ?? 'Guest'} · {nights || 0} nights ·{' '}
                    {selectedRoomType?.label ?? 'Room type'}
                  </Text>
                  <Text c="#64748b" size="sm">
                    {formatShortDate(arrivalDate)} → {formatShortDate(departureDate)} · {adults}{' '}
                    adult{adults === 1 ? '' : 's'}
                    {children ? ` · ${children} child${children === 1 ? '' : 'ren'}` : ''}
                  </Text>
                  {quoteLoading && !quote ? (
                    <Group gap={8} data-testid="booking-quote-loading">
                      <Loader size="xs" color="stayosBrand" />
                      <Text c="#64748b" size="sm">
                        Getting the live price…
                      </Text>
                    </Group>
                  ) : quoteError ? (
                    <small
                      style={{ color: '#dc2626', display: 'block' }}
                      data-testid="booking-quote-error"
                    >
                      {quoteError} Check the stay details or try again.
                    </small>
                  ) : quote && !quotePriced ? (
                    <small
                      style={{ color: '#b45309', display: 'block' }}
                      data-testid="booking-quote-blocker"
                    >
                      {quoteBlocker ?? 'This stay cannot be priced yet.'}
                    </small>
                  ) : quote ? (
                    <Stack
                      gap={4}
                      data-testid="booking-quote-breakdown"
                      style={{ opacity: quoteLoading ? 0.6 : 1 }}
                    >
                      <Group justify="space-between">
                        <Text c="#64748b" size="sm">
                          Room charges
                        </Text>
                        <Text fw={800} data-testid="booking-quote-room">
                          {formatCurrency(roomSubtotal)}
                        </Text>
                      </Group>
                      {childSubtotal > 0 ? (
                        <>
                          <Group justify="space-between">
                            <span style={{ color: '#64748b', fontSize: 14 }}>Child charges</span>
                            <span style={{ color: '#101828', fontSize: 14, fontWeight: 800 }}>
                              {formatCurrency(childSubtotal)}
                            </span>
                          </Group>
                          <Group justify="space-between">
                            <span style={{ color: '#64748b', fontSize: 14 }}>Subtotal</span>
                            <span style={{ color: '#101828', fontSize: 14, fontWeight: 800 }}>
                              {formatCurrency(subtotal)}
                            </span>
                          </Group>
                        </>
                      ) : null}
                      {quote.tax.applied ? (
                        <Group justify="space-between">
                          <span style={{ color: '#64748b', fontSize: 14 }}>{taxLabel}</span>
                          <span style={{ color: '#101828', fontSize: 14, fontWeight: 800 }}>
                            {formatCurrency(taxAmount)}
                          </span>
                        </Group>
                      ) : null}
                      <Group
                        justify="space-between"
                        pt={8}
                        style={{ borderTop: '1px solid #e2e8f0' }}
                      >
                        <Text c="#101828" fw={900} size="sm">
                          Total payable
                        </Text>
                        <Text fw={900} size="xl" data-testid="booking-quote-total">
                          {formatCurrency(total)}
                        </Text>
                      </Group>
                      {quote.deposit.required ? (
                        <Group justify="space-between" pt={4}>
                          <span style={{ color: '#64748b', fontSize: 13 }}>
                            {quote.deposit.required ? 'Required deposit' : 'Suggested deposit'} (
                            {quote.deposit.policyType === 'PERCENTAGE'
                              ? `${quote.deposit.policyValue}%`
                              : 'fixed'}
                            )
                          </span>
                          <span
                            style={{ color: '#6536b5', fontSize: 13, fontWeight: 800 }}
                            data-testid="booking-quote-deposit"
                          >
                            {formatCurrency(depositSuggestion)}
                          </span>
                        </Group>
                      ) : null}
                      <Text c="#94a3b8" size="xs">
                        Rate plan {quote.ratePlan?.code ?? '—'} · prices from live hotel settings
                      </Text>
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            ) : (
              <Paper
                radius={radius.md}
                p={16}
                style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}
              >
                <Text c="#64748b" size="sm">
                  Pick dates and a room to see the total.
                </Text>
              </Paper>
            )}
            <Button
              variant="subtle"
              color="gray"
              rightSection={<ChevronDown size={16} />}
              onClick={() => setNotesOpen((current) => !current)}
            >
              Add notes or guest requests
            </Button>
            <Collapse expanded={notesOpen}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Textarea
                  label="Internal notes"
                  description="Visible to hotel staff"
                  placeholder="Operational notes for the team"
                  minRows={3}
                  onChange={(event) => setNotes(event.currentTarget.value)}
                  value={notes}
                />
                <Textarea
                  label="Guest requests"
                  description="Requests made by the guest"
                  placeholder="Late arrival, extra bed, accessibility needs…"
                  minRows={3}
                  onChange={(event) => setSpecialRequests(event.currentTarget.value)}
                  value={specialRequests}
                />
              </SimpleGrid>
            </Collapse>
            {/* Payment intent chooser — visible in Step 4 */}
            <Stack gap={8}>
              <Text fw={700} c="#101828" size="sm">
                When will payment be collected?
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={8}>
                {[
                  {
                    key: 'CHECKOUT' as const,
                    label: 'Collect later',
                    hint: 'Do not record a payment with this booking',
                    status: 'PAYMENT_DUE' as BookingPaymentStatus,
                  },
                  {
                    key: 'PARTIAL' as const,
                    label: 'Collect deposit now',
                    hint:
                      depositSuggestion > 0
                        ? `Property policy suggests ${formatCurrency(depositSuggestion)}`
                        : 'Record an advance payment',
                    status: 'PARTIALLY_PAID' as BookingPaymentStatus,
                  },
                  {
                    key: 'FULL' as const,
                    label: 'Collect full now',
                    hint: `Record ${formatCurrency(total)} now`,
                    status: 'PAID' as BookingPaymentStatus,
                  },
                ].map((opt) => {
                  const selected = paymentIntent === opt.key;
                  return (
                    <UnstyledButton
                      key={opt.key}
                      onClick={() => {
                        setPaymentIntent(opt.key);
                        setPaymentStatus(opt.status);
                        setPaymentError('');
                        if (opt.key === 'CHECKOUT') setPaymentAmount(0);
                        else if (opt.key === 'FULL') setPaymentAmount(total);
                        else if (opt.key === 'PARTIAL')
                          setPaymentAmount(
                            depositSuggestion > 0 ? Math.min(depositSuggestion, total) : 0,
                          );
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
                      <Text fw={700} c="#101828" size="sm">
                        {opt.label}
                      </Text>
                      <Text c="#64748b" size="xs">
                        {opt.hint}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
              {paymentIntent === 'CHECKOUT' ? (
                <Alert color="blue" variant="light" radius={radius.md}>
                  No payment will be recorded now. The outstanding amount remains
                  <b> {formatCurrency(total)}</b> and can be collected later in the stay workflow.
                </Alert>
              ) : null}
              {paymentIntent !== 'CHECKOUT' ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                  <NumberInput
                    label="Amount to collect now"
                    error={paymentError}
                    min={0}
                    max={total || undefined}
                    readOnly={paymentIntent === 'FULL'}
                    value={paymentAmount}
                    onChange={(v) => {
                      setPaymentAmount(Number(v) || 0);
                      setPaymentError('');
                    }}
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
              {paymentIntent !== 'CHECKOUT' && total > 0 ? (
                <Paper
                  radius={radius.md}
                  p={12}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                >
                  <Group justify="space-between" gap={spacing[2]}>
                    <Text c="#64748b" size="sm">
                      Remaining after this payment
                    </Text>
                    <Text fw={800} size="sm">
                      {formatCurrency(remainingAfterPayment)}
                    </Text>
                  </Group>
                </Paper>
              ) : null}
            </Stack>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              Change booking source
            </Button>
            <Collapse expanded={advancedOpen}>
              <Select
                data={[
                  { label: 'Direct', value: 'DIRECT' },
                  { label: 'Walk-in', value: 'WALK_IN' },
                  { label: 'OTA', value: 'OTA' },
                  { label: 'Corporate', value: 'CORPORATE' },
                ]}
                label="Source"
                onChange={(value) => setSource((value as BookingSource | null) ?? 'DIRECT')}
                value={source}
              />
            </Collapse>
            <Stack gap={6}>
              {selectedRoomCapacityError ? (
                <small style={{ color: '#b45309', display: 'block', textAlign: 'center' }}>
                  {selectedRoomCapacityError}
                </small>
              ) : null}
              <Button
                color="stayosBrand"
                data-testid="booking-submit-button"
                disabled={
                  !guestId ||
                  !datesComplete ||
                  !roomComplete ||
                  childAgesInvalid ||
                  selectedRoomInvalid ||
                  paymentAmountInvalid ||
                  quoteLoading ||
                  !quotePriced ||
                  isSubmitting
                }
                fullWidth
                loading={isSubmitting}
                onClick={() => void submit()}
                size="lg"
              >
                {quoteLoading ? 'Updating price…' : 'Create booking'}
              </Button>
              <Text c="#64748b" size="xs" ta="center">
                The booking is saved first; room assignment can be completed separately.
              </Text>
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
  const initialGuestId = mode === 'create' ? (searchParams.get('guestId') ?? undefined) : undefined;
  const initialArrival =
    mode === 'create' ? (searchParams.get('arrivalDate') ?? undefined) : undefined;
  const initialDeparture =
    mode === 'create' ? (searchParams.get('departureDate') ?? undefined) : undefined;
  const initialRoomTypeId =
    mode === 'create' ? (searchParams.get('roomTypeId') ?? undefined) : undefined;
  const adultsParam = mode === 'create' ? Number(searchParams.get('adults')) : NaN;
  const childrenParam = mode === 'create' ? Number(searchParams.get('children')) : NaN;
  const initialAdults =
    mode === 'create' && Number.isInteger(adultsParam) && adultsParam > 0 && adultsParam <= 20
      ? adultsParam
      : undefined;
  const initialChildren =
    mode === 'create' &&
    Number.isInteger(childrenParam) &&
    childrenParam >= 0 &&
    childrenParam <= 20
      ? childrenParam
      : undefined;
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const bookings = useBookings({ allowMockFallback, enabled: mode === 'create' && enabled });
  const details = useBookingDetails({
    allowMockFallback,
    bookingId: params.reservationId,
    enabled: mode === 'edit' && enabled,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (!allowMockFallback && backend.status === 'SERVER_STARTING')
    return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING')
    return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (
    mode === 'edit' &&
    !allowMockFallback &&
    details.error &&
    !details.isLoading &&
    !details.booking
  )
    return (
      <GenericError
        onAction={() => void details.refreshBooking()}
        onCheckStatus={checkBackendStatus}
      />
    );
  if (mode === 'edit' && !details.booking)
    return (
      <Alert color="blue" variant="light" icon={<Loader size={17} />} radius={radius.lg}>
        Loading booking details…
      </Alert>
    );

  const submit = async (values: BookingFormValues) => {
    setIsSubmitting(true);
    try {
      const booking =
        mode === 'create'
          ? await bookings.createBooking(values)
          : await details.updateBooking(values);
      showToast({
        color: 'green',
        title: mode === 'create' ? 'Booking created' : 'Booking updated',
        message:
          mode === 'create' ? 'Booking created successfully.' : 'Booking saved successfully.',
      });
      router.push(`/reservations/${booking.backendId}`);
    } catch (error) {
      showToast({
        color: 'red',
        title: mode === 'create' ? 'Unable to create booking' : 'Unable to update booking',
        message: friendlyBookingError(error),
      });
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
      <Button
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        w="fit-content"
        onClick={() => router.back()}
      >
        Back
      </Button>
      <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>
        Edit Booking
      </Title>
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
