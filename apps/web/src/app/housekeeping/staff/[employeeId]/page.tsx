'use client';

import {
  Alert,
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
  Title,
} from '@mantine/core';
import { Brush, CheckCircle2, ClipboardCheck, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  completeHousekeepingRoom,
  friendlyHousekeepingError,
  getCurrentPropertyId,
  getHousekeepingDashboard,
  getHousekeepingEmployees,
  startHousekeepingRoom,
} from '../../../../features/housekeeping/api/housekeeping-api';
import { createChecklist, serializeChecklist } from '../../../../features/housekeeping/utils/housekeeping-checklist';
import type {
  HousekeepingChecklistItem,
  HousekeepingEmployee,
  HousekeepingRoom,
} from '../../../../features/housekeeping/types/housekeeping.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function statusLabel(status: HousekeepingRoom['status']) {
  if (status === 'dirty') return 'Needs Cleaning';
  if (status === 'cleaning') return 'Cleaning';
  if (status === 'inspection') return 'Inspection';
  if (status === 'ready') return 'Ready';
  return 'Unavailable';
}

function StaffChecklist({
  items,
  onToggle,
}: {
  items: HousekeepingChecklistItem[];
  onToggle: (key: string) => void;
}) {
  return (
    <SimpleGrid cols={2} spacing={12}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.key}
            aria-pressed={item.completed}
            color={item.completed ? 'green' : 'gray'}
            h={96}
            leftSection={<Icon size={30} />}
            onClick={() => onToggle(item.key)}
            radius={radius.lg}
            variant={item.completed ? 'filled' : 'light'}
            styles={{ inner: { flexDirection: 'column', gap: 8 }, label: { fontSize: 16, fontWeight: 900 } }}
          >
            {item.label}
          </Button>
        );
      })}
    </SimpleGrid>
  );
}

