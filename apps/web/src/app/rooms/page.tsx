'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
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
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  AlertCircle,
  BedDouble,
  Brush,
  CheckCircle2,
  DoorOpen,
  Download,
  Hotel,
  Plus,
  Search,
  Upload,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import {
  BackendUnavailable,
  EmptyData,
  GenericError,
  OperationalTaskCard,
  ServerStarting,
  getOpenOperationalTasks,
  showToast,
  useBackendStatus,
} from '@stayos/ui';
import {
  getProperties,
  getPropertyRooms,
  markRoomCleaning,
  markRoomInspection,
  markRoomMaintenance,
  markRoomOutOfOrder,
  markRoomOutOfService,
  markRoomReady,
  type InventoryPropertyDto,
  type InventoryRoomDto,
} from '../../lib/inventory-api';

type RoomStatus =
  | 'ready'
  | 'occupied'
  | 'cleaning'
  | 'dirty'
  | 'inspection'
  | 'maintenance'
  | 'out-of-order'
  | 'out-of-service'
  | 'reserved'
  | 'vacant';

type RoomAction = 'mark-ready' | 'start-cleaning' | 'inspection' | 'maintenance' | 'out-of-order' | 'out-of-service';

type Room = {
  accessible: boolean;
  amenities: string[];
  bedType: string;
  bookingId?: string;
  capacity: string;
  connecting: boolean;
  floor: string;
  guest?: string;
  housekeeping: {
    assignedStaff: string;
    estimatedFinish: string;
    inspection: string;
    started: string;
    status: string;
  };
  id?: string;
  maintenance: {
    engineer: string;
    issue: string;
    priority: string;
    status: string;
  };
  number: string;
  reservation: string;
  roomType: string;
  stayDates: string;
  status: RoomStatus;
  stayHref?: string;
  timeline: Array<{ label: string; time: string }>;
  view: string;
  vip: boolean;
};

