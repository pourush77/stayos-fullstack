'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Drawer,
  Group,
  MultiSelect,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  Modal,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import {
  Accessibility,
  AlertCircle,
  BedDouble,
  Brush,
  CheckCircle2,
  DoorOpen,
  Hotel,
  MapPin,
  Search,
  Sparkles,
  UserRound,
  Ban,
  ChevronRight,
  History,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import {
  BackendUnavailable,
  EmptyData,
  GenericError,
  ServerStarting,
  showToast,
  useBackendStatus,
} from '@stayos/ui';
import { getProperties } from '../../lib/inventory-api';
import {
  assignRoomToReservation,
  checkInReservation,
  unassignRoomFromReservation,
} from '../../lib/reservation-api';
import { type Reservation, useReservations } from '../../lib/reservation-hooks';

import {
  getRoomBoard,
  getActivityFeed,
  getAvailableRooms,
  getNeedsAttention,
  type OperationsActivityItemDto,
  type OperationsAttentionItemDto,
  type OperationsAvailableRoomDto,
} from '../../lib/operations-api';
import styles from './RoomsPage.module.css';
import { CheckInModal, DetailTile } from './components';
import { cardStyle, defaultRoomFilters, emptyInventory, mockRooms } from './constants';
import { useRoomFilters } from './hooks';
import type { FiltersState, InventoryState, Room, RoomAction, RoomStatus } from './types';
import {
  actionForPrimary,
  assignmentIssue,
  compactFloorLabel,
  friendlyAssignmentError,
  friendlyCheckInError,
  friendlyRemoveAssignmentError,
  friendlyRoomChangeError,
  getPropertyId,
  getPropertyName,
  getRoomSubtitle,
  hasAssignedBooking,
  isActiveRecord,
  isRoomReadyForAssignment,
  mapOperationsRoom,
  parseGuestCount,
  primaryAction,
  roomActionKey,
  runRoomStatusAction,
  statusGroup,
  statusLabel,
  statusTone,
} from './utils';

// type InventoryLookups = {
//   floors: Map<string, InventoryFloorDto>;
//   roomTypes: Map<string, InventoryRoomTypeDto>;
// };

// function mapInventoryRoom(dto: InventoryRoomDto, index: number, lookups: InventoryLookups): Room {
//   const roomPayload = getRoomPayload(dto);
//   const floorId = getString(
//     roomPayload,
//     ['floorId', 'floor_id'],
//     getString(dto, ['floorId', 'floor_id']),
//   );
//   const roomTypeId = getString(
//     roomPayload,
//     ['roomTypeId', 'room_type_id'],
//     getString(dto, ['roomTypeId', 'room_type_id']),
//   );
//   const floorRecord =
//     getRecord(roomPayload, ['floor']) ?? getRecord(dto, ['floor']) ?? lookups.floors.get(floorId);
//   const roomTypeRecord =
//     getRecord(roomPayload, ['roomType', 'room_type']) ??
//     getRecord(dto, ['roomType', 'room_type']) ??
//     lookups.roomTypes.get(roomTypeId);
//   const status = mapStatus(
//     getString(
//       roomPayload,
//       ['operationalStatus', 'operational_status', 'status'],
//       getString(dto, ['operationalStatus', 'operational_status', 'status'], 'ready'),
//     ),
//   );
//   const roomNumber = getString(
//     roomPayload,
//     ['roomNumber', 'number', 'displayName', 'name', 'code'],
//     getString(
//       dto,
//       ['roomNumber', 'number', 'displayName', 'name', 'code'],
//       String(index + 1).padStart(3, '0'),
//     ),
//   );
//   const guestName = getString(
//     dto,
//     ['guestName', 'currentGuest', 'guest'],
//     getString(roomPayload, ['guestName', 'currentGuest']),
//   );
//   const roomType =
//     getString(roomTypeRecord, ['name', 'displayName', 'title', 'label', 'code'], '') ||
//     getString(
//       roomPayload,
//       ['roomTypeName', 'room_type_name', 'typeName', 'roomType', 'room_type', 'type'],
//       getString(
//         dto,
//         ['roomTypeName', 'room_type_name', 'typeName', 'roomType', 'room_type', 'type'],
//         'Standard Room',
//       ),
//     );
//   const floor =
//     getString(floorRecord, ['name', 'displayName', 'title', 'label', 'code'], '') ||
//     getString(
//       roomPayload,
//       ['floorName', 'floor_name', 'floor', 'levelName', 'level'],
//       getString(dto, ['floorName', 'floor_name', 'floor', 'levelName', 'level'], 'Main Floor'),
//     );
//   const bedType = getString(dto, ['bedType', 'bed'], roomType.includes('Twin') ? 'Twin' : 'King');
//   const view = getString(dto, ['view', 'roomView'], 'City');
//   const housekeepingStatus = getString(
//     dto,
//     ['housekeepingStatus', 'housekeeping_status'],
//     statusLabel(status),
//   );
//   const maintenanceIssue = getString(
//     dto,
//     ['maintenanceIssue', 'maintenanceStatus', 'maintenance_status'],
//     'None',
//   );

//   return {
//     accessible: getBoolean(dto, ['accessible', 'isAccessible']),
//     amenities: [
//       bedType,
//       view,
//       getBoolean(dto, ['connecting', 'isConnecting']) ? 'Connecting' : 'WiFi',
//     ].filter(Boolean),
//     bedType,
//     bookingId: getString(dto, ['bookingId', 'reservationCode']),
//     capacity: getString(dto, ['capacity', 'occupancy'], '2 guests'),
//     connecting: getBoolean(dto, ['connecting', 'isConnecting']),
//     floor,
//     guest: guestName || undefined,
//     housekeeping: {
//       assignedStaff: getString(dto, ['housekeeper', 'assignedStaff'], 'Unassigned'),
//       estimatedFinish: getString(
//         dto,
//         ['estimatedFinish'],
//         status === 'ready' ? 'Complete' : 'Not set',
//       ),
//       inspection: getString(
//         dto,
//         ['inspectionStatus', 'inspection_status'],
//         status === 'inspection' ? 'Pending' : statusLabel(status),
//       ),
//       started: getString(dto, ['cleaningStartedAt', 'cleaningStarted'], 'Not recorded'),
//       status: housekeepingStatus,
//     },
//     id: getString(dto, ['id', '_id', 'uuid']),
//     maintenance: {
//       engineer: getString(dto, ['engineer', 'maintenanceEngineer'], 'Unassigned'),
//       issue: maintenanceIssue,
//       priority: getString(
//         dto,
//         ['maintenancePriority'],
//         maintenanceIssue === 'None' ? 'None' : 'Medium',
//       ),
//       status: getString(dto, ['maintenanceState'], maintenanceIssue === 'None' ? 'Clear' : 'Open'),
//     },
//     number: roomNumber,
//     reservation: getString(
//       dto,
//       ['reservationCode', 'bookingId'],
//       guestName ? 'In house' : 'Available',
//     ),
//     roomType,
//     stayDates: getString(
//       dto,
//       ['stayDates', 'reservationDates'],
//       status === 'occupied' ? 'Current stay' : 'Available today',
//     ),
//     status,
//     stayHref: getString(dto, ['stayHref']) || undefined,
//     timeline: [
//       { time: '08:15', label: housekeepingStatus },
//       { time: '09:02', label: statusLabel(status) },
//     ],
//     view,
//     vip: getBoolean(dto, ['vip', 'isVip']) || status === 'reserved',
//   };
// }

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = properties.find(isActiveRecord);
  const propertyId = activeProperty ? getPropertyId(activeProperty) : '';

  if (!activeProperty || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return {
    propertyId,
    propertyName: getPropertyName(activeProperty),
  };
}

function useRoomInventory({
  allowMockFallback,
  enabled,
}: {
  allowMockFallback: boolean;
  enabled: boolean;
}): InventoryState & { refreshInventory: () => Promise<void> } {
  const [state, setState] = useState<InventoryState>(emptyInventory);

  const loadInventory = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) {
        setState({ ...emptyInventory, isLoading: false });
        return;
      }

      setState((current) => ({
        ...current,
        error: undefined,
        isLoading: current.rooms.length === 0,
      }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);

        const roomBoard = await getRoomBoard(propertyId, signal);
        const rooms = roomBoard.map(mapOperationsRoom);
        const floors = Array.from(new Set(rooms.map((room) => room.floor)));

        setState({
          activePropertyName: propertyName,
          floors,
          isFallback: false,
          isLoading: false,
          propertyId,
          rooms,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (allowMockFallback) {
          setState({
            error: error instanceof Error ? error.message : 'Room inventory is unavailable.',
            floors: Array.from(new Set(mockRooms.map((room) => room.floor))),
            isFallback: true,
            isLoading: false,
            rooms: mockRooms,
          });
          return;
        }

        setState({
          error: 'Room inventory is temporarily unavailable.',
          floors: [],
          isFallback: false,
          isLoading: false,
          rooms: [],
        });
      }
    },
    [allowMockFallback, enabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadInventory(controller.signal);
    return () => controller.abort();
  }, [loadInventory]);

  const refreshInventory = useCallback(() => loadInventory(), [loadInventory]);

  return { ...state, refreshInventory };
}

