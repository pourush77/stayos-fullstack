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
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
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
  getPropertyFloors,
  getPropertyRoomTypes,
  getPropertyRooms,
  markRoomCleaning,
  markRoomInspection,
  markRoomMaintenance,
  markRoomOutOfOrder,
  markRoomOutOfService,
  markRoomReady,
  type InventoryPropertyDto,
  type InventoryFloorDto,
  type InventoryRoomDto,
  type InventoryRoomTypeDto,
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

type RoomAction =
  | 'mark-ready'
  | 'start-cleaning'
  | 'inspection'
  | 'maintenance'
  | 'out-of-order'
  | 'out-of-service';

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

type InventoryLookups = {
  floors: Map<string, InventoryFloorDto>;
  roomTypes: Map<string, InventoryRoomTypeDto>;
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

function getRecord(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>;
  }

  return undefined;
}

function getRoomPayload(dto: InventoryRoomDto) {
  return getRecord(dto, ['room']) ?? dto;
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

function createLookup<T extends Record<string, unknown>>(records: T[]) {
  const entries: Array<[string, T]> = [];

  for (const record of records) {
    const id = getString(record, ['id', '_id', 'uuid']);
    if (id) entries.push([id, record]);
  }

  return new Map(entries);
}

function getPropertyId(property: InventoryPropertyDto) {
  return getString(property, ['id', '_id', 'uuid', 'propertyId']);
}

function getPropertyName(property: InventoryPropertyDto) {
  return getString(property, ['name', 'title', 'displayName']);
}

function mapStatus(value: string): RoomStatus {
  const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  if (['active', 'available', 'clean', 'vacant-ready', 'ready'].includes(normalized))
    return 'ready';
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

function mapInventoryRoom(dto: InventoryRoomDto, index: number, lookups: InventoryLookups): Room {
  const roomPayload = getRoomPayload(dto);
  const floorId = getString(
    roomPayload,
    ['floorId', 'floor_id'],
    getString(dto, ['floorId', 'floor_id']),
  );
  const roomTypeId = getString(
    roomPayload,
    ['roomTypeId', 'room_type_id'],
    getString(dto, ['roomTypeId', 'room_type_id']),
  );
  const floorRecord =
    getRecord(roomPayload, ['floor']) ?? getRecord(dto, ['floor']) ?? lookups.floors.get(floorId);
  const roomTypeRecord =
    getRecord(roomPayload, ['roomType', 'room_type']) ??
    getRecord(dto, ['roomType', 'room_type']) ??
    lookups.roomTypes.get(roomTypeId);
  const status = mapStatus(
    getString(
      roomPayload,
      ['operationalStatus', 'operational_status', 'status'],
      getString(dto, ['operationalStatus', 'operational_status', 'status'], 'ready'),
    ),
  );
  const roomNumber = getString(
    roomPayload,
    ['roomNumber', 'number', 'displayName', 'name', 'code'],
    getString(
      dto,
      ['roomNumber', 'number', 'displayName', 'name', 'code'],
      String(index + 1).padStart(3, '0'),
    ),
  );
  const guestName = getString(
    dto,
    ['guestName', 'currentGuest', 'guest'],
    getString(roomPayload, ['guestName', 'currentGuest']),
  );
  const roomType =
    getString(roomTypeRecord, ['name', 'displayName', 'title', 'label', 'code'], '') ||
    getString(
      roomPayload,
      ['roomTypeName', 'room_type_name', 'typeName', 'roomType', 'room_type', 'type'],
      getString(
        dto,
        ['roomTypeName', 'room_type_name', 'typeName', 'roomType', 'room_type', 'type'],
        'Standard Room',
      ),
    );
  const floor =
    getString(floorRecord, ['name', 'displayName', 'title', 'label', 'code'], '') ||
    getString(
      roomPayload,
      ['floorName', 'floor_name', 'floor', 'levelName', 'level'],
      getString(dto, ['floorName', 'floor_name', 'floor', 'levelName', 'level'], 'Main Floor'),
    );
  const bedType = getString(dto, ['bedType', 'bed'], roomType.includes('Twin') ? 'Twin' : 'King');
  const view = getString(dto, ['view', 'roomView'], 'City');
  const housekeepingStatus = getString(
    dto,
    ['housekeepingStatus', 'housekeeping_status'],
    statusLabel(status),
  );
  const maintenanceIssue = getString(
    dto,
    ['maintenanceIssue', 'maintenanceStatus', 'maintenance_status'],
    'None',
  );

  return {
    accessible: getBoolean(dto, ['accessible', 'isAccessible']),
    amenities: [
      bedType,
      view,
      getBoolean(dto, ['connecting', 'isConnecting']) ? 'Connecting' : 'WiFi',
    ].filter(Boolean),
    bedType,
    bookingId: getString(dto, ['bookingId', 'reservationCode']),
    capacity: getString(dto, ['capacity', 'occupancy'], '2 guests'),
    connecting: getBoolean(dto, ['connecting', 'isConnecting']),
    floor,
    guest: guestName || undefined,
    housekeeping: {
      assignedStaff: getString(dto, ['housekeeper', 'assignedStaff'], 'Unassigned'),
      estimatedFinish: getString(
        dto,
        ['estimatedFinish'],
        status === 'ready' ? 'Complete' : 'Not set',
      ),
      inspection: getString(
        dto,
        ['inspectionStatus', 'inspection_status'],
        status === 'inspection' ? 'Pending' : statusLabel(status),
      ),
      started: getString(dto, ['cleaningStartedAt', 'cleaningStarted'], 'Not recorded'),
      status: housekeepingStatus,
    },
    id: getString(dto, ['id', '_id', 'uuid']),
    maintenance: {
      engineer: getString(dto, ['engineer', 'maintenanceEngineer'], 'Unassigned'),
      issue: maintenanceIssue,
      priority: getString(
        dto,
        ['maintenancePriority'],
        maintenanceIssue === 'None' ? 'None' : 'Medium',
      ),
      status: getString(dto, ['maintenanceState'], maintenanceIssue === 'None' ? 'Clear' : 'Open'),
    },
    number: roomNumber,
    reservation: getString(
      dto,
      ['reservationCode', 'bookingId'],
      guestName ? 'In house' : 'Available',
    ),
    roomType,
    stayDates: getString(
      dto,
      ['stayDates', 'reservationDates'],
      status === 'occupied' ? 'Current stay' : 'Available today',
    ),
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

      setState((current) => ({
        ...current,
        error: undefined,
        isLoading: current.rooms.length === 0,
      }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const [roomDtos, floorDtos, roomTypeDtos] = await Promise.all([
          getPropertyRooms(propertyId, signal),
          getPropertyFloors(propertyId, signal),
          getPropertyRoomTypes(propertyId, signal),
        ]);
        const lookups = {
          floors: createLookup(floorDtos.filter(isActiveRecord)),
          roomTypes: createLookup(roomTypeDtos.filter(isActiveRecord)),
        };
        const rooms = roomDtos.map((room, index) => mapInventoryRoom(room, index, lookups));
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
    dirty: 'Cleaning',
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
  if (status === 'ready') return { color: '#16a34a', background: '#f0fdf4', border: '#bbf7d0' };
  if (status === 'occupied') return { color: '#1d4ed8', background: '#dbeafe', border: '#bfdbfe' };
  if (status === 'cleaning' || status === 'dirty')
    return { color: '#d97706', background: '#fffbeb', border: '#fde68a' };
  if (status === 'inspection')
    return { color: '#ea580c', background: '#fff7ed', border: '#fed7aa' };
  if (status === 'maintenance' || status === 'out-of-order' || status === 'out-of-service')
    return { color: '#dc2626', background: '#fef2f2', border: '#fecaca' };
  if (status === 'reserved') return { color: '#6d5dfc', background: '#f5f3ff', border: '#ddd6fe' };
  return { color: '#64748b', background: '#f8fafc', border: '#e2e8f0' };
}

function statusGroup(status: RoomStatus) {
  if (status === 'ready') return 'ready';
  if (status === 'occupied') return 'occupied';
  if (status === 'cleaning' || status === 'dirty' || status === 'inspection')
    return 'needs-cleaning';
  if (status === 'maintenance' || status === 'out-of-order' || status === 'out-of-service')
    return 'unavailable';
  if (status === 'vacant' || status === 'reserved') return 'vacant';
  return 'vacant';
}

function getRoomSubtitle(room: Room) {
  if (room.status === 'ready') return 'Vacant';
  if (room.status === 'occupied') return room.guest ?? 'Guest in house';
  if (room.status === 'cleaning' || room.status === 'dirty') return 'Waiting for housekeeping';
  if (room.status === 'inspection') return 'Inspection pending';
  if (room.status === 'maintenance') return 'Maintenance in progress';
  if (room.status === 'out-of-order') return 'Unavailable for sale';
  if (room.status === 'out-of-service') return 'Temporarily unavailable';
  if (room.status === 'reserved') return 'Held for arrival';

  return statusLabel(room.status);
}

function sortRoomLabels(values: string[]) {
  return [...values].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

function groupRoomsByFloor(rooms: Room[], floors: string[]) {
  return floors
    .map((floor) => ({
      floor,
      rooms: rooms.filter((room) => room.floor === floor),
    }))
    .filter((group) => group.rooms.length > 0);
}

function compactFloorLabel(floor: string) {
  const numeric = floor.match(/\d+/)?.[0];
  if (numeric) return `F${numeric}`;

  const normalized = floor.toLowerCase();
  const ordinalMap: Record<string, string> = {
    ground: 'G',
    first: 'F1',
    second: 'F2',
    third: 'F3',
    fourth: 'F4',
    fifth: 'F5',
    sixth: 'F6',
    seventh: 'F7',
    eighth: 'F8',
    ninth: 'F9',
    tenth: 'F10',
  };

  for (const [token, label] of Object.entries(ordinalMap)) {
    if (normalized.includes(token)) return label;
  }

  return floor
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 3);
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
  if (room.status === 'occupied') return 'Open Stay';
  if (room.status === 'ready' || room.status === 'vacant' || room.status === 'reserved')
    return 'Assign Guest';
  if (
    room.status === 'cleaning' ||
    room.status === 'dirty' ||
    room.status === 'inspection' ||
    room.status === 'maintenance' ||
    room.status === 'out-of-order' ||
    room.status === 'out-of-service'
  )
    return 'View Details';

  return 'View Details';
}

function actionForPrimary(room: Room): RoomAction | undefined {
  if (room.status === 'occupied') return undefined;
  if (room.status === 'ready' || room.status === 'vacant' || room.status === 'reserved')
    return undefined;

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

  const isOccupied = room.status === 'occupied';
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

        <Button
          fullWidth
          loading={action ? loadingAction === roomActionKey(room, action) : false}
          onClick={(event) => {
            event.stopPropagation();

            if (action) {
              onAction(room, action);
              return;
            }

            onOpen(room);
          }}
          size="compact-sm"
          color="stayosBrand"
          variant={
            room.status === 'ready' || room.status === 'vacant' || room.status === 'reserved'
              ? 'filled'
              : 'light'
          }
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
                <Button
                  mt={spacing[3]}
                  variant="light"
                  color="orange"
                  size="compact-sm"
                  style={{ fontWeight: 600 }}
                >
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
                    color={
                      item.action === 'out-of-order' || item.action === 'out-of-service'
                        ? 'red'
                        : 'stayosBrand'
                    }
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
    .filter((room) =>
      ['ready', 'cleaning', 'dirty', 'maintenance', 'out-of-order'].includes(room.status),
    )
    .slice(0, 8)
    .map((room) => ({
      detail: statusLabel(room.status),
      title: `Room ${room.number} ${statusLabel(room.status)}`,
    }));

  return (
    <Stack gap={spacing[3]} visibleFrom="lg">
      <Card radius={radius.lg} p={16} style={cardStyle}>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          Needs Attention
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
              operations.map((operation) => (
                <Group
                  key={`${operation.title}-${operation.detail}`}
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

function roomMatches(room: Room, filters: FiltersState) {
  if (filters.status !== 'all' && statusGroup(room.status) !== filters.status) return false;
  if (filters.floor !== 'all' && room.floor !== filters.floor) return false;
  if (filters.roomType !== 'all' && room.roomType !== filters.roomType) return false;
  if (
    filters.housekeeping !== 'all' &&
    room.housekeeping.status.toLowerCase() !== filters.housekeeping
  )
    return false;
  if (
    filters.maintenance !== 'all' &&
    room.maintenance.status.toLowerCase() !== filters.maintenance
  )
    return false;
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
  const floors = useMemo(
    () => sortRoomLabels(Array.from(new Set(displayRooms.map((room) => room.floor)))),
    [displayRooms],
  );
  const roomTypes = useMemo(
    () => sortRoomLabels(Array.from(new Set(displayRooms.map((room) => room.roomType)))),
    [displayRooms],
  );
  const filteredRooms = useMemo(
    () => displayRooms.filter((room) => roomMatches(room, filters)),
    [displayRooms, filters],
  );
  const groupedRooms = useMemo(
    () => groupRoomsByFloor(filteredRooms, filters.floor === 'all' ? floors : [filters.floor]),
    [filteredRooms, filters.floor, floors],
  );
  const selectedRoomAttributes = useMemo(
    () =>
      [
        filters.vip ? 'vip' : undefined,
        filters.accessible ? 'accessible' : undefined,
        filters.connecting ? 'connecting' : undefined,
      ].filter(Boolean) as string[],
    [filters.accessible, filters.connecting, filters.vip],
  );
  const isDatasetFiltered = filteredRooms.length !== displayRooms.length;

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
        <Text
          mt={spacing[1]}
          c="#64748b"
          style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}
        >
          Manage live room operations across the property.
        </Text>
        <Text
          mt={spacing[2]}
          c="#334155"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}
        >
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

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} align="center" wrap="wrap">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder="Search room number, type, floor, guest or booking ID..."
            value={filters.query}
            onChange={(event) =>
              setFilters((current) => ({ ...current, query: event.currentTarget.value }))
            }
            style={{ flex: '7 1 360px', minWidth: 260 }}
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
            style={{ flex: '1.5 1 150px', minWidth: 140 }}
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
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <MultiSelect
            style={{ flex: '1.5 1 170px', minWidth: 160 }}
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
                <Text c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
                  {option.label}
                </Text>
              </Group>
            )}
            renderPill={({ value }) =>
              value === selectedRoomAttributes[0] ? (
                <Box
                  component="span"
                  style={{ color: '#334155', fontSize: 13, fontWeight: 500, lineHeight: '18px' }}
                >
                  {selectedRoomAttributes.length} selected
                </Box>
              ) : null
            }
            comboboxProps={{ shadow: 'md' }}
            withCheckIcon={false}
            styles={{
              input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 },
              pill: { background: 'transparent', padding: 0 },
              pillsList: { minHeight: 36 },
            }}
          />
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Box style={{ gridColumn: 'span 9' }}>
          <Stack gap={spacing[3]}>
            <Card radius={radius.lg} p={12} style={cardStyle}>
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
                <Title
                  order={2}
                  c="#101828"
                  style={{ fontSize: 18, fontWeight: 700, lineHeight: '24px' }}
                >
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
                        <Title
                          order={3}
                          c="#182230"
                          style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}
                        >
                          {group.floor}
                        </Title>
                        <Text
                          c="#64748b"
                          style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}
                        >
                          {group.rooms.length} rooms
                        </Text>
                      </Group>
                    ) : null}
                    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={spacing[3]}>
                      {group.rooms.map((room) => (
                        <RoomCard
                          key={`${room.floor}-${room.number}`}
                          loadingAction={loadingAction}
                          onAction={handleRoomAction}
                          onOpen={openRoom}
                          room={room}
                        />
                      ))}
                    </SimpleGrid>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Card p={spacing[8]} ta="center" radius={radius.lg} style={cardStyle}>
                <ThemeIcon
                  color="stayosBrand"
                  variant="light"
                  radius={radius.md}
                  size={44}
                  mx="auto"
                >
                  <Search size={20} />
                </ThemeIcon>
                <Title
                  order={3}
                  c="#101828"
                  mt={spacing[4]}
                  style={{ fontSize: 24, fontWeight: 700, lineHeight: '30px' }}
                >
                  No rooms match this view
                </Title>
                <Text
                  c="#64748b"
                  mt={spacing[2]}
                  style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}
                >
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
