'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Brush,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  BedDouble,
  Eye,
  AlertTriangle,
  Printer,
  QrCode,
  RotateCw,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Search,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../features/auth/auth-context';
import {
  assignHousekeepingRoom,
  completeHousekeepingRoom,
  friendlyHousekeepingError,
  getCurrentPropertyId,
  getHousekeepingDashboardData,
  getHousekeepingEmployees,
  inspectHousekeepingRoom,
  regenerateStaffAccess,
  startHousekeepingRoom,
  updateStaffAccess,
} from '../../features/housekeeping/api/housekeeping-api';
import {
  createChecklist,
  serializeChecklist,
} from '../../features/housekeeping/utils/housekeeping-checklist';
import type {
  HousekeepingChecklistItem,
  HousekeepingDashboardSummary,
  HousekeepingEmployee,
  HousekeepingRoom,
  HousekeepingStatus,
} from '../../features/housekeeping/types/housekeeping.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const statusTones: Record<
  HousekeepingStatus,
  { color: string; background: string; border: string; shadow: string }
> = {
  cleaning: {
    background: '#eff6ff',
    border: '#bfdbfe',
    color: '#1d4ed8',
    shadow: 'rgba(29, 78, 216, 0.14)',
  },
  dirty: {
    background: '#fffbeb',
    border: '#fde68a',
    color: '#b45309',
    shadow: 'rgba(180, 83, 9, 0.14)',
  },
  inspection: {
    background: '#f5f3ff',
    border: '#ddd6fe',
    color: '#6d28d9',
    shadow: 'rgba(109, 40, 217, 0.14)',
  },
  maintenance: {
    background: '#fef2f2',
    border: '#fecaca',
    color: '#dc2626',
    shadow: 'rgba(220, 38, 38, 0.14)',
  },
  occupied: {
    background: '#f8fafc',
    border: '#cbd5e1',
    color: '#334155',
    shadow: 'rgba(51, 65, 85, 0.14)',
  },
  'out-of-order': {
    background: '#fef2f2',
    border: '#fecaca',
    color: '#dc2626',
    shadow: 'rgba(220, 38, 38, 0.14)',
  },
  'out-of-service': {
    background: '#fef2f2',
    border: '#fecaca',
    color: '#dc2626',
    shadow: 'rgba(220, 38, 38, 0.14)',
  },
  ready: {
    background: '#f0fdf4',
    border: '#bbf7d0',
    color: '#15803d',
    shadow: 'rgba(21, 128, 61, 0.14)',
  },
};

const groups: Array<{ key: HousekeepingStatus | 'maintenance-group'; label: string }> = [
  { key: 'dirty', label: 'Needs Cleaning' },
  { key: 'cleaning', label: 'In Progress' },
  { key: 'inspection', label: 'Waiting Inspection' },
  { key: 'ready', label: 'Ready' },
  { key: 'occupied', label: 'Occupied' },
  { key: 'maintenance-group', label: 'Maintenance / Out of Order' },
];

const defaultExpandedGroups = new Set<HousekeepingStatus | 'maintenance-group'>([
  'dirty',
  'cleaning',
  'inspection',
]);

const statusFilterOptions: Array<{
  label: string;
  value: HousekeepingStatus | 'maintenance-group';
}> = [
  { label: 'Needs Cleaning', value: 'dirty' },
  { label: 'In Progress', value: 'cleaning' },
  { label: 'Waiting Inspection', value: 'inspection' },
  { label: 'Ready', value: 'ready' },
  { label: 'Occupied', value: 'occupied' },
  { label: 'Maintenance / Out of Order', value: 'maintenance-group' },
];

function statusLabel(status: HousekeepingStatus) {
  if (status === 'dirty') return 'Needs Cleaning';
  if (status === 'cleaning') return 'In Progress';
  if (status === 'inspection') return 'Inspection';
  if (status === 'ready') return 'Ready';
  if (status === 'occupied') return 'Occupied';
  if (status === 'maintenance') return 'Maintenance';
  if (status === 'out-of-service') return 'Out of Service';
  return 'Out of Order';
}

function statusTone(status: HousekeepingStatus) {
  return statusTones[status];
}

function groupTone(group: (typeof groups)[number]['key']) {
  return statusTone(group === 'maintenance-group' ? 'out-of-order' : group);
}

function statusIcon(status: HousekeepingStatus) {
  if (status === 'ready') return <CheckCircle2 size={17} />;
  if (status === 'cleaning') return <Brush size={17} />;
  if (status === 'inspection') return <Eye size={17} />;
  if (status === 'occupied') return <BedDouble size={17} />;
  if (status === 'maintenance' || status === 'out-of-order' || status === 'out-of-service')
    return <Wrench size={17} />;
  return <Sparkles size={17} />;
}

function StatusBadge({ status }: { status: HousekeepingStatus }) {
  const tone = statusTone(status);
  return (
    <Badge
      radius={radius.full}
      style={{
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
        height: 24,
        textTransform: 'none',
      }}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function canManageStaffAccess(role: string | undefined, permissions: string[] | undefined) {
  const normalizedRole = String(role ?? '').toUpperCase();
  return (
    ['MANAGER', 'ADMIN', 'OWNER'].includes(normalizedRole) ||
    hasPermission(permissions, 'housekeeping.manage')
  );
}

function staffAccessUrl(origin: string, employee: HousekeepingEmployee, propertyId?: string) {
  if (!origin || !employee.staffAccessToken) return '';
  const url = new URL(`/housekeeping/staff/access/${employee.staffAccessToken}`, origin);
  if (propertyId) url.searchParams.set('propertyId', propertyId);
  return url.toString();
}

function checklistItemsProgress(items: HousekeepingChecklistItem[]) {
  const done = items.filter((item) => item.completed).length;
  return `${done}/${items.length}`;
}

function formatElapsedTime(value?: string, options: { includeAgo?: boolean } = {}) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const suffix = options.includeAgo ? ' ago' : '';

  if (diffMs < minute) return options.includeAgo ? 'just now' : 'just now';
  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes} min${suffix}`;
  }
  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours} hr${hours === 1 ? '' : 's'}${suffix}`;
  }

  const days = Math.max(1, Math.round(diffMs / day));
  return `${days} day${days === 1 ? '' : 's'}${suffix}`;
}

function roomLastActivityAt(room: HousekeepingRoom) {
  return (room as HousekeepingRoom & { lastActivityAt?: string }).lastActivityAt ?? room.updatedAt;
}

function getHousekeepingAgeLabel(room: HousekeepingRoom) {
  if (room.status === 'occupied') return 'In-house';

  const fallbackAt = roomLastActivityAt(room);
  if (room.status === 'dirty') {
    const elapsed = formatElapsedTime(fallbackAt);
    return elapsed ? `Waiting ${elapsed}` : 'Recently updated';
  }
  if (room.status === 'cleaning') {
    const elapsed = formatElapsedTime(room.startedAt ?? fallbackAt);
    return elapsed ? `Cleaning for ${elapsed}` : 'Recently updated';
  }
  if (room.status === 'inspection') {
    const elapsed = formatElapsedTime(room.completedAt ?? fallbackAt);
    return elapsed ? `Waiting inspection for ${elapsed}` : 'Recently updated';
  }
  if (room.status === 'ready') {
    const elapsed = formatElapsedTime(room.inspectedAt ?? fallbackAt, { includeAgo: true });
    return elapsed ? `Ready since ${elapsed}` : 'Recently updated';
  }
  if (room.status === 'maintenance' || room.status === 'out-of-order' || room.status === 'out-of-service') {
    const elapsed = formatElapsedTime(fallbackAt);
    return elapsed ? `Blocked for ${elapsed}` : 'Recently updated';
  }
  return 'Recently updated';
}

