'use client';

import { Box, Button, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { AlertCircle, ArrowRight, Calendar } from 'lucide-react';
import { radius } from '@stayos/theme';
import { advanceCalendarDay, formatBusinessDate } from '../api/night-audit-api';

export interface CloseDayModalProps {
  opened: boolean;
  businessDate: string;
  nextBusinessDate?: string | null;
  isClosing: boolean;
  onClose: () => void;
  onConfirmClose: () => void;
}

export function CloseDayModal({
  opened,
  businessDate,
  nextBusinessDate,
  isClosing,
  onClose,
  onConfirmClose,
}: CloseDayModalProps) {
  const currentFormatted = formatBusinessDate(businessDate);
  const calculatedNext = nextBusinessDate || (businessDate ? advanceCalendarDay(businessDate) : '');
  const nextFormatted = formatBusinessDate(calculatedNext);

  return (
    <Modal
      opened={opened}
      onClose={isClosing ? () => undefined : onClose}
      title={
        <Title order={3} style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
          Close Business Day
        </Title>
      }
      centered
      radius={radius.md}
      padding="lg"
      data-testid="close-day-confirmation-modal"
    >
      <Stack gap={16}>
        <Box
          p={16}
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: radius.md,
            border: '1px solid #bfdbfe',
          }}
        >
          <Group gap={12} align="center" justify="center">
            <Group gap={6} align="center">
              <Calendar size={16} color="#1d4ed8" />
              <Text fw={700} c="#1e40af" size="sm">
                {currentFormatted}
              </Text>
            </Group>
            <ArrowRight size={14} color="#60a5fa" />
            <Text fw={700} c="#1e40af" size="sm">
              {nextFormatted}
            </Text>
          </Group>
        </Box>

        <Stack gap={8}>
          <Text size="sm" c="#0f172a" fw={600} data-testid="close-day-modal-question">
            Close business day {currentFormatted}?
          </Text>

          <Text size="sm" c="#475569" data-testid="close-day-modal-advance-text">
            After closing, the hotel's business date will advance to {nextFormatted}.
          </Text>

          <Group gap={6} align="center" mt={4}>
            <AlertCircle size={15} color="#dc2626" />
            <Text size="xs" c="#dc2626" fw={600} data-testid="close-day-modal-warning">
              This action cannot be undone from this screen.
            </Text>
          </Group>
        </Stack>

        <Group justify="flex-end" gap={12} mt={12}>
          <Button
            data-testid="close-day-modal-cancel-button"
            variant="default"
            onClick={onClose}
            disabled={isClosing}
          >
            Cancel
          </Button>

          <Button
            data-testid="close-day-modal-submit-button"
            color="stayosBrand"
            onClick={onConfirmClose}
            loading={isClosing}
          >
            Close Business Day
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
