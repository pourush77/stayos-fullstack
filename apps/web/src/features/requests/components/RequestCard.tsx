import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  AlarmClock,
  Bell,
  Car,
  CheckCircle2,
  ConciergeBell,
  Plane,
  Play,
  Shirt,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import type { StayOSStatusTone } from '@stayos/ui';
import { StayOSStatusBadge } from '@stayos/ui';
import type { GuestRequestDto, GuestRequestType } from '../api/guest-requests-api';

type RequestAction = 'accept' | 'start' | 'complete' | 'cancel';

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase());
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

function requestIcon(requestType?: GuestRequestType | null, department?: string) {
  if (requestType === 'WAKE_UP_CALL') return <AlarmClock size={18} />;
  if (requestType === 'TAXI') return <Car size={18} />;
  if (requestType === 'AIRPORT_PICKUP' || requestType === 'AIRPORT_DROP') {
    return <Plane size={18} />;
  }
  return departmentIcon(department ?? '');
}

function actionLabels(requestType?: GuestRequestType | null) {
  switch (requestType) {
    case 'WAKE_UP_CALL':
      return { accept: 'Acknowledge', start: 'Call Guest', complete: 'Mark Done' };
    case 'TAXI':
      return { accept: 'Confirm Request', start: 'Vehicle Arrived', complete: 'Guest Picked Up' };
    case 'AIRPORT_PICKUP':
      return { accept: 'Confirm Transfer', start: 'Driver Ready', complete: 'Guest Picked Up' };
    case 'AIRPORT_DROP':
      return { accept: 'Confirm Transfer', start: 'Vehicle Ready', complete: 'Guest Departed' };
    case 'LAUNDRY_PICKUP':
      return { accept: 'Accept Request', start: 'Picked Up', complete: 'Completed' };
    case 'ROOM_CLEANING':
      return { accept: 'Accept Request', start: 'Start Cleaning', complete: 'Mark Complete' };
    case 'EXTRA_TOWELS':
    case 'WATER_BOTTLES':
    case 'BABY_COT':
    case 'EXTRA_BED':
      return { accept: 'Accept Request', start: 'On the Way', complete: 'Delivered' };
    case 'LUGGAGE_ASSISTANCE':
      return { accept: 'Accept Request', start: 'Assistance Started', complete: 'Completed' };
    case 'FLOWERS':
    case 'CAKE':
    case 'SPECIAL_DECORATION':
      return { accept: 'Confirm Request', start: 'Preparing', complete: 'Delivered' };
    default:
      return { accept: 'Accept Request', start: 'Start Service', complete: 'Mark Complete' };
  }
}

