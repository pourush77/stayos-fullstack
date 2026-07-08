'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Brush,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Eye,
  Printer,
  QrCode,
  RotateCw,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  UserPlus,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../features/auth/auth-context';
import {
  assignHousekeepingRoom,
  completeHousekeepingRoom,
  friendlyHousekeepingError,
  getCurrentPropertyId,
  getHousekeepingDashboard,
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
  HousekeepingEmployee,
  HousekeepingRoom,
  HousekeepingStatus,
} from '../../features/housekeeping/types/housekeeping.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const groups: Array<{ key: HousekeepingStatus | 'maintenance-group'; label: string }> = [
  { key: 'dirty', label: 'Needs Cleaning' },
  { key: 'cleaning', label: 'In Progress' },
  { key: 'inspection', label: 'Waiting Inspection' },
  { key: 'ready', label: 'Ready' },
  { key: 'maintenance-group', label: 'Maintenance / Out of Order' },
];

function statusLabel(status: HousekeepingStatus) {
  if (status === 'dirty') return 'Needs Cleaning';
  if (status === 'cleaning') return 'In Progress';
  if (status === 'inspection') return 'Inspection';
  if (status === 'ready') return 'Ready';
  if (status === 'maintenance') return 'Maintenance';
  if (status === 'out-of-service') return 'Out of Service';
  return 'Out of Order';
}

function statusTone(status: HousekeepingStatus) {
  if (status === 'ready') return { color: '#15803d', background: '#f0fdf4', border: '#bbf7d0' };
  if (status === 'cleaning') return { color: '#1d4ed8', background: '#eff6ff', border: '#bfdbfe' };
  if (status === 'inspection')
    return { color: '#6d5dfc', background: '#f5f3ff', border: '#ddd6fe' };
  if (status === 'maintenance' || status === 'out-of-order' || status === 'out-of-service') {
    return { color: '#dc2626', background: '#fef2f2', border: '#fecaca' };
  }
  return { color: '#b45309', background: '#fffbeb', border: '#fde68a' };
}

