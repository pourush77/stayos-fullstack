'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { AlertCircle, AlertTriangle, RefreshCcw, ShieldAlert } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../auth/auth-context';
import {
  advanceCalendarDay,
  closeNightAudit,
  formatBusinessDate,
  getNightAudit,
  NightAuditApiError,
} from '../api/night-audit-api';
import type { NightAuditRunResponseDto } from '../types/night-audit.types';
import { CloseDayModal } from './CloseDayModal';
import { CloseDayPanel } from './CloseDayPanel';
import { FolioExceptionsSection } from './FolioExceptionsSection';
import { GroupReviewSection } from './GroupReviewSection';
import { NightAuditHeader } from './NightAuditHeader';
import { NightAuditSummary } from './NightAuditSummary';
import { PendingArrivalsSection } from './PendingArrivalsSection';
import { StayReviewSection } from './StayReviewSection';

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

export function NightAuditLoadingState() {
  return (
    <Stack gap={spacing[4]} data-testid="night-audit-loading" aria-label="Loading Night Audit" aria-busy="true">
      <Paper p={24} radius={radius.lg} style={{ border: '1px solid #e2e8f0' }}>
        <Group justify="space-between" align="center">
          <Stack gap={8}>
            <Skeleton height={28} width={200} radius="sm" />
            <Skeleton height={18} width={340} radius="sm" />
          </Stack>
          <Skeleton height={36} width={100} radius="md" />
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={14}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Paper key={i} p={18} radius={radius.md} style={{ border: '1px solid #e2e8f0' }}>
            <Skeleton height={14} width={100} mb={10} radius="sm" />
            <Skeleton height={24} width={80} radius="sm" />
          </Paper>
        ))}
      </SimpleGrid>

      <Paper p={24} radius={radius.lg} style={{ border: '1px solid #e2e8f0' }}>
        <Skeleton height={20} width={160} mb={16} radius="sm" />
        <Skeleton height={120} width="100%" radius="md" />
      </Paper>

      <Paper p={24} radius={radius.lg} style={{ border: '1px solid #e2e8f0' }}>
        <Skeleton height={20} width={160} mb={16} radius="sm" />
        <Skeleton height={120} width="100%" radius="md" />
      </Paper>
    </Stack>
  );
}

export function NightAuditErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <Paper
      data-testid="night-audit-error"
      p={32}
      radius={radius.lg}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #fecaca',
        textAlign: 'center',
      }}
    >
      <Stack align="center" gap={16}>
        <Box
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertCircle size={26} color="#ef4444" />
        </Box>

        <Stack gap={6} align="center">
          <Title order={3} style={{ fontSize: 18, color: '#0f172a' }}>
            Unable to load Night Audit
          </Title>
          <Text size="sm" c="#64748b" maw={500}>
            {error || 'An unexpected error occurred while fetching the Night Audit workspace.'}
          </Text>
        </Stack>

        <Button
          data-testid="night-audit-retry-button"
          leftSection={<RefreshCcw size={16} />}
          variant="default"
          onClick={onRetry}
        >
          Retry
        </Button>
      </Stack>
    </Paper>
  );
}

