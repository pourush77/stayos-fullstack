'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Group, Loader, Paper, Select, Stack, Text, Title } from '@mantine/core';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, useBackendStatus } from '@stayos/ui';
import { getProperties, getPropertyRooms } from '../../lib/inventory-api';
import { getGroupHolds, type GroupHoldDto } from '../../lib/operations-api';
import { getPropertyReservations } from '../../lib/reservation-api';

const DAY_MS = 86_400_000;

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(d: Date): { top: string; bottom: string } {
  return {
    top: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    bottom: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  };
}

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#7d4dd6',
  CHECKED_IN: '#059669',
  CHECKED_OUT: '#94a3b8',
  PENDING: '#f59e0b',
  CANCELLED: '#94a3b8',
};

export function AvailabilityCalendarPage() {
  const router = useRouter();
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; roomTypeId?: string; roomTypeName?: string; operationalStatus?: string }>>([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName?: string; roomId?: string; arrivalDate: string; departureDate: string; status: string; reservationCode: string }>>([]);
  const [groupHolds, setGroupHolds] = useState<GroupHoldDto[]>([]);
  const [rangeDays, setRangeDays] = useState(14);
  const [offsetDays, setOffsetDays] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const startDate = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return new Date(t.getTime() + offsetDays * DAY_MS);
  }, [offsetDays]);
  const endDate = useMemo(() => new Date(startDate.getTime() + (rangeDays - 1) * DAY_MS), [startDate, rangeDays]);
  const days = useMemo(() => Array.from({ length: rangeDays }, (_, i) => new Date(startDate.getTime() + i * DAY_MS)), [startDate, rangeDays]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const properties = await getProperties();
        const active = properties.find((p) => (typeof p.status === 'string' ? p.status.toUpperCase() : 'ACTIVE') === 'ACTIVE') ?? properties[0];
        const pid = typeof active?.id === 'string' ? active.id : '';
        if (!pid) throw new Error('No property');
        if (!cancelled) setPropertyId(pid);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load property');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    setIsLoading(true);
    const controller = new AbortController();
    Promise.all([
      getPropertyRooms(propertyId, controller.signal),
      getPropertyReservations(propertyId, controller.signal),
      getGroupHolds(propertyId, controller.signal),
    ])
      .then(([roomsData, resDataRaw, holdsData]) => {
        const rd = roomsData as Array<Record<string, unknown>>;
        setRooms(rd.map((r) => ({
          id: String(r.id),
          roomNumber: String(r.roomNumber ?? '?'),
          roomTypeId: ((r.roomType as { id?: string } | undefined)?.id) ?? (r.roomTypeId as string | undefined),
          roomTypeName: (r.roomType as { name?: string } | undefined)?.name,
          operationalStatus: r.operationalStatus as string | undefined,
        })));
        const resData = resDataRaw as Array<Record<string, unknown>>;
        setReservations(resData.map((r) => ({
          id: String(r.id),
          guestName: r.guestName as string | undefined,
          roomId: r.roomId as string | undefined,
          arrivalDate: String(r.arrivalDate),
          departureDate: String(r.departureDate),
          status: String(r.status),
          reservationCode: String(r.reservationCode),
        })));
        setGroupHolds(holdsData.filter((hold) => hold.status === 'ON_HOLD' || hold.status === 'CONFIRMED'));
        setLoadError(undefined);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load calendar data');
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [propertyId, startDate.getTime(), endDate.getTime()]);

  if (!backend.isOnline && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;
  if (!backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;

  const roomSpanFor = (roomId: string) => reservations.filter((r) => r.roomId === roomId);

  // Returns true if the given room is booked on the given calendar day (occupancy = [arrival, departure)).
  const isCellOccupied = (roomId: string, day: Date): boolean => {
    const dayIso = isoDay(day);
    return reservations.some((r) => {
      if (r.roomId !== roomId) return false;
      if (r.status === 'CANCELLED') return false;
      return r.arrivalDate <= dayIso && dayIso < r.departureDate;
    });
  };

  const handleEmptyCellClick = (roomId: string, roomTypeId: string | undefined, day: Date) => {
    const arrival = isoDay(day);
    const dep = isoDay(new Date(day.getTime() + DAY_MS));
    const qs = new URLSearchParams({ arrivalDate: arrival, departureDate: dep });
    if (roomTypeId) qs.set('roomTypeId', roomTypeId);
    if (roomId) qs.set('preferredRoomId', roomId);
    router.push(`/reservations/new?${qs.toString()}`);
  };

  const CELL_W = 90;
  const ROOM_COL_W = 130;

  return (
    <Box py={spacing[4]} px={spacing[3]}>
      <Stack gap={spacing[3]}>
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={1} c="#101828" style={{ fontSize: 28, fontWeight: 800 }}>Availability Calendar</Title>
            <Text c="#64748b" size="sm">{isoDay(startDate)} → {isoDay(endDate)} · {rooms.length} rooms</Text>
          </Stack>
          <Group gap={8}>
            <Button variant="light" color="stayosBrand" size="sm" leftSection={<ChevronLeft size={16} />} onClick={() => setOffsetDays((o) => o - rangeDays)}>Prev</Button>
            <Button variant="subtle" color="gray" size="sm" leftSection={<CalendarDays size={16} />} onClick={() => setOffsetDays(0)}>Today</Button>
            <Button variant="light" color="stayosBrand" size="sm" rightSection={<ChevronRight size={16} />} onClick={() => setOffsetDays((o) => o + rangeDays)}>Next</Button>
            <Select
              value={String(rangeDays)}
              onChange={(v) => setRangeDays(Number(v) || 14)}
              data={[{ label: '7 days', value: '7' }, { label: '14 days', value: '14' }, { label: '30 days', value: '30' }]}
              w={110}
              size="sm"
            />
            <Button component={Link} href="/reservations/group-quote" variant="light" color="stayosBrand" size="sm" leftSection={<Users size={16} />}>Group Quote</Button>
            <Button component={Link} href="/reservations/new" color="stayosBrand" size="sm">New Booking</Button>
          </Group>
        </Group>

        {loadError ? <Alert color="red" variant="light">{loadError}</Alert> : null}

        {groupHolds.length ? (
          <Paper radius={radius.lg} p={12} style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={800} c="#9a3412">Group holds blocking inventory</Text>
                <Text size="sm" c="#9a3412">
                  {groupHolds.map((hold) => `${hold.groupCode}: ${hold.groupName} (${hold.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ')})`).join(' | ')}
                </Text>
              </Stack>
              <Button component={Link} href="/reservations/group-quote" variant="light" color="orange" size="xs">Manage</Button>
            </Group>
          </Paper>
        ) : null}

        <Paper radius={radius.lg} style={{ background: '#ffffff', border: '1px solid #e2e8f0', overflow: 'auto' }}>
          {isLoading ? (
            <Group justify="center" p={40}><Loader color="stayosBrand" /></Group>
          ) : (
            <Box style={{ minWidth: ROOM_COL_W + CELL_W * rangeDays }}>
              {/* Header */}
              <Group gap={0} wrap="nowrap" style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 2 }}>
                <Box style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, padding: 10, borderRight: '1px solid #e2e8f0', fontWeight: 700, color: '#64748b', fontSize: 12 }}>ROOM</Box>
                {days.map((d, i) => {
                  const lbl = dayLabel(d);
                  const isToday = isoDay(d) === isoDay(new Date());
                  return (
                    <Box key={i} style={{ width: CELL_W, minWidth: CELL_W, padding: 8, textAlign: 'center', borderRight: '1px solid #eef2f7', background: isToday ? '#f6f1ff' : undefined }}>
                      <Text size="xs" c={isToday ? '#6536b5' : '#64748b'} fw={700}>{lbl.top}</Text>
                      <Text size="sm" c="#101828" fw={800}>{lbl.bottom}</Text>
                    </Box>
                  );
                })}
              </Group>

              {/* Rows */}
              {rooms.map((room) => (
                <Group key={room.id} gap={0} wrap="nowrap" style={{ borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                  <Box style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, padding: 10, borderRight: '1px solid #e2e8f0', background: '#ffffff', position: 'sticky', left: 0, zIndex: 1 }}>
                    <Text fw={800} c="#101828" size="sm">{room.roomNumber}</Text>
                    <Text c="#64748b" size="xs">{room.roomTypeName ?? '—'}</Text>
                  </Box>
                  {/* Background day cells */}
                  <Box style={{ position: 'relative', display: 'flex', flex: 1 }}>
                    {days.map((d, i) => {
                      const occupied = isCellOccupied(room.id, d);
                      return (
                        <Box
                          key={i}
                          onClick={occupied ? undefined : () => handleEmptyCellClick(room.id, room.roomTypeId, d)}
                          role={occupied ? undefined : 'button'}
                          tabIndex={occupied ? -1 : 0}
                          aria-label={occupied ? undefined : `Book ${room.roomNumber} on ${isoDay(d)}`}
                          data-testid={occupied ? undefined : `calendar-empty-${room.id}-${isoDay(d)}`}
                          style={{
                            width: CELL_W,
                            minWidth: CELL_W,
                            height: 52,
                            borderRight: '1px solid #f1f5f9',
                            cursor: occupied ? 'default' : 'pointer',
                            transition: 'background-color .12s ease',
                          }}
                          onMouseEnter={occupied ? undefined : (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f3ff'; }}
                          onMouseLeave={occupied ? undefined : (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                        />
                      );
                    })}
                    {/* Reservation bars */}
                    {roomSpanFor(room.id).map((res) => {
                      const arr = new Date(`${res.arrivalDate}T00:00:00`);
                      const dep = new Date(`${res.departureDate}T00:00:00`);
                      const startIdx = Math.max(0, Math.round((arr.getTime() - startDate.getTime()) / DAY_MS));
                      const endIdx = Math.min(rangeDays, Math.round((dep.getTime() - startDate.getTime()) / DAY_MS));
                      if (endIdx <= 0 || startIdx >= rangeDays || endIdx <= startIdx) return null;
                      const left = startIdx * CELL_W + 4;
                      const width = (endIdx - startIdx) * CELL_W - 8;
                      const color = STATUS_COLOR[res.status] ?? '#7d4dd6';
                      return (
                        <Box
                          key={res.id}
                          component={Link}
                          href={`/reservations/${res.id}`}
                          data-testid={`calendar-booking-${res.id}`}
                          style={{
                            position: 'absolute',
                            top: 8,
                            left,
                            width,
                            height: 36,
                            background: color,
                            color: '#ffffff',
                            borderRadius: 8,
                            padding: '4px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
                          }}
                          title={`${res.guestName ?? 'Guest'} · ${res.reservationCode} · ${res.status}`}
                        >
                          {res.guestName ?? res.reservationCode}
                        </Box>
                      );
                    })}
                  </Box>
                </Group>
              ))}
              {rooms.length === 0 ? <Text c="#64748b" ta="center" p={30}>No rooms found for this property.</Text> : null}
            </Box>
          )}
        </Paper>

        <Group gap={16}>
          <Group gap={6}><Box style={{ width: 12, height: 12, background: '#7d4dd6', borderRadius: 3 }} /><Text size="xs" c="#64748b">Confirmed</Text></Group>
          <Group gap={6}><Box style={{ width: 12, height: 12, background: '#059669', borderRadius: 3 }} /><Text size="xs" c="#64748b">Checked in</Text></Group>
          <Group gap={6}><Box style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 3 }} /><Text size="xs" c="#64748b">Pending</Text></Group>
          <Group gap={6}><Box style={{ width: 12, height: 12, background: '#94a3b8', borderRadius: 3 }} /><Text size="xs" c="#64748b">Checked out / cancelled</Text></Group>
          <Group gap={6}><Plus size={12} color="#7d4dd6" /><Text size="xs" c="#64748b">Tap any empty cell to start a booking</Text></Group>
        </Group>
      </Stack>
    </Box>
  );
}

export default AvailabilityCalendarPage;
