'use client';

import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
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
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  Hammer,
  Home,
  Hotel,
  Search,
  ShieldCheck,
  Sparkles,
  Thermometer,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { brandPalettes, colors, radius, spacing, typography } from '@stayos/theme';
import {
  OperationalTaskCard,
  StayOSOperationsCard,
  BackendUnavailable,
  EmptyData,
  GenericError,
  ServerStarting,
  getOpenOperationalTasks,
  showToast,
  useBackendStatus,
} from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';
import {
  blockRoom,
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
  type InventoryFloorDto,
  type InventoryPropertyDto,
  type InventoryRoomDto,
  type InventoryRoomTypeDto,
} from '../../lib/inventory-api';

type RoomStatus =
  | 'ready'
  | 'occupied'
  | 'needs-cleaning'
  | 'inspection'
  | 'out-of-service'
  | 'out-of-order'
  | 'maintenance'
  | 'waiting-guest'
  | 'vip-arrival';

type FloorName = string;

type Room = {
  id?: string;
  number: string;
  type: string;
  floor: FloorName;
  status: RoomStatus;
  condition: string;
  capacity: string;
  guest?: string;
  guestHref?: string;
  stayHref?: string;
  reservationHref?: string;
  bookingId?: string;
  nextArrival?: string;
  housekeeper: string;
  imageLabel: string;
  size: string;
  bedType: string;
  smoking: string;
  connecting: boolean;
  accessible: boolean;
  view: string;
  description: string;
  amenities: string[];
  housekeeping: {
    lastCleaned: string;
    cleanedBy: string;
    inspectionStatus: string;
    lastDeepClean: string;
    currentTask: string;
    timeline: string[];
  };
  maintenance: {
    lastMaintenance: string;
    upcomingMaintenance: string;
    openIssues: string;
    pastRepairs: string[];
    condition: string;
    timeline: string[];
  };
  occupancy: {
    currentGuest: string;
    nextReservation: string;
    futureReservations: string;
    daysOccupied: string;
    occupancyRate: string;
    averageRate: string;
    revenue: string;
  };
  roomTimeline: string[];
  insights: string[];
  flags: string[];
};

const defaultFloorNames: FloorName[] = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];
const liveGuestFloorNames = new Set(['Second Floor', 'Third Floor']);

