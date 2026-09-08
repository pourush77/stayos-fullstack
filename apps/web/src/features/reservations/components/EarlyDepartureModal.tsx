'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AlertTriangle, DoorOpen } from 'lucide-react';
import { spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { earlyDepartureReservation } from '../../../lib/reservation-api';

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function nightsBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function EarlyDepartureModal({
  opened,
  onClose,
  propertyId,
  reservationId,
  arrivalDate,
  currentDeparture,
  onProcessed,
}: {
  opened: boolean;
  onClose: () => void;
  propertyId: string;
  reservationId: string;
  arrivalDate: string;
  currentDeparture: string;
  onProcessed: () => Promise<void> | void;
}) {
  const arrival = new Date(`${arrivalDate}T00:00:00`);
  const current = new Date(`${currentDeparture}T00:00:00`);
  const [newDate, setNewDate] = useState<Date | null>(
    new Date(Math.max(arrival.getTime() + 86_400_000, current.getTime() - 86_400_000)),
  );
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const nightsWaived = useMemo(
    () => (newDate ? nightsBetween(toIso(newDate), currentDeparture) : 0),
    [newDate, currentDeparture],
  );

  const submit = async () => {
    if (!newDate) {
      setError('Pick the effective departure date.');
      return;
    }
    const iso = toIso(newDate);
    if (iso >= currentDeparture) {
      setError('Early departure must be before the current departure date.');
      return;
    }
    if (iso <= arrivalDate) {
      setError('Early departure must be after the arrival date.');
      return;
    }
    setError(undefined);
    setIsSaving(true);
    try {
      const result = await earlyDepartureReservation(propertyId, reservationId, iso, reason.trim() || undefined);
      showToast({
        color: 'green',
        title: 'Early departure processed',
        message: `New checkout ${result.effectiveDepartureDate} · ${result.nightsWaived} night(s) waived`,
      });
      await onProcessed();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      setError(message);
      showToast({ color: 'red', title: 'Unable to process early departure', message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Early departure" centered data-testid="early-departure-modal">
      <Stack gap={spacing[3]}>
        <Text c="#64748b" size="sm">
          Shorten this stay to an earlier checkout and waive the remaining future nights.
        </Text>
        <DatePickerInput
          label="New checkout date"
          value={newDate}
          onChange={(v) => setNewDate(v as Date | null)}
          minDate={new Date(arrival.getTime() + 86_400_000)}
          maxDate={new Date(current.getTime() - 86_400_000)}
          data-testid="early-departure-date"
        />
        <Stack gap={4}>
          <Group justify="space-between">
            <Text c="#64748b" size="sm">Original checkout</Text>
            <Text fw={700} size="sm">{currentDeparture}</Text>
          </Group>
          <Group justify="space-between">
            <Text c="#64748b" size="sm">New checkout</Text>
            <Text fw={700} size="sm" data-testid="early-departure-new-checkout">{newDate ? toIso(newDate) : '-'}</Text>
          </Group>
          <Group justify="space-between">
            <Text c="#64748b" size="sm">Future nights waived</Text>
            <Text fw={700} size="sm" data-testid="early-departure-nights-waived">{nightsWaived}</Text>
          </Group>
        </Stack>
        <Alert color="blue" variant="light" data-testid="early-departure-notice">
          Already posted room charges will not change. No cancellation fee or refund is applied automatically.
        </Alert>
        <Textarea
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          rows={2}
          placeholder="e.g. Guest leaving early for a flight"
          data-testid="early-departure-reason"
        />
        {error ? (
          <Alert color="red" variant="light" icon={<AlertTriangle size={16} />} data-testid="early-departure-error">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose} data-testid="early-departure-cancel">
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            loading={isSaving}
            leftSection={<DoorOpen size={16} />}
            onClick={() => void submit()}
            data-testid="early-departure-confirm"
          >
            Confirm early departure
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
