'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Box, Button, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { BedDouble, CalendarDays, ChevronLeft, ChevronRight, DoorOpen, LogIn, LogOut, Plus, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, useBackendStatus } from '@stayos/ui';
import { getProperties, getPropertyRooms, getPropertyRoomTypes } from '../../lib/inventory-api';
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

function statusKey(value?: string) {
  return (value ?? '').toUpperCase().replace(/[\s-]/g, '_');
}

function isReadyRoom(status?: string) {
  return ['READY', 'AVAILABLE', 'CLEAN', 'VACANT_READY', 'ACTIVE'].includes(statusKey(status));
}

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function holdDetailForRoomType(holds: GroupHoldDto[], roomTypeName?: string) {
  const matchingHold = holds.find((hold) =>
    hold.roomBlocks.some((block) => block.roomTypeName === roomTypeName),
  );
  if (!matchingHold) return undefined;

  const matchingBlocks = matchingHold.roomBlocks.filter((block) => block.roomTypeName === roomTypeName);
  const blockText = matchingBlocks
    .map((block) => `${block.rooms} ${block.roomTypeName}`)
    .join(' + ');

  return {
    hold: matchingHold,
    id: getString(matchingHold as unknown as Record<string, unknown>, [
      'id',
      'groupBookingId',
      '_id',
      'uuid',
    ]),
    label: `${matchingHold.groupCode} - ${matchingHold.groupName}${blockText ? ` - ${blockText}` : ''}`,
  };
}

