'use client';

import {
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
import { useMemo, useState } from 'react';
import { brandPalettes, colors, radius, spacing, typography } from '@stayos/theme';
import {
  OperationalTaskCard,
  StayOSOperationsCard,
  getOpenOperationalTasks,
} from '@stayos/ui';
import type { StayOSStatusTone } from '@stayos/ui';

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

type FloorName = 'Ground Floor' | 'First Floor' | 'Second Floor' | 'Third Floor' | 'Fourth Floor';

type Room = {
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

const floorNames: FloorName[] = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];

const rooms: Room[] = [
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
  onSelect,
}: {
  activeFloor: FloorName;
  onSelect: (floor: FloorName) => void;
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
  room,
  opened,
  onClose,
}: {
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

function InsightsAndActions({ room }: { room: Room }) {
  const actions = [
    { label: 'View Current Guest', href: room.stayHref, disabled: !room.guest },
    { label: 'Open Guest Profile', href: room.guestHref, disabled: !room.guestHref },
    { label: 'View Reservation', href: room.reservationHref, disabled: !room.reservationHref && !room.bookingId },
    { label: 'Mark Ready', disabled: room.status === 'ready' || room.status === 'occupied' },
    { label: 'Report Maintenance' },
    { label: 'Assign Housekeeping', disabled: room.status === 'ready' },
    { label: 'Block Room', disabled: room.status === 'occupied' },
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
          {actions.map((action) => (
            <Button
              key={action.label}
              component={action.href ? 'a' : 'button'}
              href={action.href}
              disabled={action.disabled}
              color={action.label === 'Mark Ready' ? 'stayosBrand' : 'gray'}
              variant={action.label === 'Mark Ready' ? 'filled' : 'light'}
            >
              {action.label}
            </Button>
          ))}
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
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [activeFloor, setActiveFloor] = useState<FloorName>('Third Floor');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(rooms.find((room) => room.number === '302') ?? null);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rooms.filter((room) => {
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
  }, [activeFloor, filter, query]);

  const summary = [
    {
      title: 'Ready',
      value: rooms.filter((room) => room.status === 'ready').length,
      detail: 'Can be assigned now.',
      tone: 'success' as const,
      icon: <CheckCircle2 size={17} />,
    },
    {
      title: 'Occupied',
      value: rooms.filter((room) => room.status === 'occupied').length,
      detail: 'Guests currently in house.',
      tone: 'info' as const,
      icon: <UserRound size={17} />,
    },
    {
      title: 'Needs Cleaning',
      value: rooms.filter((room) => room.status === 'needs-cleaning' || room.status === 'waiting-guest').length,
      detail: 'Housekeeping required.',
      tone: 'attention' as const,
      icon: <Brush size={17} />,
    },
    {
      title: 'Maintenance',
      value: rooms.filter((room) => room.status === 'maintenance' || room.status === 'out-of-order').length,
      detail: 'Engineering attention.',
      tone: 'danger' as const,
      icon: <Thermometer size={17} />,
    },
    {
      title: 'VIP',
      value: rooms.filter((room) => room.flags.includes('vip') || room.status === 'vip-arrival').length,
      detail: 'High-touch rooms.',
      tone: 'premium' as const,
      icon: <Sparkles size={17} />,
    },
  ];

  const openRoom = (room: Room) => {
    setSelectedRoom(room);
    openDrawer();
  };

  return (
    <Stack gap={spacing[6]}>
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

      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.title} {...item} />
        ))}
      </SimpleGrid>

      <Grid gap={spacing[5]}>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Stack gap={spacing[5]}>
            <FloorRail activeFloor={activeFloor} onSelect={setActiveFloor} />
            {selectedRoom ? <InsightsAndActions room={selectedRoom} /> : null}
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

            {filteredRooms.length === 0 ? (
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

      <RoomProfileDrawer room={selectedRoom} opened={drawerOpened} onClose={closeDrawer} />
    </Stack>
  );
}
