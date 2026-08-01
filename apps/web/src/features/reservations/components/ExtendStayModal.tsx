'use client';

import { useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AlertTriangle, CalendarPlus } from 'lucide-react';
import { spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { extendReservationStay } from '../../../lib/reservation-api';

export function ExtendStayModal({
  opened,
  onClose,
  propertyId,
  reservationId,
  currentDeparture,
  onExtended,
}: {
  opened: boolean;
  onClose: () => void;
  propertyId: string;
  reservationId: string;
  currentDeparture: string;
  onExtended: () => Promise<void> | void;
}) {
  const currentDate = new Date(`${currentDeparture}T00:00:00`);
  const [newDate, setNewDate] = useState<Date | null>(new Date(currentDate.getTime() + 86_400_000));
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    if (!newDate) {
      setError('Pick a new departure date.');
      return;
    }
    if (newDate <= currentDate) {
      setError('New date must be after the current departure.');
      return;
    }
    setError(undefined);
    setIsSaving(true);
    try {
      const iso = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
      await extendReservationStay(propertyId, reservationId, iso);
      showToast({ color: 'green', title: 'Stay extended', message: `New departure: ${iso}` });
      await onExtended();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      setError(message);
      showToast({ color: 'red', title: 'Unable to extend', message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Extend stay" centered>
      <Stack gap={spacing[3]}>
        <Text c="#64748b" size="sm">
          Current departure: <b>{currentDeparture}</b>. Pick a later date to add more nights.
        </Text>
        <DatePickerInput
          label="New departure date"
          value={newDate}
          onChange={(v) => setNewDate(v as Date | null)}
          minDate={new Date(currentDate.getTime() + 86_400_000)}
          data-testid="extend-stay-date"
        />
        <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.currentTarget.value)} rows={2} placeholder="e.g. Flight delayed" />
        {error ? <Alert color="red" variant="light" icon={<AlertTriangle size={16} />}>{error}</Alert> : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button color="stayosBrand" loading={isSaving} leftSection={<CalendarPlus size={16} />} onClick={() => void submit()} data-testid="extend-stay-confirm">
            Extend stay
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