function statusIcon(status: HousekeepingStatus) {
  if (status === 'ready') return <CheckCircle2 size={17} />;
  if (status === 'cleaning') return <Brush size={17} />;
  if (status === 'inspection') return <Eye size={17} />;
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

function staffAccessUrl(origin: string, employee: HousekeepingEmployee) {
  if (!origin || !employee.staffAccessToken) return '';
  return `${origin}/housekeeping/staff/access/${employee.staffAccessToken}`;
}

function checklistProgress(room: HousekeepingRoom) {
  const done = room.checklist.filter((item) => item.completed).length;
  return `${done}/${room.checklist.length}`;
}

function checklistItemsProgress(items: HousekeepingChecklistItem[]) {
  const done = items.filter((item) => item.completed).length;
  return `${done}/${items.length}`;
}

function checklistPercent(room: HousekeepingRoom) {
  if (room.checklist.length === 0) return 0;
  return (room.checklist.filter((item) => item.completed).length / room.checklist.length) * 100;
}

function formatTimestamp(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function roomActivityLabel(room: HousekeepingRoom) {
  if (room.status === 'cleaning' && room.startedAt) return `Started ${formatTimestamp(room.startedAt)}`;
  if (room.status === 'inspection' && room.completedAt)
    return `Completed ${formatTimestamp(room.completedAt)}`;
  if (room.inspectedAt) return `Inspected ${formatTimestamp(room.inspectedAt)}`;
  if (room.updatedAt) return `Updated ${formatTimestamp(room.updatedAt)}`;
  return 'Updated today';
}

function roomMatchesGroup(room: HousekeepingRoom, group: (typeof groups)[number]['key']) {
  if (group === 'maintenance-group') {
    return ['maintenance', 'out-of-order', 'out-of-service'].includes(room.status);
  }
  return room.status === group;
}

function primaryAction(room: HousekeepingRoom) {
  if (room.status === 'dirty') return room.assignedEmployeeId ? 'Start Cleaning' : 'Assign Staff';
  if (room.status === 'cleaning') return 'Complete on behalf';
  if (room.status === 'inspection') return 'Inspect Room';
  return 'View';
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
}: {
  employee?: HousekeepingEmployee;
  origin: string;
  propertyName?: string;
}) {
  const url = employee ? staffAccessUrl(origin, employee) : '';
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
  isBusy,
  onClose,
  onPrint,
  onRegenerate,
  onToggleAccess,
  opened,
  origin,
  propertyName,
}: {
  employees: HousekeepingEmployee[];
  isBusy?: string;
  onClose: () => void;
  onPrint: (employee: HousekeepingEmployee) => void;
  onRegenerate: (employee: HousekeepingEmployee) => void;
  onToggleAccess: (employee: HousekeepingEmployee) => void;
  opened: boolean;
  origin: string;
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
        {activeHousekeeping.length === 0 ? (
          <Alert color="yellow">No active housekeeping employees found.</Alert>
        ) : null}
        {activeHousekeeping.map((employee) => {
          const enabled = Boolean(employee.staffAccessEnabled && employee.staffAccessToken);
          const url = staffAccessUrl(origin, employee);
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
  loading,
  onAssign,
  onComplete,
  onInspect,
  onStart,
  room,
}: {
  loading?: boolean;
  onAssign: (room: HousekeepingRoom) => void;
  onComplete: (room: HousekeepingRoom) => void;
  onInspect: (room: HousekeepingRoom) => void;
  onStart: (room: HousekeepingRoom) => void;
  room: HousekeepingRoom;
}) {
  const action = primaryAction(room);
  return (
    <Paper radius={radius.lg} p={16} style={cardStyle}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c="#101828" style={{ fontSize: 34, fontWeight: 800, lineHeight: '38px' }}>
            {room.number}
          </Text>
          <Text c="#475569" mt={4} style={{ fontSize: 13, fontWeight: 650 }}>
            {room.roomType} - {room.floor}
          </Text>
        </Box>
        <StatusBadge status={room.status} />
      </Group>

      <Stack gap={6} mt={14}>
        <Text c="#334155" style={{ fontSize: 13, fontWeight: 700 }}>
          {room.status === 'cleaning' && room.assignedEmployeeName
            ? `Cleaning by ${room.assignedEmployeeName}`
            : room.assignedEmployeeName
              ? `Assigned to ${room.assignedEmployeeName}`
              : 'Unassigned'}
        </Text>
        {room.status === 'inspection' ? (
          <Text c="#334155" style={{ fontSize: 13, fontWeight: 700 }}>
            {room.completedByEmployeeId || room.assignedEmployeeName
              ? `Completed by ${room.assignedEmployeeName ?? 'staff'}`
              : 'Completed by staff'}
          </Text>
        ) : null}
        <Text c="#64748b" style={{ fontSize: 12, fontWeight: 600 }}>
          Checklist {checklistProgress(room)}
        </Text>
        <Progress value={checklistPercent(room)} size={5} radius={radius.full} color="green" />
        <Text c="#94a3b8" style={{ fontSize: 12, fontWeight: 500 }}>
          {roomActivityLabel(room)}
        </Text>
      </Stack>

      <Group mt={16} justify="flex-end">
        {room.status === 'dirty' && !room.assignedEmployeeId ? (
          <Button
            leftSection={<UserPlus size={16} />}
            onClick={() => onAssign(room)}
            loading={loading}
          >
            Assign Staff
          </Button>
        ) : null}
        {room.status === 'dirty' && room.assignedEmployeeId ? (
          <>
            <Button
              variant="light"
              color="gray"
              onClick={() => onAssign(room)}
              loading={loading}
            >
              Change Staff
            </Button>
            <Button
              variant="light"
              leftSection={<ClipboardCheck size={16} />}
              onClick={() => onComplete(room)}
              loading={loading}
            >
              Complete on behalf
            </Button>
            <Button
              leftSection={<Brush size={16} />}
              onClick={() => onStart(room)}
              loading={loading}
            >
              Start Cleaning
            </Button>
          </>
        ) : null}
        {room.status === 'cleaning' ? (
          <>
            <Button
              variant="light"
              color="gray"
              onClick={() => onAssign(room)}
              loading={loading}
            >
              Change Staff
            </Button>
            <Button
              leftSection={<ClipboardCheck size={16} />}
              onClick={() => onComplete(room)}
              loading={loading}
            >
              Complete on behalf
            </Button>
          </>
        ) : null}
        {room.status === 'inspection' ? (
          <Button leftSection={<Eye size={16} />} onClick={() => onInspect(room)} loading={loading}>
            Inspect Room
          </Button>
        ) : null}
        {['ready', 'maintenance', 'out-of-order', 'out-of-service'].includes(room.status) ? (
          <Button variant="light" color="gray">
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
  const [employees, setEmployees] = useState<HousekeepingEmployee[]>([]);
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRoomId, setLoadingRoomId] = useState<string>();
  const [staffAccessOpen, setStaffAccessOpen] = useState(false);
  const [staffAccessBusy, setStaffAccessBusy] = useState<string>();
  const [printEmployee, setPrintEmployee] = useState<HousekeepingEmployee>();
  const [assignRoom, setAssignRoom] = useState<HousekeepingRoom | null>(null);
  const [completeRoom, setCompleteRoom] = useState<HousekeepingRoom | null>(null);
  const [inspectRoom, setInspectRoom] = useState<HousekeepingRoom | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<HousekeepingChecklistItem[]>(createChecklist());
  const [rejectReason, setRejectReason] = useState<string>();
  const checklistComplete = checklist.length > 0 && checklist.every((item) => item.completed);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(undefined);
      setIsLoading(true);
      try {
        const nextPropertyId = propertyId || (await getCurrentPropertyId(signal));
        const [nextRooms, nextEmployees] = await Promise.all([
          getHousekeepingDashboard(nextPropertyId, signal),
          getHousekeepingEmployees(nextPropertyId, signal),
        ]);
        setPropertyId(nextPropertyId);
        setRooms(nextRooms);
        setEmployees(nextEmployees);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Housekeeping is temporarily unavailable.');
      } finally {
        setIsLoading(false);
      }
    },
    [propertyId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

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

  const runAction = async (
    room: HousekeepingRoom,
    action: () => Promise<unknown>,
    success: string,
  ) => {
    setLoadingRoomId(room.id);
    try {
      await action();
      showToast({ color: 'green', title: 'Housekeeping updated', message: success });
      await load();
    } catch (actionError) {
      showToast({
        color: 'red',
        title: 'Unable to update room',
        message: friendlyHousekeepingError(actionError),
      });
    } finally {
      setLoadingRoomId(undefined);
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
      await load();
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
      await load();
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
    <Stack gap={spacing[3]} h="100%" style={{ minHeight: 0 }}>
      <style jsx global>{`
        .staff-print-root {
          display: none;
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
        {canOpenStaffAccess ? (
          <Button leftSection={<QrCode size={17} />} onClick={() => setStaffAccessOpen(true)}>
            Staff Access
          </Button>
        ) : null}
      </Group>

      {error ? <Alert color="red">{error}</Alert> : null}
      {isLoading ? <Alert color="blue">Loading housekeeping rooms...</Alert> : null}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing={spacing[3]}>
        {groups.map((group) => {
          const status = group.key === 'maintenance-group' ? 'out-of-order' : group.key;
          const count = rooms.filter((room) => roomMatchesGroup(room, group.key)).length;
          return (
            <Paper key={group.key} radius={radius.lg} p={16} style={cardStyle}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box>
                  <Text c="#334155" style={{ fontSize: 12, fontWeight: 700 }}>
                    {group.label}
                  </Text>
                  <Text c="#111827" mt={4} style={{ fontSize: 25, fontWeight: 800 }}>
                    {count}
                  </Text>
                </Box>
                <ThemeIcon
                  variant="light"
                  color={status === 'ready' ? 'green' : 'stayosBrand'}
                  radius={radius.full}
                >
                  {statusIcon(status as HousekeepingStatus)}
                </ThemeIcon>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Card
        radius={radius.lg}
        p={0}
        style={{ ...cardStyle, flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}
      >
        <Group p={16} justify="space-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 750 }}>
            Room Workflow
          </Title>
          <Badge radius={radius.full} variant="light" color="gray">
            {employees.length} active staff
          </Badge>
        </Group>
        <ScrollArea
          style={{
            maxHeight: 'calc(100vh - 330px)',
            minHeight: 280,
          }}
          scrollbarSize={6}
        >
          <Stack p={12} gap={spacing[4]}>
            {groups.map((group) => {
              const groupRooms = rooms.filter((room) => roomMatchesGroup(room, group.key));
              return (
                <Stack key={group.key} gap={spacing[2]}>
                  <Group justify="space-between">
                    <Title order={3} c="#334155" style={{ fontSize: 15, fontWeight: 800 }}>
                      {group.label}
                    </Title>
                    <Text c="#94a3b8" style={{ fontSize: 12, fontWeight: 700 }}>
                      {groupRooms.length} rooms
                    </Text>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing={spacing[3]}>
                    {groupRooms.map((room) => (
                      <RoomCard
                        key={room.id}
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
                    ))}
                  </SimpleGrid>
                </Stack>
              );
            })}
          </Stack>
        </ScrollArea>
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
            disabled={employeeOptions.length === 0}
            placeholder={
              employeeOptions.length === 0
                ? 'No housekeeping staff available'
                : 'Select housekeeping staff'
            }
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
          />
          {employeeOptions.length === 0 ? (
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
            disabled={!assignRoom || !selectedEmployeeId}
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
            disabled={employeeOptions.length === 0}
            placeholder={
              employeeOptions.length === 0
                ? 'No housekeeping staff available'
                : 'Select housekeeping staff'
            }
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
          />
          {employeeOptions.length === 0 ? (
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
              !completeRoom || !selectedEmployeeId || checklist.some((item) => !item.completed)
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
              disabled={!inspectRoom || !rejectReason}
              onClick={() => {
                if (!inspectRoom || !rejectReason) return;
                const room = inspectRoom;
                setInspectRoom(null);
                void runAction(
                  room,
                  () =>
                    inspectHousekeepingRoom(propertyId, room.id, {
                      action: 'REJECT',
                      reason: rejectReason,
                    }),
                  `Room ${room.number} sent back.`,
                );
              }}
            >
              Send Back
            </Button>
            <Button
              color="green"
              disabled={!inspectRoom || !checklistComplete}
              onClick={() => {
                if (!inspectRoom) return;
                const room = inspectRoom;
                setInspectRoom(null);
                void runAction(
                  room,
                  () => inspectHousekeepingRoom(propertyId, room.id, { action: 'APPROVE' }),
                  `Room ${room.number} is ready.`,
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
        isBusy={staffAccessBusy}
        onClose={() => setStaffAccessOpen(false)}
        onPrint={setPrintEmployee}
        onRegenerate={(employee) => void regenerateAccess(employee)}
        onToggleAccess={(employee) => void toggleAccess(employee)}
        opened={staffAccessOpen}
        origin={origin}
        propertyName={auth.user?.propertyName}
      />

    </Stack>
  );
}
