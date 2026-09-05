'use client';

import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { radius } from '@stayos/theme';
import type { NightAuditValidationDto } from '../types/night-audit.types';

export interface CloseDayPanelProps {
  validation?: NightAuditValidationDto;
  isClosing?: boolean;
  onOpenCloseModal: () => void;
}

export function CloseDayPanel({
  validation,
  isClosing = false,
  onOpenCloseModal,
}: CloseDayPanelProps) {
  const canClose = validation?.canClose ?? false;
  const totalBlockingCount = validation?.totalBlockingCount ?? 0;

  return (
    <Paper
      data-testid="close-business-day-panel"
      p={20}
      radius={radius.lg}
      style={{
        backgroundColor: '#ffffff',
        border: canClose ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap={16}>
        <Group gap={12} align="center">
          {canClose ? (
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={20} color="#16a34a" />
            </Box>
          ) : (
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={20} color="#ef4444" />
            </Box>
          )}

          <Stack gap={2}>
            <Text
              data-testid="close-day-status-text"
              size="md"
              fw={700}
              c={canClose ? '#16a34a' : '#0f172a'}
            >
              {canClose
                ? 'Ready to close'
                : `${totalBlockingCount} ${totalBlockingCount === 1 ? 'issue' : 'issues'} must be resolved before closing`}
            </Text>
            <Text size="xs" c="#64748b">
              {canClose
                ? 'All pending arrivals, due-outs, and folio exceptions have been resolved.'
                : 'Resolve all blocking operational items above to enable closing the business day.'}
            </Text>
          </Stack>
        </Group>

        <Button
          data-testid="close-business-day-button"
          size="md"
          color="stayosBrand"
          leftSection={<Lock size={16} />}
          disabled={!canClose || isClosing}
          loading={isClosing}
          onClick={onOpenCloseModal}
          style={{ minWidth: 190 }}
        >
          Close Business Day
        </Button>
      </Group>
    </Paper>
  );
}
