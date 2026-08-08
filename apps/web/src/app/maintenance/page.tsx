'use client';

import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AlertTriangle, CheckCircle2, Clock, Plus, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { StayOSOperationsCard } from '@stayos/ui';
import { useAuth } from '../../features/auth/auth-context';
import { CreateMaintenanceTicketModal } from '../../features/maintenance/components/CreateMaintenanceTicketModal';
import { MaintenanceTicketCard } from '../../features/maintenance/components/MaintenanceTicketCard';
import { useMaintenanceTickets } from '../../features/maintenance/hooks/useMaintenanceTickets';

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function MaintenancePageLoading({ canManage }: { canManage: boolean }) {
  return (
    <Stack gap={spacing[6]} aria-label="Loading maintenance" aria-busy="true">
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Skeleton height={38} width={190} radius="sm" />
          <Skeleton mt={6} height={15} width={420} maw="70vw" radius="sm" />
          <Skeleton mt={spacing[3]} height={13} width={320} radius="sm" />
        </Box>

        {canManage ? <Skeleton height={36} width={115} radius="md" /> : null}
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={spacing[3]}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Paper
            key={`maintenance-summary-skeleton-${index}`}
            radius={radius.lg}
            p={18}
            style={{ border: '1px solid #e2e8f0' }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box style={{ flex: 1 }}>
                <Skeleton height={12} width={92} radius="sm" />
                <Skeleton mt={8} height={30} width={38} radius="sm" />
                <Skeleton mt={7} height={11} width="75%" radius="sm" />
              </Box>
              <Skeleton height={36} width={36} radius={radius.full} />
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Group justify="space-between" align="flex-end">
        <Box>
          <Skeleton height={24} width={85} radius="sm" />
          <Skeleton mt={6} height={12} width={250} radius="sm" />
        </Box>
        <Skeleton height={36} width={145} radius="md" />
      </Group>

      <Stack gap={spacing[4]}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Paper
            key={`maintenance-ticket-skeleton-${index}`}
            radius={radius.lg}
            p={18}
            style={{ border: '1px solid #e2e8f0' }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box style={{ flex: 1 }}>
                <Group gap={8} wrap="wrap">
                  <Skeleton height={17} width={140} radius="sm" />
                  <Skeleton height={24} width={72} radius={radius.full} />
                  <Skeleton height={24} width={82} radius={radius.full} />
                </Group>

                <Skeleton mt={9} height={12} width="45%" radius="sm" />
                <Skeleton mt={7} height={11} width="65%" radius="sm" />
              </Box>

              <Skeleton height={34} width={105} radius="md" />
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

export default function MaintenancePage() {
  const auth = useAuth();
  const [opened, { open, close }] = useDisclosure(false);
  const state = useMaintenanceTickets(auth.user?.propertyId);
  const canView = hasPermission(auth.user?.permissions, 'maintenance.view');
  const canManage = hasPermission(auth.user?.permissions, 'maintenance.manage');
  const summary = state.summary ?? { open: 0, inProgress: 0, resolved: 0, highPriority: 0 };

  const summaryCards = useMemo(
    () => [
      {
        title: 'Open',
        value: summary.open,
        detail: 'Waiting for maintenance',
        tone: 'info' as const,
        icon: <Wrench size={17} />,
      },
      {
        title: 'In Progress',
        value: summary.inProgress,
        detail: 'Assigned and active',
        tone: 'progress' as const,
        icon: <Clock size={17} />,
      },
      {
        title: 'Resolved',
        value: summary.resolved,
        detail: 'Completed tickets',
        tone: 'success' as const,
        icon: <CheckCircle2 size={17} />,
      },
      {
        title: 'High Priority',
        value: summary.highPriority,
        detail: 'Needs attention',
        tone: 'danger' as const,
        icon: <AlertTriangle size={17} />,
      },
    ],
    [summary],
  );

  if (!canView) {
    return (
      <Alert color="red" variant="light" radius={radius.lg}>
        You do not have permission to view maintenance tickets.
      </Alert>
    );
  }

  if (!state.hasLoadedOnce && state.isLoading) {
    return <MaintenancePageLoading canManage={canManage} />;
  }

  return (
    <Stack gap={spacing[6]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
            Maintenance
          </Title>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
            Track room issues, public-area repairs, and resolution work.
          </Text>
          <Text c={colors.text.strong} mt={spacing[3]} style={typography.styles.label}>
            Today you have {summary.open} open tickets, {summary.inProgress} in progress, and{' '}
            {summary.highPriority} high priority.
          </Text>
        </Box>
        {canManage ? (
          <Button color="stayosBrand" leftSection={<Plus size={16} />} onClick={open}>
            New Ticket
          </Button>
        ) : null}
      </Group>

      {state.error ? (
        <Alert color="red" variant="light" radius={radius.lg}>
          {state.error}
        </Alert>
      ) : null}

      {state.isLoading && state.hasLoadedOnce ? (
        <Group gap={8} role="status" aria-live="polite">
          <Loader color="stayosBrand" size="xs" />
          <Text c={colors.text.muted} style={typography.styles.small}>
            Updating maintenance data...
          </Text>
        </Group>
      ) : null}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={spacing[3]}>
        {summaryCards.map((item) => (
          <StayOSOperationsCard key={item.title} {...item} />
        ))}
      </SimpleGrid>

      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            Tickets
          </Title>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
            Open work, assignment state, and resolution history.
          </Text>
        </Box>
        <Select
          placeholder="Status"
          clearable
          data={['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']}
          value={state.status || null}
          onChange={(value) => state.setStatus((value ?? '') as never)}
        />
      </Group>

      <Stack gap={spacing[4]}>
        {state.tickets.map((ticket) => (
          <MaintenanceTicketCard
            key={ticket.id}
            canManage={canManage}
            ticket={ticket}
            onAssign={(id) => (auth.user?.id ? void state.assign(id, auth.user.id) : undefined)}
            onCancel={(id) => void state.cancel(id)}
            onResolve={(id) => void state.resolve(id, 'Resolved from maintenance workspace')}
          />
        ))}
        {!state.isLoading && state.tickets.length === 0 ? (
          <Alert color="blue" variant="light" radius={radius.lg}>
            No maintenance tickets match these filters.
          </Alert>
        ) : null}
      </Stack>

      <CreateMaintenanceTicketModal opened={opened} onClose={close} onCreate={state.create} />
    </Stack>
  );
}