function roomStateText(room: HousekeepingRoom) {
  if (room.status === 'dirty') {
    return room.assignedEmployeeName
      ? `Assigned to ${room.assignedEmployeeName} · Not started`
      : 'Not started';
  }
  if (room.status === 'cleaning') {
    return room.assignedEmployeeName ? `Cleaning by ${room.assignedEmployeeName}` : 'Cleaning';
  }
  if (room.status === 'inspection') return 'Checklist complete · Waiting inspection';
  if (room.status === 'ready') return 'Ready for assignment';
  if (room.status === 'occupied') return 'In-house · No housekeeping action';
  return 'Blocked · Maintenance required';
}

function roomMatchesGroup(room: HousekeepingRoom, group: (typeof groups)[number]['key']) {
  if (group === 'maintenance-group') {
    return ['maintenance', 'out-of-order', 'out-of-service'].includes(room.status);
  }
  return room.status === group;
}

function roomGroupKey(room: HousekeepingRoom): HousekeepingStatus | 'maintenance-group' {
  return ['maintenance', 'out-of-order', 'out-of-service'].includes(room.status)
    ? 'maintenance-group'
    : room.status;
}

function isUnassignedActionableRoom(room: HousekeepingRoom) {
  return ['dirty', 'cleaning', 'inspection'].includes(room.status) && !room.assignedEmployeeId;
}

function attentionReason(room: HousekeepingRoom) {
  if (room.status === 'dirty' && !room.assignedEmployeeId) return 'Needs staff assignment';
  if (room.status === 'inspection') return 'Waiting for inspection';
  if (room.status === 'maintenance') return 'Maintenance required';
  if (room.status === 'out-of-order') return 'Out of order';
  if (room.status === 'out-of-service') return 'Out of service';
  return undefined;
}

function primaryAction(room: HousekeepingRoom) {
  if (room.status === 'dirty') return room.assignedEmployeeId ? 'Start Cleaning' : 'Assign Staff';
  if (room.status === 'cleaning') return 'Complete on behalf';
  if (room.status === 'inspection') return 'Inspect Room';
  if (room.status === 'occupied') return 'Occupied';
  return 'View';
}

function actionSuccessLabel(action: string) {
  if (action === 'Assign Staff') return 'Assigned';
  if (action === 'Start Cleaning') return 'Started';
  if (action === 'Complete on behalf') return 'Submitted';
  if (action === 'Inspect Room') return 'Approved';
  return 'Updated';
}

function emptyGroupMessage(group: (typeof groups)[number]['key']) {
  if (group === 'dirty') return 'No rooms need cleaning';
  if (group === 'cleaning') return 'No rooms in progress';
  if (group === 'inspection') return 'No rooms waiting inspection';
  if (group === 'ready') return 'No ready rooms';
  if (group === 'occupied') return 'No occupied rooms';
  return 'No maintenance rooms';
}

function floorSortValue(floor: string) {
  const number = floor.match(/\d+/)?.[0];
  return number ? Number(number) : Number.MAX_SAFE_INTEGER;
}

function groupRoomsByFloor(rooms: HousekeepingRoom[]) {
  const floors = new Map<string, HousekeepingRoom[]>();
  rooms.forEach((room) => {
    const floorRooms = floors.get(room.floor) ?? [];
    floorRooms.push(room);
    floors.set(room.floor, floorRooms);
  });
  return Array.from(floors.entries())
    .sort(([first], [second]) => {
      const firstValue = floorSortValue(first);
      const secondValue = floorSortValue(second);
      if (firstValue !== secondValue) return firstValue - secondValue;
      return first.localeCompare(second, undefined, { numeric: true });
    })
    .map(([floor, floorRooms]) => ({
      floor,
      rooms: floorRooms.sort((first, second) =>
        first.number.localeCompare(second.number, undefined, { numeric: true }),
      ),
    }));
}

export function housekeepingGroupCount(
  rooms: HousekeepingRoom[],
  group: (typeof groups)[number]['key'],
  summary?: HousekeepingDashboardSummary,
) {
  if (group === 'occupied' && summary?.occupied !== undefined) return summary.occupied;
  return rooms.filter((room) => roomMatchesGroup(room, group)).length;
}

export function housekeepingVisibleRoomTotal(rooms: HousekeepingRoom[]) {
  return groups.reduce((total, group) => total + rooms.filter((room) => roomMatchesGroup(room, group.key)).length, 0);
}