export function AvailabilityCalendarPage() {
  const router = useRouter();
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; roomTypeId?: string; roomTypeName?: string; operationalStatus?: string }>>([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName?: string; roomId?: string; arrivalDate: string; departureDate: string; status: string; reservationCode: string }>>([]);
  const [groupHolds, setGroupHolds] = useState<GroupHoldDto[]>([]);
  const [rangeDays, setRangeDays] = useState(14);
  const [offsetDays, setOffsetDays] = useState(0);
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
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
      getPropertyRoomTypes(propertyId, controller.signal),
      getPropertyReservations(propertyId, controller.signal),
      getGroupHolds(propertyId, controller.signal),
    ])
      .then(([roomsData, roomTypesData, resDataRaw, holdsData]) => {
        const roomTypeLookup = new Map(
          (roomTypesData as Array<Record<string, unknown>>)
            .map((roomType) => [
              getString(roomType, ['id', '_id', 'uuid']),
              getString(roomType, ['name', 'displayName', 'title', 'label', 'code'], 'Room type'),
            ] as const)
            .filter(([id]) => id),
        );
        const rd = roomsData as Array<Record<string, unknown>>;
        setRooms(rd.map((r) => {
          const roomType = getRecord(r, ['roomType', 'room_type', 'type']);
          const roomTypeId =
            getString(roomType, ['id', '_id', 'uuid']) ||
            getString(r, ['roomTypeId', 'room_type_id', 'typeId']);
          const roomTypeName =
            getString(roomType, ['name', 'displayName', 'title', 'label', 'code']) ||
            getString(r, ['roomTypeName', 'room_type_name', 'typeName']) ||
            roomTypeLookup.get(roomTypeId) ||
            'Room type';

          return {
            id: getString(r, ['id', '_id', 'uuid']),
            roomNumber: getString(r, ['roomNumber', 'number', 'displayName'], '?'),
            roomTypeId,
            roomTypeName,
            operationalStatus: getString(r, ['operationalStatus', 'operational_status', 'status']),
          };
        }));
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
  const todayIso = isoDay(new Date());
  const todayArrivals = reservations.filter((r) => r.arrivalDate === todayIso && r.status !== 'CANCELLED').length;
  const todayDepartures = reservations.filter((r) => r.departureDate === todayIso && r.status !== 'CANCELLED').length;
  const availableTonight = rooms.filter((room) => isReadyRoom(room.operationalStatus) && !isCellOccupied(room.id, new Date())).length;
  const readyRooms = rooms.filter((room) => isReadyRoom(room.operationalStatus)).length;
  const roomTypeOptions = Array.from(new Set(rooms.map((room) => room.roomTypeName ?? 'Room type'))).sort();
  const visibleRooms = roomTypeFilter === 'all'
    ? rooms
    : rooms.filter((room) => (room.roomTypeName ?? 'Room type') === roomTypeFilter);
  const availableCountForDay = (day: Date) =>
    visibleRooms.filter((room) => isReadyRoom(room.operationalStatus) && !isCellOccupied(room.id, day)).length;
  const holdsForDay = (day: Date) => {
    const dayIso = isoDay(day);
    return groupHolds.filter((hold) => hold.arrivalDate <= dayIso && dayIso < hold.departureDate);
  };
  const roomTypeAvailability = Object.entries(
    rooms.reduce<Record<string, { available: number; total: number }>>((acc, room) => {
      const label = room.roomTypeName ?? 'Uncategorized';
      acc[label] ??= { available: 0, total: 0 };
      acc[label].total += 1;
      if (isReadyRoom(room.operationalStatus) && !isCellOccupied(room.id, new Date())) {
        acc[label].available += 1;
      }
      return acc;
    }, {}),
  );

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
  const firstGroupHoldId = groupHolds
    .map((hold) => getString(hold as unknown as Record<string, unknown>, ['id', 'groupBookingId', '_id', 'uuid']))
    .find(Boolean);
  const groupHoldsHref =
    groupHolds.length === 1 && firstGroupHoldId
      ? `/reservations/group-holds/${firstGroupHoldId}`
      : '/reservations/group-quote';

  return (
    <Box py={spacing[4]} px={spacing[3]}>
      <Stack gap={spacing[3]}>
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={1} c="#101828" style={{ fontSize: 28, fontWeight: 800 }}>Availability Calendar</Title>
            <Text c="#64748b" size="sm">{isoDay(startDate)} to {isoDay(endDate)} - {rooms.length} rooms</Text>
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
            <Button component={Link} href="/reservations/group-quote" variant="light" color="stayosBrand" size="sm" leftSection={<Users size={16} />}>Group / Block</Button>
            <Button component={Link} href="/reservations/new" color="stayosBrand" size="sm">New Booking</Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing={spacing[2]}>
          {[
            { label: 'Available tonight', value: availableTonight, detail: 'Start booking', icon: <DoorOpen size={17} />, tone: '#16a34a', bg: '#f0fdf4', href: '/reservations/new' },
            { label: 'Ready rooms', value: readyRooms, detail: 'Assign now', icon: <BedDouble size={17} />, tone: '#2563eb', bg: '#eff6ff', href: '/rooms?mode=assign&status=ready' },
            { label: 'Arrivals today', value: todayArrivals, detail: 'Open bookings', icon: <LogIn size={17} />, tone: '#7d4dd6', bg: '#f5f3ff', href: '/reservations' },
            { label: 'Departures today', value: todayDepartures, detail: 'Open bookings', icon: <LogOut size={17} />, tone: '#d97706', bg: '#fffbeb', href: '/reservations' },
            { label: 'Group holds', value: groupHolds.length, detail: groupHolds.length === 1 ? 'Open hold' : 'View holds', icon: <Users size={17} />, tone: '#dc2626', bg: '#fef2f2', href: groupHoldsHref },
          ].map((item) => (
            <Paper
              key={item.label}
              component={Link}
              href={item.href}
              aria-label={`${item.label}: ${item.detail}`}
              radius={radius.lg}
              p={10}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 6px 16px rgba(15, 23, 42, 0.03)',
                color: 'inherit',
                cursor: 'pointer',
                outline: 'none',
                textDecoration: 'none',
                transform: 'translateY(0)',
                transition: 'transform .16s ease, box-shadow .16s ease, border-color .16s ease',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = item.tone;
                event.currentTarget.style.boxShadow = '0 14px 28px rgba(15, 23, 42, 0.10)';
                event.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = '#e2e8f0';
                event.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.03)';
                event.currentTarget.style.transform = 'translateY(0)';
              }}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = item.tone;
                event.currentTarget.style.boxShadow = `0 0 0 3px ${item.bg}, 0 14px 28px rgba(15, 23, 42, 0.10)`;
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = '#e2e8f0';
                event.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.03)';
              }}
            >
              <Group gap={10} wrap="nowrap">
                <ThemeIcon radius={radius.full} size={32} style={{ background: item.bg, color: item.tone }}>
                  {item.icon}
                </ThemeIcon>
                <Box style={{ minWidth: 0 }}>
                  <Text c="#111827" fw={850} style={{ fontSize: 18, lineHeight: '22px' }}>{item.value}</Text>
                  <Text c="#334155" fw={700} style={{ fontSize: 12, lineHeight: '16px' }}>{item.label}</Text>
                  <Text c="#64748b" style={{ fontSize: 11, lineHeight: '15px' }}>{item.detail}</Text>
                </Box>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        <Paper radius={radius.lg} p={12} style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Group justify="space-between" align="center" gap={spacing[3]}>
            <Box>
              <Text c="#101828" fw={800} style={{ fontSize: 15 }}>Sellable room types</Text>
              <Text c="#64748b" size="xs">Quick read for phone, walk-in, and front desk enquiries.</Text>
            </Box>
            <Group gap={8}>
              <Select
                value={roomTypeFilter}
                onChange={(value) => setRoomTypeFilter(value ?? 'all')}
                data={[
                  { label: 'All room types', value: 'all' },
                  ...roomTypeOptions.map((roomType) => ({ label: roomType, value: roomType })),
                ]}
                size="xs"
                w={180}
              />
              {roomTypeAvailability.map(([label, counts]) => (
                <Badge
                  key={label}
                  radius={radius.full}
                  variant="light"
                  color={counts.available > 0 ? 'green' : 'gray'}
                  style={{ height: 28, textTransform: 'none' }}
                >
                  {label}: {counts.available}/{counts.total}
                </Badge>
              ))}
            </Group>
          </Group>
        </Paper>

        {loadError ? <Alert color="red" variant="light">{loadError}</Alert> : null}

        <Group justify="space-between" align="center">
          <Text c="#334155" fw={700} size="sm">
            Click an empty cell to start a booking for that room and date.
          </Text>
          <Text c="#64748b" size="xs">
            Empty cells are sellable unless blocked by room status or a hold.
          </Text>
        </Group>

        <Paper radius={radius.lg} style={{ background: '#ffffff', border: '1px solid #e2e8f0', maxHeight: 'clamp(520px, 62vh, 760px)', overflow: 'auto', boxShadow: '0 10px 28px rgba(15, 23, 42, 0.04)' }}>
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
                    <Box key={i} style={{ width: CELL_W, minWidth: CELL_W, padding: 8, textAlign: 'center', borderRight: '1px solid #eef2f7', background: isToday ? '#f6f1ff' : undefined, boxShadow: isToday ? 'inset 0 -3px 0 #7d4dd6' : undefined }}>
                      <Text size="xs" c={isToday ? '#6536b5' : '#64748b'} fw={700}>{lbl.top}</Text>
                      <Text size="sm" c="#101828" fw={800}>{lbl.bottom}</Text>
                    </Box>
                  );
                })}
              </Group>
              <Group gap={0} wrap="nowrap" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 53, zIndex: 2 }}>
                <Box style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, padding: '7px 10px', borderRight: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 800 }}>AVAILABLE</Box>
                {days.map((day) => {
                  const count = availableCountForDay(day);
                  const holds = holdsForDay(day);
                  return (
                    <Box key={isoDay(day)} style={{ width: CELL_W, minWidth: CELL_W, padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #eef2f7', background: holds.length ? '#fff7ed' : '#ffffff' }}>
                      <Text c={count > 0 ? '#166534' : '#64748b'} fw={850} style={{ fontSize: 12, lineHeight: '16px' }}>
                        {count}
                      </Text>
                      {holds.length ? (
                        <Text c="#9a3412" style={{ fontSize: 9, fontWeight: 800, lineHeight: '12px' }}>
                          HOLD
                        </Text>
                      ) : null}
                    </Box>
                  );
                })}
              </Group>

              {/* Rows */}
              {visibleRooms.map((room) => (
                <Group key={room.id} gap={0} wrap="nowrap" style={{ borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                  <Box style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, padding: 10, borderRight: '1px solid #e2e8f0', background: '#ffffff', position: 'sticky', left: 0, zIndex: 1 }}>
                    <Text fw={800} c="#101828" size="sm">{room.roomNumber}</Text>
                    <Text c="#64748b" size="xs">{room.roomTypeName ?? '—'}</Text>
                  </Box>
                  {/* Background day cells */}
                  <Box style={{ position: 'relative', display: 'flex', flex: 1 }}>
                    {days.map((d, i) => {
                      const occupied = isCellOccupied(room.id, d);
                      const holdDetail = holdDetailForRoomType(holdsForDay(d), room.roomTypeName);
                      const hasHold = Boolean(holdDetail);
                      const cellBaseStyle = {
                        width: CELL_W,
                        minWidth: CELL_W,
                        height: 52,
                        borderRight: '1px solid #f1f5f9',
                        cursor: occupied ? 'default' : hasHold ? 'pointer' : 'pointer',
                        background: hasHold ? '#fff7ed' : undefined,
                        transition: 'background-color .12s ease',
                      };

                      if (holdDetail && !occupied && holdDetail.id) {
                        return (
                          <Box
                            key={i}
                            component={Link}
                            href={`/reservations/group-holds/${holdDetail.id}`}
                            aria-label={`View hold ${holdDetail.label}`}
                            data-testid={`calendar-hold-${room.id}-${isoDay(d)}`}
                            title={holdDetail.label}
                            style={{
                              ...cellBaseStyle,
                              alignItems: 'center',
                              color: '#c2410c',
                              display: 'flex',
                              fontSize: 9,
                              fontWeight: 800,
                              justifyContent: 'center',
                              textDecoration: 'none',
                            }}
                            onMouseEnter={(event) => {
                              event.currentTarget.style.backgroundColor = '#ffedd5';
                              event.currentTarget.style.boxShadow = 'inset 0 0 0 1px #fb923c';
                            }}
                            onMouseLeave={(event) => {
                              event.currentTarget.style.backgroundColor = '#fff7ed';
                              event.currentTarget.style.boxShadow = '';
                            }}
                          >
                            HOLD
                          </Box>
                        );
                      }

                      if (holdDetail && !occupied) {
                        return (
                          <Box
                            key={i}
                            aria-label={`Hold ${holdDetail.label}`}
                            data-testid={`calendar-hold-${room.id}-${isoDay(d)}`}
                            title={holdDetail.label}
                            style={{
                              ...cellBaseStyle,
                              alignItems: 'center',
                              color: '#c2410c',
                              cursor: 'default',
                              display: 'flex',
                              fontSize: 9,
                              fontWeight: 800,
                              justifyContent: 'center',
                            }}
                          >
                            HOLD
                          </Box>
                        );
                      }

                      return (
                        <Box
                          key={i}
                          onClick={occupied ? undefined : () => handleEmptyCellClick(room.id, room.roomTypeId, d)}
                          role={occupied ? undefined : 'button'}
                          tabIndex={occupied ? -1 : 0}
                          aria-label={occupied ? undefined : `Book ${room.roomNumber} on ${isoDay(d)}`}
                          data-testid={occupied ? undefined : `calendar-empty-${room.id}-${isoDay(d)}`}
                          style={cellBaseStyle}
                          onMouseEnter={occupied ? undefined : (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ecfdf5'; }}
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
                            transition: 'transform .14s ease, box-shadow .14s ease, filter .14s ease',
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.boxShadow = '0 8px 18px rgba(15,23,42,0.20)';
                            event.currentTarget.style.filter = 'brightness(1.03)';
                            event.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.15)';
                            event.currentTarget.style.filter = 'none';
                            event.currentTarget.style.transform = 'translateY(0)';
                          }}
                          title={`${res.guestName ?? 'Guest'} - ${res.reservationCode} - ${res.status} - ${res.arrivalDate} to ${res.departureDate}`}
                        >
                          {res.guestName ?? res.reservationCode}
                        </Box>
                      );
                    })}
                  </Box>
                </Group>
              ))}
              {visibleRooms.length === 0 ? <Text c="#64748b" ta="center" p={30}>No rooms match this view.</Text> : null}
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