type InventoryState = {
  activePropertyName?: string;
  error?: string;
  floors: string[];
  isFallback: boolean;
  isLoading: boolean;
  propertyId?: string;
  rooms: Room[];
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const emptyInventory: InventoryState = {
  floors: [],
  isFallback: false,
  isLoading: true,
  rooms: [],
};

const mockRooms: Room[] = [
  {
    accessible: true,
    amenities: ['Queen', 'Garden', 'Accessible'],
    bedType: 'Queen',
    capacity: '2 guests',
    connecting: false,
    floor: 'Ground Floor',
    guest: undefined,
    housekeeping: {
      assignedStaff: 'Pooja',
      estimatedFinish: 'Complete',
      inspection: 'Ready',
      started: '08:00',
      status: 'Ready',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '005',
    reservation: 'Available',
    roomType: 'Accessible Queen',
    stayDates: 'Available today',
    status: 'ready',
    timeline: [
      { time: '08:00', label: 'Cleaning Started' },
      { time: '08:35', label: 'Ready for Assignment' },
    ],
    view: 'Garden',
    vip: false,
  },
  {
    accessible: false,
    amenities: ['Queen', 'City', 'Connecting'],
    bedType: 'Queen',
    capacity: '2 guests',
    connecting: true,
    floor: 'First Floor',
    housekeeping: {
      assignedStaff: 'Nisha',
      estimatedFinish: 'Complete',
      inspection: 'Passed',
      started: '08:10',
      status: 'Ready',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '101',
    reservation: 'ST1871',
    roomType: 'Standard Queen',
    stayDates: 'Arrival 4:00 PM',
    status: 'ready',
    timeline: [
      { time: '08:10', label: 'Cleaning Started' },
      { time: '09:00', label: 'Ready for Assignment' },
    ],
    view: 'City',
    vip: false,
  },
  {
    accessible: false,
    amenities: ['Twin', 'Courtyard', 'Connecting'],
    bedType: 'Twin',
    bookingId: 'ST1856',
    capacity: '2 guests',
    connecting: true,
    floor: 'First Floor',
    guest: 'Rhea Malhotra',
    housekeeping: {
      assignedStaff: 'Kavita',
      estimatedFinish: '10:45',
      inspection: 'Pending',
      started: '10:14',
      status: 'Cleaning',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '102',
    reservation: 'ST1856',
    roomType: 'Deluxe Twin',
    stayDates: 'Guest waiting',
    status: 'cleaning',
    timeline: [
      { time: '10:05', label: 'Checkout Completed' },
      { time: '10:14', label: 'Cleaning Started' },
    ],
    view: 'Courtyard',
    vip: false,
  },
  {
    accessible: false,
    amenities: ['King', 'City', 'Desk'],
    bedType: 'King',
    bookingId: 'ST1838',
    capacity: '2 guests',
    connecting: false,
    floor: 'Second Floor',
    guest: 'Dev Sharma',
    housekeeping: {
      assignedStaff: 'Rekha',
      estimatedFinish: 'Complete',
      inspection: 'Occupied refresh complete',
      started: '07:10',
      status: 'Occupied',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '201',
    reservation: 'ST1838',
    roomType: 'Premium King',
    stayDates: 'Checkout tomorrow',
    status: 'occupied',
    stayHref: '/guest-stay/ST1842',
    timeline: [
      { time: '07:30', label: 'Room Refresh Completed' },
      { time: '10:12', label: 'Guest In House' },
    ],
    view: 'City',
    vip: false,
  },
  {
    accessible: false,
    amenities: ['King', 'City', 'Work Desk'],
    bedType: 'King',
    capacity: '2 guests',
    connecting: false,
    floor: 'Second Floor',
    housekeeping: {
      assignedStaff: 'Ravi',
      estimatedFinish: 'After engineering',
      inspection: 'Hold',
      started: '09:05',
      status: 'Hold',
    },
    maintenance: {
      engineer: 'Arjun',
      issue: 'AC not cooling',
      priority: 'High',
      status: 'In progress',
    },
    number: '202',
    reservation: 'Blocked',
    roomType: 'Premium King',
    stayDates: 'Unavailable',
    status: 'maintenance',
    timeline: [
      { time: '09:20', label: 'Maintenance Created' },
      { time: '09:30', label: 'Engineer Assigned' },
    ],
    view: 'City',
    vip: false,
  },
  {
    accessible: false,
    amenities: ['King', 'Courtyard', 'Desk'],
    bedType: 'King',
    bookingId: 'ST1849',
    capacity: '2 guests',
    connecting: false,
    floor: 'Third Floor',
    guest: 'Jaipur Textiles Group',
    housekeeping: {
      assignedStaff: 'Suman',
      estimatedFinish: '12:30',
      inspection: 'Pending',
      started: '11:05',
      status: 'Dirty',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '302',
    reservation: 'ST1849',
    roomType: 'Premium King',
    stayDates: 'Corporate arrival',
    status: 'dirty',
    timeline: [
      { time: '10:41', label: 'Guest Arrived Early' },
      { time: '11:05', label: 'Cleaning Started' },
    ],
    view: 'Courtyard',
    vip: false,
  },
  {
    accessible: false,
    amenities: ['King', 'Balcony', 'Garden'],
    bedType: 'King',
    bookingId: 'ST1842',
    capacity: '3 guests',
    connecting: false,
    floor: 'Fourth Floor',
    guest: 'Ananya Rao',
    housekeeping: {
      assignedStaff: 'Meena',
      estimatedFinish: 'Complete',
      inspection: 'Occupied refresh complete',
      started: '07:30',
      status: 'Occupied',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '402',
    reservation: 'ST1842',
    roomType: 'Premium Suite',
    stayDates: '28 Jun - 01 Jul',
    status: 'occupied',
    stayHref: '/guest-stay/ST1842',
    timeline: [
      { time: '09:42', label: 'Priority Cleaning Complete' },
      { time: '10:12', label: 'Guest Checked In' },
    ],
    view: 'Garden',
    vip: true,
  },
  {
    accessible: false,
    amenities: ['Suite', 'Balcony', 'City'],
    bedType: 'King',
    capacity: '3 guests',
    connecting: false,
    floor: 'Fourth Floor',
    housekeeping: {
      assignedStaff: 'Sana',
      estimatedFinish: 'Complete',
      inspection: 'Passed',
      started: '07:20',
      status: 'Ready',
    },
    maintenance: { engineer: 'None', issue: 'None', priority: 'None', status: 'Clear' },
    number: '501',
    reservation: 'ST1851',
    roomType: 'Signature Suite',
    stayDates: 'VIP arrival 11:30',
    status: 'reserved',
    timeline: [
      { time: '08:10', label: 'Cleaning Completed' },
      { time: '08:40', label: 'Held for VIP' },
    ],
    view: 'Garden and city',
    vip: true,
  },
  {
    accessible: false,
    amenities: ['Suite', 'City', 'Blocked'],
    bedType: 'King',
    capacity: '3 guests',
    connecting: false,
    floor: 'Fourth Floor',
    housekeeping: {
      assignedStaff: 'Sana',
      estimatedFinish: 'After repair',
      inspection: 'Blocked',
      started: 'Not started',
      status: 'Blocked',
    },
    maintenance: {
      engineer: 'Manoj',
      issue: 'Plumbing repair',
      priority: 'High',
      status: 'Open',
    },
    number: '506',
    reservation: 'Blocked',
    roomType: 'Signature Suite',
    stayDates: 'Unavailable',
    status: 'out-of-order',
    timeline: [
      { time: '07:55', label: 'Room Marked Out Of Order' },
      { time: '08:05', label: 'Maintenance Assigned' },
    ],
    view: 'City',
    vip: false,
  },
];

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function getBoolean(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return false;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1', 'vip'].includes(value.toLowerCase());
  }

  return false;
}

function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function getPropertyId(property: InventoryPropertyDto) {
  return getString(property, ['id', '_id', 'uuid', 'propertyId']);
}

function getPropertyName(property: InventoryPropertyDto) {
  return getString(property, ['name', 'title', 'displayName']);
}

function mapStatus(value: string): RoomStatus {
  const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  if (['active', 'available', 'clean', 'vacant-ready', 'ready'].includes(normalized)) return 'ready';
  if (['occupied', 'in-house', 'guest-staying'].includes(normalized)) return 'occupied';
  if (['cleaning', 'waiting-guest'].includes(normalized)) return 'cleaning';
  if (['dirty', 'needs-cleaning', 'checkout-dirty'].includes(normalized)) return 'dirty';
  if (['inspection', 'inspect', 'pending-inspection'].includes(normalized)) return 'inspection';
  if (['maintenance', 'under-maintenance', 'repair'].includes(normalized)) return 'maintenance';
  if (['out-of-order', 'ooo'].includes(normalized)) return 'out-of-order';
  if (['out-of-service', 'oos', 'blocked'].includes(normalized)) return 'out-of-service';
  if (['reserved', 'held', 'vip-arrival', 'vip'].includes(normalized)) return 'reserved';
  return 'vacant';
}

function mapInventoryRoom(dto: InventoryRoomDto, index: number): Room {
  const status = mapStatus(getString(dto, ['operationalStatus', 'operational_status', 'status'], 'ready'));
  const roomNumber = getString(dto, ['roomNumber', 'number', 'displayName'], String(index + 1).padStart(3, '0'));
  const guestName = getString(dto, ['guestName', 'currentGuest']);
  const roomType = getString(dto, ['roomTypeName', 'roomType', 'type'], 'Standard Room');
  const floor = getString(dto, ['floorName', 'floor', 'level'], 'Main Floor');
  const bedType = getString(dto, ['bedType', 'bed'], roomType.includes('Twin') ? 'Twin' : 'King');
  const view = getString(dto, ['view', 'roomView'], 'City');
  const housekeepingStatus = getString(dto, ['housekeepingStatus', 'housekeeping_status'], statusLabel(status));
  const maintenanceIssue = getString(dto, ['maintenanceIssue', 'maintenanceStatus', 'maintenance_status'], 'None');

  return {
    accessible: getBoolean(dto, ['accessible', 'isAccessible']),
    amenities: [bedType, view, getBoolean(dto, ['connecting', 'isConnecting']) ? 'Connecting' : 'WiFi'].filter(Boolean),
    bedType,
    bookingId: getString(dto, ['bookingId', 'reservationCode']),
    capacity: getString(dto, ['capacity', 'occupancy'], '2 guests'),
    connecting: getBoolean(dto, ['connecting', 'isConnecting']),
    floor,
    guest: guestName || undefined,
    housekeeping: {
      assignedStaff: getString(dto, ['housekeeper', 'assignedStaff'], 'Unassigned'),
      estimatedFinish: getString(dto, ['estimatedFinish'], status === 'ready' ? 'Complete' : 'Not set'),
      inspection: getString(dto, ['inspectionStatus', 'inspection_status'], status === 'inspection' ? 'Pending' : statusLabel(status)),
      started: getString(dto, ['cleaningStartedAt', 'cleaningStarted'], 'Not recorded'),
      status: housekeepingStatus,
    },
    id: getString(dto, ['id', '_id', 'uuid']),
    maintenance: {
      engineer: getString(dto, ['engineer', 'maintenanceEngineer'], 'Unassigned'),
      issue: maintenanceIssue,
      priority: getString(dto, ['maintenancePriority'], maintenanceIssue === 'None' ? 'None' : 'Medium'),
      status: getString(dto, ['maintenanceState'], maintenanceIssue === 'None' ? 'Clear' : 'Open'),
    },
    number: roomNumber,
    reservation: getString(dto, ['reservationCode', 'bookingId'], guestName ? 'In house' : 'Available'),
    roomType,
    stayDates: getString(dto, ['stayDates', 'reservationDates'], status === 'occupied' ? 'Current stay' : 'Available today'),
    status,
    stayHref: getString(dto, ['stayHref']) || undefined,
    timeline: [
      { time: '08:15', label: housekeepingStatus },
      { time: '09:02', label: statusLabel(status) },
    ],
    view,
    vip: getBoolean(dto, ['vip', 'isVip']) || status === 'reserved',
  };
}

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

      setState((current) => ({ ...current, error: undefined, isLoading: current.rooms.length === 0 }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const roomDtos = await getPropertyRooms(propertyId, signal);
        const rooms = roomDtos.map(mapInventoryRoom);
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

function statusLabel(status: RoomStatus) {
  const labels: Record<RoomStatus, string> = {
    cleaning: 'Cleaning',
    dirty: 'Dirty',
    inspection: 'Inspection',
    maintenance: 'Maintenance',
    occupied: 'Occupied',
    'out-of-order': 'Out Of Order',
    'out-of-service': 'Out Of Service',
    ready: 'Ready',
    reserved: 'Reserved',
    vacant: 'Vacant',
  };

  return labels[status];
}

function statusTone(status: RoomStatus) {
  if (status === 'ready') return { color: '#16a34a', background: '#f0fdf4' };
  if (status === 'occupied') return { color: '#2563eb', background: '#eff6ff' };
  if (status === 'cleaning' || status === 'dirty' || status === 'inspection') return { color: '#d97706', background: '#fffbeb' };
  if (status === 'maintenance') return { color: '#f97316', background: '#fff7ed' };
  if (status === 'out-of-order' || status === 'out-of-service') return { color: '#dc2626', background: '#fef2f2' };
  if (status === 'reserved') return { color: '#6d5dfc', background: '#f5f3ff' };
  return { color: '#64748b', background: '#f8fafc' };
}

function RoomBadge({ children, status }: { children: ReactNode; status?: RoomStatus }) {
  const tone = status ? statusTone(status) : { color: '#64748b', background: '#f8fafc' };

  return (
    <Badge
      radius={radius.full}
      style={{
        background: tone.background,
        border: '1px solid rgba(226, 232, 240, 0.9)',
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
    <Paper radius={radius.lg} p={15} style={{ ...cardStyle, minHeight: 84 }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c="#334155" style={{ fontSize: 12, fontWeight: 600, lineHeight: '15px' }}>
            {label}
          </Text>
          <Text c="#111827" mt={4} style={{ fontSize: 22, fontWeight: 700, lineHeight: '26px' }}>
            {value}
          </Text>
          <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
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

function primaryAction(room: Room) {
  if (room.status === 'occupied') return room.stayHref ? 'View Stay' : 'Check Out';
  if (room.status === 'ready') return 'Assign Guest';
  if (room.status === 'reserved') return 'Check In';
  if (room.status === 'cleaning' || room.status === 'dirty') return 'Start Cleaning';
  if (room.status === 'inspection') return 'Mark Ready';
  if (room.status === 'maintenance' || room.status === 'out-of-order' || room.status === 'out-of-service') return 'View Room';
  return 'Assign Guest';
}

function actionForPrimary(room: Room): RoomAction | undefined {
  if (room.status === 'cleaning' || room.status === 'dirty') return 'start-cleaning';
  if (room.status === 'inspection') return 'mark-ready';
  return undefined;
}

function runRoomStatusAction(action: RoomAction, propertyId: string, roomId: string) {
  if (action === 'mark-ready') return markRoomReady(propertyId, roomId);
  if (action === 'start-cleaning') return markRoomCleaning(propertyId, roomId);
  if (action === 'inspection') return markRoomInspection(propertyId, roomId);
  if (action === 'maintenance') return markRoomMaintenance(propertyId, roomId);
  if (action === 'out-of-order') return markRoomOutOfOrder(propertyId, roomId);
  return markRoomOutOfService(propertyId, roomId);
}

function roomActionKey(room: Room, action: RoomAction) {
  return `${room.number}-${action}`;
}

function RoomCard({
  loadingAction,
  onAction,
  onOpen,
  room,
}: {
  loadingAction?: string;
  onAction: (room: Room, action: RoomAction) => void;
  onOpen: (room: Room) => void;
  room: Room;
}) {
  const action = actionForPrimary(room);
  const tone = statusTone(room.status);

  return (
    <UnstyledButton onClick={() => onOpen(room)} style={{ display: 'block', height: '100%', width: '100%' }}>
      <Paper
        radius={radius.lg}
        p={16}
        style={{
          ...cardStyle,
          borderLeft: `3px solid ${tone.color}`,
          cursor: 'pointer',
          height: '100%',
          transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.boxShadow = '0 12px 24px rgba(15, 23, 42, 0.055)';
          event.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.boxShadow = cardStyle.boxShadow as string;
          event.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <Stack gap={12}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Box>
              <Text c="#101828" style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>
                {room.number}
              </Text>
              <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                {room.roomType} - {room.floor}
              </Text>
            </Box>
            <RoomBadge status={room.status}>{statusLabel(room.status)}</RoomBadge>
          </Group>

          <Group gap={8}>
            <Text c="#334155" style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
              Guest
            </Text>
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
              {room.guest ?? 'None'}
            </Text>
          </Group>

          <SimpleGrid cols={2} spacing={8}>
            <Box>
              <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
                Housekeeping
              </Text>
              <Text c="#182230" mt={2} lineClamp={1} style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
                {room.housekeeping.status}
              </Text>
            </Box>
            <Box>
              <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
                Maintenance
              </Text>
              <Text c="#182230" mt={2} lineClamp={1} style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>
                {room.maintenance.status}
              </Text>
            </Box>
          </SimpleGrid>

          <Group gap={6}>
            {room.amenities.slice(0, 4).map((amenity) => (
              <Badge
                key={amenity}
                radius={radius.full}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#526383',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                {amenity}
              </Badge>
            ))}
          </Group>

          <Button
            fullWidth
            loading={action ? loadingAction === roomActionKey(room, action) : false}
            onClick={(event) => {
              event.stopPropagation();
              if (action) onAction(room, action);
              else onOpen(room);
            }}
            size="compact-sm"
            color="stayosBrand"
            variant={room.status === 'ready' || room.status === 'reserved' ? 'filled' : 'light'}
            style={{ fontWeight: 600 }}
          >
            {primaryAction(room)}
          </Button>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}

function DetailTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
        {label}
      </Text>
      <Text c="#182230" mt={3} style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
        {value}
      </Text>
    </Paper>
  );
}

function DrawerSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Box>
      <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
        {title}
      </Text>
      <Box mt={10}>{children}</Box>
    </Box>
  );
}

function RoomDrawer({
  loadingAction,
  onAction,
  onClose,
  opened,
  room,
}: {
  loadingAction?: string;
  onAction: (room: Room, action: RoomAction) => void;
  onClose: () => void;
  opened: boolean;
  room: Room | null;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(94vw, 560px)"
      title={
        room ? (
          <Group gap={10}>
            <Text style={{ fontSize: 20, fontWeight: 700 }}>Room {room.number}</Text>
            <RoomBadge status={room.status}>{statusLabel(room.status)}</RoomBadge>
          </Group>
        ) : (
          'Room'
        )
      }
    >
      {room ? (
        <ScrollArea.Autosize mah="calc(100vh - 92px)" type="hover" scrollbarSize={6}>
          <Stack gap={18}>
            <SimpleGrid cols={2} spacing={spacing[3]}>
              <DetailTile label="Guest" value={room.guest ?? 'None'} />
              <DetailTile label="Reservation" value={room.reservation} />
              <DetailTile label="Stay dates" value={room.stayDates} />
              <DetailTile label="Room type" value={room.roomType} />
              <DetailTile label="Floor" value={room.floor} />
              <DetailTile label="Capacity" value={room.capacity} />
              <DetailTile label="Bed type" value={room.bedType} />
              <DetailTile label="View" value={room.view} />
            </SimpleGrid>

            <DrawerSection title="Housekeeping">
              <SimpleGrid cols={2} spacing={spacing[3]}>
                <DetailTile label="Assigned staff" value={room.housekeeping.assignedStaff} />
                <DetailTile label="Cleaning started" value={room.housekeeping.started} />
                <DetailTile label="Estimated finish" value={room.housekeeping.estimatedFinish} />
                <DetailTile label="Inspection" value={room.housekeeping.inspection} />
              </SimpleGrid>
            </DrawerSection>

            <DrawerSection title="Maintenance">
              <SimpleGrid cols={2} spacing={spacing[3]}>
                <DetailTile label="Issue" value={room.maintenance.issue} />
                <DetailTile label="Priority" value={room.maintenance.priority} />
                <DetailTile label="Engineer" value={room.maintenance.engineer} />
                <DetailTile label="Status" value={room.maintenance.status} />
              </SimpleGrid>
              {room.maintenance.issue !== 'None' ? (
                <Button mt={spacing[3]} variant="light" color="orange" size="compact-sm" style={{ fontWeight: 600 }}>
                  View Ticket
                </Button>
              ) : null}
            </DrawerSection>

            <DrawerSection title="Amenities">
              <Group gap={6}>
                {room.amenities.map((amenity) => (
                  <RoomBadge key={amenity}>{amenity}</RoomBadge>
                ))}
                {room.accessible ? <RoomBadge>Accessible</RoomBadge> : null}
                {room.connecting ? <RoomBadge>Connecting</RoomBadge> : null}
              </Group>
            </DrawerSection>

            <DrawerSection title="Room Timeline">
              <Timeline active={room.timeline.length - 1} bulletSize={18} lineWidth={1}>
                {room.timeline.map((item) => (
                  <Timeline.Item key={`${item.time}-${item.label}`} title={item.time}>
                    <Text c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
                      {item.label}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </DrawerSection>

            <DrawerSection title="Quick actions">
              <SimpleGrid cols={2} spacing={spacing[3]}>
                {[
                  { action: 'mark-ready' as const, label: 'Mark Ready' },
                  { action: 'start-cleaning' as const, label: 'Start Cleaning' },
                  { action: 'inspection' as const, label: 'Send Inspection' },
                  { action: 'maintenance' as const, label: 'Maintenance' },
                  { action: 'out-of-order' as const, label: 'Out Of Order' },
                  { action: 'out-of-service' as const, label: 'Out Of Service' },
                ].map((item) => (
                  <Button
                    key={item.action}
                    loading={loadingAction === roomActionKey(room, item.action)}
                    onClick={() => onAction(room, item.action)}
                    variant={item.action === 'mark-ready' ? 'filled' : 'light'}
                    color={item.action === 'out-of-order' || item.action === 'out-of-service' ? 'red' : 'stayosBrand'}
                    style={{ fontWeight: 600 }}
                  >
                    {item.label}
                  </Button>
                ))}
              </SimpleGrid>
            </DrawerSection>
          </Stack>
        </ScrollArea.Autosize>
      ) : null}
    </Drawer>
  );
}

function RoomAlerts({ rooms }: { rooms: Room[] }) {
  const tasks = getOpenOperationalTasks({ limit: 3 });
  const operations = rooms
    .filter((room) => ['ready', 'cleaning', 'dirty', 'maintenance', 'out-of-order'].includes(room.status))
    .slice(0, 8)
    .map((room) => ({
      detail: statusLabel(room.status),
      title: `Room ${room.number} ${statusLabel(room.status)}`,
    }));

  return (
    <Stack gap={spacing[3]} visibleFrom="lg">
      <Card radius={radius.lg} p={16} style={cardStyle}>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          Room Alerts
        </Text>
        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
          Operational room tasks.
        </Text>
        <Stack mt={12} gap={spacing[3]}>
          {tasks.map((task) => (
            <OperationalTaskCard key={task.id} task={task} compact />
          ))}
        </Stack>
      </Card>

      <Card radius={radius.lg} p={16} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', maxHeight: 360 }}>
        <Group justify="space-between">
          <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
            Live Operations
          </Text>
          <Text c="#64748b" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
            Newest first
          </Text>
        </Group>
        <ScrollArea mt={12} type="hover" scrollbarSize={6} style={{ minHeight: 0 }}>
          <Stack gap={10} pr={4} pb={4}>
            {operations.length > 0 ? (
              operations.map((operation) => (
                <Group key={`${operation.title}-${operation.detail}`} gap={10} wrap="nowrap" align="flex-start">
                  <CheckCircle2 size={15} color="#16a34a" style={{ flex: '0 0 auto', marginTop: 2 }} />
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

function roomMatches(room: Room, filters: FiltersState) {
  if (filters.status !== 'all' && room.status !== filters.status) return false;
  if (filters.floor !== 'all' && room.floor !== filters.floor) return false;
  if (filters.roomType !== 'all' && room.roomType !== filters.roomType) return false;
  if (filters.housekeeping !== 'all' && room.housekeeping.status.toLowerCase() !== filters.housekeeping) return false;
  if (filters.maintenance !== 'all' && room.maintenance.status.toLowerCase() !== filters.maintenance) return false;
  if (filters.vip && !room.vip) return false;
  if (filters.accessible && !room.accessible) return false;
  if (filters.connecting && !room.connecting) return false;

  const normalized = filters.query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    room.number,
    room.guest,
    room.bookingId,
    room.roomType,
    room.floor,
    room.housekeeping.status,
    room.maintenance.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

type FiltersState = {
  accessible: boolean;
  connecting: boolean;
  floor: string;
  housekeeping: string;
  maintenance: string;
  query: string;
  roomType: string;
  status: string;
  vip: boolean;
};

export default function RoomsPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const inventory = useRoomInventory({
    allowMockFallback,
    enabled: backend.isOnline,
  });
  const [filters, setFilters] = useState<FiltersState>({
    accessible: false,
    connecting: false,
    floor: 'all',
    housekeeping: 'all',
    maintenance: 'all',
    query: '',
    roomType: 'all',
    status: 'all',
    vip: false,
  });
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loadingAction, setLoadingAction] = useState<string>();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  const displayRooms = inventory.rooms;
  const floors = useMemo(() => Array.from(new Set(displayRooms.map((room) => room.floor))), [displayRooms]);
  const roomTypes = useMemo(() => Array.from(new Set(displayRooms.map((room) => room.roomType))), [displayRooms]);
  const filteredRooms = useMemo(
    () => displayRooms.filter((room) => roomMatches(room, filters)),
    [displayRooms, filters],
  );

  const summary = [
    {
      label: 'Ready',
      value: displayRooms.filter((room) => room.status === 'ready').length,
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
      label: 'Cleaning',
      value: displayRooms.filter((room) => room.status === 'cleaning' || room.status === 'dirty').length,
      detail: 'Housekeeping in progress.',
      tone: '#d97706',
      icon: <Brush size={17} />,
    },
    {
      label: 'Out of Order',
      value: displayRooms.filter((room) => room.status === 'out-of-order' || room.status === 'out-of-service').length,
      detail: 'Unavailable rooms.',
      tone: '#dc2626',
      icon: <AlertCircle size={17} />,
    },
    {
      label: 'Maintenance',
      value: displayRooms.filter((room) => room.status === 'maintenance').length,
      detail: 'Engineering work.',
      tone: '#f97316',
      icon: <Wrench size={17} />,
    },
    {
      label: 'Vacant',
      value: displayRooms.filter((room) => room.status === 'vacant' || room.status === 'ready').length,
      detail: 'Currently empty rooms.',
      tone: '#64748b',
      icon: <BedDouble size={17} />,
    },
  ];

  const openRoom = (room: Room) => {
    setSelectedRoom(room);
    openDrawer();
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
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
          Rooms
        </Title>
        <Text mt={spacing[1]} c="#64748b" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
          Manage live room operations across the property.
        </Text>
        <Text mt={spacing[2]} c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
          {displayRooms.length} Rooms - {summary[1].value} Occupied - {summary[0].value} Ready - {summary[2].value} Cleaning
        </Text>
      </Box>
      <Group gap={8}>
        <Button variant="light" color="gray" leftSection={<Upload size={15} />} style={{ fontWeight: 600 }}>
          Import
        </Button>
        <Button variant="light" color="gray" leftSection={<Download size={15} />} style={{ fontWeight: 600 }}>
          Export
        </Button>
        <Button color="stayosBrand" leftSection={<Plus size={16} />} style={{ fontWeight: 600 }}>
          Add Room
        </Button>
      </Group>
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
        <GenericError onAction={() => void inventory.refreshInventory()} onCheckStatus={checkBackendStatus} />
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
          Demo fallback is enabled, so Rooms is showing mock inventory while the backend is unavailable.
        </Alert>
      ) : null}

      {!inventory.isFallback && inventory.activePropertyName ? (
        <Alert color="green" variant="light" icon={<CheckCircle2 size={17} />} radius={radius.lg}>
          Showing live inventory for {inventory.activePropertyName}.
        </Alert>
      ) : null}

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} align="center">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder="Search room number, guest, booking ID or room type..."
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.currentTarget.value }))}
            style={{ flex: 1, minWidth: 260 }}
            styles={{
              input: {
                borderColor: '#dbe3ef',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 400,
                minHeight: 38,
              },
            }}
          />
          <Select
            w={{ base: 140, md: 160 }}
            data={[
              { label: 'All Statuses', value: 'all' },
              ...(['ready', 'occupied', 'cleaning', 'dirty', 'inspection', 'maintenance', 'out-of-order', 'out-of-service', 'reserved', 'vacant'] as RoomStatus[]).map((status) => ({
                label: statusLabel(status),
                value: status,
              })),
            ]}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value ?? 'all' }))}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 140, md: 160 }}
            data={[{ label: 'All Floors', value: 'all' }, ...floors.map((floor) => ({ label: floor, value: floor }))]}
            value={filters.floor}
            onChange={(value) => setFilters((current) => ({ ...current, floor: value ?? 'all' }))}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 150, md: 180 }}
            data={[{ label: 'All Room Types', value: 'all' }, ...roomTypes.map((roomType) => ({ label: roomType, value: roomType }))]}
            value={filters.roomType}
            onChange={(value) => setFilters((current) => ({ ...current, roomType: value ?? 'all' }))}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Button
            variant={filters.vip ? 'light' : 'subtle'}
            color="stayosBrand"
            size="compact-md"
            onClick={() => setFilters((current) => ({ ...current, vip: !current.vip }))}
            style={{ fontWeight: 600, height: 38 }}
          >
            VIP
          </Button>
          <Button
            variant={filters.accessible ? 'light' : 'subtle'}
            color="gray"
            size="compact-md"
            onClick={() => setFilters((current) => ({ ...current, accessible: !current.accessible }))}
            style={{ fontWeight: 600, height: 38 }}
          >
            Accessible
          </Button>
          <Button
            variant={filters.connecting ? 'light' : 'subtle'}
            color="gray"
            size="compact-md"
            onClick={() => setFilters((current) => ({ ...current, connecting: !current.connecting }))}
            style={{ fontWeight: 600, height: 38 }}
          >
            Connecting
          </Button>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Box style={{ gridColumn: 'span 9' }}>
          <Stack gap={spacing[3]}>
            <Group justify="space-between" align="center">
              <Box>
                <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 700, lineHeight: '24px' }}>
                  Room Board
                </Title>
                <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
                  Click any room to open operational details.
                </Text>
              </Box>
              <RoomBadge>{filteredRooms.length} rooms shown</RoomBadge>
            </Group>

            {filteredRooms.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={spacing[3]}>
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={`${room.floor}-${room.number}`}
                    loadingAction={loadingAction}
                    onAction={handleRoomAction}
                    onOpen={openRoom}
                    room={room}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Card p={spacing[8]} ta="center" radius={radius.lg} style={cardStyle}>
                <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44} mx="auto">
                  <Search size={20} />
                </ThemeIcon>
                <Title order={3} c="#101828" mt={spacing[4]} style={{ fontSize: 24, fontWeight: 700, lineHeight: '30px' }}>
                  No rooms match this view
                </Title>
                <Text c="#64748b" mt={spacing[2]} style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
                  Try another floor, status, room type, or search term.
                </Text>
              </Card>
            )}

            {!inventory.isLoading && displayRooms.length === 0 ? (
              <EmptyData title="No rooms returned" detail="The active property has no live room inventory yet." />
            ) : null}
          </Stack>
        </Box>

        <Box style={{ gridColumn: 'span 3' }}>
          <RoomAlerts rooms={displayRooms} />
        </Box>
      </SimpleGrid>

      <RoomDrawer
        loadingAction={loadingAction}
        onAction={handleRoomAction}
        room={selectedRoom}
        opened={drawerOpened}
        onClose={closeDrawer}
      />
    </Stack>
  );
}
