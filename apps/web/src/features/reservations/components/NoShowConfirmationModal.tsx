'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { radius } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { markReservationNoShow } from '../../../lib/reservation-api';

export interface NoShowTarget {
  propertyId: string;
  reservationId: string;
  reservationCode?: string;
  guestName?: string;
}

export interface NoShowConfirmationModalProps {
  opened: boolean;
  target: NoShowTarget | null;
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
}

export function NoShowConfirmationModal({
  opened,
  target,
  onClose,
  onSuccess,
}: NoShowConfirmationModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setReason('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!target?.propertyId || !target?.reservationId) return;

    setIsSubmitting(true);
    try {
      await markReservationNoShow(
        target.propertyId,
        target.reservationId,
        reason.trim() || undefined,
      );
      showToast({
        color: 'green',
        title: 'Marked as No-Show',
        message: `Reservation ${target.reservationCode || target.reservationId} marked as no-show. Reserved inventory released.`,
      });
      setReason('');
      onClose();
      await onSuccess?.();
    } catch (error: unknown) {
      showToast({
        color: 'red',
        title: 'Unable to mark as no-show',
        message: error instanceof Error ? error.message : 'Failed to mark reservation as no-show.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened && Boolean(target)}
      onClose={handleClose}
      title={
        <Title order={3} style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
          Mark Reservation as No-Show?
        </Title>
      }
      centered
      radius={radius.md}
      padding="lg"
      data-testid="no-show-confirmation-modal"
    >
      {target ? (
        <Stack gap={16}>
          <Text size="sm" c="#475569">
            Mark reservation{' '}
            <Text span fw={700} c="#0f172a">
              {target.reservationCode || target.reservationId}
            </Text>{' '}
            for{' '}
            <Text span fw={700} c="#0f172a">
              {target.guestName || 'Guest'}
            </Text>{' '}
            as no-show?
          </Text>

          <Box
            p={12}
            style={{
              backgroundColor: '#fffbeb',
              borderRadius: radius.sm,
              border: '1px solid #fef3c7',
            }}
          >
            <Text size="xs" c="#b45309" fw={600} data-testid="no-show-inventory-release-notice">
              This will mark the booking as no-show and release its reserved room inventory.
            </Text>
          </Box>

          <TextInput
            label="Reason (optional)"
            placeholder="e.g. Guest did not arrive by audit cutoff"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            disabled={isSubmitting}
            data-testid="no-show-reason-input"
          />

          <Group justify="flex-end" gap={12} mt={8}>
            <Button
              variant="default"
              onClick={handleClose}
              disabled={isSubmitting}
              data-testid="no-show-cancel-button"
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => void handleConfirm()}
              loading={isSubmitting}
              disabled={isSubmitting}
              data-testid="no-show-confirm-button"
            >
              Mark No-Show
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
