'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  ScrollArea,
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
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Plus,
  Sparkles,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  assignHousekeepingRoom,
  completeHousekeepingRoom,
  createHousekeepingEmployee,
  friendlyHousekeepingError,
  getCurrentPropertyId,
  getHousekeepingDashboard,
  getHousekeepingEmployees,
  inspectHousekeepingRoom,
  startHousekeepingRoom,
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

function checklistProgress(room: HousekeepingRoom) {
  const done = room.checklist.filter((item) => item.completed).length;
  return `${done}/${room.checklist.length}`;
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
  if (room.status === 'inspection') return 'Inspect';
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
          {room.assignedEmployeeName ? `Assigned to ${room.assignedEmployeeName}` : 'Unassigned'}
        </Text>
        {room.status === 'cleaning' && room.assignedEmployeeName ? (
          <Text c="#1d4ed8" style={{ fontSize: 13, fontWeight: 700 }}>
            Cleaning by {room.assignedEmployeeName}
          </Text>
        ) : null}
        <Text c="#64748b" style={{ fontSize: 12, fontWeight: 600 }}>
          Checklist {checklistProgress(room)}
        </Text>
        <Text c="#94a3b8" style={{ fontSize: 12, fontWeight: 500 }}>
          {room.updatedAt ?? room.completedAt ?? room.startedAt ?? 'Updated today'}
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
          <Button leftSection={<Brush size={16} />} onClick={() => onStart(room)} loading={loading}>
            Start Cleaning
          </Button>
        ) : null}
        {room.status === 'cleaning' ? (
          <Button
            leftSection={<ClipboardCheck size={16} />}
            onClick={() => onComplete(room)}
            loading={loading}
          >
            Complete on behalf
          </Button>
        ) : null}
        {room.status === 'inspection' ? (
          <Button leftSection={<Eye size={16} />} onClick={() => onInspect(room)} loading={loading}>
            Inspect
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
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<HousekeepingRoom[]>([]);
  const [employees, setEmployees] = useState<HousekeepingEmployee[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRoomId, setLoadingRoomId] = useState<string>();
  const [assignRoom, setAssignRoom] = useState<HousekeepingRoom | null>(null);
  const [completeRoom, setCompleteRoom] = useState<HousekeepingRoom | null>(null);
  const [inspectRoom, setInspectRoom] = useState<HousekeepingRoom | null>(null);
  const [staffOpened, setStaffOpened] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<HousekeepingChecklistItem[]>(createChecklist());
  const [rejectReason, setRejectReason] = useState<string>();
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    phone: '',
  });
  const updateNewEmployee =
    (field: keyof typeof newEmployee) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;

      setNewEmployee((current) => ({ ...current, [field]: value }));
    };

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

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ label: employee.displayName, value: employee.id })),
    [employees],
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

  return (
    <Stack gap={spacing[3]} h="100%" style={{ minHeight: 0 }}>
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
        title="Assign Staff"
        centered
      >
        <Stack>
          <Text c="#334155" style={{ fontWeight: 700 }}>
            Room {assignRoom?.number}
          </Text>
          <Select
            data={employeeOptions}
            label="Housekeeping staff"
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
          />
          <Button
            disabled={!assignRoom || !selectedEmployeeId}
            onClick={() => {
              if (!assignRoom || !selectedEmployeeId) return;
              const room = assignRoom;
              setAssignRoom(null);
              void runAction(
                room,
                () => assignHousekeepingRoom(propertyId, room.id, selectedEmployeeId),
                `Assigned to ${selectedEmployee?.displayName ?? 'staff'}.`,
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
        title="Complete on behalf"
        centered
        size="lg"
      >
        <Stack>
          <Select
            data={employeeOptions}
            label="Staff"
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
          />
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
                `Room ${room.number} sent for inspection.`,
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
          <ChecklistButtons checklist={checklist} onToggle={() => undefined} />
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
                  onClick={() => setRejectReason(item.label)}
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
              disabled={!inspectRoom}
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

      <Modal
        opened={staffOpened}
        onClose={() => setStaffOpened(false)}
        title="Manage Staff"
        centered
        size="lg"
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {employees.map((employee) => (
              <Paper
                key={employee.id}
                radius={radius.md}
                p={12}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              >
                <Text c="#101828" style={{ fontWeight: 800 }}>
                  {employee.displayName}
                </Text>
                <Text c="#64748b" style={{ fontSize: 12, fontWeight: 600 }}>
                  {employee.phone || employee.employeeCode || 'Housekeeping'}
                </Text>
                <Text c="#6d5dfc" mt={6} style={{ fontSize: 12, fontWeight: 700 }}>
                  /housekeeping/staff/{employee.id}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Group grow align="flex-end" wrap="wrap">
            <TextInput
              label="First name"
              value={newEmployee.firstName}
              onChange={updateNewEmployee('firstName')}
            />
            <TextInput
              label="Last name"
              value={newEmployee.lastName}
              onChange={updateNewEmployee('lastName')}
            />
          </Group>
          <Group grow align="flex-end" wrap="wrap">
            <TextInput
              label="Display name"
              value={newEmployee.displayName}
              onChange={updateNewEmployee('displayName')}
            />
            <TextInput
              label="Phone"
              value={newEmployee.phone}
              onChange={updateNewEmployee('phone')}
            />
          </Group>
          <Button
            leftSection={<Plus size={16} />}
            onClick={async () => {
              try {
                await createHousekeepingEmployee(propertyId, {
                  ...newEmployee,
                  displayName:
                    newEmployee.displayName ||
                    `${newEmployee.firstName} ${newEmployee.lastName}`.trim(),
                  status: 'ACTIVE',
                });
                setNewEmployee({ firstName: '', lastName: '', displayName: '', phone: '' });
                await load();
              } catch (createError) {
                showToast({
                  color: 'red',
                  title: 'Unable to create staff',
                  message: friendlyHousekeepingError(createError),
                });
              }
            }}
          >
            Add Staff
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
