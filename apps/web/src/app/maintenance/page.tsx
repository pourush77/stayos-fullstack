'use client';

import { Alert, Box, Button, Group, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
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

export default function MaintenancePage() {
  const auth = useAuth();
  const [opened, { open, close }] = useDisclosure(false);
  const state = useMaintenanceTickets(auth.user?.propertyId);
  const canView = hasPermission(auth.user?.permissions, 'maintenance.view');
  const canManage = hasPermission(auth.user?.permissions, 'maintenance.manage');
  const summary = state.summary ?? { open: 0, inProgress: 0, resolved: 0, highPriority: 0 };

  const summaryCards = useMemo(() => [
    { title: 'Open', value: summary.open, detail: 'Waiting for maintenance', tone: 'info' as const, icon: <Wrench size={17} /> },
    { title: 'In Progress', value: summary.inProgress, detail: 'Assigned and active', tone: 'progress' as const, icon: <Clock size={17} /> },
    { title: 'Resolved', value: summary.resolved, detail: 'Completed tickets', tone: 'success' as const, icon: <CheckCircle2 size={17} /> },
    { title: 'High Priority', value: summary.highPriority, detail: 'Needs attention', tone: 'danger' as const, icon: <AlertTriangle size={17} /> },
  ], [summary]);

  if (!canView) {
    return <Alert color="red" variant="light" radius={radius.lg}>You do not have permission to view maintenance tickets.</Alert>;
  }

  return (
    <Stack gap={spacing[6]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Title order={1} c={colors.text.strong} style={typography.styles.h1}>Maintenance</Title>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>Track room issues, public-area repairs, and resolution work.</Text>
          <Text c={colors.text.strong} mt={spacing[3]} style={typography.styles.label}>
            Today you have {summary.open} open tickets, {summary.inProgress} in progress, and {summary.highPriority} high priority.
          </Text>
        </Box>
        {canManage ? (
          <Button color="stayosBrand" leftSection={<Plus size={16} />} onClick={open}>New Ticket</Button>
        ) : null}
      </Group>

      {state.error ? <Alert color="red" variant="light" radius={radius.lg}>{state.error}</Alert> : null}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={spacing[3]}>
        {summaryCards.map((item) => <StayOSOperationsCard key={item.title} {...item} />)}
      </SimpleGrid>

      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>Tickets</Title>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>Open work, assignment state, and resolution history.</Text>
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
            onAssign={(id) => auth.user?.id ? void state.assign(id, auth.user.id) : undefined}
            onCancel={(id) => void state.cancel(id)}
            onResolve={(id) => void state.resolve(id, 'Resolved from maintenance workspace')}
          />
        ))}
        {!state.isLoading && state.tickets.length === 0 ? <Alert color="blue" variant="light" radius={radius.lg}>No maintenance tickets match these filters.</Alert> : null}
      </Stack>

      <CreateMaintenanceTicketModal opened={opened} onClose={close} onCreate={state.create} />
    </Stack>
  );
}
