'use client';

import { Alert, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Brush, CheckCircle2, ClipboardCheck, RefreshCw, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  completeStaffRoomByToken,
  friendlyHousekeepingError,
  getCurrentPropertyId,
  getStaffWorklistByToken,
  startStaffRoomByToken,
} from '../../../../../features/housekeeping/api/housekeeping-api';
import { createChecklist, serializeChecklist } from '../../../../../features/housekeeping/utils/housekeeping-checklist';
import type {
  HousekeepingChecklistItem,
  HousekeepingEmployee,
  HousekeepingRoom,
  HousekeepingStatus,
} from '../../../../../features/housekeeping/types/housekeeping.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const sections: Array<{ label: string; statuses: HousekeepingStatus[] }> = [
  { label: 'New Work', statuses: ['dirty'] },
  { label: 'In Progress', statuses: ['cleaning'] },
  { label: 'Sent for Inspection', statuses: ['inspection'] },
];

function statusLabel(status: HousekeepingStatus) {
  if (status === 'dirty') return 'Needs Cleaning';
  if (status === 'cleaning') return 'In Progress';
  if (status === 'inspection') return 'Sent for Inspection';
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
            h={104}
            leftSection={<Icon size={32} />}
            onClick={() => onToggle(item.key)}
            radius={radius.lg}
            variant={item.completed ? 'filled' : 'light'}
            styles={{
              inner: { flexDirection: 'column', gap: 8 },
              label: { fontSize: 16, fontWeight: 900 },
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </SimpleGrid>
  );
}

export default function HousekeepingStaffAccessPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const previousRoomCount = useRef<number | undefined>(undefined);
  const [propertyId, setPropertyId] = useState('');
  const [employee, setEmployee] = useState<HousekeepingEmployee>();
  const [rooms, setRooms] = useState<HousekeepingRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>();
  const [checklists, setChecklists] = useState<Record<string, HousekeepingChecklistItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingRoomId, setLoadingRoomId] = useState<string>();
  const [newRoomNotice, setNewRoomNotice] = useState(false);
  const [invalidAccess, setInvalidAccess] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setError(undefined);
      try {
        const nextPropertyId = propertyId || (await getCurrentPropertyId(signal));
        const worklist = await getStaffWorklistByToken(nextPropertyId, token, signal);
        setPropertyId(nextPropertyId);
        setEmployee(worklist.employee);
        setRooms(worklist.rooms);
        setInvalidAccess(false);
        if (
          previousRoomCount.current !== undefined &&
          worklist.rooms.length > previousRoomCount.current
        ) {
          setNewRoomNotice(true);
        }
        previousRoomCount.current = worklist.rooms.length;
        setChecklists((current) => {
          const next = { ...current };
          worklist.rooms.forEach((room) => {
            if (!next[room.id]) {
              next[room.id] = room.checklist.some((item) => item.completed)
                ? room.checklist
                : createChecklist();
            }
          });
          return next;
        });
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        const message = loadError instanceof Error ? loadError.message.toLowerCase() : '';
        if (message.includes('disabled') || message.includes('invalid') || message.includes('404')) {
          setInvalidAccess(true);
        } else {
          setError('Unable to load your rooms. Please refresh.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [propertyId, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load(undefined, true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId && room.status === 'cleaning'),
    [activeRoomId, rooms],
  );
  const activeChecklist = activeRoom ? (checklists[activeRoom.id] ?? createChecklist()) : [];
  const checklistComplete =
    activeChecklist.length > 0 && activeChecklist.every((item) => item.completed);

  const runRoomAction = async (room: HousekeepingRoom, action: () => Promise<unknown>, success: string) => {
    setLoadingRoomId(room.id);
    try {
      await action();
      showToast({ color: 'green', title: 'Done', message: success });
      await load(undefined, true);
    } catch (actionError) {
      showToast({ color: 'red', title: 'Try again', message: friendlyHousekeepingError(actionError) });
    } finally {
      setLoadingRoomId(undefined);
    }
  };

  if (invalidAccess) {
    return (
      <Box style={{ background: '#f8fafc', minHeight: '100vh', margin: -16, padding: 16 }}>
        <Stack gap={spacing[4]} maw={520} mx="auto" w="100%">
          <Alert color="red">
            This staff access card is no longer valid. Please contact your supervisor.
          </Alert>
        </Stack>
      </Box>
    );
  }

  return (
    <Box style={{ background: '#f8fafc', minHeight: '100vh', margin: -16, padding: 16 }}>
      <Stack gap={spacing[4]} maw={560} mx="auto" w="100%">
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

        <Button
          fullWidth
          h={58}
          leftSection={<RefreshCw size={22} />}
          loading={isRefreshing}
          onClick={() => {
            setNewRoomNotice(false);
            void load(undefined, true);
          }}
          style={{ fontSize: 17, fontWeight: 900 }}
          variant="light"
        >
          Refresh
        </Button>

        {newRoomNotice ? (
          <Alert color="green" icon={<CheckCircle2 size={18} />}>
            New room assigned.
          </Alert>
        ) : null}
        {error ? <Alert color="red">{error}</Alert> : null}
        {isLoading ? <Alert color="blue">Loading rooms...</Alert> : null}

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
                  <Text c="#64748b" mt={2} style={{ fontSize: 15, fontWeight: 700 }}>
                    {activeRoom.roomType}
                  </Text>
                </Box>
                <Badge color="blue" radius={radius.full} size="lg" variant="light">
                  In Progress
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
                      completeStaffRoomByToken(propertyId, token, activeRoom.id, {
                        checklist: serializeChecklist(activeChecklist),
                      }),
                    'Room sent for inspection.',
                  ).then(() => setActiveRoomId(undefined))
                }
                style={{ fontSize: 18, fontWeight: 900 }}
              >
                Send for Inspection
              </Button>
            </Stack>
          </Card>
        ) : (
          <Stack gap={spacing[4]}>
            {rooms.length === 0 && !isLoading ? (
              <PaperLike message="No rooms assigned right now." />
            ) : null}
            {sections.map((section) => {
              const sectionRooms = rooms.filter((room) => section.statuses.includes(room.status));
              if (sectionRooms.length === 0) return null;
              return (
                <Stack key={section.label} gap={spacing[3]}>
                  <Title order={2} c="#334155" style={{ fontSize: 18, fontWeight: 900 }}>
                    {section.label}
                  </Title>
                  {sectionRooms.map((room) => (
                    <Card key={room.id} radius={radius.lg} p={18} style={cardStyle}>
                      <Group justify="space-between" align="flex-start" wrap="wrap">
                        <Box>
                          <Text c="#101828" style={{ fontSize: 58, fontWeight: 950, lineHeight: '60px' }}>
                            {room.number}
                          </Text>
                          <Text c="#64748b" mt={6} style={{ fontSize: 17, fontWeight: 800 }}>
                            {room.floor}
                          </Text>
                          <Text c="#64748b" mt={2} style={{ fontSize: 15, fontWeight: 700 }}>
                            {room.roomType}
                          </Text>
                        </Box>
                        <Badge color={room.status === 'inspection' ? 'violet' : room.status === 'cleaning' ? 'blue' : 'yellow'} radius={radius.full} size="lg" variant="light">
                          {statusLabel(room.status)}
                        </Badge>
                      </Group>
                      <Button
                        fullWidth
                        h={64}
                        mt={18}
                        leftSection={<Brush size={24} />}
                        disabled={room.status === 'inspection'}
                        loading={loadingRoomId === room.id}
                        onClick={() => {
                          if (room.status === 'cleaning') {
                            setActiveRoomId(room.id);
                            return;
                          }
                          void runRoomAction(
                            room,
                            () => startStaffRoomByToken(propertyId, token, room.id),
                            `Room ${room.number} started.`,
                          ).then(() => setActiveRoomId(room.id));
                        }}
                        style={{ fontSize: 19, fontWeight: 900 }}
                      >
                        {room.status === 'cleaning' ? 'Open Checklist' : 'Start Cleaning'}
                      </Button>
                    </Card>
                  ))}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function PaperLike({ message }: { message: string }) {
  return (
    <Card radius={radius.lg} p={26} ta="center" style={cardStyle}>
      <Text c="#101828" style={{ fontSize: 20, fontWeight: 900 }}>
        {message}
      </Text>
    </Card>
  );
}
