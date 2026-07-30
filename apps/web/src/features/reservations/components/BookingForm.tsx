'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Group, NumberInput, Select, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Plus, Save } from 'lucide-react';
import { spacing } from '@stayos/theme';
import { paymentOptions, sourceOptions } from '../constants/booking.constants';
import type { Booking, BookingFormValues, BookingPaymentStatus, BookingSource, GuestOption, RoomTypeOption } from '../types/booking.types';
import { calculateNights } from '../utils/booking-formatters';
import { bookingToFormValues } from '../utils/booking-mappers';
import { hasBookingFormErrors, validateBookingForm, type BookingFormErrors } from '../utils/booking-validation';

function dateToValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function valueToDate(value: Date | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function BookingForm({
  booking,
  guests,
  initialGuestId,
  isEdit = false,
  isSubmitting,
  onCancel,
  onSubmit,
  roomTypes,
}: {
  booking?: Booking;
  guests: GuestOption[];
  initialGuestId?: string;
  isEdit?: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: BookingFormValues) => Promise<void>;
  roomTypes: RoomTypeOption[];
}) {
  const initialValues = useMemo(() => bookingToFormValues(booking), [booking]);
  const [values, setValues] = useState<BookingFormValues>(initialValues);
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const nights = calculateNights(values.arrivalDate, values.departureDate);

  const updateValue = <Key extends keyof BookingFormValues>(key: Key, value: BookingFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  useEffect(() => {
    if (isEdit || !initialGuestId) return;
    if (!guests.some((guest) => guest.id === initialGuestId)) return;
    setValues((current) => (current.guestId ? current : { ...current, guestId: initialGuestId }));
  }, [guests, initialGuestId, isEdit]);

  const submit = async () => {
    const nextErrors = validateBookingForm(values, roomTypes);
    setErrors(nextErrors);
    if (hasBookingFormErrors(nextErrors)) return;
    await onSubmit(values);
  };

  return (
    <Stack gap={spacing[5]}>
      {!isEdit ? (
        <Stack gap={spacing[2]}>
          <Group justify="space-between">
            <Text c="#101828" fw={800}>Guest Selection</Text>
            <Button component={Link} href="/guests/new" variant="light" color="stayosBrand" leftSection={<Plus size={15} />} size="compact-sm">
              Create New Guest
            </Button>
          </Group>
          <Select
            data={guests.map((guest) => ({
              label: `${guest.label} - ${guest.phone} - ${guest.email}${guest.isVip ? ' - VIP' : ''}`,
              value: guest.id,
            }))}
            error={errors.guestId}
            label="Guest"
            nothingFoundMessage="No guests found"
            onChange={(value) => updateValue('guestId', value ?? '')}
            placeholder="Search by name, phone or email"
            searchable
            value={values.guestId}
          />
        </Stack>
      ) : null}

      <Stack gap={spacing[2]}>
        <Text c="#101828" fw={800}>Stay Dates</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <DateInput error={errors.arrivalDate} label="Arrival date" onChange={(value) => updateValue('arrivalDate', valueToDate(value))} value={dateToValue(values.arrivalDate)} />
          <DateInput error={errors.departureDate} label="Departure date" onChange={(value) => updateValue('departureDate', valueToDate(value))} value={dateToValue(values.departureDate)} />
        </SimpleGrid>
        <Text c={nights > 0 ? '#334155' : '#b45309'} size="sm">{nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select valid stay dates.'}</Text>
      </Stack>

      <Stack gap={spacing[2]}>
        <Text c="#101828" fw={800}>Occupancy</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <NumberInput error={errors.adults} label="Adults" min={1} onChange={(value) => updateValue('adults', Number(value) || 1)} value={values.adults} />
          <NumberInput error={errors.children} label="Children" min={0} onChange={(value) => updateValue('children', Number(value) || 0)} value={values.children} />
        </SimpleGrid>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <Select
          data={roomTypes.map((roomType) => ({ label: `${roomType.label} - up to ${roomType.capacity} guests`, value: roomType.id }))}
          disabled={isEdit && booking?.status === 'CHECKED_IN'}
          error={errors.roomTypeId}
          label="Room type"
          onChange={(value) => updateValue('roomTypeId', value ?? '')}
          value={values.roomTypeId}
        />
        <Select data={paymentOptions} label="Payment" onChange={(value) => updateValue('paymentStatus', (value as BookingPaymentStatus | null) ?? 'PAYMENT_DUE')} value={values.paymentStatus} />
        <Select data={sourceOptions} label="Source" onChange={(value) => updateValue('source', (value as BookingSource | null) ?? 'DIRECT')} value={values.source} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <Textarea label="Special requests" minRows={3} onChange={(event) => updateValue('specialRequests', event.currentTarget.value)} placeholder="None" value={values.specialRequests} />
        <Textarea label="Notes" minRows={3} onChange={(event) => updateValue('notes', event.currentTarget.value)} value={values.notes} />
      </SimpleGrid>

      <Group justify="flex-end">
        <Button variant="subtle" color="gray" onClick={onCancel}>Cancel</Button>
        <Button color="stayosBrand" leftSection={<Save size={16} />} loading={isSubmitting} onClick={() => void submit()}>
          {isEdit ? 'Save Booking' : 'Create Booking'}
        </Button>
      </Group>
    </Stack>
  );
}
