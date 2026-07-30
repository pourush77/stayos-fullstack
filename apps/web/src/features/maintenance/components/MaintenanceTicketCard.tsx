import { Badge, Box, Button, Card, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { CheckCircle2, PlugZap, Snowflake, Wrench } from 'lucide-react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import type { StayOSStatusTone } from '@stayos/ui';
import { StayOSStatusBadge } from '@stayos/ui';
import type { MaintenanceTicketDto } from '../api/maintenance-api';

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): StayOSStatusTone {
  if (status === 'RESOLVED') return 'success';
  if (status === 'IN_PROGRESS') return 'progress';
  if (status === 'CANCELLED') return 'muted';
  return 'info';
}

function priorityTone(priority: string): StayOSStatusTone {
  if (priority === 'HIGH') return 'danger';
  if (priority === 'LOW') return 'muted';
  return 'info';
}

function categoryIcon(category: string) {
  if (category === 'ELECTRICAL') return <PlugZap size={17} />;
  if (category === 'HVAC') return <Snowflake size={17} />;
  if (category === 'APPLIANCE') return <CheckCircle2 size={17} />;
  return <Wrench size={17} />;
}

export function MaintenanceTicketCard({
  canManage,
  onAssign,
  onCancel,
  onResolve,
  ticket,
}: {
  canManage: boolean;
  onAssign: (ticketId: string) => void;
  onCancel: (ticketId: string) => void;
  onResolve: (ticketId: string) => void;
  ticket: MaintenanceTicketDto;
}) {
  const isClosed = ['RESOLVED', 'CANCELLED'].includes(ticket.status);

  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Group gap={spacing[4]} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
            {categoryIcon(ticket.category)}
          </ThemeIcon>
          <Box>
            <Text c={colors.brand[600]} style={typography.styles.h3}>
              {ticket.roomNumber ? `Room ${ticket.roomNumber}` : 'Public Area'}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.h3}>
              {ticket.title}
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {label(ticket.category)} - Reported {new Date(ticket.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Box>
        </Group>
        <Stack align="flex-end" gap={spacing[2]}>
          <StayOSStatusBadge tone={statusTone(ticket.status)}>{label(ticket.status)}</StayOSStatusBadge>
          <StayOSStatusBadge tone={priorityTone(ticket.priority)}>{label(ticket.priority)}</StayOSStatusBadge>
        </Stack>
      </Group>

      <SimpleGrid mt={spacing[5]} cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Owner</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>{ticket.assignedToUserId ? 'Assigned' : 'Unassigned'}</Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Resolved</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>{ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString() : 'Open'}</Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Category</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>{label(ticket.category)}</Text>
        </Paper>
      </SimpleGrid>

      {ticket.description ? <Text mt={spacing[4]} c={colors.text.body} style={typography.styles.small}>{ticket.description}</Text> : null}
      {ticket.resolutionNote ? <Text mt={spacing[3]} c={colors.text.muted} style={typography.styles.small}>Resolution: {ticket.resolutionNote}</Text> : null}

      <Group mt={spacing[5]} justify="flex-end">
        {canManage && ticket.status === 'OPEN' ? (
          <Button color="stayosBrand" onClick={() => onAssign(ticket.id)}>Accept</Button>
        ) : null}
        {canManage && ticket.status === 'IN_PROGRESS' ? (
          <Button color="stayosBrand" onClick={() => onResolve(ticket.id)}>Resolve</Button>
        ) : null}
        {canManage && !isClosed ? (
          <Button color="red" variant="light" onClick={() => onCancel(ticket.id)}>Cancel</Button>
        ) : null}
        {!canManage || isClosed ? <Badge color="gray" variant="light">{isClosed ? 'Closed' : 'View Only'}</Badge> : null}
      </Group>
    </Card>
  );
}