function getRoomTypeDisplay(roomType: string) {
  const normalized = roomType.toLowerCase();

  if (normalized.includes('suite')) {
    return {
      label: 'Suite',
      icon: Sparkles,
      iconColor: '#b7791f',
      color: '#7a4f01',
      background: '#fff8e6',
      border: '#f3d98b',
    };
  }

  if (normalized.includes('accessible')) {
    return {
      label: 'Accessible',
      icon: Accessibility,
      iconColor: '#0f766e',
      color: '#115e59',
      background: '#ecfdf5',
      border: '#99f6e4',
    };
  }

  if (
    normalized.includes('deluxe') ||
    normalized.includes('premium') ||
    normalized.includes('king') ||
    normalized.includes('twin')
  ) {
    return {
      label: roomType.includes('Twin') ? 'Deluxe Twin' : 'Deluxe',
      icon: BedDouble,
      iconColor: '#2563eb',
      color: '#1d4ed8',
      background: '#eff6ff',
      border: '#bfdbfe',
    };
  }

  return {
    label: roomType || 'Standard',
    icon: BedDouble,
    iconColor: '#64748b',
    color: '#475569',
    background: '#f8fafc',
    border: '#e2e8f0',
  };
}

function RoomBadge({ children, status }: { children: ReactNode; status?: RoomStatus }) {
  const tone = status
    ? statusTone(status)
    : { color: '#64748b', background: '#f8fafc', border: '#e2e8f0' };

  return (
    <Badge
      radius={radius.full}
      style={{
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 11,
        fontWeight: 600,
        height: 24,
        paddingInline: 10,
        textTransform: 'none',
      }}
    >
      {children}
    </Badge>
  );
}

function RoomTypeMetadata({ roomType }: { roomType: string }) {
  const display = getRoomTypeDisplay(roomType);
  const Icon = display.icon;

  return (
    <Box
      component="span"
      aria-label={`${display.label} room type`}
      style={{
        alignItems: 'center',
        background: display.background,
        border: `1px solid ${display.border}`,
        borderRadius: radius.full,
        color: display.color,
        display: 'inline-flex',
        fontSize: 12,
        fontWeight: 700,
        gap: 6,
        lineHeight: '16px',
        minHeight: 26,
        padding: '5px 10px',
      }}
    >
      <Icon aria-hidden size={14} color={display.iconColor} strokeWidth={2.3} />
      {display.label}
    </Box>
  );
}

function FloorMetadata({ floor }: { floor: string }) {
  return (
    <Tooltip label={floor} withArrow position="top">
      <Box
        component="span"
        aria-label={`${floor} location`}
        style={{
          alignItems: 'center',
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
          borderRadius: radius.full,
          color: '#64748b',
          display: 'inline-flex',
          fontSize: 11,
          fontWeight: 700,
          gap: 5,
          lineHeight: '15px',
          minHeight: 24,
          padding: '4px 8px',
        }}
      >
        <MapPin aria-hidden size={12} strokeWidth={2.2} />
        {compactFloorLabel(floor)}
      </Box>
    </Tooltip>
  );
}

function SummaryCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <Paper radius={radius.lg} p={18} className={styles.summaryCard}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text className={styles.summaryLabel}>{label}</Text>
          <Text mt={4} className={styles.summaryValue}>
            {value}
          </Text>
          <Text mt={2} className={styles.summaryDetail}>
            {detail}
          </Text>
        </Box>
        <Box
          aria-hidden
          style={{
            alignItems: 'center',
            background: `${tone}12`,
            borderRadius: radius.full,
            color: tone,
            display: 'flex',
            flex: '0 0 34px',
            height: 34,
            justifyContent: 'center',
            width: 34,
          }}
        >
          {icon}
        </Box>
      </Group>
    </Paper>
  );
}

function RoomCard({
  loadingAction,
  onAction,
  onAssignGuest,
  onCheckIn,
  onOpen,
  onOpenStay,
  room,
}: {
  loadingAction?: string;
  onAction: (room: Room, action: RoomAction) => void;
  onAssignGuest: (room: Room) => void;
  onCheckIn: (room: Room) => void;
  onOpen: (room: Room) => void;
  onOpenStay: (room: Room) => void;
  room: Room;
}) {
  const action = actionForPrimary(room);
  const tone = statusTone(room.status);

  const isOccupied = room.status === 'occupied';
  const isAssignedArrival = hasAssignedBooking(room) && isRoomReadyForAssignment(room);
  const isSuiteRoom = room.roomType.toLowerCase().includes('suite');
  const isAttentionState = [
    'cleaning',
    'dirty',
    'inspection',
    'maintenance',
    'out-of-order',
    'out-of-service',
  ].includes(room.status);

  const borderLeftColor = isOccupied ? '#1d4ed8' : isAttentionState ? tone.color : 'transparent';
  const baseShadow = isOccupied
    ? '0 14px 32px rgba(29, 78, 216, 0.18)'
    : isSuiteRoom
      ? '0 12px 26px rgba(183, 121, 31, 0.12)'
      : (cardStyle.boxShadow as string);
  const hoverShadow = isOccupied
    ? '0 18px 38px rgba(29, 78, 216, 0.24)'
    : isSuiteRoom
      ? '0 16px 32px rgba(183, 121, 31, 0.16)'
      : '0 12px 24px rgba(15, 23, 42, 0.055)';
  const cardBackground = isOccupied
    ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 42%, #ffffff 100%)'
    : isSuiteRoom
      ? 'linear-gradient(135deg, #fffbeb 0%, #fffdf7 45%, #ffffff 100%)'
      : cardStyle.background;
  const cardBorder = isOccupied
    ? '1px solid #60a5fa'
    : isSuiteRoom
      ? '1px solid #f3d98b'
      : cardStyle.border;
  const leftRailWidth = isOccupied ? 8 : isAttentionState ? 3 : 0;
  const rightRailColor = isSuiteRoom ? '#b7791f' : 'transparent';

  return (
    <Paper
      role="button"
      tabIndex={0}
      aria-label={`Open room ${room.number} details`}
      radius={radius.lg}
      p={11}
      style={{
        ...cardStyle,
        background: cardBackground,
        border: cardBorder,
        borderLeft: `${leftRailWidth}px solid ${borderLeftColor}`,
        borderRight: isSuiteRoom ? `5px solid ${rightRailColor}` : cardBorder,
        boxShadow: baseShadow,
        cursor: 'pointer',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
      }}
      onClick={() => onOpen(room)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(room);
        }
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = hoverShadow;
        event.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = baseShadow;
        event.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {isOccupied || isSuiteRoom ? (
        <Box
          aria-hidden
          style={{
            background: isOccupied ? '#1d4ed8' : '#b7791f',
            height: 4,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />
      ) : null}
      <Stack gap={8}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text c="#101828" style={{ fontSize: 24, fontWeight: 750, lineHeight: '29px' }}>
              {room.number}
            </Text>

            <Group mt={5} gap={6} wrap="nowrap">
              <RoomTypeMetadata roomType={room.roomType} />
              <FloorMetadata floor={room.floor} />
            </Group>
          </Box>

          <RoomBadge status={room.status}>{statusLabel(room.status)}</RoomBadge>
        </Group>

        <Box>
          {isOccupied ? (
            <Group gap={7} wrap="nowrap">
              <ThemeIcon aria-hidden color="blue" variant="light" radius={radius.full} size={22}>
                <UserRound size={13} strokeWidth={2.3} />
              </ThemeIcon>
              <Text
                c="#1e3a8a"
                lineClamp={1}
                style={{ flex: 1, fontSize: 13, fontWeight: 700, lineHeight: '17px', minWidth: 0 }}
              >
                {getRoomSubtitle(room)}
              </Text>
              <Box
                component="span"
                style={{
                  background: '#1d4ed8',
                  borderRadius: radius.full,
                  color: '#ffffff',
                  flex: '0 0 auto',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0,
                  lineHeight: '13px',
                  padding: '2px 7px',
                }}
              >
                IN HOUSE
              </Box>
            </Group>
          ) : (
            <Text
              c={isAttentionState ? tone.color : '#64748b'}
              lineClamp={1}
              style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}
            >
              {getRoomSubtitle(room)}
            </Text>
          )}
        </Box>

        {isAssignedArrival ? (
          <Text
            c="#475569"
            lineClamp={1}
            style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}
          >
            {room.reservation} Â· {room.stayDates}
          </Text>
        ) : null}

        {isOccupied ? (
          <Text
            c="#1e3a8a"
            lineClamp={1}
            style={{ fontSize: 12, fontWeight: 650, lineHeight: '16px' }}
          >
            {room.checkInTime ? `Checked in ${room.checkInTime}` : 'Checked in Today'}
          </Text>
        ) : null}

        <Button
          fullWidth
          loading={action ? loadingAction === roomActionKey(room, action) : false}
          onClick={(event) => {
            event.stopPropagation();

            if (isAssignedArrival) {
              onCheckIn(room);
              return;
            }

            if (isOccupied) {
              onOpenStay(room);
              return;
            }

            if (isRoomReadyForAssignment(room)) {
              onAssignGuest(room);
              return;
            }

            if (action) {
              onAction(room, action);
              return;
            }

            onOpen(room);
          }}
          size="compact-sm"
          color="stayosBrand"
          variant={isAssignedArrival || isRoomReadyForAssignment(room) ? 'filled' : 'light'}
          style={{
            fontWeight: 650,
          }}
        >
          {primaryAction(room)}
        </Button>
      </Stack>
    </Paper>
  );
}

function DrawerSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Box>
      <Text className={styles.drawerSectionTitle}>{title}</Text>
      <Box mt={10}>{children}</Box>
    </Box>
  );
}

function getDrawerContext(room: Room) {
  if (hasAssignedBooking(room) && isRoomReadyForAssignment(room)) {
    return {
      title: 'Assigned Booking',
      headline: room.guest ?? room.reservation,
      detail: `${room.reservation} Â· ${room.stayDates}`,
    };
  }

  if (room.status === 'ready' || room.status === 'vacant' || room.status === 'reserved') {
    return {
      title: 'Availability',
      headline: 'Available',
      detail: 'Ready for immediate assignment.',
    };
  }

  if (room.status === 'occupied') {
    return {
      title: 'Current Stay',
      headline: room.guest ?? 'Guest in house',
      detail: `${room.reservation} · ${room.stayDates}`,
    };
  }

  if (room.status === 'cleaning' || room.status === 'dirty' || room.status === 'inspection') {
    return {
      title: 'Housekeeping',
      headline: room.status === 'inspection' ? 'Waiting for inspection' : 'Cleaning in progress',
      detail: `${room.housekeeping.assignedStaff} · ${room.housekeeping.estimatedFinish}`,
    };
  }

  if (
    room.status === 'maintenance' ||
    room.status === 'out-of-order' ||
    room.status === 'out-of-service'
  ) {
    return {
      title: 'Maintenance',
      headline: room.maintenance.issue || 'Room unavailable',
      detail: `${room.maintenance.status} · ${room.maintenance.priority}`,
    };
  }

  return {
    title: 'Room Status',
    headline: statusLabel(room.status),
    detail: getRoomSubtitle(room),
  };
}

function getContextBanner(room: Room) {
  if (hasAssignedBooking(room) && isRoomReadyForAssignment(room)) {
    return 'This booking has a room assigned. The guest has not checked in yet.';
  }

  if (room.status === 'ready' || room.status === 'vacant') {
    return 'This room is clean and available for immediate assignment.';
  }

  if (room.status === 'occupied') {
    return `${room.guest ?? 'Guest'} is staying. ${room.stayDates}.`;
  }

  if (room.status === 'cleaning' || room.status === 'dirty') {
    return 'Housekeeping is preparing this room.';
  }

  if (room.status === 'inspection') {
    return 'This room is waiting for inspection before it can be assigned.';
  }

  if (room.status === 'maintenance') {
    return 'This room is unavailable while maintenance is in progress.';
  }

  if (room.status === 'out-of-order' || room.status === 'out-of-service') {
    return 'This room is currently unavailable for assignment.';
  }

  return getRoomSubtitle(room);
}

function OperationRow({
  color = '#475569',
  icon,
  label,
  onClick,
}: {
  color?: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        alignItems: 'center',
        borderRadius: radius.md,
        display: 'flex',
        gap: 10,
        minHeight: 42,
        padding: '9px 10px',
        width: '100%',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = '#f8fafc';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
      }}
    >
      <Box style={{ color, display: 'flex', flex: '0 0 auto' }}>{icon}</Box>
      <Text className={styles.operationLabel}>{label}</Text>
      <ChevronRight size={15} color="#94a3b8" />
    </UnstyledButton>
  );
}

function formatActivityTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function AssignGuestModal({
  loading,
  onAssign,
  onClose,
  opened,
  reservations,
  room,
  selectedReservationId,
  setSelectedReservationId,
}: {
  loading: boolean;
  onAssign: () => void;
  onClose: () => void;
  opened: boolean;
  reservations: Reservation[];
  room: Room | null;
  selectedReservationId?: string;
  setSelectedReservationId: (value: string | undefined) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (opened) setQuery('');
  }, [opened, room?.id]);

  const visibleReservations = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return reservations.filter((reservation) => {
      if (reservation.status !== 'Confirmed' && reservation.status !== 'Pending') return false;
      if (!normalized) return true;

      return [
        reservation.id,
        reservation.guest,
        reservation.phone,
        reservation.roomType,
        reservation.occupancy,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, reservations]);
  const selectedReservation = reservations.find(
    (reservation) => reservation.backendId === selectedReservationId,
  );
  const selectedIssue = selectedReservation
    ? assignmentIssue(room, selectedReservation)
    : undefined;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="min(92vw, 640px)"
      title={
        <Box>
          <Text className={styles.modalTitle}>Assign Guest</Text>
          <Text mt={3} className={styles.modalSubtitle}>
            {room ? `Assign a booking to Room ${room.number}.` : 'Select a room first.'}
          </Text>
        </Box>
      }
    >
      <Stack gap={spacing[3]}>
        {room ? (
          <Paper radius={radius.lg} p={14} className={styles.surfaceCard}>
            <Group justify="space-between" wrap="nowrap">
              <Box>
                <Text c="#101828" style={{ fontSize: 15, fontWeight: 650 }}>
                  Room {room.number}
                </Text>
                <Text c="#64748b" mt={3} style={{ fontSize: 13, fontWeight: 450 }}>
                  {room.roomType} · {compactFloorLabel(room.floor)}
                </Text>
              </Box>
              <RoomBadge status={room.status}>{statusLabel(room.status)}</RoomBadge>
            </Group>
          </Paper>
        ) : null}

        <TextInput
          leftSection={<Search size={15} />}
          placeholder="Search booking, guest, phone or room type..."
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setSelectedReservationId(undefined);
          }}
          styles={{
            input: {
              borderColor: '#dbe3ef',
              borderRadius: 12,
              fontSize: 13,
              minHeight: 40,
            },
          }}
        />

        <Stack gap={8}>
          {visibleReservations.length > 0 ? (
            visibleReservations.map((reservation) => {
              const selected = selectedReservationId === reservation.backendId;
              const issue = assignmentIssue(room, reservation);
              const canSelect = !issue;

              return (
                <UnstyledButton
                  key={reservation.backendId}
                  aria-disabled={!canSelect}
                  onClick={() => {
                    if (canSelect) setSelectedReservationId(reservation.backendId);
                  }}
                  style={{
                    background: selected ? '#f5f3ff' : '#ffffff',
                    border: selected
                      ? '1px solid rgba(109, 93, 252, 0.35)'
                      : issue
                        ? '1px solid #e5e7eb'
                        : '1px solid #eef2f7',
                    borderRadius: radius.lg,
                    cursor: canSelect ? 'pointer' : 'not-allowed',
                    opacity: canSelect ? 1 : 0.72,
                    padding: 12,
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Box style={{ minWidth: 0 }}>
                      <Group gap={6}>
                        <Text c="#101828" style={{ fontSize: 14, fontWeight: 700 }}>
                          {reservation.guest}
                        </Text>
                        {reservation.isVip ? (
                          <Badge color="stayosBrand" variant="light" radius={radius.full}>
                            VIP
                          </Badge>
                        ) : null}
                      </Group>
                      <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 450 }}>
                        {reservation.id} · {reservation.stayDates}
                      </Text>
                      <Text c="#475569" mt={4} style={{ fontSize: 12, fontWeight: 500 }}>
                        {reservation.roomType} · {reservation.occupancy}
                      </Text>
                      {issue ? (
                        <Text
                          c="#b45309"
                          mt={7}
                          style={{ fontSize: 12, fontWeight: 600, lineHeight: '17px' }}
                        >
                          {issue}
                        </Text>
                      ) : null}
                    </Box>
                    <Badge
                      variant={selected ? 'filled' : 'light'}
                      color={issue ? 'gray' : 'stayosBrand'}
                      radius={radius.full}
                    >
                      {issue ? 'Unavailable' : selected ? 'Selected' : 'Select'}
                    </Badge>
                  </Group>
                </UnstyledButton>
              );
            })
          ) : (
            <Paper radius={radius.lg} p={16} className={styles.modalEmpty}>
              <Text className={styles.modalEmptyText}>
                No confirmed or pending bookings match this search.
              </Text>
            </Paper>
          )}
        </Stack>

        {selectedIssue ? (
          <Alert color="yellow" variant="light" radius={radius.lg}>
            {selectedIssue}
          </Alert>
        ) : null}

        <Group justify="flex-end" mt={spacing[2]}>
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            disabled={!selectedReservationId || !room || Boolean(selectedIssue)}
            loading={loading}
            onClick={onAssign}
            className={styles.primaryButtonText}
          >
            Assign Room
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ChangeRoomModal({
  loading,
  onClose,
  onConfirm,
  opened,
  propertyId,
  reservations,
  room,
}: {
  loading: boolean;
  onClose: () => void;
  onConfirm: (room: Room) => void;
  opened: boolean;
  propertyId?: string;
  reservations: Reservation[];
  room: Room | null;
}) {
  const [availableRooms, setAvailableRooms] = useState<OperationsAvailableRoomDto[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [selectedRoomId, setSelectedRoomId] = useState<string>();

  const reservation = useMemo(
    () =>
      reservations.find(
        (item) =>
          item.backendId === room?.reservationId ||
          item.backendId === room?.bookingId ||
          item.id === room?.bookingId,
      ),
    [reservations, room?.bookingId, room?.reservationId],
  );

  useEffect(() => {
    if (!opened) return;

    setSelectedRoomId(undefined);
    setAvailableRooms([]);
    setLoadError(undefined);

    if (!propertyId || !room?.reservationId) {
      setLoadError('Unable to load available rooms for this booking.');
      return;
    }

    const controller = new AbortController();

    async function loadAvailableRooms() {
      setIsLoadingRooms(true);

      try {
        const rooms = await getAvailableRooms(
          propertyId!,
          {
            arrivalDate: room?.reservationArrivalDate ?? reservation?.arrivalDate,
            departureDate: room?.reservationDepartureDate ?? reservation?.departureDate,
            guestCount: reservation ? parseGuestCount(reservation.occupancy) : room?.guestCount,
            roomTypeId: room?.roomTypeId,
          },
          controller.signal,
        );

        setAvailableRooms(
          rooms.filter(
            (availableRoom) =>
              availableRoom.roomId !== room?.id && availableRoom.roomNumber !== room?.number,
          ),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError('Unable to load available rooms right now.');
      } finally {
        setIsLoadingRooms(false);
      }
    }

    void loadAvailableRooms();

    return () => controller.abort();
  }, [opened, propertyId, reservation, room]);

  const mappedRooms = useMemo(() => availableRooms.map(mapOperationsRoom), [availableRooms]);
  const selectedRoom = mappedRooms.find((item) => item.id === selectedRoomId);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="min(92vw, 720px)"
      title={
        <Box>
          <Text className={styles.modalTitle}>Change Room</Text>
          <Text mt={3} className={styles.modalSubtitle}>
            {room
              ? `Move ${room.guest ?? 'this guest'} from Room ${room.number} to another available room.`
              : 'Select an assigned room first.'}
          </Text>
        </Box>
      }
    >
      <Stack gap={spacing[3]}>
        {room ? (
          <Paper radius={radius.lg} p={14} className={styles.surfaceCard}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Guest" value={room.guest ?? 'Guest not recorded'} />
              <DetailTile label="Booking ID" value={room.bookingId ?? room.reservation} />
              <DetailTile label="Current room" value={`Room ${room.number}`} />
              <DetailTile
                label="Stay dates"
                value={reservation?.stayDates ?? room.stayDates ?? 'Stay dates not recorded'}
              />
            </SimpleGrid>
          </Paper>
        ) : null}

        {isLoadingRooms ? (
          <Alert color="blue" variant="light" radius={radius.lg}>
            Loading available rooms...
          </Alert>
        ) : null}

        {loadError ? (
          <Alert color="red" variant="light" radius={radius.lg}>
            {loadError}
          </Alert>
        ) : null}

        {!isLoadingRooms && !loadError ? (
          <Stack gap={8}>
            {mappedRooms.length > 0 ? (
              mappedRooms.map((availableRoom) => {
                const selected = availableRoom.id === selectedRoomId;

                return (
                  <UnstyledButton
                    key={availableRoom.id ?? availableRoom.number}
                    onClick={() => setSelectedRoomId(availableRoom.id)}
                    style={{
                      background: selected ? '#f5f3ff' : '#ffffff',
                      border: selected ? '1px solid rgba(109, 93, 252, 0.35)' : '1px solid #eef2f7',
                      borderRadius: radius.lg,
                      cursor: 'pointer',
                      padding: 12,
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Group gap={8} wrap="wrap">
                          <Text c="#101828" style={{ fontSize: 15, fontWeight: 700 }}>
                            Room {availableRoom.number}
                          </Text>
                          <RoomBadge status={availableRoom.status}>
                            {statusLabel(availableRoom.status)}
                          </RoomBadge>
                        </Group>
                        <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 450 }}>
                          {availableRoom.roomType} - {availableRoom.floor}
                        </Text>
                        <Text c="#475569" mt={4} style={{ fontSize: 12, fontWeight: 500 }}>
                          Capacity {availableRoom.capacity}
                        </Text>
                        {room?.roomTypeId && availableRoom.roomTypeId !== room.roomTypeId ? (
                          <Text
                            c="#b45309"
                            mt={7}
                            style={{ fontSize: 12, fontWeight: 600, lineHeight: '17px' }}
                          >
                            Backend will validate this room type before moving the booking.
                          </Text>
                        ) : null}
                      </Box>
                      <Badge
                        variant={selected ? 'filled' : 'light'}
                        color="stayosBrand"
                        radius={radius.full}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </Badge>
                    </Group>
                  </UnstyledButton>
                );
              })
            ) : (
              <Paper radius={radius.lg} p={16} className={styles.modalEmpty}>
                <Text className={styles.modalEmptyText}>
                  No compatible rooms are available right now.
                </Text>
              </Paper>
            )}
          </Stack>
        ) : null}

        <Group justify="flex-end" mt={spacing[2]}>
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            disabled={!selectedRoom || !room}
            loading={loading}
            onClick={() => {
              if (selectedRoom) onConfirm(selectedRoom);
            }}
            className={styles.primaryButtonText}
          >
            Confirm Room Change
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function RoomDrawer({
  activityItems,
  onAction,
  onAssignGuest,
  onCheckIn,
  onChangeRoom,
  onOpenStay,
  onRemoveAssignment,
  onClose,
  opened,
  room,
}: {
  activityItems: OperationsActivityItemDto[];
  onAction: (room: Room, action: RoomAction) => void;
  onAssignGuest: (room: Room) => void;
  onCheckIn: (room: Room) => void;
  onChangeRoom: (room: Room) => void;
  onOpenStay: (room: Room) => void;
  onRemoveAssignment: (room: Room) => void;
  onClose: () => void;
  opened: boolean;
  room: Room | null;
}) {
  if (!room) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="min(92vw, 480px)"
        title="Room"
      />
    );
  }

  const action = actionForPrimary(room);
  const context = getDrawerContext(room);
  const contextBanner = getContextBanner(room);
  const isReady = isRoomReadyForAssignment(room);
  const isAssignedArrival = hasAssignedBooking(room) && isReady;
  const activityTimeline = activityItems
    .filter((item) => {
      const entityId = item.entity?.id;
      return (
        entityId === room.id ||
        entityId === room.reservationId ||
        item.description.includes(`Room ${room.number}`) ||
        item.description.includes(room.reservation)
      );
    })
    .slice(0, 6)
    .map((item) => ({
      label: item.title,
      time: formatActivityTime(item.timestamp),
    }));
  const timeline = activityTimeline.length > 0 ? activityTimeline : room.timeline;

  const handlePrimaryClick = () => {
    if (isReady && !isAssignedArrival) {
      onAssignGuest(room);
      return;
    }

    if (isAssignedArrival) {
      onCheckIn(room);
      return;
    }

    if (room.status === 'occupied') {
      onOpenStay(room);
      return;
    }

    if (action) onAction(room, action);
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(92vw, 480px)"
      title={
        <Group gap={10}>
          <Text style={{ fontSize: 20, fontWeight: 700 }}>Room {room.number}</Text>
          <RoomBadge status={room.status}>{statusLabel(room.status)}</RoomBadge>
        </Group>
      }
    >
      <ScrollArea.Autosize mah="calc(100vh - 92px)" type="hover" scrollbarSize={6}>
        <Stack gap={22}>
          <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
            <Stack gap={13}>
              <Group gap={6}>
                <RoomTypeMetadata roomType={room.roomType} />
                <FloorMetadata floor={room.floor} />
              </Group>

              <Box>
                <Text c="#101828" style={{ fontSize: 21, fontWeight: 700, lineHeight: '28px' }}>
                  {context.headline}
                </Text>
                <Text
                  mt={4}
                  c="#64748b"
                  style={{ fontSize: 13, fontWeight: 450, lineHeight: '20px' }}
                >
                  {contextBanner}
                </Text>
              </Box>

              <Button
                fullWidth
                onClick={handlePrimaryClick}
                color="stayosBrand"
                variant={isReady ? 'filled' : 'light'}
                style={{ fontWeight: 650 }}
              >
                {primaryAction(room)}
              </Button>
            </Stack>
          </Paper>

          {!isReady ? (
            <DrawerSection title={context.title}>
              <Paper radius={radius.lg} p={14} className={styles.surfaceCard}>
                <Text c="#101828" style={{ fontSize: 15, fontWeight: 650, lineHeight: '21px' }}>
                  {context.headline}
                </Text>
                <Text
                  mt={5}
                  c="#64748b"
                  style={{ fontSize: 13, fontWeight: 450, lineHeight: '19px' }}
                >
                  {context.detail}
                </Text>
              </Paper>
            </DrawerSection>
          ) : null}

          <DrawerSection title="Room Information">
            <SimpleGrid cols={2} spacing={spacing[3]}>
              <DetailTile label="Capacity" value={room.capacity} />
              <DetailTile label="Bed" value={room.bedType} />
            </SimpleGrid>

            {room.amenities.length > 0 || room.accessible || room.connecting ? (
              <Box mt={spacing[3]}>
                <Text
                  c="#64748b"
                  mb={7}
                  style={{ fontSize: 11, fontWeight: 600, lineHeight: '15px' }}
                >
                  Amenities
                </Text>
                <Group gap={6}>
                  {room.amenities
                    .filter(
                      (amenity) => !['city', 'garden', 'courtyard'].includes(amenity.toLowerCase()),
                    )
                    .map((amenity) => (
                      <RoomBadge key={amenity}>{amenity}</RoomBadge>
                    ))}
                  {room.accessible ? <RoomBadge>Accessible</RoomBadge> : null}
                  {room.connecting ? <RoomBadge>Connecting</RoomBadge> : null}
                </Group>
              </Box>
            ) : null}
          </DrawerSection>

          <DrawerSection title="Operations">
            <Stack gap={2}>
              {/* Occupied Room */}
              {room.status === 'occupied' ? (
                <>
                  <OperationRow
                    icon={<DoorOpen size={16} />}
                    label="Open Stay"
                    onClick={() => onOpenStay(room)}
                  />
                  <OperationRow
                    icon={<CheckCircle2 size={16} />}
                    label="Check Out"
                    onClick={() => onOpenStay(room)}
                  />
                </>
              ) : null}

              {/* Assigned but not Checked In */}
              {room.status === 'reserved' ? (
                <>
                  <OperationRow
                    icon={<DoorOpen size={16} />}
                    label="Change Room"
                    onClick={() => onChangeRoom(room)}
                  />

                  <OperationRow
                    color="#dc2626"
                    icon={<Ban size={16} />}
                    label="Remove Assignment"
                    onClick={() => onRemoveAssignment(room)}
                  />
                </>
              ) : null}

              {/* Cleaning / Dirty / Inspection */}
              {room.status === 'cleaning' ||
              room.status === 'dirty' ||
              room.status === 'inspection' ? (
                <OperationRow
                  icon={<CheckCircle2 size={16} />}
                  label="Mark Ready"
                  onClick={() => onAction(room, 'mark-ready')}
                />
              ) : null}

              {/* Maintenance should NOT appear for assigned rooms */}
              {room.status !== 'reserved' &&
              room.status !== 'maintenance' &&
              room.status !== 'out-of-service' &&
              room.status !== 'out-of-order' ? (
                <OperationRow
                  color="#b45309"
                  icon={<Wrench size={16} />}
                  label="Maintenance"
                  onClick={() => onAction(room, 'maintenance')}
                />
              ) : null}

              {/* Block Room only when truly Ready */}
              {isReady && room.status !== 'reserved' ? (
                <OperationRow
                  color="#dc2626"
                  icon={<Ban size={16} />}
                  label="Block Room"
                  onClick={() => onAction(room, 'out-of-service')}
                />
              ) : null}

              <OperationRow icon={<History size={16} />} label="View History" />
            </Stack>
          </DrawerSection>

          {timeline.length > 0 ? (
            <DrawerSection title="Recent Activity">
              <Timeline active={timeline.length - 1} bulletSize={18} lineWidth={1}>
                {timeline.map((item, index) => (
                  <Timeline.Item key={`${item.time}-${item.label}-${index}`} title={item.time}>
                    <Text c="#334155" style={{ fontSize: 13, fontWeight: 450, lineHeight: '19px' }}>
                      {item.label}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </DrawerSection>
          ) : null}
        </Stack>
      </ScrollArea.Autosize>
    </Drawer>
  );
}

function RoomAlerts({
  activityItems,
  attentionItems,
  rooms,
}: {
  activityItems: OperationsActivityItemDto[];
  attentionItems: OperationsAttentionItemDto[];
  rooms: Room[];
}) {
  const tasks = attentionItems.slice(0, 3);
  const operations =
    activityItems.length > 0
      ? activityItems.slice(0, 8).map((item) => ({
          detail: item.description,
          entityId: item.entity?.id,
          timestamp: item.timestamp,
          title: item.title,
        }))
      : rooms
          .filter((room) =>
            ['ready', 'cleaning', 'dirty', 'maintenance', 'out-of-order'].includes(room.status),
          )
          .slice(0, 8)
          .map((room) => ({
            detail: statusLabel(room.status),
            entityId: room.id ?? room.number,
            timestamp: undefined,
            title: `Room ${room.number} ${statusLabel(room.status)}`,
          }));

  return (
    <Stack gap={spacing[3]} visibleFrom="lg">
      <Card radius={radius.lg} p={16} className={styles.surfaceCard}>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          Needs Attention
        </Text>
        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
          Operational room tasks.
        </Text>
        <Stack mt={12} gap={spacing[3]}>
          {tasks.length > 0 ? (
            tasks.map((task, index) => (
              <Card
                key={`${task.type}-${task.relatedEntity?.id ?? task.title}-${index}`}
                radius={radius.md}
                p={12}
                style={{ border: '1px solid #eef2f7' }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Box>
                    <Text c="#101828" style={{ fontSize: 12, fontWeight: 700, lineHeight: '17px' }}>
                      {task.title}
                    </Text>
                    <Text
                      c="#475569"
                      mt={4}
                      style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}
                    >
                      {task.description}
                    </Text>
                  </Box>
                  <Badge
                    color={
                      task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'red' : 'yellow'
                    }
                    variant="light"
                    radius={radius.full}
                  >
                    {task.priority}
                  </Badge>
                </Group>
                <Button mt={10} size="compact-xs" variant="light" color="stayosBrand">
                  {task.primaryAction}
                </Button>
              </Card>
            ))
          ) : (
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 400 }}>
              No rooms need attention.
            </Text>
          )}
        </Stack>
      </Card>

      <Card
        radius={radius.lg}
        p={16}
        style={{ ...cardStyle, display: 'flex', flexDirection: 'column', maxHeight: 360 }}
      >
        <Group justify="space-between">
          <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
            Recent Activity
          </Text>
          <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
            Newest first
          </Text>
        </Group>
        <ScrollArea mt={12} type="hover" scrollbarSize={6} style={{ minHeight: 0 }}>
          <Stack gap={10} pr={4} pb={4}>
            {operations.length > 0 ? (
              operations.map((operation, index) => (
                <Group
                  key={`${operation.timestamp ?? 'room'}-${operation.entityId ?? index}-${index}`}
                  gap={10}
                  wrap="nowrap"
                  align="flex-start"
                >
                  <CheckCircle2
                    size={15}
                    color="#16a34a"
                    style={{ flex: '0 0 auto', marginTop: 2 }}
                  />
                  <Box>
                    <Text c="#182230" style={{ fontSize: 12, fontWeight: 600, lineHeight: '17px' }}>
                      {operation.title}
                    </Text>
                    <Text c="#64748b" style={{ fontSize: 11, fontWeight: 400, lineHeight: '15px' }}>
                      {operation.detail}
                    </Text>
                  </Box>
                </Group>
              ))
            ) : (
              <Text c="#64748b" style={{ fontSize: 12, fontWeight: 400 }}>
                No recent room updates.
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Card>
    </Stack>
  );
}

function FilterPills({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Box>
      <Text c="#64748b" mb={6} style={{ fontSize: 11, fontWeight: 600, lineHeight: '15px' }}>
        {label}
      </Text>
      <Group gap={6}>
        {options.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? 'light' : 'subtle'}
            color={value === option.value ? 'stayosBrand' : 'gray'}
            size="compact-sm"
            onClick={() => onChange(option.value)}
            style={{
              border:
                value === option.value
                  ? '1px solid rgba(109, 93, 252, 0.22)'
                  : '1px solid transparent',
              fontWeight: 600,
            }}
          >
            {option.label}
          </Button>
        ))}
      </Group>
    </Box>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const inventory = useRoomInventory({
    allowMockFallback,
    enabled: backend.isOnline,
  });
  const reservationsState = useReservations({
    allowMockFallback,
    enabled: backend.isOnline,
  });
  const [filters, setFilters] = useState<FiltersState>(defaultRoomFilters);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loadingAction, setLoadingAction] = useState<string>();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [attentionItems, setAttentionItems] = useState<OperationsAttentionItemDto[]>([]);
  const [activityItems, setActivityItems] = useState<OperationsActivityItemDto[]>([]);
  const [assignmentOpened, { open: openAssignmentModal, close: closeAssignmentModal }] =
    useDisclosure(false);
  const [assignmentRoom, setAssignmentRoom] = useState<Room | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string>();
  const [isAssigningRoom, setIsAssigningRoom] = useState(false);
  const [changeRoomOpened, { open: openChangeRoomModal, close: closeChangeRoomModal }] =
    useDisclosure(false);
  const [changeRoomSource, setChangeRoomSource] = useState<Room | null>(null);
  const [isChangingRoom, setIsChangingRoom] = useState(false);
  const [
    removeAssignmentOpened,
    { open: openRemoveAssignmentModal, close: closeRemoveAssignmentModal },
  ] = useDisclosure(false);
  const [removeAssignmentRoom, setRemoveAssignmentRoom] = useState<Room | null>(null);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [checkInOpened, { open: openCheckInModal, close: closeCheckInModal }] =
    useDisclosure(false);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  useEffect(() => {
    if (!backend.isOnline || !inventory.propertyId || inventory.isFallback) return;

    const controller = new AbortController();

    async function loadSidebar() {
      try {
        const [attention, activity] = await Promise.all([
          getNeedsAttention(inventory.propertyId!, controller.signal),
          getActivityFeed(inventory.propertyId!, { limit: 8 }, controller.signal),
        ]);

        setAttentionItems(attention);
        setActivityItems(activity);
      } catch {
        setAttentionItems([]);
        setActivityItems([]);
      }
    }

    void loadSidebar();

    return () => controller.abort();
  }, [backend.isOnline, inventory.isFallback, inventory.propertyId, sidebarRefreshKey]);

  const displayRooms = inventory.rooms;
  const {
    filteredRooms,
    floors,
    groupedRooms,
    isDatasetFiltered,
    roomTypes,
    selectedRoomAttributes,
  } = useRoomFilters(displayRooms, filters);

  const summary = [
    {
      label: 'Ready',
      value: displayRooms.filter((room) => statusGroup(room.status) === 'ready').length,
      detail: 'Rooms available now.',
      tone: '#16a34a',
      icon: <DoorOpen size={17} />,
    },
    {
      label: 'Occupied',
      value: displayRooms.filter((room) => room.status === 'occupied').length,
      detail: 'Guests currently staying.',
      tone: '#2563eb',
      icon: <UserRound size={17} />,
    },
    {
      label: 'Needs Cleaning',
      value: displayRooms.filter((room) => statusGroup(room.status) === 'needs-cleaning').length,
      detail: 'Cleaning or inspection.',
      tone: '#d97706',
      icon: <Brush size={17} />,
    },
    {
      label: 'Unavailable',
      value: displayRooms.filter((room) => statusGroup(room.status) === 'unavailable').length,
      detail: 'Maintenance or blocked.',
      tone: '#dc2626',
      icon: <AlertCircle size={17} />,
    },
    {
      label: 'Vacant',
      value: displayRooms.filter((room) => statusGroup(room.status) === 'vacant').length,
      detail: 'Currently empty rooms.',
      tone: '#64748b',
      icon: <BedDouble size={17} />,
    },
  ];

  const openRoom = (room: Room) => {
    setSelectedRoom(room);
    openDrawer();
  };

  const openAssignGuest = (room: Room) => {
    setAssignmentRoom(room);
    setSelectedReservationId(undefined);
    openAssignmentModal();
  };

  const openChangeRoom = (room: Room) => {
    if (room.status === 'occupied') {
      showToast({
        color: 'yellow',
        title: 'Room change unavailable',
        message: 'This room assignment cannot be changed after check-in.',
      });
      return;
    }

    setChangeRoomSource(room);
    openChangeRoomModal();
  };

  const reservationForRoom = useCallback(
    (room: Room | null) =>
      reservationsState.reservations.find(
        (reservation) =>
          reservation.backendId === room?.reservationId ||
          reservation.backendId === room?.bookingId ||
          reservation.id === room?.bookingId,
      ),
    [reservationsState.reservations],
  );

  const openCheckIn = (room: Room) => {
    if (room.status === 'occupied') {
      showToast({
        color: 'yellow',
        title: 'Already checked in',
        message: 'This guest is already checked in.',
      });
      return;
    }

    setCheckInRoom(room);
    openCheckInModal();
  };

  const openStay = (room: Room) => {
    const stayId = room.reservationId || room.bookingId;

    if (!stayId) {
      showToast({
        color: 'red',
        title: 'Stay unavailable',
        message: 'Unable to open this stay. Booking details are missing.',
      });
      return;
    }

    router.push(`/guest-stay/${stayId}`);
  };

  const openRemoveAssignment = (room: Room) => {
    if (room.status === 'occupied') {
      showToast({
        color: 'yellow',
        title: 'Assignment locked',
        message: 'This room assignment cannot be changed after check-in.',
      });
      return;
    }

    setRemoveAssignmentRoom(room);
    openRemoveAssignmentModal();
  };

  const handleAssignGuest = async () => {
    const selectedReservation = reservationsState.reservations.find(
      (reservation) => reservation.backendId === selectedReservationId,
    );

    if (
      !inventory.propertyId ||
      !assignmentRoom?.id ||
      !selectedReservationId ||
      !selectedReservation ||
      inventory.isFallback
    ) {
      showToast({
        color: 'red',
        message: 'Unable to assign this room. Please try again.',
        title: 'Assignment failed',
      });
      return;
    }

    const issue = assignmentIssue(assignmentRoom, selectedReservation);
    if (issue) {
      showToast({
        color: 'yellow',
        message: issue,
        title: 'Assignment needs review',
      });
      return;
    }

    setIsAssigningRoom(true);

    try {
      await assignRoomToReservation(inventory.propertyId, selectedReservationId, assignmentRoom.id);

      showToast({
        color: 'green',
        message: `Room ${assignmentRoom.number} assigned successfully.`,
        title: 'Room assigned',
      });

      closeAssignmentModal();
      closeDrawer();
      setAssignmentRoom(null);
      setSelectedReservationId(undefined);

      await Promise.all([inventory.refreshInventory(), reservationsState.refreshReservations()]);

      setSidebarRefreshKey((current) => current + 1);
    } catch (error) {
      showToast({
        color: 'red',
        message: friendlyAssignmentError(error),
        title: 'Assignment failed',
      });
    } finally {
      setIsAssigningRoom(false);
    }
  };

  const handleChangeRoom = async (newRoom: Room) => {
    if (
      !inventory.propertyId ||
      !changeRoomSource?.reservationId ||
      !newRoom.id ||
      inventory.isFallback
    ) {
      showToast({
        color: 'red',
        message: 'Unable to change the room. Please try again.',
        title: 'Room change failed',
      });
      return;
    }

    setIsChangingRoom(true);

    try {
      await assignRoomToReservation(
        inventory.propertyId,
        changeRoomSource.reservationId,
        newRoom.id,
      );

      showToast({
        color: 'green',
        message: `${changeRoomSource.guest ?? 'Guest'} moved from Room ${changeRoomSource.number} to Room ${newRoom.number}.`,
        title: 'Room changed',
      });

      closeChangeRoomModal();
      closeDrawer();
      setChangeRoomSource(null);

      await Promise.all([inventory.refreshInventory(), reservationsState.refreshReservations()]);

      setSidebarRefreshKey((current) => current + 1);
    } catch (error) {
      showToast({
        color: 'red',
        message: friendlyRoomChangeError(error),
        title: 'Room change failed',
      });
    } finally {
      setIsChangingRoom(false);
    }
  };

  const handleCheckIn = async () => {
    const reservation = reservationForRoom(checkInRoom);

    if (!inventory.propertyId || !checkInRoom?.reservationId || inventory.isFallback) {
      showToast({
        color: 'red',
        title: 'Check in failed',
        message: 'Unable to check in this guest. Please try again.',
      });
      return;
    }

    if (checkInRoom.status === 'occupied' || reservation?.status === 'Checked-in') {
      showToast({
        color: 'yellow',
        title: 'Already checked in',
        message: 'This guest is already checked in.',
      });
      return;
    }

    setIsCheckingIn(true);

    try {
      await checkInReservation(inventory.propertyId, checkInRoom.reservationId);

      showToast({
        color: 'green',
        title: 'Guest checked in',
        message: `${reservation?.guest ?? checkInRoom.guest ?? 'Guest'} checked in to Room ${checkInRoom.number}.`,
      });

      closeCheckInModal();
      closeDrawer();
      setCheckInRoom(null);

      await Promise.all([inventory.refreshInventory(), reservationsState.refreshReservations()]);

      setSidebarRefreshKey((current) => current + 1);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Check in failed',
        message: friendlyCheckInError(error),
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleRemoveAssignment = async (room: Room) => {
    if (!inventory.propertyId || !room.reservationId || inventory.isFallback) {
      showToast({
        color: 'red',
        title: 'Unable to remove assignment',
        message: 'Unable to remove this room assignment. Please try again.',
      });
      return;
    }

    setIsRemovingAssignment(true);

    try {
      await unassignRoomFromReservation(inventory.propertyId, room.reservationId);

      showToast({
        color: 'green',
        title: 'Assignment removed',
        message: `Room ${room.number} is available again.`,
      });

      closeRemoveAssignmentModal();
      closeDrawer();
      setRemoveAssignmentRoom(null);

      await Promise.all([inventory.refreshInventory(), reservationsState.refreshReservations()]);

      setSidebarRefreshKey((current) => current + 1);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to remove assignment',
        message: friendlyRemoveAssignmentError(error),
      });
    } finally {
      setIsRemovingAssignment(false);
    }
  };

  const retryBackend = () => {
    void backend.retry();
  };

  const checkBackendStatus = () => {
    void backend.checkHealth();
  };

  const handleRoomAction = async (room: Room, action: RoomAction) => {
    if (!inventory.propertyId || !room.id || inventory.isFallback) {
      showToast({
        color: 'red',
        message: 'Live room inventory is unavailable. Action was not sent.',
        title: 'Room action failed',
      });
      return;
    }

    const actionKey = roomActionKey(room, action);
    setLoadingAction(actionKey);

    try {
      await runRoomStatusAction(action, inventory.propertyId, room.id);
      showToast({
        color: 'green',
        message: `Room ${room.number} updated.`,
        title: 'Room updated',
      });
      await inventory.refreshInventory();
      setSidebarRefreshKey((current) => current + 1);
    } catch (error) {
      showToast({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to update room status.',
        title: 'Room action failed',
      });
    } finally {
      setLoadingAction(undefined);
    }
  };

  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title order={1} className={styles.pageTitle}>
          Rooms
        </Title>
        <Text mt={spacing[1]} className={styles.pageSubtitle}>
          Manage live room operations across the property.
        </Text>
        <Text mt={spacing[2]} className={styles.pageMeta}>
          {displayRooms.length} Rooms - {summary[1].value} Occupied - {summary[0].value} Ready -{' '}
          {summary[2].value} Need Cleaning
        </Text>
      </Box>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && backend.status === 'CONNECTING' && displayRooms.length === 0) {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <ServerStarting
          title="Connecting to StayOS"
          detail="We are checking the hotel server before loading live room operations."
          onAction={retryBackend}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  if (!allowMockFallback && inventory.error && !inventory.isLoading && displayRooms.length === 0) {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <GenericError
          onAction={() => void inventory.refreshInventory()}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </SimpleGrid>

      {inventory.isLoading ? (
        <Alert color="blue" variant="light" icon={<Hotel size={17} />} radius={radius.lg}>
          Loading live room inventory...
        </Alert>
      ) : null}

      {inventory.isFallback && inventory.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Rooms is showing mock inventory while the backend is
          unavailable.
        </Alert>
      ) : null}

      <Card radius={radius.lg} p={12} className={styles.surfaceCard}>
        <Group gap={spacing[2]} align="center" wrap="wrap">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder="Search room number, type, floor, guest or booking ID..."
            value={filters.query}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setFilters((current) => ({ ...current, query }));
            }}
            className={styles.searchInput}
            classNames={{ input: styles.searchControlInput }}
          />
          <Select
            className={styles.statusSelect}
            data={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Ready', value: 'ready' },
              { label: 'Occupied', value: 'occupied' },
              { label: 'Needs Cleaning', value: 'needs-cleaning' },
              { label: 'Unavailable', value: 'unavailable' },
              { label: 'Vacant', value: 'vacant' },
            ]}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value ?? 'all' }))}
            classNames={{ input: styles.controlInput }}
          />
          <MultiSelect
            className={styles.attributeSelect}
            data={[
              { label: 'VIP', value: 'vip' },
              { label: 'Accessible', value: 'accessible' },
              { label: 'Connecting', value: 'connecting' },
            ]}
            value={selectedRoomAttributes}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                accessible: value.includes('accessible'),
                connecting: value.includes('connecting'),
                vip: value.includes('vip'),
              }))
            }
            placeholder="Room Attributes"
            renderOption={({ option, checked }) => (
              <Group gap={8} wrap="nowrap">
                <Checkbox checked={checked} readOnly size="xs" color="stayosBrand" aria-hidden />
                <Text className={styles.attributeOptionLabel}>{option.label}</Text>
              </Group>
            )}
            renderPill={({ value }) =>
              value === selectedRoomAttributes[0] ? (
                <Box component="span" className={styles.attributeSelectedCount}>
                  {selectedRoomAttributes.length} selected
                </Box>
              ) : null
            }
            comboboxProps={{ shadow: 'md' }}
            withCheckIcon={false}
            classNames={{
              input: styles.controlInput,
              pill: styles.attributePill,
              pillsList: styles.attributePillsList,
            }}
          />
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Box className={styles.gridMain}>
          <Stack gap={spacing[3]}>
            <Card radius={radius.lg} p={12} className={styles.surfaceCard}>
              <Stack gap={spacing[2]}>
                <FilterPills
                  label="Floors"
                  value={filters.floor}
                  onChange={(value) => setFilters((current) => ({ ...current, floor: value }))}
                  options={[
                    { label: 'All Floors', value: 'all' },
                    ...floors.map((floor) => ({ label: floor, value: floor })),
                  ]}
                />
                <FilterPills
                  label="Room Types"
                  value={filters.roomType}
                  onChange={(value) => setFilters((current) => ({ ...current, roomType: value }))}
                  options={[
                    { label: 'All Types', value: 'all' },
                    ...roomTypes.map((roomType) => ({ label: roomType, value: roomType })),
                  ]}
                />
              </Stack>
            </Card>

            <Group justify="space-between" align="center">
              <Box>
                <Title order={2} className={styles.boardTitle}>
                  Room Board
                </Title>
              </Box>
              {isDatasetFiltered ? <RoomBadge>{filteredRooms.length} rooms shown</RoomBadge> : null}
            </Group>

            {filteredRooms.length > 0 ? (
              <Stack gap={spacing[4]}>
                {groupedRooms.map((group) => (
                  <Stack key={group.floor} gap={spacing[3]}>
                    {filters.floor === 'all' ? (
                      <Group justify="space-between" align="center">
                        <Title order={3} className={styles.floorTitle}>
                          {group.floor}
                        </Title>
                        <Text className={styles.floorCount}>{group.rooms.length} rooms</Text>
                      </Group>
                    ) : null}
                    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={spacing[3]}>
                      {group.rooms.map((room) => (
                        <RoomCard
                          key={`${room.floor}-${room.number}`}
                          loadingAction={loadingAction}
                          onAction={handleRoomAction}
                          onAssignGuest={openAssignGuest}
                          onCheckIn={openCheckIn}
                          onOpen={openRoom}
                          onOpenStay={openStay}
                          room={room}
                        />
                      ))}
                    </SimpleGrid>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Card p={spacing[8]} ta="center" radius={radius.lg} className={styles.surfaceCard}>
                <ThemeIcon
                  color="stayosBrand"
                  variant="light"
                  radius={radius.md}
                  size={44}
                  mx="auto"
                >
                  <Search size={20} />
                </ThemeIcon>
                <Title order={3} mt={spacing[4]} className={styles.emptyTitle}>
                  No rooms match this view
                </Title>
                <Text mt={spacing[2]} className={styles.emptyDetail}>
                  Try another floor, status, room type, or search term.
                </Text>
              </Card>
            )}

            {!inventory.isLoading && displayRooms.length === 0 ? (
              <EmptyData
                title="No rooms returned"
                detail="The active property has no live room inventory yet."
              />
            ) : null}
          </Stack>
        </Box>

        <Box className={styles.gridSidebar}>
          <RoomAlerts
            activityItems={activityItems}
            attentionItems={attentionItems}
            rooms={displayRooms}
          />
        </Box>
      </SimpleGrid>

      <RoomDrawer
        activityItems={activityItems}
        onAction={handleRoomAction}
        onAssignGuest={openAssignGuest}
        onCheckIn={openCheckIn}
        onChangeRoom={openChangeRoom}
        onOpenStay={openStay}
        room={selectedRoom}
        opened={drawerOpened}
        onClose={closeDrawer}
        onRemoveAssignment={openRemoveAssignment}
      />

      <AssignGuestModal
        loading={isAssigningRoom}
        onAssign={handleAssignGuest}
        onClose={closeAssignmentModal}
        opened={assignmentOpened}
        reservations={reservationsState.reservations}
        room={assignmentRoom}
        selectedReservationId={selectedReservationId}
        setSelectedReservationId={setSelectedReservationId}
      />

      <ChangeRoomModal
        loading={isChangingRoom}
        onClose={closeChangeRoomModal}
        onConfirm={handleChangeRoom}
        opened={changeRoomOpened}
        propertyId={inventory.propertyId}
        reservations={reservationsState.reservations}
        room={changeRoomSource}
      />

      <CheckInModal
        loading={isCheckingIn}
        onClose={closeCheckInModal}
        onConfirm={handleCheckIn}
        opened={checkInOpened}
        reservation={reservationForRoom(checkInRoom)}
        room={checkInRoom}
      />

      <Modal
        opened={removeAssignmentOpened}
        onClose={closeRemoveAssignmentModal}
        centered
        size="min(92vw, 460px)"
        title={<Text className={styles.modalTitle}>Remove room assignment?</Text>}
      >
        <Stack gap={spacing[4]}>
          <Text className={styles.dialogBody}>
            {removeAssignmentRoom
              ? `This will release Room ${removeAssignmentRoom.number} and keep the booking unassigned. You can assign another room later.`
              : 'This will release the room and keep the booking unassigned. You can assign another room later.'}
          </Text>

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={closeRemoveAssignmentModal}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={isRemovingAssignment}
              onClick={() => {
                if (removeAssignmentRoom) void handleRemoveAssignment(removeAssignmentRoom);
              }}
              className={styles.primaryButtonText}
            >
              Remove Assignment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