function dueLabel(request: GuestRequestDto) {
  if (!request.dueAt) return 'Not scheduled';

  const dueDate = new Date(request.dueAt);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (request.overdue && !['COMPLETED', 'CANCELLED'].includes(request.status)) {
    return `${Math.max(1, Math.abs(diffMinutes))} min overdue`;
  }

  if (diffMinutes >= 0 && diffMinutes <= 60) {
    if (diffMinutes <= 1) return 'Due now';
    return `Due in ${diffMinutes} min`;
  }

  return dueDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RequestCard({
  onTransition,
  request,
}: {
  onTransition: (requestId: string, action: RequestAction) => void | Promise<void>;
  request: GuestRequestDto;
}) {
  const [pendingAction, setPendingAction] = useState<RequestAction | null>(null);

  const labels = useMemo(() => actionLabels(request.requestType), [request.requestType]);

  const actions =
    request.status === 'REQUESTED'
      ? [
          { label: labels.accept, action: 'accept' as const },
          { label: 'Cancel', action: 'cancel' as const },
        ]
      : request.status === 'ACCEPTED'
        ? [
            { label: labels.start, action: 'start' as const },
            { label: 'Cancel', action: 'cancel' as const },
          ]
        : request.status === 'IN_PROGRESS'
          ? [
              { label: labels.complete, action: 'complete' as const },
              { label: 'Cancel', action: 'cancel' as const },
            ]
          : [];

  const handleTransition = async (action: RequestAction) => {
    if (pendingAction) return;
    setPendingAction(action);
    try {
      await onTransition(request.id, action);
    } finally {
      setPendingAction(null);
    }
  };

  const dueText = dueLabel(request);
  const dueAtMs = request.dueAt ? new Date(request.dueAt).getTime() : null;
  const isDueSoon =
    Boolean(dueAtMs) &&
    !request.overdue &&
    !['COMPLETED', 'CANCELLED'].includes(request.status) &&
    (dueAtMs as number) - Date.now() <= 10 * 60_000 &&
    (dueAtMs as number) > Date.now();

  return (
    <Card
      p={spacing[5]}
      radius={radius.lg}
      shadow="xs"
      style={{
        border: request.overdue
          ? '1px solid #fecaca'
          : isDueSoon
            ? '1px solid #fde68a'
            : '1px solid #eef2f7',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
      }}
    >
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Group gap={spacing[4]} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon
            color={request.overdue ? 'red' : isDueSoon ? 'yellow' : 'stayosBrand'}
            variant="light"
            radius={radius.md}
            size={42}
          >
            {requestIcon(request.requestType, request.department)}
          </ThemeIcon>

          <Box>
            <Text c={colors.brand[600]} style={typography.styles.h3}>
              {request.roomNumber ? `Room ${request.roomNumber}` : 'Public Area'}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.h3}>
              {request.title}
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {request.guestDisplayName ?? 'Walk-in guest'} - {label(request.department)} -{' '}
              {new Date(request.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </Box>
        </Group>

        <Stack align="flex-end" gap={spacing[2]}>
          <StayOSStatusBadge tone={statusTone(request)}>
            {request.overdue && !['COMPLETED', 'CANCELLED'].includes(request.status)
              ? 'Delayed'
              : label(request.status)}
          </StayOSStatusBadge>
          <StayOSStatusBadge tone={priorityTone(request.priority)}>
            {label(request.priority)}
          </StayOSStatusBadge>
        </Stack>
      </Group>

      {isDueSoon || request.overdue ? (
        <Paper
          mt={spacing[4]}
          p={spacing[3]}
          radius={radius.md}
          style={{
            background: request.overdue ? '#fef2f2' : '#fffbeb',
            border: request.overdue ? '1px solid #fecaca' : '1px solid #fde68a',
          }}
        >
          <Group gap={8}>
            <AlarmClock size={16} color={request.overdue ? '#dc2626' : '#b45309'} />
            <Text c={request.overdue ? '#b91c1c' : '#92400e'} fw={800} size="sm">
              {request.overdue ? 'Needs attention now' : 'Due soon'} · {dueText}
            </Text>
          </Group>
        </Paper>
      ) : null}

      <SimpleGrid mt={spacing[5]} cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Due
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {dueText}
          </Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Owner
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {request.assignedEmployeeName ?? label(request.department)}
          </Text>
        </Paper>
        <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            Booking
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {request.reservationCode ?? 'None'}
          </Text>
        </Paper>
      </SimpleGrid>

      {request.description ? (
        <Text mt={spacing[4]} c={colors.text.body} style={typography.styles.small}>
          {request.description}
        </Text>
      ) : null}

      <Group mt={spacing[5]} justify="flex-end">
        {actions.map((item) => {
          const loading = pendingAction === item.action;
          const disabled = Boolean(pendingAction) && !loading;

          return (
            <Button
              key={item.action}
              color={item.action === 'cancel' ? 'red' : 'stayosBrand'}
              variant={item.action === 'cancel' ? 'light' : 'filled'}
              loading={loading}
              disabled={disabled}
              leftSection={
                item.action === 'start' ? (
                  <Play size={15} />
                ) : item.action === 'complete' ? (
                  <CheckCircle2 size={15} />
                ) : undefined
              }
              onClick={() => void handleTransition(item.action)}
            >
              {item.label}
            </Button>
          );
        })}

        {actions.length === 0 ? (
          <Badge color="gray" variant="light">
            Closed
          </Badge>
        ) : null}
      </Group>
    </Card>
  );
}
