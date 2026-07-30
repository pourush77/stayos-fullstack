import { Badge, Box, Button, Card, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { Bell, ConciergeBell, Shirt, Sparkles, Wrench } from 'lucide-react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import type { StayOSStatusTone } from '@stayos/ui';
import { StayOSStatusBadge } from '@stayos/ui';
import type { GuestRequestDto } from '../api/guest-requests-api';

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(request: GuestRequestDto): StayOSStatusTone {
  if (request.overdue && !['COMPLETED', 'CANCELLED'].includes(request.status)) return 'danger';
  if (request.status === 'COMPLETED') return 'success';
  if (request.status === 'IN_PROGRESS') return 'progress';
  if (request.status === 'CANCELLED') return 'muted';
  return 'info';
}

function priorityTone(priority: string): StayOSStatusTone {
  if (priority === 'VIP') return 'premium';
  if (priority === 'HIGH') return 'danger';
  return 'muted';
}

function departmentIcon(department: string) {
  if (department === 'HOUSEKEEPING') return <Sparkles size={17} />;
  if (department === 'MAINTENANCE') return <Wrench size={17} />;
  if (department === 'LAUNDRY') return <Shirt size={17} />;
  if (department === 'CONCIERGE') return <ConciergeBell size={17} />;
  return <Bell size={17} />;
}

export function RequestCard({
  onTransition,
  request,
}: {
  onTransition: (requestId: string, action: 'accept' | 'start' | 'complete' | 'cancel') => void;
  request: GuestRequestDto;
}) {
  const actions =
    request.status === 'REQUESTED'
      ? [{ label: 'Accept', action: 'accept' as const }, { label: 'Cancel', action: 'cancel' as const }]
      : request.status === 'ACCEPTED'
        ? [{ label: 'Start', action: 'start' as const }, { label: 'Cancel', action: 'cancel' as const }]
        : request.status === 'IN_PROGRESS'
          ? [{ label: 'Complete', action: 'complete' as const }, { label: 'Cancel', action: 'cancel' as const }]
          : [];

  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Group gap={spacing[4]} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
            {departmentIcon(request.department)}
          </ThemeIcon>
          <Box>
            <Text c={colors.brand[600]} style={typography.styles.h3}>
              {request.roomNumber ? `Room ${request.roomNumber}` : 'Public Area'}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.h3}>
              {request.title}
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {request.guestDisplayName ?? 'Walk-in guest'} - {label(request.department)} - {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Box>
        </Group>
        <Stack align="flex-end" gap={spacing[2]}>
          <StayOSStatusBadge tone={statusTone(request)}>{request.overdue && !['COMPLETED', 'CANCELLED'].includes(request.status) ? 'Delayed' : label(request.status)}</StayOSStatusBadge>
          <StayOSStatusBadge tone={priorityTone(request.priority)}>{label(request.priority)}</StayOSStatusBadge>
        </Stack>
      </Group>

      <SimpleGrid mt={spacing[5]} cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Due</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>{request.dueAt ? new Date(request.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not scheduled'}</Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Owner</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>{request.assignedEmployeeName ?? label(request.department)}</Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Booking</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>{request.reservationCode ?? 'None'}</Text>
        </Paper>
      </SimpleGrid>

      {request.description ? <Text mt={spacing[4]} c={colors.text.body} style={typography.styles.small}>{request.description}</Text> : null}

      <Group mt={spacing[5]} justify="flex-end">
        {actions.map((item) => (
          <Button key={item.action} color={item.action === 'cancel' ? 'red' : 'stayosBrand'} variant={item.action === 'cancel' ? 'light' : 'filled'} onClick={() => onTransition(request.id, item.action)}>
            {item.label}
          </Button>
        ))}
        {actions.length === 0 ? <Badge color="gray" variant="light">Closed</Badge> : null}
      </Group>
    </Card>
  );
}