const mockRooms: Room[] = [
  {
    number: '005',
    type: 'Accessible Queen',
    floor: 'Ground Floor',
    status: 'ready',
    condition: 'Fresh and inspected',
    capacity: '2 guests',
    housekeeper: 'Pooja',
    imageLabel: 'Accessible room with garden view',
    size: '280 sq ft',
    bedType: 'Queen bed',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: true,
    view: 'Garden',
    description: 'Ground-floor accessible room close to reception and elevator.',
    amenities: ['WiFi', 'Smart TV', 'Work Desk', 'Safe', 'Hair Dryer', 'Iron'],
    housekeeping: {
      lastCleaned: 'Today 08:20',
      cleanedBy: 'Pooja',
      inspectionStatus: 'Passed',
      lastDeepClean: '12 June 2026',
      currentTask: 'Ready for assignment',
      timeline: ['08:00 Cleaning started', '08:20 Cleaning completed', '08:35 Supervisor inspected'],
    },
    maintenance: {
      lastMaintenance: '18 June 2026',
      upcomingMaintenance: 'Door closer check next week',
      openIssues: 'None',
      pastRepairs: ['Bathroom rail tightened', 'Smart TV reset'],
      condition: 'Excellent',
      timeline: ['18 Jun Preventive check complete', '12 Jun Bathroom rail tightened'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'Available today',
      futureReservations: '2 upcoming',
      daysOccupied: '18 days',
      occupancyRate: '60%',
      averageRate: 'INR 4,300',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Inspection complete', 'Room marked ready', 'Available for sale'],
    insights: ['Accessible room available now.', 'Preferred by senior guests.', 'Near reception for easy support.'],
    flags: ['accessible'],
  },
  {
    number: '101',
    type: 'Standard Queen',
    floor: 'First Floor',
    status: 'ready',
    condition: 'Ready now',
    capacity: '2 guests',
    nextArrival: 'Website arrival at 4:00 PM',
    housekeeper: 'Nisha',
    imageLabel: 'Calm standard room with work desk',
    size: '240 sq ft',
    bedType: 'Queen bed',
    smoking: 'Non-smoking',
    connecting: true,
    accessible: false,
    view: 'City',
    description: 'Compact, quiet room suitable for short business stays.',
    amenities: ['WiFi', 'Coffee Machine', 'Hair Dryer', 'Safe', 'Smart TV', 'Work Desk'],
    housekeeping: {
      lastCleaned: 'Today 08:45',
      cleanedBy: 'Nisha',
      inspectionStatus: 'Passed',
      lastDeepClean: '09 June 2026',
      currentTask: 'No active task',
      timeline: ['08:10 Room cleaned', '08:45 Linen checked', '09:00 Marked ready'],
    },
    maintenance: {
      lastMaintenance: '20 June 2026',
      upcomingMaintenance: 'AC filter on 02 July',
      openIssues: 'None',
      pastRepairs: ['Lamp replaced'],
      condition: 'Good',
      timeline: ['20 Jun Preventive maintenance', '04 Jun Lamp replaced'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'ST1871 at 4:00 PM',
      futureReservations: '3 upcoming',
      daysOccupied: '21 days',
      occupancyRate: '70%',
      averageRate: 'INR 4,100',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Reservation created', 'Room cleaned', 'Inspection complete', 'Ready for arrival'],
    insights: ['Connecting room with 102.', 'Good option for phone enquiries.', 'Deep cleaning due next week.'],
    flags: ['connecting'],
  },
  {
    number: '102',
    type: 'Deluxe Twin',
    floor: 'First Floor',
    status: 'waiting-guest',
    condition: 'Cleaning in progress',
    capacity: '2 guests',
    guest: 'Rhea Malhotra',
    bookingId: 'ST1856',
    nextArrival: 'Guest waiting at reception',
    reservationHref: '/reservations',
    housekeeper: 'Kavita',
    imageLabel: 'Twin room being prepared',
    size: '270 sq ft',
    bedType: 'Twin beds',
    smoking: 'Non-smoking',
    connecting: true,
    accessible: false,
    view: 'Courtyard',
    description: 'Twin room often used for friends and short corporate stays.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Safe', 'Smart TV', 'Work Desk'],
    housekeeping: {
      lastCleaned: 'Yesterday 09:10',
      cleanedBy: 'Kavita',
      inspectionStatus: 'Pending',
      lastDeepClean: '16 June 2026',
      currentTask: 'Priority cleaning',
      timeline: ['10:05 Checkout complete', '10:14 Cleaning started', '10:31 Guest waiting marked'],
    },
    maintenance: {
      lastMaintenance: '17 June 2026',
      upcomingMaintenance: 'None scheduled',
      openIssues: 'None',
      pastRepairs: ['Door battery changed'],
      condition: 'Good',
      timeline: ['17 Jun Lock battery replaced', '01 Jun Preventive check'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'Rhea Malhotra - waiting',
      futureReservations: '1 upcoming',
      daysOccupied: '24 days',
      occupancyRate: '80%',
      averageRate: 'INR 4,800',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Guest checked out', 'Cleaning started', 'Waiting guest flagged', 'Inspection pending'],
    insights: ['Guest is waiting now.', 'Connecting room with 101.', 'Supervisor inspection is the blocker.'],
    flags: ['connecting'],
  },
  {
    number: '201',
    type: 'Premium King',
    floor: 'Second Floor',
    status: 'occupied',
    condition: 'Guest in house',
    capacity: '2 guests',
    guest: 'Dev Sharma',
    bookingId: 'ST1838',
    guestHref: '/guests/ananya-rao',
    stayHref: '/guest-stay/ST1842',
    reservationHref: '/reservations',
    housekeeper: 'Rekha',
    imageLabel: 'Premium king room with city view',
    size: '320 sq ft',
    bedType: 'King bed',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'City',
    description: 'Premium room for longer stays with a larger workspace.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Safe', 'Smart TV', 'Work Desk', 'Iron'],
    housekeeping: {
      lastCleaned: 'Today 07:30',
      cleanedBy: 'Rekha',
      inspectionStatus: 'Occupied refresh complete',
      lastDeepClean: '11 June 2026',
      currentTask: 'Evening turndown',
      timeline: ['07:10 Refresh started', '07:30 Towels replaced', '07:40 Guest requested extra water'],
    },
    maintenance: {
      lastMaintenance: '19 June 2026',
      upcomingMaintenance: 'None scheduled',
      openIssues: 'None',
      pastRepairs: ['Mini bar sensor reset'],
      condition: 'Good',
      timeline: ['19 Jun Mini bar sensor reset', '05 Jun AC checked'],
    },
    occupancy: {
      currentGuest: 'Dev Sharma',
      nextReservation: 'Checkout tomorrow',
      futureReservations: '4 upcoming',
      daysOccupied: '25 days',
      occupancyRate: '83%',
      averageRate: 'INR 5,900',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Reservation created', 'Guest checked in', 'Room refresh completed', 'Guest request added'],
    insights: ['Guest prefers extra water.', 'Strong corporate room performance.', 'No current blockers.'],
    flags: [],
  },
  {
    number: '202',
    type: 'Premium King',
    floor: 'Second Floor',
    status: 'maintenance',
    condition: 'AC repair active',
    capacity: '2 guests',
    housekeeper: 'Ravi',
    imageLabel: 'Premium room under maintenance',
    size: '320 sq ft',
    bedType: 'King bed',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'City',
    description: 'Premium king room temporarily blocked for AC repair.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Safe', 'Smart TV', 'Work Desk'],
    housekeeping: {
      lastCleaned: 'Today 09:05',
      cleanedBy: 'Ravi',
      inspectionStatus: 'Hold for maintenance',
      lastDeepClean: '08 June 2026',
      currentTask: 'Refresh after engineering clearance',
      timeline: ['09:05 Room cleaned', '09:20 AC issue reported', '09:30 Room blocked'],
    },
    maintenance: {
      lastMaintenance: 'Today 09:30',
      upcomingMaintenance: 'Engineering recheck at 3:00 PM',
      openIssues: 'AC not cooling',
      pastRepairs: ['AC filter changed', 'Thermostat recalibrated'],
      condition: 'Needs attention',
      timeline: ['09:20 AC issue opened', '09:30 Engineer assigned', '10:15 Compressor inspection started'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'Blocked until cleared',
      futureReservations: '2 upcoming',
      daysOccupied: '19 days',
      occupancyRate: '63%',
      averageRate: 'INR 5,700',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Room cleaned', 'Maintenance reported', 'Engineer assigned', 'Room blocked'],
    insights: ['Currently one maintenance issue.', 'Do not assign until engineering clears it.', 'AC has repeated complaints.'],
    flags: [],
  },
  {
    number: '302',
    type: 'Premium King',
    floor: 'Third Floor',
    status: 'needs-cleaning',
    condition: 'Priority clean',
    capacity: '2 guests',
    guest: 'Jaipur Textiles Group',
    bookingId: 'ST1849',
    nextArrival: 'Corporate group waiting',
    reservationHref: '/reservations',
    housekeeper: 'Suman',
    imageLabel: 'Priority room for waiting guest',
    size: '320 sq ft',
    bedType: 'King bed',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'Courtyard',
    description: 'Quiet premium king room requested by a corporate group.',
    amenities: ['WiFi', 'Coffee Machine', 'Safe', 'Smart TV', 'Work Desk', 'Iron'],
    housekeeping: {
      lastCleaned: 'Yesterday 08:40',
      cleanedBy: 'Suman',
      inspectionStatus: 'Cleaning active',
      lastDeepClean: '10 June 2026',
      currentTask: 'Finish priority clean before 12:30 PM',
      timeline: ['10:41 Waiting guest flagged', '10:44 Housekeeper assigned', '11:05 Linen changed'],
    },
    maintenance: {
      lastMaintenance: '14 June 2026',
      upcomingMaintenance: 'None scheduled',
      openIssues: 'None',
      pastRepairs: ['Shower mixer serviced'],
      condition: 'Good',
      timeline: ['14 Jun Shower mixer serviced', '02 Jun Preventive check'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'ST1849 - Jaipur Textiles Group',
      futureReservations: '5 upcoming',
      daysOccupied: '27 days',
      occupancyRate: '90%',
      averageRate: 'INR 5,600',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Reservation created', 'Guest arrived early', 'Room cleaning started', 'Housekeeping notified'],
    insights: ['Guest waiting at front desk.', 'Fastest path is supervisor inspection.', 'Corporate guest needs GST invoice later.'],
    flags: [],
  },
  {
    number: '401',
    type: 'Premium Suite',
    floor: 'Fourth Floor',
    status: 'inspection',
    condition: 'Supervisor review',
    capacity: '3 guests',
    housekeeper: 'Meena',
    imageLabel: 'Suite awaiting inspection',
    size: '520 sq ft',
    bedType: 'King bed with sofa bed',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'Garden',
    description: 'Large suite often used for VIP arrivals and family upgrades.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Balcony', 'Bathtub', 'Hair Dryer', 'Safe', 'Smart TV', 'Work Desk'],
    housekeeping: {
      lastCleaned: 'Today 09:25',
      cleanedBy: 'Meena',
      inspectionStatus: 'Pending',
      lastDeepClean: '21 June 2026',
      currentTask: 'Supervisor inspection',
      timeline: ['08:30 Deep refresh started', '09:25 Cleaning completed', '09:40 Inspection requested'],
    },
    maintenance: {
      lastMaintenance: '22 June 2026',
      upcomingMaintenance: 'Balcony rail check next month',
      openIssues: 'None',
      pastRepairs: ['Balcony light replaced'],
      condition: 'Excellent',
      timeline: ['22 Jun Balcony light replaced', '18 Jun Preventive suite check'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'Upgrade candidate today',
      futureReservations: '3 upcoming',
      daysOccupied: '20 days',
      occupancyRate: '67%',
      averageRate: 'INR 8,700',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Room cleaned', 'Inspection requested', 'Awaiting supervisor'],
    insights: ['Upgrade opportunity today.', 'Inspection is pending.', 'Preferred by repeat guests.'],
    flags: [],
  },
  {
    number: '402',
    type: 'Premium Suite',
    floor: 'Fourth Floor',
    status: 'occupied',
    condition: 'VIP in house',
    capacity: '3 guests',
    guest: 'Ananya Rao',
    bookingId: 'ST1842',
    guestHref: '/guests/ananya-rao',
    stayHref: '/guest-stay/ST1842',
    reservationHref: '/reservations',
    housekeeper: 'Meena',
    imageLabel: 'Premium suite with balcony',
    size: '540 sq ft',
    bedType: 'King bed with sofa bed',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'Garden',
    description: 'Flagship suite with balcony, bathtub, and quiet garden view.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Balcony', 'Bathtub', 'Hair Dryer', 'Safe', 'Iron', 'Smart TV', 'Work Desk'],
    housekeeping: {
      lastCleaned: 'Today 07:55',
      cleanedBy: 'Meena',
      inspectionStatus: 'Occupied refresh complete',
      lastDeepClean: '19 June 2026',
      currentTask: 'Evening towel refresh',
      timeline: ['07:30 Refresh started', '07:55 Room refreshed', '09:42 Priority cleaning marked complete'],
    },
    maintenance: {
      lastMaintenance: '20 June 2026',
      upcomingMaintenance: 'Deep cleaning due next week',
      openIssues: 'None',
      pastRepairs: ['Balcony lock adjusted', 'Coffee machine serviced'],
      condition: 'Excellent',
      timeline: ['20 Jun Coffee machine serviced', '12 Jun Balcony lock adjusted'],
    },
    occupancy: {
      currentGuest: 'Ananya Rao',
      nextReservation: 'Checkout tomorrow',
      futureReservations: '4 upcoming',
      daysOccupied: '26 days',
      occupancyRate: '87%',
      averageRate: 'INR 9,100',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Reservation created', 'Guest checked in', 'Room cleaned', 'Laundry request created', 'Payment pending'],
    insights: ['VIP guest currently in house.', 'Preferred by repeat guests.', 'Deep cleaning due next week.', 'No maintenance issue open.'],
    flags: ['vip'],
  },
  {
    number: '501',
    type: 'Signature Suite',
    floor: 'Fourth Floor',
    status: 'vip-arrival',
    condition: 'Held for VIP',
    capacity: '3 guests',
    nextArrival: 'Mr Kapoor at 11:30',
    bookingId: 'ST1851',
    reservationHref: '/reservations',
    housekeeper: 'Sana',
    imageLabel: 'Signature suite prepared for VIP',
    size: '610 sq ft',
    bedType: 'King bed with lounge',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'Garden and city',
    description: 'Top suite prepared for VIP arrivals and special occasions.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Balcony', 'Bathtub', 'Hair Dryer', 'Safe', 'Iron', 'Smart TV', 'Work Desk'],
    housekeeping: {
      lastCleaned: 'Today 08:10',
      cleanedBy: 'Sana',
      inspectionStatus: 'Passed',
      lastDeepClean: '18 June 2026',
      currentTask: 'Welcome amenities setup',
      timeline: ['07:20 Suite refresh started', '08:10 Cleaning completed', '08:40 Amenities requested'],
    },
    maintenance: {
      lastMaintenance: '21 June 2026',
      upcomingMaintenance: 'None scheduled',
      openIssues: 'None',
      pastRepairs: ['Safe battery replaced'],
      condition: 'Excellent',
      timeline: ['21 Jun Safe battery replaced', '10 Jun Preventive check'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'ST1851 - Mr Kapoor',
      futureReservations: '2 upcoming',
      daysOccupied: '22 days',
      occupancyRate: '73%',
      averageRate: 'INR 11,200',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Reservation created', 'VIP arrival flagged', 'Room cleaned', 'Welcome amenities pending'],
    insights: ['VIP arriving today.', 'Airport pickup confirmed.', 'Welcome amenities still pending.'],
    flags: ['vip'],
  },
  {
    number: '506',
    type: 'Signature Suite',
    floor: 'Fourth Floor',
    status: 'out-of-order',
    condition: 'Plumbing repair',
    capacity: '3 guests',
    housekeeper: 'Sana',
    imageLabel: 'Suite blocked for repair',
    size: '600 sq ft',
    bedType: 'King bed with lounge',
    smoking: 'Non-smoking',
    connecting: false,
    accessible: false,
    view: 'City',
    description: 'Suite blocked until plumbing repair is completed.',
    amenities: ['WiFi', 'Mini Bar', 'Coffee Machine', 'Balcony', 'Bathtub', 'Safe', 'Smart TV'],
    housekeeping: {
      lastCleaned: 'Yesterday 10:00',
      cleanedBy: 'Sana',
      inspectionStatus: 'Blocked',
      lastDeepClean: '15 June 2026',
      currentTask: 'Clean after repair',
      timeline: ['Yesterday checkout complete', 'Room blocked', 'Housekeeping hold'],
    },
    maintenance: {
      lastMaintenance: 'Today 08:00',
      upcomingMaintenance: 'Plumber recheck at 4:00 PM',
      openIssues: 'Bathroom plumbing leak',
      pastRepairs: ['Drain cleared', 'Valve replaced'],
      condition: 'Blocked',
      timeline: ['08:00 Leak confirmed', '08:20 Room marked out of order', '10:30 Parts ordered'],
    },
    occupancy: {
      currentGuest: 'None',
      nextReservation: 'Unavailable',
      futureReservations: '0 until cleared',
      daysOccupied: '16 days',
      occupancyRate: '53%',
      averageRate: 'INR 10,900',
      revenue: 'Placeholder',
    },
    roomTimeline: ['Leak reported', 'Room blocked', 'Parts ordered', 'Awaiting repair'],
    insights: ['Out of order due to plumbing.', 'Do not sell today.', 'Revenue impact placeholder will connect later.'],
    flags: [],
  },
];

type InventoryState = {
  activePropertyName?: string;
  error?: string;
  floors: FloorName[];
  isFallback: boolean;
  isLoading: boolean;
  propertyId?: string;
  rooms: Room[];
};

type UseRoomInventoryOptions = {
  allowMockFallback: boolean;
  enabled: boolean;
};

type RoomStatusAction =
  | 'mark-ready'
  | 'mark-cleaning'
  | 'mark-inspection'
  | 'block'
  | 'out-of-service'
  | 'out-of-order'
  | 'maintenance';

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function getNumber(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }

  return undefined;
}

function getBoolean(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return false;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.toLowerCase());
  }

  return false;
}

function getRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }

  return undefined;
}

function getStringArray(record: Record<string, unknown>, keys: string[], fallback: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item : getString(item as Record<string, unknown>, ['name', 'label', 'title'])))
        .filter(Boolean);
    }
  }

  return fallback;
}

function mapStatus(value: string): RoomStatus {
  const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');

  if (['active', 'available', 'clean', 'vacant-ready', 'ready'].includes(normalized)) return 'ready';
  if (['occupied', 'in-house', 'guest-staying'].includes(normalized)) return 'occupied';
  if (['dirty', 'needs-cleaning', 'cleaning', 'checkout-dirty'].includes(normalized)) return 'needs-cleaning';
  if (['inspection', 'inspect', 'pending-inspection'].includes(normalized)) return 'inspection';
  if (['out-of-service', 'oos', 'blocked'].includes(normalized)) return 'out-of-service';
  if (['out-of-order', 'ooo'].includes(normalized)) return 'out-of-order';
  if (['maintenance', 'under-maintenance', 'repair'].includes(normalized)) return 'maintenance';
  if (['waiting-guest', 'guest-waiting'].includes(normalized)) return 'waiting-guest';
  if (['vip-arrival', 'vip'].includes(normalized)) return 'vip-arrival';

  return 'ready';
}

function createLookup<T extends Record<string, unknown>>(items: T[]) {
  return new Map(
    items
      .map((item) => [getString(item, ['id', '_id', 'uuid', 'floorId', 'roomTypeId']), item] as const)
      .filter(([id]) => id),
  );
}

function mapInventoryRooms({
  floors,
  rooms,
  roomTypes,
}: {
  floors: InventoryFloorDto[];
  rooms: InventoryRoomDto[];
  roomTypes: InventoryRoomTypeDto[];
}) {
  const floorLookup = createLookup(floors);
  const roomTypeLookup = createLookup(roomTypes);

  return rooms
    .slice()
    .sort((roomA, roomB) => getString(roomA, ['roomNumber', 'number']).localeCompare(getString(roomB, ['roomNumber', 'number']), undefined, { numeric: true }))
    .map((room, index): Room => {
    const floorRecord =
      getRecord(room, ['floor']) ?? floorLookup.get(getString(room, ['floorId', 'floor_id', 'floorID']));
    const roomTypeRecord =
      getRecord(room, ['roomType', 'type']) ?? roomTypeLookup.get(getString(room, ['roomTypeId', 'room_type_id', 'typeId']));
    const roomNumber = getString(room, ['number', 'roomNumber', 'room_number', 'name', 'code'], String(index + 1));
    const roomType = getString(roomTypeRecord, ['name', 'label', 'title'], getString(room, ['roomTypeName', 'typeName'], 'Room'));
    const floor = getString(floorRecord, ['name', 'label', 'title'], getString(room, ['floorName', 'floor'], 'Unassigned Floor'));
    const status = mapStatus(getString(room, ['operationalStatus', 'operational_status'], 'ready'));
    const maxOccupancy =
      getNumber(room, ['capacity', 'maxOccupancy', 'max_occupancy']) ??
      getNumber(roomTypeRecord, ['capacity', 'maxOccupancy', 'max_occupancy']);
    const size =
      getString(room, ['size', 'area', 'squareFeet', 'square_feet', 'sizeSqFt']) ||
      getString(roomTypeRecord, ['size', 'area', 'squareFeet', 'square_feet', 'sizeSqFt'], 'Not specified');
    const bedType = getString(room, ['bedType', 'bed_type'], getString(roomTypeRecord, ['bedType', 'bed_type'], 'Not specified'));
    const guestName = getString(getRecord(room, ['guest', 'currentGuest']), ['name', 'fullName', 'displayName']);
    const nextArrival = getString(room, ['nextArrival', 'next_arrival']);
    const accessible = getBoolean(room, ['accessible', 'isAccessible']) || getBoolean(roomTypeRecord, ['accessible', 'isAccessible']);
    const connecting = getBoolean(room, ['connecting', 'isConnecting']);
    const isVip = getBoolean(room, ['vip', 'isVip']) || status === 'vip-arrival';
    const amenities = getStringArray(room, ['amenities'], getStringArray(roomTypeRecord ?? {}, ['amenities'], ['WiFi', 'Smart TV']));
    const condition = getString(room, ['condition', 'description'], statusLabels[status]);
    const housekeepingStatus = getString(room, ['housekeepingStatus', 'housekeeping_status'], statusLabels[status]);
    const maintenanceStatus = getString(room, ['maintenanceStatus', 'maintenance_status'], 'No active issues');

    return {
      id: getString(room, ['id', '_id', 'uuid']),
      number: roomNumber,
      type: roomType,
      floor,
      status,
      condition,
      capacity: maxOccupancy ? `${maxOccupancy} guests` : 'Not specified',
      guest: guestName || undefined,
      bookingId: getString(room, ['bookingId', 'reservationCode', 'reservationId']) || undefined,
      nextArrival: nextArrival || undefined,
      housekeeper: getString(room, ['housekeeper', 'assignedHousekeeper'], 'Unassigned'),
      imageLabel: `${roomType} ${floor.toLowerCase()}`,
      size: typeof size === 'string' && /^\d+$/.test(size) ? `${size} sq ft` : size,
      bedType,
      smoking: getBoolean(room, ['smoking', 'isSmoking']) ? 'Smoking' : 'Non-smoking',
      connecting,
      accessible,
      view: getString(room, ['view', 'viewType'], 'Not specified'),
      description: getString(room, ['description'], `${roomType} on ${floor}.`),
      amenities,
      housekeeping: {
        lastCleaned: getString(room, ['lastCleaned', 'last_cleaned'], 'Not recorded'),
        cleanedBy: getString(room, ['cleanedBy', 'cleaned_by'], 'Unassigned'),
        inspectionStatus: getString(room, ['inspectionStatus', 'inspection_status'], housekeepingStatus),
        lastDeepClean: getString(room, ['lastDeepClean', 'last_deep_clean'], 'Not recorded'),
        currentTask: getString(room, ['currentHousekeepingTask', 'currentTask'], housekeepingStatus),
        timeline: getStringArray(room, ['housekeepingTimeline'], [housekeepingStatus]),
      },
      maintenance: {
        lastMaintenance: getString(room, ['lastMaintenance', 'last_maintenance'], 'Not recorded'),
        upcomingMaintenance: getString(room, ['upcomingMaintenance', 'upcoming_maintenance'], 'None scheduled'),
        openIssues: getString(room, ['openIssues', 'open_issues', 'maintenanceIssue'], maintenanceStatus),
        pastRepairs: getStringArray(room, ['pastRepairs', 'repairs'], []),
        condition: getString(room, ['maintenanceCondition'], condition),
        timeline: getStringArray(room, ['maintenanceTimeline'], [maintenanceStatus]),
      },
      occupancy: {
        currentGuest: guestName || 'None',
        nextReservation: nextArrival || 'No arrival today',
        futureReservations: getString(room, ['futureReservations'], 'Not connected'),
        daysOccupied: getString(room, ['daysOccupied'], 'Not connected'),
        occupancyRate: getString(room, ['occupancyRate'], 'Not connected'),
        averageRate: getString(room, ['averageRate'], 'Not connected'),
        revenue: 'Not connected',
      },
      roomTimeline: getStringArray(room, ['timeline', 'roomTimeline'], [`Room ${roomNumber} loaded from inventory`]),
      insights: [
        'Live inventory record from backend.',
        `${statusLabels[status]} status for Room ${roomNumber}.`,
        `${accessible ? 'Accessible room.' : 'Standard accessibility.'}`,
      ],
      flags: [accessible ? 'accessible' : '', connecting ? 'connecting' : '', isVip ? 'vip' : ''].filter(Boolean),
    };
  });
}

function getPropertyId(property: InventoryPropertyDto) {
  return getString(property, ['id', '_id', 'uuid', 'propertyId']);
}

function getPropertyName(property: InventoryPropertyDto) {
  return getString(property, ['name', 'title', 'displayName']);
}

function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function getActiveProperty(properties: InventoryPropertyDto[]) {
  return properties.find(isActiveRecord);
}

function getFloorNames(floors: InventoryFloorDto[], mappedRooms: Room[]) {
  const apiFloors = floors
    .filter(isActiveRecord)
    .slice()
    .sort((floorA, floorB) => (getNumber(floorA, ['displayOrder', 'floorNumber']) ?? 0) - (getNumber(floorB, ['displayOrder', 'floorNumber']) ?? 0))
    .map((floor) => getString(floor, ['name', 'label', 'title']))
    .filter((floorName) => liveGuestFloorNames.has(floorName))
    .filter(Boolean);
  const roomFloors = mappedRooms.map((room) => room.floor).filter((floorName) => liveGuestFloorNames.has(floorName));

  return Array.from(new Set([...apiFloors, ...roomFloors]));
}

function useRoomInventory({
  allowMockFallback,
  enabled,
}: UseRoomInventoryOptions): InventoryState & { refreshInventory: () => Promise<void> } {
  const [state, setState] = useState<InventoryState>({
    floors: [],
    isFallback: false,
    isLoading: true,
    rooms: [],
  });

  const loadInventory = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) {
      setState((currentState) => ({
        ...currentState,
        error: undefined,
        isFallback: false,
        isLoading: false,
        rooms: [],
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      error: undefined,
      isLoading: currentState.rooms.length === 0,
    }));

    try {
        const properties = await getProperties(signal);
        const activeProperty = getActiveProperty(properties);
        const propertyId = activeProperty ? getPropertyId(activeProperty) : '';

        if (!activeProperty || !propertyId) {
          throw new Error('No active property returned from inventory API.');
        }

        const [allFloors, allRoomTypes, allInventoryRooms] = await Promise.all([
          getPropertyFloors(propertyId, signal),
          getPropertyRoomTypes(propertyId, signal),
          getPropertyRooms(propertyId, signal),
        ]);
        const floors = allFloors.filter((floor) => isActiveRecord(floor) && liveGuestFloorNames.has(getString(floor, ['name'])));
        const floorIds = new Set(floors.map((floor) => getPropertyId(floor)).filter(Boolean));
        const roomTypes = allRoomTypes.filter(isActiveRecord);
        const inventoryRooms = allInventoryRooms.filter(
          (room) => isActiveRecord(room) && floorIds.has(getString(room, ['floorId', 'floor_id', 'floorID'])),
        );
        const mappedRooms = mapInventoryRooms({ floors, roomTypes, rooms: inventoryRooms });

        setState({
          activePropertyName: getPropertyName(activeProperty),
          floors: getFloorNames(floors, mappedRooms),
          isFallback: false,
          isLoading: false,
          propertyId,
          rooms: mappedRooms,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (allowMockFallback) {
          setState({
            error: error instanceof Error ? error.message : 'Inventory API is unavailable.',
            floors: defaultFloorNames,
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
  }, [allowMockFallback, enabled]);

  useEffect(() => {
    const controller = new AbortController();

    void loadInventory(controller.signal);

    return () => controller.abort();
  }, [loadInventory]);

  const refreshInventory = useCallback(() => loadInventory(), [loadInventory]);

  return { ...state, refreshInventory };
}

const filters = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'out-of-service', label: 'Out of Service' },
  { value: 'out-of-order', label: 'Out of Order' },
  { value: 'vip', label: 'VIP' },
  { value: 'accessible', label: 'Accessible' },
  { value: 'connecting', label: 'Connecting' },
];

const statusLabels: Record<RoomStatus, string> = {
  ready: 'Ready',
  occupied: 'Occupied',
  'needs-cleaning': 'Needs Cleaning',
  inspection: 'Inspection',
  'out-of-service': 'Out of Service',
  'out-of-order': 'Out of Order',
  maintenance: 'Maintenance',
  'waiting-guest': 'Waiting Guest',
  'vip-arrival': 'VIP Arrival',
};

const roomActionLabels: Record<RoomStatusAction, string> = {
  'mark-ready': 'marked Ready',
  'mark-cleaning': 'marked Needs Cleaning',
  'mark-inspection': 'sent to Inspection',
  block: 'blocked',
  'out-of-service': 'marked Out of Service',
  'out-of-order': 'marked Out of Order',
  maintenance: 'sent to Maintenance',
};

const roomStatusActions: Array<{
  action: RoomStatusAction;
  color: string;
  label: string;
  status: RoomStatus;
}> = [
  { action: 'mark-ready', color: 'stayosBrand', label: 'Mark Ready', status: 'ready' },
  { action: 'mark-cleaning', color: 'yellow', label: 'Needs Cleaning', status: 'needs-cleaning' },
  { action: 'mark-inspection', color: 'yellow', label: 'Send to Inspection', status: 'inspection' },
  { action: 'maintenance', color: 'orange', label: 'Mark Maintenance', status: 'maintenance' },
  { action: 'out-of-service', color: 'gray', label: 'Out of Service', status: 'out-of-service' },
  { action: 'out-of-order', color: 'red', label: 'Out of Order', status: 'out-of-order' },
];

async function runRoomStatusAction(action: RoomStatusAction, propertyId: string, roomId: string) {
  if (action === 'mark-ready') return markRoomReady(propertyId, roomId);
  if (action === 'mark-cleaning') return markRoomCleaning(propertyId, roomId);
  if (action === 'mark-inspection') return markRoomInspection(propertyId, roomId);
  if (action === 'block') return blockRoom(propertyId, roomId);
  if (action === 'out-of-service') return markRoomOutOfService(propertyId, roomId);
  if (action === 'out-of-order') return markRoomOutOfOrder(propertyId, roomId);
  return markRoomMaintenance(propertyId, roomId);
}

function statusForAction(action: RoomStatusAction): RoomStatus {
  if (action === 'mark-ready') return 'ready';
  if (action === 'mark-cleaning') return 'needs-cleaning';
  if (action === 'mark-inspection') return 'inspection';
  if (action === 'block') return 'out-of-service';
  if (action === 'out-of-service') return 'out-of-service';
  if (action === 'out-of-order') return 'out-of-order';
  return 'maintenance';
}

function roomActionKey(room: Room, action: RoomStatusAction) {
  return `${room.id}:${action}`;
}

function isRoomStatusActionDisabled(room: Room, action: RoomStatusAction) {
  if (!room.id) return true;
  if (room.status === 'occupied') return true;
  return room.status === statusForAction(action);
}

function statusTone(status: RoomStatus) {
  if (status === 'ready') return colors.semantic.success;
  if (status === 'occupied') return colors.semantic.info;
  if (status === 'needs-cleaning' || status === 'waiting-guest' || status === 'inspection') return colors.semantic.warning;
  if (status === 'vip-arrival') return brandPalettes.purple[600];
  if (status === 'out-of-service') return colors.text.muted;
  return colors.semantic.danger;
}

function statusBackground(status: RoomStatus) {
  if (status === 'ready') return colors.brand[50];
  if (status === 'occupied') return brandPalettes.blue[50];
  if (status === 'needs-cleaning' || status === 'waiting-guest' || status === 'inspection') return brandPalettes.gold[50];
  if (status === 'vip-arrival') return brandPalettes.purple[50];
  if (status === 'maintenance' || status === 'out-of-order') return colors.surface.subtle;
  return colors.surface.subtle;
}

function statusIcon(status: RoomStatus): ReactNode {
  if (status === 'ready') return <DoorOpen size={17} />;
  if (status === 'occupied') return <UserRound size={17} />;
  if (status === 'needs-cleaning') return <Brush size={17} />;
  if (status === 'inspection') return <ShieldCheck size={17} />;
  if (status === 'waiting-guest') return <Users size={17} />;
  if (status === 'vip-arrival') return <Sparkles size={17} />;
  if (status === 'maintenance') return <Wrench size={17} />;
  return <Hammer size={17} />;
}

function roomMatchesFilter(room: Room, filter: string) {
  if (filter === 'all') return true;
  if (filter === 'dirty') return room.status === 'needs-cleaning' || room.status === 'waiting-guest';
  if (filter === 'vip') return room.flags.includes('vip') || room.status === 'vip-arrival';
  if (filter === 'accessible') return room.accessible;
  if (filter === 'connecting') return room.connecting;
  return room.status === filter;
}

function SummaryCard({
  title,
  value,
  detail,
  tone,
  icon,
}: {
  title: string;
  value: number;
  detail: string;
  tone: StayOSStatusTone;
  icon: ReactNode;
}) {
  return <StayOSOperationsCard title={title} value={value} detail={detail} icon={icon} tone={tone} />;
}

function FloorRail({
  activeFloor,
  floorNames,
  onSelect,
  rooms,
}: {
  activeFloor: FloorName;
  floorNames: FloorName[];
  onSelect: (floor: FloorName) => void;
  rooms: Room[];
}) {
  return (
    <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Floors
      </Text>
      <Stack mt={spacing[3]} gap={spacing[2]}>
        {floorNames.map((floor) => {
          const count = rooms.filter((room) => room.floor === floor).length;
          const active = floor === activeFloor;

          return (
            <UnstyledButton
              key={floor}
              onClick={() => onSelect(floor)}
              style={{
                background: active ? colors.brand[50] : colors.surface.base,
                border: `1px solid ${active ? colors.brand[200] : colors.border.subtle}`,
                borderRadius: radius.md,
                padding: spacing[3],
                width: '100%',
              }}
            >
              <Group justify="space-between" gap={spacing[2]}>
                <Group gap={spacing[2]}>
                  <Home size={16} color={active ? colors.brand[600] : colors.text.muted} />
                  <Text c={colors.text.strong} style={typography.styles.label}>
                    {floor}
                  </Text>
                </Group>
                <Badge color={active ? 'stayosBrand' : 'gray'} variant="light" radius={radius.full}>
                  {count}
                </Badge>
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>
    </Card>
  );
}

function RoomCard({ room, onOpen }: { room: Room; onOpen: (room: Room) => void }) {
  return (
    <Card
      onClick={() => onOpen(room)}
      p={spacing[4]}
      radius={radius.lg}
      shadow="xs"
      style={{
        background: statusBackground(room.status),
        border: `1px solid ${colors.border.subtle}`,
        color: 'inherit',
        cursor: 'pointer',
        minHeight: 188,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c={colors.text.strong} style={typography.styles.h1}>
            {room.number}
          </Text>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
            {room.type}
          </Text>
        </Box>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
          {statusIcon(room.status)}
        </ThemeIcon>
      </Group>

      <Badge
        mt={spacing[4]}
        radius={radius.full}
        variant="light"
        styles={{
          root: {
            color: statusTone(room.status),
            fontWeight: typography.weights.semibold,
            textTransform: 'none',
          },
        }}
      >
        {statusLabels[room.status]}
      </Badge>

      <Stack mt={spacing[4]} gap={spacing[1]}>
        {room.guest ? (
          <>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              Current guest
            </Text>
            <Text c={colors.text.strong} style={typography.styles.label}>
              {room.guest}
            </Text>
          </>
        ) : null}

        {room.nextArrival ? (
          <>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              Next arrival
            </Text>
            <Text c={colors.text.strong} style={typography.styles.label}>
              {room.nextArrival}
            </Text>
          </>
        ) : null}

        {!room.guest && !room.nextArrival ? (
          <Text c={colors.text.body} style={typography.styles.small}>
            {room.condition}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}

function DetailTile({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <Paper p={spacing[4]} radius={radius.md} bg={colors.surface.subtle}>
      <Group gap={spacing[2]} align="flex-start" wrap="nowrap">
        {icon ? (
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={30}>
            {icon}
          </ThemeIcon>
        ) : null}
        <Box>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            {label}
          </Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            {value}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

function TimelineList({ items }: { items: string[] }) {
  return (
    <Timeline active={items.length - 1} bulletSize={24} lineWidth={2} color="stayosBrand">
      {items.map((item) => (
        <Timeline.Item key={item} bullet={<CheckCircle2 size={13} />}>
          <Text c={colors.text.body} style={typography.styles.small}>
            {item}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function ProfileSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
          {icon}
        </ThemeIcon>
        <Box>
          <Text c={colors.text.strong} style={typography.styles.label}>
            {title}
          </Text>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
            {subtitle}
          </Text>
        </Box>
      </Group>
      <Box mt={spacing[4]}>{children}</Box>
    </Card>
  );
}

function RoomProfileDrawer({
  loadingAction,
  onRoomAction,
  room,
  opened,
  onClose,
}: {
  loadingAction?: string;
  onRoomAction: (room: Room, action: RoomStatusAction) => void;
  room: Room | null;
  opened: boolean;
  onClose: () => void;
}) {
  const roomTasks = room ? getOpenOperationalTasks({ room: room.number, limit: 3 }) : [];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(94vw, 680px)"
      title={room ? `Room ${room.number}` : 'Room profile'}
    >
      {room ? (
        <ScrollArea.Autosize mah="calc(100vh - 104px)" type="auto">
          <Stack gap={spacing[5]} pr={spacing[2]}>
            <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none', overflow: 'hidden' }}>
              <Paper
                h={150}
                radius={radius.lg}
                p={spacing[4]}
                mb={spacing[4]}
                style={{
                  alignItems: 'flex-end',
                  background: `linear-gradient(135deg, ${colors.brand[50]}, ${colors.surface.subtle})`,
                  display: 'flex',
                }}
              >
                <Group gap={spacing[2]}>
                  <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
                    <Hotel size={17} />
                  </ThemeIcon>
                  <Text c={colors.text.body} style={typography.styles.small}>
                    {room.imageLabel}
                  </Text>
                </Group>
              </Paper>

              <Group justify="space-between" align="flex-start" gap={spacing[4]}>
                <Box>
                  <Badge color="stayosBrand" variant="light" radius={radius.full}>
                    {room.floor}
                  </Badge>
                  <Title order={2} c={colors.text.strong} mt={spacing[3]} style={typography.styles.h1}>
                    Room {room.number}
                  </Title>
                  <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
                    {room.type} - {room.capacity}
                  </Text>
                </Box>
                <Badge
                  radius={radius.full}
                  variant="light"
                  styles={{ root: { color: statusTone(room.status), textTransform: 'none' } }}
                >
                  {statusLabels[room.status]}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]} mt={spacing[4]}>
                <DetailTile label="Current condition" value={room.condition} icon={<ShieldCheck size={15} />} />
                <DetailTile label="Current guest" value={room.guest ?? 'None'} icon={<UserRound size={15} />} />
                <DetailTile label="Next arrival" value={room.nextArrival ?? 'No arrival today'} icon={<CalendarClock size={15} />} />
                <DetailTile label="Today's housekeeper" value={room.housekeeper} icon={<Brush size={15} />} />
              </SimpleGrid>
            </Card>

            <ProfileSection title="Quick Actions" subtitle="Update this room's live operational status." icon={<ShieldCheck size={17} />}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                {roomStatusActions.map((item) => (
                  <Button
                    key={item.action}
                    color={item.color}
                    disabled={isRoomStatusActionDisabled(room, item.action)}
                    loading={loadingAction === roomActionKey(room, item.action)}
                    onClick={() => onRoomAction(room, item.action)}
                    variant={item.status === room.status ? 'filled' : 'light'}
                  >
                    {item.label}
                  </Button>
                ))}
              </SimpleGrid>
            </ProfileSection>

            <ProfileSection title="Room Details" subtitle="Physical room profile." icon={<BedDouble size={17} />}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <DetailTile label="Room size" value={room.size} />
                <DetailTile label="Bed type" value={room.bedType} />
                <DetailTile label="Smoking" value={room.smoking} />
                <DetailTile label="Connecting room" value={room.connecting ? 'Yes' : 'No'} />
                <DetailTile label="Accessible room" value={room.accessible ? 'Yes' : 'No'} />
                <DetailTile label="View" value={room.view} />
              </SimpleGrid>
              <Text c={colors.text.body} mt={spacing[4]} style={typography.styles.body}>
                {room.description}
              </Text>
            </ProfileSection>

            <ProfileSection title="Amenities" subtitle="What staff can confidently promise." icon={<Sparkles size={17} />}>
              <Group gap={spacing[2]}>
                {room.amenities.map((amenity) => (
                  <Badge key={amenity} color="stayosBrand" variant="light" radius={radius.full}>
                    {amenity}
                  </Badge>
                ))}
              </Group>
            </ProfileSection>

            <ProfileSection title="Housekeeping" subtitle="Cleaning state and supervisor readiness." icon={<Brush size={17} />}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <DetailTile label="Last cleaned" value={room.housekeeping.lastCleaned} />
                <DetailTile label="Cleaned by" value={room.housekeeping.cleanedBy} />
                <DetailTile label="Inspection status" value={room.housekeeping.inspectionStatus} />
                <DetailTile label="Last deep clean" value={room.housekeeping.lastDeepClean} />
                <DetailTile label="Current task" value={room.housekeeping.currentTask} />
              </SimpleGrid>
              <Box mt={spacing[4]}>
                <TimelineList items={room.housekeeping.timeline} />
              </Box>
            </ProfileSection>

            <ProfileSection title="Maintenance" subtitle="Condition, open issues, and repair memory." icon={<Wrench size={17} />}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <DetailTile label="Last maintenance" value={room.maintenance.lastMaintenance} />
                <DetailTile label="Upcoming maintenance" value={room.maintenance.upcomingMaintenance} />
                <DetailTile label="Open issues" value={room.maintenance.openIssues} />
                <DetailTile label="Room condition" value={room.maintenance.condition} />
              </SimpleGrid>
              <Group mt={spacing[4]} gap={spacing[2]}>
                {room.maintenance.pastRepairs.map((repair) => (
                  <Badge key={repair} color="gray" variant="light" radius={radius.full}>
                    {repair}
                  </Badge>
                ))}
              </Group>
              <Box mt={spacing[4]}>
                <TimelineList items={room.maintenance.timeline} />
              </Box>
            </ProfileSection>

            <ProfileSection title="Occupancy" subtitle="Room performance context, not billing management." icon={<CalendarClock size={17} />}>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={spacing[3]}>
                <DetailTile label="Current guest" value={room.occupancy.currentGuest} />
                <DetailTile label="Next reservation" value={room.occupancy.nextReservation} />
                <DetailTile label="Future reservations" value={room.occupancy.futureReservations} />
                <DetailTile label="Days occupied this month" value={room.occupancy.daysOccupied} />
                <DetailTile label="Occupancy" value={room.occupancy.occupancyRate} />
                <DetailTile label="Average room rate" value={room.occupancy.averageRate} />
                <DetailTile label="Revenue" value={room.occupancy.revenue} />
              </SimpleGrid>
            </ProfileSection>

            <ProfileSection title="Room Timeline" subtitle="Everything meaningful that happened to this room." icon={<CalendarClock size={17} />}>
              <TimelineList items={room.roomTimeline} />
            </ProfileSection>

            {roomTasks.length > 0 ? (
              <ProfileSection title="Notification Engine" subtitle="Open operational tasks for this room." icon={<AlertCircle size={17} />}>
                <Stack gap={spacing[3]}>
                  {roomTasks.map((task) => (
                    <OperationalTaskCard key={task.id} task={task} compact />
                  ))}
                </Stack>
              </ProfileSection>
            ) : null}
          </Stack>
        </ScrollArea.Autosize>
      ) : null}
    </Drawer>
  );
}

function InsightsAndActions({
  loadingAction,
  onRoomAction,
  room,
}: {
  loadingAction?: string;
  onRoomAction: (room: Room, action: RoomStatusAction) => void;
  room: Room;
}) {
  const actions = [
    { label: 'View Current Guest', href: room.stayHref, disabled: !room.guest },
    { label: 'Open Guest Profile', href: room.guestHref, disabled: !room.guestHref },
    { label: 'View Reservation', href: room.reservationHref, disabled: !room.reservationHref && !room.bookingId },
    { label: 'Mark Ready', action: 'mark-ready' as const },
    { label: 'Mark Cleaning', action: 'mark-cleaning' as const },
    { label: 'Mark Inspection', action: 'mark-inspection' as const },
    { label: 'Report Maintenance', action: 'maintenance' as const },
    { label: 'Block Room', action: 'block' as const, disabled: room.status === 'occupied' },
    { label: 'Out of Service', action: 'out-of-service' as const },
    { label: 'Out of Order', action: 'out-of-order' as const },
    { label: 'Move Guest', disabled: !room.guest },
  ];

  return (
    <Stack gap={spacing[4]}>
      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Text c={colors.text.strong} style={typography.styles.label}>
          Room insights
        </Text>
        <Stack mt={spacing[3]} gap={spacing[3]}>
          {room.insights.slice(0, 5).map((insight) => (
            <Paper key={insight} p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
              <Text c={colors.text.body} style={typography.styles.small}>
                {insight}
              </Text>
            </Paper>
          ))}
        </Stack>
      </Card>

      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Text c={colors.text.strong} style={typography.styles.label}>
          Quick actions
        </Text>
        <Divider my={spacing[3]} color={colors.border.subtle} />
        <Stack gap={spacing[2]}>
          {actions.map((action) =>
            action.href ? (
              <Button
                key={action.label}
                component={Link}
                href={action.href}
                disabled={action.disabled}
                color={action.label === 'Mark Ready' ? 'stayosBrand' : 'gray'}
                variant={action.label === 'Mark Ready' ? 'filled' : 'light'}
              >
                {action.label}
              </Button>
            ) : (
              <Button
                key={action.label}
                disabled={action.disabled || (action.action ? isRoomStatusActionDisabled(room, action.action) : false)}
                loading={action.action ? loadingAction === roomActionKey(room, action.action) : false}
                onClick={action.action ? () => onRoomAction(room, action.action) : undefined}
                color={action.label === 'Mark Ready' ? 'stayosBrand' : 'gray'}
                variant={action.label === 'Mark Ready' ? 'filled' : 'light'}
              >
                {action.label}
              </Button>
            ),
          )}
        </Stack>
      </Card>

      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Text c={colors.text.strong} style={typography.styles.label}>
          Future room intelligence
        </Text>
        <Group mt={spacing[3]} gap={spacing[2]}>
          {['Room Photos', 'IoT Sensors', 'Energy Usage', 'Digital Lock Status', 'Mini Bar Inventory', 'Smart Room Controls'].map(
            (item) => (
              <Badge key={item} color="gray" variant="light" radius={radius.full}>
                {item}
              </Badge>
            ),
          )}
        </Group>
      </Card>
    </Stack>
  );
}

export default function RoomsPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const inventory = useRoomInventory({
    allowMockFallback,
    enabled: backend.isOnline,
  });
  const displayRooms = inventory.rooms;
  const displayFloors = inventory.floors.length > 0 ? inventory.floors : defaultFloorNames;
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [activeFloor, setActiveFloor] = useState<FloorName>(defaultFloorNames[0]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loadingAction, setLoadingAction] = useState<string>();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  useEffect(() => {
    if (displayFloors.length > 0 && !displayFloors.includes(activeFloor)) {
      setActiveFloor(displayFloors[0]);
    }
  }, [activeFloor, displayFloors]);

  useEffect(() => {
    if (displayRooms.length === 0) {
      setSelectedRoom(null);
      return;
    }

    const refreshedSelectedRoom = selectedRoom
      ? displayRooms.find((room) => room.number === selectedRoom.number)
      : undefined;

    if (refreshedSelectedRoom && refreshedSelectedRoom !== selectedRoom) {
      setSelectedRoom(refreshedSelectedRoom);
      return;
    }

    if (!refreshedSelectedRoom) {
      setSelectedRoom(displayRooms.find((room) => room.number === '302') ?? displayRooms[0]);
    }
  }, [displayRooms, selectedRoom]);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return displayRooms.filter((room) => {
      const matchesFloor = room.floor === activeFloor;
      const matchesFilter = roomMatchesFilter(room, filter);
      const searchText = [
        room.number,
        room.guest,
        room.bookingId,
        room.type,
        room.floor,
        statusLabels[room.status],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = normalized ? searchText.includes(normalized) : true;

      return matchesFloor && matchesFilter && matchesSearch;
    });
  }, [activeFloor, displayRooms, filter, query]);

  const summary = [
    {
      title: 'Ready',
      value: displayRooms.filter((room) => room.status === 'ready').length,
      detail: 'Can be assigned now.',
      tone: 'success' as const,
      icon: <CheckCircle2 size={17} />,
    },
    {
      title: 'Occupied',
      value: displayRooms.filter((room) => room.status === 'occupied').length,
      detail: 'Guests currently in house.',
      tone: 'info' as const,
      icon: <UserRound size={17} />,
    },
    {
      title: 'Needs Cleaning',
      value: displayRooms.filter((room) => room.status === 'needs-cleaning' || room.status === 'waiting-guest').length,
      detail: 'Housekeeping required.',
      tone: 'attention' as const,
      icon: <Brush size={17} />,
    },
    {
      title: 'Maintenance',
      value: displayRooms.filter((room) => room.status === 'maintenance' || room.status === 'out-of-order').length,
      detail: 'Engineering attention.',
      tone: 'danger' as const,
      icon: <Thermometer size={17} />,
    },
    {
      title: 'VIP',
      value: displayRooms.filter((room) => room.flags.includes('vip') || room.status === 'vip-arrival').length,
      detail: 'High-touch rooms.',
      tone: 'premium' as const,
      icon: <Sparkles size={17} />,
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

  const handleRoomAction = async (room: Room, action: RoomStatusAction) => {
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
      const nextStatus = statusForAction(action);
      const updatedRoom = {
        ...room,
        condition: statusLabels[nextStatus],
        status: nextStatus,
      };

      setSelectedRoom(updatedRoom);
      showToast({
        color: 'green',
        message: `Room ${room.number} ${roomActionLabels[action]}`,
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
        <Group gap={spacing[3]}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
            <Hotel size={20} />
          </ThemeIcon>
          <Box>
            <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
              Rooms
            </Title>
            <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
              Digital twin of every physical room in the hotel.
            </Text>
          </Box>
        </Group>
      </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return (
      <Stack gap={spacing[6]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <Stack gap={spacing[6]}>
        {pageHeader}
        <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && backend.status === 'CONNECTING' && displayRooms.length === 0) {
    return (
      <Stack gap={spacing[6]}>
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
      <Stack gap={spacing[6]}>
        {pageHeader}
        <GenericError onAction={() => void inventory.refreshInventory()} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[6]}>
      {pageHeader}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.title} {...item} />
        ))}
      </SimpleGrid>

      {inventory.isLoading ? (
        <Alert color="blue" variant="light" icon={<Hotel size={17} />} radius={radius.lg}>
          Loading live Hillston room inventory...
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

      <Grid gap={spacing[5]}>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Stack gap={spacing[5]}>
            <FloorRail
              activeFloor={activeFloor}
              floorNames={displayFloors}
              onSelect={setActiveFloor}
              rooms={displayRooms}
            />
            {selectedRoom ? (
              <InsightsAndActions
                loadingAction={loadingAction}
                onRoomAction={handleRoomAction}
                room={selectedRoom}
              />
            ) : null}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Stack gap={spacing[4]}>
            <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
              <Group gap={spacing[3]} align="center">
                <TextInput
                  leftSection={<Search size={16} />}
                  placeholder="Search room number, guest, room type, floor, or status"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  style={{ flex: 1, minWidth: 260 }}
                />
                <SegmentedControl
                  value={filter}
                  onChange={setFilter}
                  data={filters}
                  color="stayosBrand"
                  visibleFrom="md"
                />
              </Group>
            </Card>

            <Group justify="space-between" align="flex-end" gap={spacing[3]}>
              <Box>
                <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
                  {activeFloor}
                </Title>
                <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                  Click any room to open its Room 360 profile.
                </Text>
              </Box>
              <Badge color="stayosBrand" variant="light" radius={radius.full}>
                {filteredRooms.length} rooms shown
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={spacing[4]}>
              {filteredRooms.map((room) => (
                <RoomCard key={room.number} room={room} onOpen={openRoom} />
              ))}
            </SimpleGrid>

            {!inventory.isLoading && displayRooms.length === 0 ? (
              <EmptyData
                title="No rooms returned"
                detail="The active property has no live room inventory yet."
              />
            ) : !inventory.isLoading && filteredRooms.length === 0 ? (
              <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none', textAlign: 'center' }}>
                <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44} mx="auto">
                  <Search size={20} />
                </ThemeIcon>
                <Title order={3} c={colors.text.strong} mt={spacing[4]} style={typography.styles.h3}>
                  No rooms match this view
                </Title>
                <Text c={colors.text.muted} mt={spacing[2]} style={typography.styles.body}>
                  Try another floor, status, or search term.
                </Text>
              </Card>
            ) : null}
          </Stack>
        </Grid.Col>
      </Grid>

      <RoomProfileDrawer
        loadingAction={loadingAction}
        onRoomAction={handleRoomAction}
        room={selectedRoom}
        opened={drawerOpened}
        onClose={closeDrawer}
      />
    </Stack>
  );
}