function ChecklistButtons({
  checklist,
  onToggle,
  readOnly = false,
}: {
  checklist: HousekeepingChecklistItem[];
  onToggle: (key: string) => void;
  readOnly?: boolean;
}) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={spacing[2]}>
      {checklist.map((item) => {
        const Icon = item.icon;
        if (readOnly) {
          return (
            <Paper
              key={item.key}
              aria-label={`${item.label} ${item.completed ? 'complete' : 'not complete'}`}
              radius={radius.md}
              p={12}
              style={{
                alignItems: 'center',
                background: item.completed ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${item.completed ? '#bbf7d0' : '#e2e8f0'}`,
                color: item.completed ? '#15803d' : '#475569',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 70,
                justifyContent: 'center',
              }}
            >
              <Icon aria-hidden size={22} />
              <Text style={{ fontSize: 13, fontWeight: 800, lineHeight: '17px' }}>
                {item.label}
              </Text>
            </Paper>
          );
        }
        return (
          <Button
            key={item.key}
            color={item.completed ? 'green' : 'gray'}
            h={70}
            leftSection={<Icon size={22} />}
            onClick={() => onToggle(item.key)}
            variant={item.completed ? 'filled' : 'light'}
            style={{ fontWeight: 800, whiteSpace: 'normal' }}
          >
            {item.label}
          </Button>
        );
      })}
    </SimpleGrid>
  );
}

function PrintableStaffCard({
  employee,
  origin,
  propertyName,
  propertyId,
}: {
  employee?: HousekeepingEmployee;
  origin: string;
  propertyName?: string;
  propertyId?: string;
}) {
  const url = employee ? staffAccessUrl(origin, employee, propertyId) : '';
  if (!employee || !url) return null;

  return (
    <Box className="staff-print-root" aria-hidden>
      <Box className="staff-print-card">
        <Title order={1}>StayOS</Title>
        <Text className="staff-print-kicker">HOUSEKEEPING STAFF</Text>
        <Text>
          <strong>Name:</strong> {employee.displayName}
        </Text>
        <Text>
          <strong>Code:</strong> {employee.employeeCode}
        </Text>
        <Text>
          <strong>Property:</strong> {employee.propertyName || propertyName || 'Hillston Hotel'}
        </Text>
        <QRCodeSVG value={url} size={184} level="M" includeMargin />
        <Text className="staff-print-hint">Scan to view your rooms.</Text>
      </Box>
    </Box>
  );
}

function StaffAccessModal({
  employees,
  isLoadingEmployees,
  isBusy,
  onClose,
  onPrint,
  onRegenerate,
  onToggleAccess,
  opened,
  origin,
  propertyId,
  propertyName,
}: {
  employees: HousekeepingEmployee[];
  isLoadingEmployees?: boolean;
  isBusy?: string;
  onClose: () => void;
  onPrint: (employee: HousekeepingEmployee) => void;
  onRegenerate: (employee: HousekeepingEmployee) => void;
  onToggleAccess: (employee: HousekeepingEmployee) => void;
  opened: boolean;
  origin: string;
  propertyId?: string;
  propertyName?: string;
}) {
  const activeHousekeeping = employees.filter(
    (employee) =>
      employee.status.toUpperCase() === 'ACTIVE' &&
      employee.department.toUpperCase() === 'HOUSEKEEPING',
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Staff Access" centered size="xl">
      <Stack gap={spacing[3]}>
        {isLoadingEmployees ? <Alert color="blue">Loading housekeeping staff...</Alert> : null}
        {!isLoadingEmployees && activeHousekeeping.length === 0 ? (
          <Alert color="yellow">No active housekeeping employees found.</Alert>
        ) : null}
        {activeHousekeeping.map((employee) => {
          const enabled = Boolean(employee.staffAccessEnabled && employee.staffAccessToken);
          const url = staffAccessUrl(origin, employee, propertyId);
          return (
            <Paper key={employee.id} radius={radius.lg} p={16} style={cardStyle}>
              <Group align="flex-start" justify="space-between" gap={spacing[3]} wrap="wrap">
                <Stack gap={4} style={{ flex: '1 1 220px' }}>
                  <Text c="#101828" style={{ fontSize: 17, fontWeight: 850 }}>
                    {employee.displayName}
                  </Text>
                  <Text c="#64748b" style={{ fontSize: 13, fontWeight: 700 }}>
                    {employee.employeeCode}
                  </Text>
                  <Badge
                    color={enabled ? 'green' : 'gray'}
                    radius={radius.full}
                    variant="light"
                    w="fit-content"
                  >
                    {enabled ? 'Access enabled' : 'Access disabled'}
                  </Badge>
                  <Text c="#94a3b8" style={{ fontSize: 12, fontWeight: 650 }}>
                    {employee.propertyName || propertyName || 'Property'}
                  </Text>
                </Stack>
                <Box
                  style={{
                    alignItems: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    display: 'flex',
                    height: 132,
                    justifyContent: 'center',
                    width: 132,
                  }}
                >
                  {enabled && url ? (
                    <QRCodeSVG value={url} size={112} level="M" includeMargin />
                  ) : (
                    <Text c="#94a3b8" ta="center" style={{ fontSize: 12, fontWeight: 800 }}>
                      Access disabled.
                    </Text>
                  )}
                </Box>
              </Group>
              <Divider my={14} />
              <Group justify="flex-end" gap={8}>
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<Copy size={16} />}
                  disabled={!enabled || !url}
                  onClick={() => {
                    void navigator.clipboard.writeText(url).then(() => {
                      showToast({
                        color: 'green',
                        title: 'Copied',
                        message: 'Staff link copied.',
                      });
                    });
                  }}
                >
                  Copy link
                </Button>
                <Button
                  variant="light"
                  leftSection={<Printer size={16} />}
                  disabled={!enabled || !url}
                  onClick={() => onPrint(employee)}
                >
                  Print card
                </Button>
                <Button
                  variant="light"
                  color="yellow"
                  leftSection={<RotateCw size={16} />}
                  loading={isBusy === `regenerate:${employee.id}`}
                  onClick={() => onRegenerate(employee)}
                >
                  Regenerate QR
                </Button>
                <Button
                  variant="light"
                  color={enabled ? 'red' : 'green'}
                  leftSection={enabled ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                  loading={isBusy === `toggle:${employee.id}`}
                  onClick={() => onToggleAccess(employee)}
                >
                  {enabled ? 'Disable Access' : 'Enable Access'}
                </Button>
              </Group>
            </Paper>
          );
        })}
      </Stack>
    </Modal>
  );
}

function RoomCard({
  feedback,
  highlighted,
  loading,
  onAssign,
  onComplete,
  onInspect,
  onStart,
  room,
}: {
  feedback?: string;
  highlighted?: boolean;
  loading?: boolean;
  onAssign: (room: HousekeepingRoom) => void;
  onComplete: (room: HousekeepingRoom) => void;
  onInspect: (room: HousekeepingRoom) => void;
  onStart: (room: HousekeepingRoom) => void;
  room: HousekeepingRoom;
}) {
  const action = primaryAction(room);
  const tone = statusTone(room.status);
  const isUnassigned = isUnassignedActionableRoom(room);
  const primaryLabel = feedback ? `✓ ${feedback}` : action;
  const primaryColor =
    room.status === 'dirty'
      ? 'yellow'
      : room.status === 'cleaning'
        ? 'blue'
        : room.status === 'inspection'
          ? 'violet'
          : 'gray';
  return (
    <Paper
      className="housekeeping-room-card"
      radius={radius.lg}
      p={18}
      style={{
        ...cardStyle,
        background: isUnassigned ? '#fffbeb' : '#ffffff',
        borderColor: highlighted || isUnassigned ? '#f59e0b' : tone.border,
        boxShadow: highlighted
          ? '0 0 0 3px rgba(245, 158, 11, 0.22), 0 16px 34px rgba(15, 23, 42, 0.08)'
          : isUnassigned
            ? '0 10px 28px rgba(180, 83, 9, 0.10)'
            : cardStyle.boxShadow,
      }}
    >
      <Group justify="space-between" align="center" gap={spacing[3]} wrap="nowrap">
        <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
          <Text
            component={Link}
            href={`/housekeeping/${room.id}`}
            c="#101828"
            style={{
              fontSize: 34,
              fontWeight: 800,
              lineHeight: '38px',
              textDecoration: 'none',
            }}
          >
            {room.number}
          </Text>
          <StatusBadge status={room.status} />
          {isUnassigned ? (
            <Badge
              radius={radius.full}
              color="yellow"
              variant="filled"
              style={{ textTransform: 'none' }}
            >
              Unassigned
            </Badge>
          ) : null}
        </Group>
      </Group>

      <Stack gap={9} mt={16}>
        <Group gap={8} wrap="wrap">
          <Text c="#475569" style={{ fontSize: 13, fontWeight: 750 }}>
            {room.roomType}
          </Text>
          <Badge
            leftSection={<Building2 size={12} />}
            radius={radius.full}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: 11,
              fontWeight: 750,
              textTransform: 'none',
            }}
          >
            {room.floor}
          </Badge>
        </Group>
        <Text c="#334155" style={{ fontSize: 13, fontWeight: 700, lineHeight: '20px' }}>
          {roomStateText(room)}
        </Text>
        <Text c="#94a3b8" style={{ fontSize: 12, fontWeight: 600 }}>
          {getHousekeepingAgeLabel(room)}
        </Text>
      </Stack>

      <Group mt={20} justify="flex-end" gap={8}>
        {room.status === 'dirty' && !room.assignedEmployeeId ? (
          <Button
            color={primaryColor}
            leftSection={<UserPlus size={16} />}
            onClick={() => onAssign(room)}
            loading={loading}
          >
            {primaryLabel}
          </Button>
        ) : null}
        {room.status === 'dirty' && room.assignedEmployeeId ? (
          <>
            <Button
              color={primaryColor}
              leftSection={<Brush size={16} />}
              onClick={() => onStart(room)}
              loading={loading}
            >
              {primaryLabel}
            </Button>
            <Button
              variant="subtle"
              color="gray"
              onClick={() => onAssign(room)}
            >
              Change Staff
            </Button>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<ClipboardCheck size={16} />}
              onClick={() => onComplete(room)}
            >
              Complete on behalf
            </Button>
          </>
        ) : null}
        {room.status === 'cleaning' ? (
          <>
            <Button
              color={primaryColor}
              leftSection={<ClipboardCheck size={16} />}
              onClick={() => onComplete(room)}
              loading={loading}
            >
              {primaryLabel}
            </Button>
            <Button
              variant="subtle"
              color="gray"
              onClick={() => onAssign(room)}
            >
              Change Staff
            </Button>
          </>
        ) : null}
        {room.status === 'inspection' ? (
          <Button
            color={primaryColor}
            leftSection={<Eye size={16} />}
            onClick={() => onInspect(room)}
            loading={loading}
          >
            {primaryLabel}
          </Button>
        ) : null}
        {['ready', 'maintenance', 'out-of-order', 'out-of-service'].includes(room.status) ? (
          <Button variant="subtle" color="gray">
            {action}
          </Button>
        ) : null}
      </Group>
    </Paper>
  );
}

export default function HousekeepingPage() {
  const auth = useAuth();
  const canManageEmployees = hasPermission(auth.user?.permissions, 'employees.manage');
  const canOpenStaffAccess = canManageStaffAccess(auth.user?.role, auth.user?.permissions);
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<HousekeepingRoom[]>([]);
  const [summary, setSummary] = useState<HousekeepingDashboardSummary>();
  const [employees, setEmployees] = useState<HousekeepingEmployee[]>([]);
  const employeesLoadedAtRef = useRef(0);
  const propertyIdRef = useRef('');
  const isMountedRef = useRef(false);
  const sectionRefs = useRef<
    Record<HousekeepingStatus | 'maintenance-group', HTMLDivElement | null>
  >({} as Record<HousekeepingStatus | 'maintenance-group', HTMLDivElement | null>);
  const roomRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState<string>();
  const [loadingRoomId, setLoadingRoomId] = useState<string>();
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [staffAccessOpen, setStaffAccessOpen] = useState(false);
  const [staffAccessBusy, setStaffAccessBusy] = useState<string>();
  const [printEmployee, setPrintEmployee] = useState<HousekeepingEmployee>();
  const [assignRoom, setAssignRoom] = useState<HousekeepingRoom | null>(null);
  const [completeRoom, setCompleteRoom] = useState<HousekeepingRoom | null>(null);
  const [inspectRoom, setInspectRoom] = useState<HousekeepingRoom | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<HousekeepingChecklistItem[]>(createChecklist());
  const [rejectReason, setRejectReason] = useState<string>();
  const [roomSearch, setRoomSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [highlightedGroup, setHighlightedGroup] = useState<
    HousekeepingStatus | 'maintenance-group' | null
  >(null);
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<HousekeepingStatus | 'maintenance-group', boolean>
  >(() =>
    groups.reduce(
      (expanded, group) => ({
        ...expanded,
        [group.key]: defaultExpandedGroups.has(group.key),
      }),
      {} as Record<HousekeepingStatus | 'maintenance-group', boolean>,
    ),
  );
  const checklistComplete = checklist.length > 0 && checklist.every((item) => item.completed);
  const canSendBackInspection = Boolean(inspectRoom && rejectReason);
  const canMarkInspectionReady = Boolean(inspectRoom && checklistComplete && !rejectReason);

  const scrollToGroup = useCallback((groupKey: HousekeepingStatus | 'maintenance-group') => {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: true,
    }));
    setHighlightedGroup(groupKey);
    window.setTimeout(() => {
      sectionRefs.current[groupKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, []);

  const scrollToRoom = useCallback((room: HousekeepingRoom) => {
    const groupKey = roomGroupKey(room);
    setRoomSearch('');
    setFloorFilter(null);
    setStatusFilter(null);
    setStaffFilter(null);
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: true,
    }));
    setHighlightedGroup(groupKey);
    setHighlightedRoomId(room.id);
    window.setTimeout(() => {
      roomRefs.current[room.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    window.setTimeout(() => {
      setHighlightedRoomId((current) => (current === room.id ? null : current));
    }, 2400);
  }, []);

  const resolvePropertyId = useCallback(async (signal?: AbortSignal) => {
    if (propertyIdRef.current) return propertyIdRef.current;
    if (auth.user?.propertyId) {
      propertyIdRef.current = auth.user.propertyId;
      setPropertyId(auth.user.propertyId);
      return auth.user.propertyId;
    }
    const nextPropertyId = await getCurrentPropertyId(signal);
    propertyIdRef.current = nextPropertyId;
    if (isMountedRef.current) setPropertyId(nextPropertyId);
    return nextPropertyId;
  }, [auth.user?.propertyId]);

  const loadDashboard = useCallback(
    async (signal?: AbortSignal) => {
      setError(undefined);
      setIsLoading(true);
      try {
        const nextPropertyId = await resolvePropertyId(signal);
        const dashboard = await getHousekeepingDashboardData(nextPropertyId, signal);
        if (!isMountedRef.current) return;
        setRooms(dashboard.rooms);
        setSummary(dashboard.summary);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        if (isMountedRef.current) setError('Housekeeping is temporarily unavailable.');
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    },
    [resolvePropertyId],
  );

  const loadEmployees = useCallback(
    async ({ force = false, signal }: { force?: boolean; signal?: AbortSignal } = {}) => {
      const cacheAgeMs = Date.now() - employeesLoadedAtRef.current;
      if (!force && employees.length > 0 && cacheAgeMs < 5 * 60 * 1000) return employees;

      setEmployeeError(undefined);
      setIsEmployeeLoading(true);
      try {
        const nextPropertyId = await resolvePropertyId(signal);
        const nextEmployees = await getHousekeepingEmployees(nextPropertyId, signal);
        if (!isMountedRef.current) return nextEmployees;
        setEmployees(nextEmployees);
        employeesLoadedAtRef.current = Date.now();
        return nextEmployees;
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return employees;
        if (isMountedRef.current) setEmployeeError('Unable to load housekeeping staff.');
        return employees;
      } finally {
        if (isMountedRef.current) setIsEmployeeLoading(false);
      }
    },
    [employees, resolvePropertyId],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (employees.length > 0) return;
    const controller = new AbortController();
    void loadEmployees({ signal: controller.signal });
    return () => controller.abort();
  }, [employees.length, loadEmployees]);

  useEffect(() => {
    if (!assignRoom) return;
    const controller = new AbortController();
    void loadEmployees({ signal: controller.signal });
    return () => controller.abort();
  }, [assignRoom, loadEmployees]);

  useEffect(() => {
    if (!completeRoom) return;
    const controller = new AbortController();
    void loadEmployees({ signal: controller.signal });
    return () => controller.abort();
  }, [completeRoom, loadEmployees]);

  useEffect(() => {
    if (!staffAccessOpen) return;
    const controller = new AbortController();
    void loadEmployees({ signal: controller.signal });
    return () => controller.abort();
  }, [loadEmployees, staffAccessOpen]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!printEmployee) return;
    const timeout = window.setTimeout(() => {
      window.print();
      setPrintEmployee(undefined);
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [printEmployee]);

  const employeeOptions = useMemo(
    () =>
      employees
        .filter(
          (employee) =>
            employee.status.toUpperCase() === 'ACTIVE' &&
            employee.department.toUpperCase() === 'HOUSEKEEPING',
        )
        .map((employee) => ({
          label:
            assignRoom?.assignedEmployeeId === employee.id
              ? `${employee.displayName} (Currently assigned)`
              : employee.displayName,
          value: employee.id,
        })),
    [assignRoom?.assignedEmployeeId, employees],
  );
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const floorOptions = useMemo(
    () =>
      Array.from(new Set(rooms.map((room) => room.floor).filter(Boolean)))
        .sort((first, second) => {
          const firstValue = floorSortValue(first);
          const secondValue = floorSortValue(second);
          if (firstValue !== secondValue) return firstValue - secondValue;
          return first.localeCompare(second, undefined, { numeric: true });
        })
        .map((floor) => ({ label: floor, value: floor })),
    [rooms],
  );
  const staffOptions = useMemo(
    () =>
      Array.from(
        new Map(
          rooms
            .filter((room) => room.assignedEmployeeId && room.assignedEmployeeName)
            .map((room) => [
              room.assignedEmployeeId as string,
              {
                label: room.assignedEmployeeName as string,
                value: room.assignedEmployeeId as string,
              },
            ]),
        ).values(),
      ).sort((first, second) => first.label.localeCompare(second.label)),
    [rooms],
  );
  const filteredRooms = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesSearch =
        !query ||
        [
          room.number,
          room.floor,
          room.assignedEmployeeName,
          room.roomType,
          statusLabel(room.status),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesFloor = !floorFilter || room.floor === floorFilter;
      const matchesStatus =
        !statusFilter || roomMatchesGroup(room, statusFilter as (typeof groups)[number]['key']);
      const matchesStaff = !staffFilter || room.assignedEmployeeId === staffFilter;
      return matchesSearch && matchesFloor && matchesStatus && matchesStaff;
    });
  }, [floorFilter, rooms, roomSearch, staffFilter, statusFilter]);
  const attentionRooms = useMemo(
    () =>
      rooms
        .map((room) => ({ reason: attentionReason(room), room }))
        .filter((item): item is { reason: string; room: HousekeepingRoom } => Boolean(item.reason))
        .sort((first, second) => {
          const priority: Record<HousekeepingStatus, number> = {
            dirty: 0,
            inspection: 1,
            maintenance: 2,
            'out-of-order': 2,
            'out-of-service': 2,
            cleaning: 3,
            occupied: 4,
            ready: 5,
          };
          const priorityDiff = priority[first.room.status] - priority[second.room.status];
          if (priorityDiff !== 0) return priorityDiff;
          return first.room.number.localeCompare(second.room.number, undefined, { numeric: true });
        })
        .slice(0, 6),
    [rooms],
  );
  const staffWorkload = useMemo(() => {
    const workload = new Map<
      string,
      {
        assigned: number;
        cleaning: number;
        employeeId: string;
        employeeName: string;
        inspection: number;
        rooms: number;
      }
    >();
    let unassigned = 0;

    filteredRooms.forEach((room) => {
      if (!room.assignedEmployeeId) {
        unassigned += 1;
        return;
      }

      const current = workload.get(room.assignedEmployeeId) ?? {
        assigned: 0,
        cleaning: 0,
        employeeId: room.assignedEmployeeId,
        employeeName: room.assignedEmployeeName ?? 'Assigned staff',
        inspection: 0,
        rooms: 0,
      };
      current.assigned += 1;
      current.rooms += 1;
      if (room.status === 'cleaning') current.cleaning += 1;
      if (room.status === 'inspection') current.inspection += 1;
      workload.set(room.assignedEmployeeId, current);
    });

    const activeHousekeepingEmployees = employees.filter(
      (employee) =>
        employee.status.toUpperCase() === 'ACTIVE' &&
        employee.department.toUpperCase() === 'HOUSEKEEPING',
    );
    const idleStaff = activeHousekeepingEmployees
      .filter((employee) => !workload.has(employee.id))
      .map((employee) => employee.displayName)
      .sort((first, second) => first.localeCompare(second));

    return {
      idleStaff,
      rows: Array.from(workload.values()).sort((first, second) => {
        if (second.rooms !== first.rooms) return second.rooms - first.rooms;
        return first.employeeName.localeCompare(second.employeeName);
      }),
      unassigned,
    };
  }, [employees, filteredRooms]);
  const filteredRoomTotal = housekeepingVisibleRoomTotal(filteredRooms);
  const filtersActive = Boolean(roomSearch.trim() || floorFilter || statusFilter || staffFilter);
  const activeStaffCount = employeeOptions.length;
  const lastUpdatedLabel = isLoading ? 'Updating...' : 'Updated just now';
  const clearFilters = () => {
    setRoomSearch('');
    setFloorFilter(null);
    setStatusFilter(null);
    setStaffFilter(null);
  };

  const runAction = async (
    room: HousekeepingRoom,
    action: () => Promise<unknown>,
    success: string,
    feedback = actionSuccessLabel(primaryAction(room)),
  ) => {
    setLoadingRoomId(room.id);
    try {
      await action();
      setActionFeedback((current) => ({ ...current, [room.id]: feedback }));
      showToast({ color: 'green', title: 'Housekeeping updated', message: success });
      await new Promise((resolve) => {
        window.setTimeout(resolve, 550);
      });
      await loadDashboard();
    } catch (actionError) {
      showToast({
        color: 'red',
        title: 'Unable to update room',
        message: friendlyHousekeepingError(actionError),
      });
    } finally {
      setLoadingRoomId(undefined);
      window.setTimeout(() => {
        setActionFeedback((current) => {
          const next = { ...current };
          delete next[room.id];
          return next;
        });
      }, 900);
    }
  };

  const openComplete = (room: HousekeepingRoom) => {
    setCompleteRoom(room);
    setSelectedEmployeeId(room.assignedEmployeeId ?? null);
    setChecklist(
      room.checklist.some((item) => item.completed) ? room.checklist : createChecklist(),
    );
  };

  const openInspect = (room: HousekeepingRoom) => {
    setInspectRoom(room);
    setRejectReason(undefined);
    setChecklist(
      room.checklist.some((item) => item.completed) ? room.checklist : createChecklist(),
    );
  };

  const regenerateAccess = async (employee: HousekeepingEmployee) => {
    if (!window.confirm('Old QR will stop working. Continue?')) return;
    setStaffAccessBusy(`regenerate:${employee.id}`);
    try {
      await regenerateStaffAccess(propertyId, employee.id);
      await loadEmployees({ force: true });
      showToast({ color: 'green', title: 'Staff access updated', message: 'New QR is ready.' });
    } catch {
      showToast({
        color: 'red',
        title: 'Unable to regenerate QR',
        message: 'Please try again.',
      });
    } finally {
      setStaffAccessBusy(undefined);
    }
  };

  const toggleAccess = async (employee: HousekeepingEmployee) => {
    const enabled = Boolean(employee.staffAccessEnabled && employee.staffAccessToken);
    setStaffAccessBusy(`toggle:${employee.id}`);
    try {
      await updateStaffAccess(propertyId, employee.id, !enabled);
      await loadEmployees({ force: true });
      showToast({
        color: 'green',
        title: 'Staff access updated',
        message: enabled ? 'Access disabled.' : 'Access enabled.',
      });
    } catch {
      showToast({
        color: 'red',
        title: 'Unable to update access',
        message: 'Please try again.',
      });
    } finally {
      setStaffAccessBusy(undefined);
    }
  };

  return (
    <Stack gap={spacing[3]} mih="100%">
      <style jsx global>{`
        .staff-print-root {
          display: none;
        }
        .housekeeping-room-card {
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease;
        }
        .housekeeping-room-card:hover {
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08) !important;
          transform: translateY(-2px);
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .staff-print-root,
          .staff-print-root * {
            visibility: visible !important;
          }
          .staff-print-root {
            align-items: flex-start;
            background: #ffffff;
            display: flex !important;
            inset: 0;
            justify-content: center;
            padding: 24px;
            position: fixed;
          }
          .staff-print-card {
            border: 2px solid #101828;
            border-radius: 12px;
            color: #101828;
            font-family: Arial, sans-serif;
            padding: 20px;
            text-align: center;
            width: 300px;
          }
          .staff-print-card h1 {
            font-size: 26px;
            margin: 0 0 8px;
          }
          .staff-print-card p {
            font-size: 14px;
            margin: 7px 0;
            text-align: left;
          }
          .staff-print-kicker {
            font-size: 15px !important;
            font-weight: 800 !important;
            letter-spacing: 1.5px;
            margin: 0 0 18px !important;
            text-align: center !important;
          }
          .staff-print-card svg {
            height: 184px;
            margin: 18px auto;
            width: 184px;
          }
          .staff-print-hint {
            font-size: 15px !important;
            font-weight: 700 !important;
            text-align: center !important;
          }
        }
      `}</style>
      <PrintableStaffCard
        employee={printEmployee}
        origin={origin}
        propertyId={propertyId}
        propertyName={auth.user?.propertyName}
      />
      <Group justify="space-between" align="flex-start" gap={spacing[4]} wrap="wrap">
        <Box>
          <Title
            order={1}
            c="#101828"
            style={{ fontSize: 30, fontWeight: 750, lineHeight: '38px' }}
          >
            Housekeeping
          </Title>
          <Text c="#64748b" mt={4} style={{ fontSize: 14, lineHeight: '22px' }}>
            Assign rooms, track cleaning, and inspect rooms before release.
          </Text>
        </Box>
        <Group gap={spacing[2]} justify="flex-end" wrap="wrap">
          <Badge radius={radius.full} variant="light" color="gray">
            {housekeepingVisibleRoomTotal(rooms)} Rooms
          </Badge>
          <Badge radius={radius.full} variant="light" color="blue">
            {activeStaffCount} Active Staff
          </Badge>
          <Badge radius={radius.full} variant="light" color="green">
            {lastUpdatedLabel}
          </Badge>
          {canOpenStaffAccess ? (
            <Button leftSection={<QrCode size={17} />} onClick={() => setStaffAccessOpen(true)}>
              Staff Access
            </Button>
          ) : null}
        </Group>
      </Group>

      {error ? <Alert color="red">{error}</Alert> : null}
      {isLoading ? <Alert color="blue">Loading housekeeping rooms...</Alert> : null}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
        {groups.map((group) => {
          const status = group.key === 'maintenance-group' ? 'out-of-order' : group.key;
          const count = housekeepingGroupCount(rooms, group.key, summary);
          const tone = groupTone(group.key);
          const isActive = highlightedGroup === group.key;
          return (
            <Paper
              key={group.key}
              component="button"
              type="button"
              radius={radius.lg}
              p={16}
              onClick={() => scrollToGroup(group.key)}
              style={{
                ...cardStyle,
                background: isActive ? tone.background : '#ffffff',
                borderColor: isActive ? tone.border : 'rgba(226, 232, 240, 0.9)',
                boxShadow: isActive
                  ? `0 14px 32px ${tone.shadow}, 0 0 0 1px ${tone.border}`
                  : cardStyle.boxShadow,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
                width: '100%',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = tone.border;
                event.currentTarget.style.boxShadow = `0 12px 30px ${tone.shadow}`;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = isActive
                  ? tone.border
                  : 'rgba(226, 232, 240, 0.9)';
                event.currentTarget.style.boxShadow = isActive
                  ? `0 14px 32px ${tone.shadow}, 0 0 0 1px ${tone.border}`
                  : '0 8px 24px rgba(15, 23, 42, 0.035)';
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box>
                  <Text c="#334155" style={{ fontSize: 12, fontWeight: 700 }}>
                    {group.label}
                  </Text>
                  <Text c="#111827" mt={4} style={{ fontSize: 25, fontWeight: 800 }}>
                    {count}
                  </Text>
                </Box>
                <ThemeIcon radius={radius.full} style={{ background: tone.background, color: tone.color }}>
                  {statusIcon(status as HousekeepingStatus)}
                </ThemeIcon>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Card radius={radius.lg} p={16} style={cardStyle}>
        <Group justify="space-between" align="center" gap={spacing[3]} wrap="wrap">
          <Group gap={10}>
            <ThemeIcon radius={radius.full} color="yellow" variant="light">
              <AlertTriangle size={18} />
            </ThemeIcon>
            <Box>
              <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 750 }}>
                Requires Attention
              </Title>
              <Text c="#64748b" style={{ fontSize: 13, fontWeight: 650 }}>
                Urgent housekeeping rooms needing an action.
              </Text>
            </Box>
          </Group>
          <Badge radius={radius.full} color={attentionRooms.length > 0 ? 'yellow' : 'green'} variant="light">
            {attentionRooms.length} {attentionRooms.length === 1 ? 'item' : 'items'}
          </Badge>
        </Group>
        <Stack gap={8} mt={spacing[3]}>
          {attentionRooms.length > 0 ? (
            attentionRooms.map(({ reason, room }) => {
              const tone = statusTone(room.status);
              return (
                <Paper
                  key={room.id}
                  component="button"
                  type="button"
                  radius={radius.md}
                  p={12}
                  onClick={() => scrollToRoom(room)}
                  style={{
                    alignItems: 'center',
                    background: room.status === 'dirty' && !room.assignedEmployeeId ? '#fffbeb' : '#ffffff',
                    border: `1px solid ${tone.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
                    <ThemeIcon radius={radius.full} style={{ background: tone.background, color: tone.color }}>
                      {statusIcon(room.status)}
                    </ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Text c="#101828" style={{ fontSize: 14, fontWeight: 850 }}>
                        Room {room.number}
                      </Text>
                      <Text c="#64748b" style={{ fontSize: 12, fontWeight: 650 }}>
                        {reason} - {room.floor} - {getHousekeepingAgeLabel(room)}
                      </Text>
                    </Box>
                  </Group>
                  <StatusBadge status={room.status} />
                </Paper>
              );
            })
          ) : (
            <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
              <Text c="#64748b" style={{ fontSize: 13, fontWeight: 700 }}>
                No urgent housekeeping rooms right now.
              </Text>
            </Paper>
          )}
        </Stack>
      </Card>

      <Card
        radius={radius.lg}
        p={0}
        style={{ ...cardStyle, overflow: 'hidden' }}
      >
        <Group
          p={16}
          justify="space-between"
          gap={spacing[3]}
          wrap="wrap"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 750 }}>
            Room Workflow
          </Title>
          <Group gap={8}>
            <Badge radius={radius.full} variant="light" color="gray">
              {filteredRoomTotal} rooms
            </Badge>
            <Popover width={360} position="bottom-end" shadow="md">
              <Popover.Target>
                <Button variant="light" color="gray" size="xs" leftSection={<UserPlus size={14} />}>
                  Staff Workload
                </Button>
              </Popover.Target>
              <Popover.Dropdown p={spacing[3]}>
                <Stack gap={spacing[2]}>
                  <Group justify="space-between" gap={spacing[2]} wrap="nowrap">
                    <Text c="#101828" style={{ fontSize: 14, fontWeight: 800 }}>
                      Staff Workload
                    </Text>
                    <Badge radius={radius.full} variant="light" color="gray">
                      {filteredRoomTotal} rooms
                    </Badge>
                  </Group>
                  <Divider />
                  {staffWorkload.rows.length > 0 ? (
                    <Stack gap={8}>
                      {staffWorkload.rows.map((staff) => (
                        <Group
                          key={staff.employeeId}
                          justify="space-between"
                          align="flex-start"
                          gap={spacing[2]}
                          wrap="nowrap"
                        >
                          <Box style={{ minWidth: 0 }}>
                            <Text c="#334155" style={{ fontSize: 13, fontWeight: 800 }}>
                              {staff.employeeName}
                            </Text>
                            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 650 }}>
                              {[
                                `${staff.assigned} assigned`,
                                staff.cleaning > 0 ? `${staff.cleaning} in progress` : null,
                                staff.inspection > 0 ? `${staff.inspection} inspection` : null,
                              ]
                                .filter(Boolean)
                                .join(' / ')}
                            </Text>
                          </Box>
                          <Badge radius={radius.full} variant="light" color="blue">
                            {staff.rooms} {staff.rooms === 1 ? 'room' : 'rooms'}
                          </Badge>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text c="#94a3b8" style={{ fontSize: 13, fontWeight: 650 }}>
                      No assigned rooms in the current view.
                    </Text>
                  )}
                  <Divider />
                  <Group justify="space-between" gap={spacing[2]} wrap="nowrap">
                    <Text c="#334155" style={{ fontSize: 13, fontWeight: 800 }}>
                      Unassigned
                    </Text>
                    <Badge radius={radius.full} variant="light" color="yellow">
                      {staffWorkload.unassigned} {staffWorkload.unassigned === 1 ? 'room' : 'rooms'}
                    </Badge>
                  </Group>
                  <Group justify="space-between" gap={spacing[2]} wrap="nowrap">
                    <Text c="#334155" style={{ fontSize: 13, fontWeight: 800 }}>
                      Idle staff
                    </Text>
                    <Badge radius={radius.full} variant="light" color="green">
                      {staffWorkload.idleStaff.length}
                    </Badge>
                  </Group>
                  {staffWorkload.idleStaff.length > 0 ? (
                    <Text c="#64748b" style={{ fontSize: 12, fontWeight: 650, lineHeight: '18px' }}>
                      {staffWorkload.idleStaff.slice(0, 4).join(', ')}
                      {staffWorkload.idleStaff.length > 4
                        ? ` +${staffWorkload.idleStaff.length - 4} more`
                        : ''}
                    </Text>
                  ) : null}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Group>
        <Stack p={16} gap={spacing[4]}>
          <SimpleGrid cols={{ base: 1, md: 4 }} spacing={spacing[3]}>
            <TextInput
              placeholder="Search room, staff or floor"
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.currentTarget.value)}
              leftSection={<Search size={16} />}
              rightSection={
                roomSearch ? (
                  <ActionIcon
                    aria-label="Clear search"
                    variant="subtle"
                    color="gray"
                    onClick={() => setRoomSearch('')}
                  >
                    <X size={16} />
                  </ActionIcon>
                ) : null
              }
              styles={{ root: { gridColumn: 'span 1' } }}
            />
            <Select
              data={floorOptions}
              placeholder="All Floors"
              value={floorFilter}
              onChange={setFloorFilter}
              clearable
            />
            <Select
              data={statusFilterOptions}
              placeholder="All Statuses"
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
            />
            <Select
              data={staffOptions}
              placeholder="All Staff"
              value={staffFilter}
              onChange={setStaffFilter}
              clearable
            />
          </SimpleGrid>
          {filtersActive ? (
            <Group justify="space-between" gap={spacing[2]} wrap="wrap">
              <Text c="#64748b" style={{ fontSize: 13, fontWeight: 650 }}>
                Showing {filteredRoomTotal} of {housekeepingVisibleRoomTotal(rooms)} rooms
              </Text>
              <Button variant="light" color="gray" size="xs" onClick={clearFilters}>
                Clear Filters
              </Button>
            </Group>
          ) : null}
          {filtersActive && filteredRoomTotal === 0 ? (
            <Alert color="gray">
              {roomSearch.trim()
                ? `No rooms match "${roomSearch.trim()}".`
                : 'No rooms match your filters.'}
            </Alert>
          ) : null}
          {groups.map((group) => {
            const groupRooms = filteredRooms.filter((room) => roomMatchesGroup(room, group.key));
            const isExpanded = expandedGroups[group.key];
            const floorGroups = groupRoomsByFloor(groupRooms);
            const isHighlighted = highlightedGroup === group.key;
            const tone = groupTone(group.key);
            return (
              <Stack
                key={group.key}
                ref={(node) => {
                  sectionRefs.current[group.key] = node;
                }}
                gap={spacing[2]}
                style={{ scrollMarginTop: 16 }}
              >
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() =>
                    setExpandedGroups((current) => ({
                      ...current,
                      [group.key]: !current[group.key],
                    }))
                  }
                  rightSection={
                    <ChevronDown
                      size={18}
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 140ms ease',
                      }}
                    />
                  }
                  styles={{
                    root: {
                      background: isHighlighted ? tone.background : '#ffffff',
                      border: `1px solid ${isHighlighted ? tone.border : '#e2e8f0'}`,
                      boxShadow: isHighlighted ? `0 0 0 3px ${tone.shadow}` : undefined,
                      height: 'auto',
                      padding: '12px 14px',
                      transition: 'border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
                    },
                    inner: { justifyContent: 'space-between' },
                    label: { width: '100%' },
                  }}
                >
                  <Group justify="space-between" w="100%" gap={spacing[2]} wrap="nowrap">
                    <Title order={3} c={tone.color} style={{ fontSize: 15, fontWeight: 800 }}>
                      {group.label} · {groupRooms.length} rooms
                    </Title>
                  </Group>
                </Button>
                <Box
                  aria-hidden={!isExpanded}
                  style={{
                    maxHeight: isExpanded ? 2400 : 0,
                    opacity: isExpanded ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 180ms ease, opacity 140ms ease',
                  }}
                >
                  {groupRooms.length > 0 ? (
                    <Stack gap={spacing[3]} pt={spacing[2]}>
                      {floorGroups.map((floorGroup) => (
                        <Stack key={`${group.key}-${floorGroup.floor}`} gap={spacing[2]}>
                          <Group gap={8}>
                            <Badge
                              leftSection={<Building2 size={12} />}
                              radius={radius.full}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                color: '#475569',
                                fontWeight: 750,
                                textTransform: 'none',
                              }}
                            >
                              {floorGroup.floor}
                            </Badge>
                            <Text c="#94a3b8" style={{ fontSize: 12, fontWeight: 700 }}>
                              {floorGroup.rooms.length} rooms
                            </Text>
                          </Group>
                          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing={spacing[3]}>
                            {floorGroup.rooms.map((room) => (
                              <Box
                                key={room.id}
                                ref={(node) => {
                                  roomRefs.current[room.id] = node;
                                }}
                                style={{ scrollMarginTop: 24 }}
                              >
                                <RoomCard
                                  feedback={actionFeedback[room.id]}
                                  highlighted={highlightedRoomId === room.id}
                                  loading={loadingRoomId === room.id}
                                  onAssign={(nextRoom) => {
                                    setAssignRoom(nextRoom);
                                    setSelectedEmployeeId(nextRoom.assignedEmployeeId ?? null);
                                  }}
                                  onComplete={openComplete}
                                  onInspect={openInspect}
                                  onStart={(nextRoom) =>
                                    void runAction(
                                      nextRoom,
                                      () =>
                                        startHousekeepingRoom(
                                          propertyId,
                                          nextRoom.id,
                                          nextRoom.assignedEmployeeId,
                                        ),
                                      `Room ${nextRoom.number} is in progress.`,
                                    )
                                  }
                                  room={room}
                                />
                              </Box>
                            ))}
                          </SimpleGrid>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Paper
                      radius={radius.md}
                      px={14}
                      py={12}
                      mt={spacing[2]}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #cbd5e1',
                      }}
                    >
                      <Group gap={8}>
                        <CheckCircle2 size={16} color="#15803d" />
                        <Text c="#64748b" style={{ fontSize: 13, fontWeight: 700 }}>
                          {emptyGroupMessage(group.key)}
                        </Text>
                      </Group>
                    </Paper>
                  )}
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </Card>

      <Modal
        opened={Boolean(assignRoom)}
        onClose={() => setAssignRoom(null)}
        title={assignRoom?.assignedEmployeeId ? 'Change Staff' : 'Assign Staff'}
        centered
      >
        <Stack>
          <Text c="#334155" style={{ fontWeight: 700 }}>
            Room {assignRoom?.number}
          </Text>
          <Select
            data={employeeOptions}
            label="Housekeeping staff"
            disabled={isEmployeeLoading || employeeOptions.length === 0}
            placeholder={
              isEmployeeLoading
                ? 'Loading housekeeping staff'
                : employeeOptions.length === 0
                  ? 'No housekeeping staff available'
                  : 'Select housekeeping staff'
            }
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
          />
          {isEmployeeLoading ? <Alert color="blue">Loading housekeeping staff...</Alert> : null}
          {employeeError ? (
            <Alert color="red">
              <Group justify="space-between" gap={8}>
                <Text size="sm">{employeeError}</Text>
                <Button size="xs" variant="light" onClick={() => void loadEmployees({ force: true })}>
                  Retry
                </Button>
              </Group>
            </Alert>
          ) : null}
          {!isEmployeeLoading && !employeeError && employeeOptions.length === 0 ? (
            <Alert color="yellow">
              No housekeeping staff found. Ask a manager to add housekeeping employees.
            </Alert>
          ) : null}
          {canManageEmployees ? (
            <Button
              component={Link}
              href="/settings/employees"
              variant="light"
              leftSection={<UserPlus size={16} />}
            >
              Manage Employees
            </Button>
          ) : null}
          <Button
            disabled={!assignRoom || !selectedEmployeeId || isEmployeeLoading}
            onClick={() => {
              if (!assignRoom || !selectedEmployeeId) return;
              const room = assignRoom;
              const wasAssigned = Boolean(room.assignedEmployeeId);
              setAssignRoom(null);
              void runAction(
                room,
                () => assignHousekeepingRoom(propertyId, room.id, selectedEmployeeId),
                wasAssigned
                  ? `Room reassigned to ${selectedEmployee?.displayName ?? 'staff'}.`
                  : `Room assigned to ${selectedEmployee?.displayName ?? 'staff'}.`,
                'Assigned',
              );
            }}
          >
            Save
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(completeRoom)}
        onClose={() => setCompleteRoom(null)}
        title="Complete cleaning on behalf"
        centered
        size="lg"
      >
        <Stack>
          <Text c="#64748b" style={{ fontSize: 14, lineHeight: '22px' }}>
            Use this when staff has finished the room but cannot update StayOS.
          </Text>
          <Text c="#334155" style={{ fontSize: 13, fontWeight: 800 }}>
            {completeRoom?.assignedEmployeeName
              ? `Assigned staff: ${completeRoom.assignedEmployeeName}`
              : 'Assigned staff required'}
          </Text>
          <Select
            data={employeeOptions}
            label="Staff"
            disabled={isEmployeeLoading || employeeOptions.length === 0}
            placeholder={
              isEmployeeLoading
                ? 'Loading housekeeping staff'
                : employeeOptions.length === 0
                  ? 'No housekeeping staff available'
                  : 'Select housekeeping staff'
            }
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
          />
          {isEmployeeLoading ? <Alert color="blue">Loading housekeeping staff...</Alert> : null}
          {employeeError ? (
            <Alert color="red">
              <Group justify="space-between" gap={8}>
                <Text size="sm">{employeeError}</Text>
                <Button size="xs" variant="light" onClick={() => void loadEmployees({ force: true })}>
                  Retry
                </Button>
              </Group>
            </Alert>
          ) : null}
          {!isEmployeeLoading && !employeeError && employeeOptions.length === 0 ? (
            <Alert color="yellow">
              No housekeeping staff found. Ask a manager to add housekeeping employees.
            </Alert>
          ) : null}
          {canManageEmployees ? (
            <Button
              component={Link}
              href="/settings/employees"
              variant="light"
              leftSection={<UserPlus size={16} />}
            >
              Manage Employees
            </Button>
          ) : null}
          <Button
            variant="light"
            onClick={() =>
              setChecklist((items) => items.map((item) => ({ ...item, completed: true })))
            }
          >
            Mark all done
          </Button>
          <ChecklistButtons
            checklist={checklist}
            onToggle={(key) =>
              setChecklist((items) =>
                items.map((item) =>
                  item.key === key ? { ...item, completed: !item.completed } : item,
                ),
              )
            }
          />
          <Button
            disabled={
              !completeRoom ||
              !selectedEmployeeId ||
              isEmployeeLoading ||
              checklist.some((item) => !item.completed)
            }
            onClick={() => {
              if (!completeRoom || !selectedEmployeeId) return;
              const room = completeRoom;
              setCompleteRoom(null);
              void runAction(
                room,
                () =>
                  completeHousekeepingRoom(propertyId, room.id, {
                    checklist: serializeChecklist(checklist),
                    completedOnBehalf: true,
                    employeeId: selectedEmployeeId,
                  }),
                'Room sent for inspection.',
                'Submitted',
              );
            }}
          >
            Send for Inspection
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(inspectRoom)}
        onClose={() => setInspectRoom(null)}
        title="Inspect Room"
        centered
        size="lg"
      >
        <Stack>
          <Text c="#334155" style={{ fontSize: 13, fontWeight: 800 }}>
            Checklist {checklistItemsProgress(checklist)}
          </Text>
          <ChecklistButtons
            checklist={checklist}
            onToggle={(key) =>
              setChecklist((items) =>
                items.map((item) =>
                  item.key === key ? { ...item, completed: !item.completed } : item,
                ),
              )
            }
          />
          <Text c="#334155" style={{ fontSize: 13, fontWeight: 700 }}>
            Send back reason
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {createChecklist().map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  variant={rejectReason === item.label ? 'filled' : 'light'}
                  color={rejectReason === item.label ? 'red' : 'gray'}
                  leftSection={<Icon size={17} />}
                  onClick={() =>
                    setRejectReason((current) => (current === item.label ? undefined : item.label))
                  }
                >
                  {item.label}
                </Button>
              );
            })}
          </SimpleGrid>
          <Group justify="flex-end">
            <Button
              color="red"
              variant="light"
              disabled={!canSendBackInspection}
              onClick={() => {
                if (!canSendBackInspection || !inspectRoom || !rejectReason) return;
                const room = inspectRoom;
                setInspectRoom(null);
                void runAction(
                  room,
                  () =>
                    inspectHousekeepingRoom(propertyId, room.id, {
                      action: 'REJECT',
                      reworkReason: rejectReason,
                    }),
                  `Room ${room.number} sent back.`,
                  'Submitted',
                );
              }}
            >
              Send Back
            </Button>
            <Button
              color="green"
              disabled={!canMarkInspectionReady}
              onClick={() => {
                if (!canMarkInspectionReady || !inspectRoom) return;
                const room = inspectRoom;
                setInspectRoom(null);
                void runAction(
                  room,
                  () => inspectHousekeepingRoom(propertyId, room.id, { action: 'APPROVE' }),
                  `Room ${room.number} is ready.`,
                  'Approved',
                );
              }}
            >
              Mark Ready
            </Button>
          </Group>
        </Stack>
      </Modal>

      <StaffAccessModal
        employees={employees}
        isLoadingEmployees={isEmployeeLoading}
        isBusy={staffAccessBusy}
        onClose={() => setStaffAccessOpen(false)}
        onPrint={setPrintEmployee}
        onRegenerate={(employee) => void regenerateAccess(employee)}
        onToggleAccess={(employee) => void toggleAccess(employee)}
        opened={staffAccessOpen}
        origin={origin}
        propertyId={propertyId}
        propertyName={auth.user?.propertyName}
      />

    </Stack>
  );
}
