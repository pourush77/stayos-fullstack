'use client';

import { ActionIcon, Badge, Box, Button, Group, Stack, Text, Title, Tooltip } from '@mantine/core';
import { Calendar, CheckCircle2, Moon, RefreshCw, ShieldAlert } from 'lucide-react';
import { radius } from '@stayos/theme';
import { formatBusinessDate } from '../api/night-audit-api';
import type { NightAuditRunStatus } from '../types/night-audit.types';

export interface NightAuditHeaderProps {
  businessDate: string;
  status: NightAuditRunStatus;
  totalBlockingCount: number;
  isLoading?: boolean;
  onRefresh: () => void;
}

export function NightAuditHeader({
  businessDate,
  status,
  totalBlockingCount,
  isLoading = false,
  onRefresh,
}: NightAuditHeaderProps) {
  const formattedDate = formatBusinessDate(businessDate);
  const isBlocked = totalBlockingCount > 0;

  return (
    <Box
      data-testid="night-audit-header"
      py={18}
      px={24}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: radius.lg,
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap={16}>
        <Stack gap={6}>
          <Group gap={12} align="center">
            <Group gap={8} align="center">
              <Moon size={22} color="#4f46e5" />
              <Title order={2} style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                Night Audit
              </Title>
            </Group>

            <Badge
              data-testid="night-audit-status-badge"
              color={status === 'OPEN' ? 'blue' : 'green'}
              variant="light"
              size="md"
            >
              {status}
            </Badge>
          </Group>

          <Group gap={16} align="center" wrap="wrap">
            <Group gap={6} align="center">
              <Calendar size={15} color="#64748b" />
              <Text size="sm" c="#64748b" fw={500}>
                Business Date:
              </Text>
              <Text
                data-testid="night-audit-business-date"
                size="sm"
                fw={700}
                c="#0f172a"
              >
                {formattedDate}
              </Text>
            </Group>

            <Text size="sm" c="#cbd5e1">
              •
            </Text>

            <Group gap={6} align="center">
              {isBlocked ? (
                <>
                  <ShieldAlert size={15} color="#ef4444" />
                  <Text
                    data-testid="night-audit-blockers-remaining"
                    size="sm"
                    fw={700}
                    c="#ef4444"
                  >
                    {totalBlockingCount} {totalBlockingCount === 1 ? 'blocker' : 'blockers'} remaining
                  </Text>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} color="#16a34a" />
                  <Text
                    data-testid="night-audit-blockers-remaining"
                    size="sm"
                    fw={700}
                    c="#16a34a"
                  >
                    0 blockers remaining
                  </Text>
                </>
              )}
            </Group>
          </Group>
        </Stack>

        <Group gap={10} align="center">
          <Button
            data-testid="night-audit-refresh-button"
            variant="default"
            size="sm"
            leftSection={<RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />}
            onClick={onRefresh}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Group>
      </Group>
    </Box>
  );
}