function SimpleGrid({
  children,
  cols,
  spacing: sp,
}: {
  children: React.ReactNode;
  cols: { base: number; sm: number; lg: number };
  spacing: number;
}) {
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols.lg}, minmax(0, 1fr))`,
        gap: sp,
      }}
    >
      {children}
    </Box>
  );
}

export function NightAuditPage() {
  const auth = useAuth();
  const propertyId = auth.user?.propertyId;
  const canManage = hasPermission(auth.user?.permissions, 'night-audit.manage');

  const [data, setData] = useState<NightAuditRunResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const loadData = useCallback(
    async (signal?: AbortSignal, isExplicitRefresh = false) => {
      if (!propertyId || !canManage) {
        setIsLoading(false);
        return;
      }

      if (isExplicitRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await getNightAudit(propertyId, signal);
        setData(response);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unable to load Night Audit';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [propertyId, canManage],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleManualRefresh = async () => {
    await loadData(undefined, true);
    showToast({
      color: 'blue',
      title: 'Night Audit Refreshed',
      message: 'Workspace updated with latest property operations.',
    });
  };

  const handleSelectSection = (sectionKey: string) => {
    const element = document.getElementById(`section-${sectionKey}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleConfirmClose = async () => {
    if (!propertyId || !data) return;

    setIsClosing(true);
    try {
      const result = await closeNightAudit(propertyId);
      const prevDateFormatted = formatBusinessDate(data.businessDate);
      const nextDateFormatted = formatBusinessDate(
        result.nextBusinessDate ?? advanceCalendarDay(data.businessDate),
      );

      showToast({
        color: 'green',
        title: 'Business Day Closed',
        message: `Business day ${prevDateFormatted} closed. New business date: ${nextDateFormatted}.`,
      });

      setIsCloseModalOpen(false);

      // Existing backend creates or resumes next day's OPEN run on GET
      await loadData();
    } catch (err: unknown) {
      setIsCloseModalOpen(false);

      if (err instanceof NightAuditApiError && err.code === 'NIGHT_AUDIT_BLOCKED') {
        showToast({
          color: 'red',
          title: 'Night Audit Blocked',
          message:
            err.message ||
            'Night audit cannot be closed because there are blocking operational items.',
        });
      } else {
        showToast({
          color: 'red',
          title: 'Close Failed',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to close business day. Please review blockers and try again.',
        });
      }

      // Always reload to get fresh authoritative validation and blockers
      await loadData();
    } finally {
      setIsClosing(false);
    }
  };

  if (!canManage) {
    return (
      <Container size="xl" py={24}>
        <Paper
          data-testid="night-audit-access-denied"
          p={32}
          radius={radius.lg}
          style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', textAlign: 'center' }}
        >
          <Stack align="center" gap={12}>
            <ShieldAlert size={32} color="#ef4444" />
            <Title order={3} style={{ fontSize: 18 }}>
              Access Restricted
            </Title>
            <Text size="sm" c="#64748b" maw={460}>
              You do not have permission to view or manage Night Audit (night-audit.manage).
              Please contact your property administrator.
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (isLoading && !data) {
    return (
      <Container size="xl" py={24}>
        <NightAuditLoadingState />
      </Container>
    );
  }

  if (error && !data) {
    return (
      <Container size="xl" py={24}>
        <NightAuditErrorState error={error} onRetry={() => void loadData()} />
      </Container>
    );
  }

  if (!data) {
    return null;
  }

  const workspace = data.workspace ?? {
    pendingArrivals: { count: 0, blockingCount: 0, items: [] },
    stayReview: { count: 0, blockingCount: 0, summary: { stayover: 0, dueOut: 0, overdue: 0 }, items: [] },
    folioExceptions: {
      count: 0,
      blockingCount: 0,
      summary: { outstandingBalance: 0, unsettledZeroBalance: 0, missingFolio: 0 },
      items: [],
    },
    groupReview: {
      count: 0,
      blockingCount: 0,
      summary: { stayover: 0, dueOut: 0, overdue: 0, financialExceptions: 0, operationalExceptions: 0 },
      items: [],
    },
  };

  const validation = data.validation ?? {
    canClose: false,
    totalBlockingCount: 0,
    blockers: { pendingArrivals: 0, stayReview: 0, folioExceptions: 0, groupReview: 0 },
    reasons: [],
  };

  return (
    <Container size="xl" py={24}>
      <Stack gap={spacing[4]}>
        {/* 1. Header */}
        <NightAuditHeader
          businessDate={data.businessDate}
          status={data.status}
          totalBlockingCount={validation.totalBlockingCount}
          isLoading={isRefreshing}
          onRefresh={() => void handleManualRefresh()}
        />

        {/* 2. Top Summary */}
        <NightAuditSummary
          blockers={validation.blockers}
          onSelectSection={handleSelectSection}
        />

        {/* 3. Four Operational Workspace Sections */}
        <PendingArrivalsSection
          section={workspace.pendingArrivals}
          propertyId={propertyId}
          onRefresh={() => loadData()}
        />

        <StayReviewSection section={workspace.stayReview} />

        <FolioExceptionsSection section={workspace.folioExceptions} />

        <GroupReviewSection section={workspace.groupReview} />

        {/* 4. Bottom Close Business Day Panel */}
        <CloseDayPanel
          validation={validation}
          isClosing={isClosing}
          onOpenCloseModal={() => setIsCloseModalOpen(true)}
        />

        {/* Confirmation Modal */}
        <CloseDayModal
          opened={isCloseModalOpen}
          businessDate={data.businessDate}
          nextBusinessDate={data.nextBusinessDate}
          isClosing={isClosing}
          onClose={() => setIsCloseModalOpen(false)}
          onConfirmClose={() => void handleConfirmClose()}
        />
      </Stack>
    </Container>
  );
}