export default function HousekeepingStaffPage() {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;
  const [propertyId, setPropertyId] = useState('');
  const [employee, setEmployee] = useState<HousekeepingEmployee>();
  const [rooms, setRooms] = useState<HousekeepingRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>();
  const [checklists, setChecklists] = useState<Record<string, HousekeepingChecklistItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRoomId, setLoadingRoomId] = useState<string>();
  const [successRoom, setSuccessRoom] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const nextPropertyId = propertyId || (await getCurrentPropertyId(signal));
      const [allRooms, employees] = await Promise.all([
        getHousekeepingDashboard(nextPropertyId, signal),
        getHousekeepingEmployees(nextPropertyId, signal),
      ]);
      setPropertyId(nextPropertyId);
      setEmployee(employees.find((item) => item.id === employeeId));
      setRooms(allRooms.filter((room) => room.assignedEmployeeId === employeeId));
      setChecklists((current) => {
        const next = { ...current };
        allRooms.forEach((room) => {
          if (room.assignedEmployeeId === employeeId && !next[room.id]) {
            next[room.id] = room.checklist.some((item) => item.completed) ? room.checklist : createChecklist();
          }
        });
        return next;
      });
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError('Your rooms are temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, propertyId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId && room.status === 'cleaning'),
    [activeRoomId, rooms],
  );
  const activeChecklist = activeRoom ? (checklists[activeRoom.id] ?? createChecklist()) : [];
  const checklistComplete = activeChecklist.length > 0 && activeChecklist.every((item) => item.completed);

  const runRoomAction = async (room: HousekeepingRoom, action: () => Promise<unknown>, success: string) => {
    setLoadingRoomId(room.id);
    try {
      await action();
      showToast({ color: 'green', title: 'Done', message: success });
      await load();
    } catch (actionError) {
      showToast({ color: 'red', title: 'Try again', message: friendlyHousekeepingError(actionError) });
    } finally {
      setLoadingRoomId(undefined);
    }
  };

  return (
    <Box style={{ background: '#f8fafc', minHeight: '100vh', margin: -16, padding: 16 }}>
      <Stack gap={spacing[4]} maw={520} mx="auto" w="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Title order={1} c="#101828" style={{ fontSize: 28, fontWeight: 900, lineHeight: '34px' }}>
              Good morning, {employee?.displayName?.split(' ')[0] ?? 'Staff'}
            </Title>
            <Text c="#64748b" mt={5} style={{ fontSize: 16, fontWeight: 700 }}>
              Your rooms today
            </Text>
          </Box>
          <ThemeIcon color="stayosBrand" radius={radius.full} size={46}>
            <Sparkles size={22} />
          </ThemeIcon>
        </Group>

        {error ? <Alert color="red">{error}</Alert> : null}
        {isLoading ? <Alert color="blue">Loading rooms...</Alert> : null}

        {successRoom ? (
          <Card radius={radius.lg} p={22} style={{ ...cardStyle, borderColor: '#86efac' }}>
            <Stack align="center" gap={8}>
              <ThemeIcon color="green" radius={radius.full} size={54}>
                <CheckCircle2 size={28} />
              </ThemeIcon>
              <Title order={2} c="#15803d" style={{ fontSize: 22, fontWeight: 900 }}>
                Room sent for inspection.
              </Title>
              <Text c="#64748b" style={{ fontSize: 15, fontWeight: 700 }}>
                Room {successRoom}
              </Text>
            </Stack>
          </Card>
        ) : null}

        {activeRoom ? (
          <Card radius={radius.lg} p={18} style={cardStyle}>
            <Stack gap={spacing[4]}>
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Box>
                  <Text c="#101828" style={{ fontSize: 54, fontWeight: 950, lineHeight: '58px' }}>
                    {activeRoom.number}
                  </Text>
                  <Text c="#64748b" mt={4} style={{ fontSize: 17, fontWeight: 800 }}>
                    {activeRoom.floor}
                  </Text>
                </Box>
                <Badge color="blue" radius={radius.full} size="lg" variant="light">
                  Cleaning
                </Badge>
              </Group>
              <StaffChecklist
                items={activeChecklist}
                onToggle={(key) =>
                  setChecklists((current) => ({
                    ...current,
                    [activeRoom.id]: activeChecklist.map((item) =>
                      item.key === key ? { ...item, completed: !item.completed } : item,
                    ),
                  }))
                }
              />
              <Button
                color="green"
                disabled={!checklistComplete}
                fullWidth
                h={64}
                leftSection={<ClipboardCheck size={22} />}
                loading={loadingRoomId === activeRoom.id}
                onClick={() =>
                  void runRoomAction(
                    activeRoom,
                    () =>
                      completeHousekeepingRoom(propertyId, activeRoom.id, {
                        checklist: serializeChecklist(activeChecklist),
                        completedOnBehalf: false,
                        employeeId,
                      }),
                    'Room sent for inspection.',
                  ).then(() => {
                    setSuccessRoom(activeRoom.number);
                    setActiveRoomId(undefined);
                  })
                }
                style={{ fontSize: 18, fontWeight: 900 }}
              >
                Send for Inspection
              </Button>
            </Stack>
          </Card>
        ) : (
          <Stack gap={spacing[3]}>
            {rooms.length === 0 && !isLoading ? (
              <Paper radius={radius.lg} p={26} ta="center" style={cardStyle}>
                <Text c="#101828" style={{ fontSize: 20, fontWeight: 900 }}>
                  No rooms assigned.
                </Text>
              </Paper>
            ) : null}
            {rooms.map((room) => (
              <Card key={room.id} radius={radius.lg} p={18} style={cardStyle}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Box>
                    <Text c="#101828" style={{ fontSize: 58, fontWeight: 950, lineHeight: '60px' }}>
                      {room.number}
                    </Text>
                    <Text c="#64748b" mt={6} style={{ fontSize: 17, fontWeight: 800 }}>
                      {room.floor}
                    </Text>
                  </Box>
                  <Badge color={room.status === 'inspection' ? 'violet' : room.status === 'ready' ? 'green' : 'yellow'} radius={radius.full} size="lg" variant="light">
                    {statusLabel(room.status)}
                  </Badge>
                </Group>
                <Button
                  fullWidth
                  h={64}
                  mt={18}
                  leftSection={<Brush size={24} />}
                  disabled={!['dirty', 'cleaning'].includes(room.status)}
                  loading={loadingRoomId === room.id}
                  onClick={() => {
                    if (room.status === 'cleaning') {
                      setActiveRoomId(room.id);
                      return;
                    }
                    void runRoomAction(
                      room,
                      () => startHousekeepingRoom(propertyId, room.id, employeeId),
                      `Room ${room.number} started.`,
                    ).then(() => setActiveRoomId(room.id));
                  }}
                  style={{ fontSize: 19, fontWeight: 900 }}
                >
                  {room.status === 'cleaning' ? 'Open Checklist' : 'Start'}
                </Button>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
