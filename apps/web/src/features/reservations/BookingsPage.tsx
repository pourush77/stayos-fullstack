'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  BedDouble,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit,
  Globe2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { brandPalettes, colors, radius, spacing } from '@stayos/theme';
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
  completeGroupCheckout,
  extendGroupStay,
  getGroupHolds,
  getGroupMasterFolio,
  getInHouseGroups,
  type GroupMasterFolioDetailDto,
  type GroupHoldDto,
  type InHouseGroupDto,
} from '../../lib/operations-api';
import { BookingStatusBadge, PaymentStatusBadge } from './components/BookingBadges';
import { GroupExtendStayModal } from './components/GroupExtendStayModal';
import { WalkInGroupModal } from './components/WalkInGroupModal';
import { bookingFilterOptions } from './constants/booking.constants';
import { useBookings } from './hooks/useBookings';
import type { Booking, BookingFilter } from './types/booking.types';
import { calculateNights, dateKey, formatStayDates, sourceLabel } from './utils/booking-formatters';
import styles from './BookingsPage.module.css';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.055)',
};

type DateScope = 'today' | 'upcoming' | 'all-dates';

const dateScopeOptions: { label: string; value: DateScope }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'All Dates', value: 'all-dates' },
];

const pageSizeOptions = [
  { label: '10 rows', value: '10' },
  { label: '25 rows', value: '25' },
  { label: '50 rows', value: '50' },
];

const defaultBookingsView = {
  dateScope: 'today' as DateScope,
  filter: 'all' as BookingFilter,
  page: 1,
  pageSize: 10,
  query: '',
};

type SummaryTone = { color: string; soft: string; mantineColor: string };

const defaultSummaryTone: SummaryTone = {
  color: colors.semantic.info,
  soft: brandPalettes.blue[50],
  mantineColor: 'blue',
};

const summaryToneByFilter: Partial<Record<BookingFilter, SummaryTone>> = {
  'arrivals-today': {
    color: colors.semantic.info,
    soft: brandPalettes.blue[50],
    mantineColor: 'blue',
  },
  'checked-in': {
    color: colors.semantic.success,
    soft: brandPalettes.green[50],
    mantineColor: 'green',
  },
  'departures-today': {
    color: colors.semantic.warning,
    soft: brandPalettes.gold[50],
    mantineColor: 'yellow',
  },
  'needs-attention': {
    color: colors.semantic.warning,
    soft: brandPalettes.gold[50],
    mantineColor: 'orange',
  },
};

function nextAction(booking: Booking) {
  if (booking.status === 'CHECKED_IN' && booking.departureDate === dateKey(new Date())) {
    return 'Check Out';
  }
  if (booking.status === 'PENDING') return 'Confirm Booking';
  if (booking.status === 'CONFIRMED' && booking.room === 'Unassigned') return 'Assign Room';
  if (booking.status === 'CONFIRMED' && booking.roomReadyForCheckIn === false)
    return 'Room Not Ready';
  if (booking.status === 'CONFIRMED') return 'Start Check In';
  if (booking.status === 'CHECKED_IN') return 'Open Stay';
  if (booking.status === 'CHECKED_OUT') return 'View Stay History';
  return 'View Only';
}

function primaryBookingActionLabel(booking: Booking) {
  if (booking.status === 'CHECKED_OUT') return 'View Stay';
  return nextAction(booking);
}

function roomReadinessClassName(label: Booking['roomReadinessLabel']) {
  if (label === 'Ready') return styles.roomReadinessReady;
  if (label === 'Cleaning' || label === 'Inspection') return styles.roomReadinessWarning;
  return styles.roomReadinessNotReady;
}

function unassignedWarningState(booking: Pick<Booking, 'room' | 'status'>) {
  if (!isActionableUnassignedBooking(booking)) return undefined;
  if (booking.status === 'CHECKED_IN') {
    return {
      className: styles.unassignedWarningUrgent,
      label: 'Unassigned in-house',
    };
  }
  return {
    className: styles.unassignedWarning,
    label: 'Needs room',
  };
}

function guestInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function SourceIcon({ source }: { source: Booking['source'] }) {
  const Icon = source === 'CORPORATE' ? BriefcaseBusiness : source === 'OTA' ? Globe2 : Building2;

  return <Icon aria-hidden="true" size={12} strokeWidth={2.25} />;
}

function SummaryIcon({ filter }: { filter: BookingFilter }) {
  if (filter === 'checked-in') return <BedDouble size={14} />;
  if (filter === 'departures-today') return <LogOut size={14} />;
  if (filter === 'needs-attention') return <AlertCircle size={14} />;
  return <LogIn size={14} />;
}

function matchesFilter(booking: Booking, filter: BookingFilter) {
  const today = dateKey(new Date());
  if (filter === 'arrivals-today') return booking.arrivalDate === today;
  if (filter === 'departures-today')
    return booking.departureDate === today && booking.status === 'CHECKED_IN';
  if (filter === 'pending') return booking.status === 'PENDING';
  if (filter === 'confirmed') return booking.status === 'CONFIRMED';
  if (filter === 'checked-in') return booking.status === 'CHECKED_IN';
  if (filter === 'unassigned') return isActionableUnassignedBooking(booking);
  if (filter === 'needs-attention') return hasBookingAttention(booking);
  if (filter === 'upcoming') return isUpcomingBooking(booking, today);
  if (filter === 'groups') return false;
  if (filter === 'payment-due') return booking.paymentStatus === 'PAYMENT_DUE';
  if (filter === 'vip') return booking.isVip;
  if (filter === 'cancelled') return booking.status === 'CANCELLED';
  return true;
}

function groupMatchesFilter(group: GroupHoldDto, filter: BookingFilter) {
  const today = dateKey(new Date());

  if (filter === 'arrivals-today') return group.arrivalDate === today;
  if (filter === 'departures-today')
    return group.departureDate === today && group.status === 'CHECKED_IN';
  if (filter === 'confirmed') return group.status === 'CONFIRMED';
  if (filter === 'checked-in') return group.status === 'CHECKED_IN';
  if (filter === 'unassigned') return hasGroupAttention(group);
  if (filter === 'needs-attention') return hasGroupAttention(group);
  if (filter === 'upcoming') return isUpcomingGroupHold(group, today);
  if (filter === 'groups') return true;
  if (filter === 'cancelled') return group.status === 'CANCELLED';

  if (filter === 'pending' || filter === 'payment-due' || filter === 'vip') return false;

  return true;
}

function groupRoomTypeSummary(group: GroupHoldDto) {
  return group.roomBlocks.length
    ? group.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ')
    : 'Room type pending';
}

function groupRoomSummary(group: GroupHoldDto) {
  return group.roomAssignments.length
    ? group.roomAssignments.map((assignment) => assignment.roomNumber).join(', ')
    : 'Unassigned';
}

function groupStatusLabel(status: GroupHoldDto['status']) {
  return status.replace(/_/g, ' ');
}

function groupStatusColor(status: GroupHoldDto['status']) {
  if (status === 'CHECKED_IN') return 'green';
  if (status === 'CONFIRMED') return 'blue';
  if (status === 'CANCELLED') return 'red';
  if (status === 'CHECKED_OUT' || status === 'RELEASED') return 'gray';
  return 'yellow';
}

type GroupBookingResult =
  { kind: 'hold'; group: GroupHoldDto } | { kind: 'inHouse'; group: InHouseGroupDto };

function groupResultId(result: GroupBookingResult) {
  return result.kind === 'hold' ? result.group.id : result.group.groupBookingId;
}

function groupResultStatus(result: GroupBookingResult): GroupHoldDto['status'] {
  return result.kind === 'hold' ? result.group.status : 'CHECKED_IN';
}

function isTerminalBookingStatus(status: Booking['status']) {
  return status === 'CHECKED_OUT' || status === 'CANCELLED' || status === 'NO_SHOW';
}

function isTerminalGroupStatus(status: GroupHoldDto['status']) {
  return status === 'CHECKED_OUT' || status === 'CANCELLED' || status === 'RELEASED';
}

function isUpcomingBooking(booking: Booking, today = dateKey(new Date())) {
  return booking.arrivalDate > today && !isTerminalBookingStatus(booking.status);
}

function isUpcomingGroupHold(group: GroupHoldDto, today = dateKey(new Date())) {
  return group.arrivalDate > today && !isTerminalGroupStatus(group.status);
}

function groupResultHasAttention(result: GroupBookingResult) {
  return result.kind === 'hold' ? hasGroupAttention(result.group) : false;
}

type BookingListRow =
  | { id: string; kind: 'booking'; booking: Booking }
  | { id: string; kind: 'group'; result: GroupBookingResult };

function rowStayDate(row: BookingListRow) {
  return row.kind === 'booking' ? row.booking.arrivalDate : row.result.group.arrivalDate;
}

function rowDepartureDate(row: BookingListRow) {
  return row.kind === 'booking' ? row.booking.departureDate : row.result.group.departureDate;
}

function rowTieBreaker(row: BookingListRow) {
  return row.kind === 'booking' ? row.booking.bookingId : groupResultId(row.result);
}

function groupResultCreatedAt(result: GroupBookingResult) {
  return result.group.createdAt ?? result.group.created_at ?? '';
}

function rowChronologyValue(row: BookingListRow) {
  const rank = operationalRank(row);
  if (row.kind === 'booking') {
    return row.booking.createdAt ?? (rank === 4 ? row.booking.departureDate : row.booking.arrivalDate);
  }
  return (
    groupResultCreatedAt(row.result) ||
    (rank === 4 ? row.result.group.departureDate : row.result.group.arrivalDate)
  );
}

function operationalRank(row: BookingListRow) {
  const today = dateKey(new Date());

  if (row.kind === 'booking') {
    const booking = row.booking;
    if (booking.status === 'CHECKED_IN' && hasBookingAttention(booking)) return 1;
    if (isActionableUnassignedBooking(booking) && booking.arrivalDate === today) return 2;
    if (booking.arrivalDate === today && !isTerminalBookingStatus(booking.status)) return 3;
    if (booking.status === 'CHECKED_IN' && booking.departureDate === today) return 4;
    if (booking.status === 'CHECKED_IN') return 5;
    if (isUpcomingBooking(booking, today)) return 6;
    if (!isTerminalBookingStatus(booking.status)) return 7;
    return 8;
  }

  const result = row.result;
  const status = groupResultStatus(result);
  if (groupResultHasAttention(result) && result.group.arrivalDate === today) return 1;
  if (result.group.arrivalDate === today && !isTerminalGroupStatus(status)) return 2;
  if (status === 'CHECKED_IN' && groupResultHasAttention(result)) return 1;
  if (status === 'CHECKED_IN' && result.group.departureDate === today) return 4;
  if (status === 'CHECKED_IN') return 5;
  if (result.kind === 'hold' && isUpcomingGroupHold(result.group, today)) return 6;
  if (!isTerminalGroupStatus(status)) return 7;
  return 8;
}

function sortOperationalRows(rows: BookingListRow[]) {
  return [...rows].sort((left, right) => {
    const rankDelta = operationalRank(left) - operationalRank(right);
    if (rankDelta !== 0) return rankDelta;

    const leftRelevantDate =
      rowChronologyValue(left) ||
      (operationalRank(left) === 4 ? rowDepartureDate(left) : rowStayDate(left));
    const rightRelevantDate =
      rowChronologyValue(right) ||
      (operationalRank(right) === 4 ? rowDepartureDate(right) : rowStayDate(right));
    const dateDelta = rightRelevantDate.localeCompare(leftRelevantDate);
    if (dateDelta !== 0) return dateDelta;

    return rowTieBreaker(left).localeCompare(rowTieBreaker(right));
  });
}

function isTodayBooking(booking: Booking, today = dateKey(new Date())) {
  if (isTerminalBookingStatus(booking.status)) return false;
  return booking.arrivalDate === today || booking.status === 'CHECKED_IN';
}

function isTodayGroupResult(result: GroupBookingResult, today = dateKey(new Date())) {
  const status = groupResultStatus(result);
  if (isTerminalGroupStatus(status)) return false;
  return result.group.arrivalDate <= today && result.group.departureDate >= today;
}

function rowMatchesDateScope(row: BookingListRow, dateScope: DateScope) {
  const today = dateKey(new Date());

  if (dateScope === 'all-dates') return true;

  if (row.kind === 'booking') {
    return dateScope === 'today'
      ? isTodayBooking(row.booking, today)
      : isUpcomingBooking(row.booking, today);
  }

  return dateScope === 'today'
    ? isTodayGroupResult(row.result, today)
    : row.result.kind === 'hold' && isUpcomingGroupHold(row.result.group, today);
}

function groupResultRoomTypes(result: GroupBookingResult) {
  return result.kind === 'hold'
    ? groupRoomTypeSummary(result.group)
    : `${result.group.roomCount} rooms`;
}

function groupResultSecondary(result: GroupBookingResult) {
  return result.kind === 'hold'
    ? `${result.group.adults + result.group.children} guests`
    : `${result.group.roomCount} rooms`;
}

function groupResultNightCount(result: GroupBookingResult) {
  return calculateNights(result.group.arrivalDate, result.group.departureDate);
}

function groupRoomAssignmentDetail(result: GroupBookingResult) {
  if (result.kind === 'inHouse') {
    return result.group.occupiedRooms.length
      ? `Rooms ${result.group.occupiedRooms.join(', ')}`
      : 'Rooms pending';
  }

  const assignedRooms = result.group.roomAssignments.map((assignment) => assignment.roomNumber);
  const totalRooms = result.group.roomBlocks.reduce((sum, block) => sum + block.rooms, 0);

  if (assignedRooms.length) return `Rooms ${assignedRooms.join(', ')}`;
  if (totalRooms > 0) return `0/${totalRooms} rooms assigned`;
  return 'Room assignment pending';
}

export function isActionableUnassignedBooking(booking: Pick<Booking, 'room' | 'status'>) {
  return (
    booking.room === 'Unassigned' &&
    (booking.status === 'PENDING' ||
      booking.status === 'CONFIRMED' ||
      booking.status === 'CHECKED_IN')
  );
}

function hasBookingAttention(booking: Booking) {
  return isActionableUnassignedBooking(booking);
}

function hasGroupAttention(group: GroupHoldDto) {
  return group.status === 'CONFIRMED' && group.roomAssignments.length === 0;
}

function groupResultSearchText(result: GroupBookingResult) {
  if (result.kind === 'hold') {
    const group = result.group;
    return [
      group.groupCode,
      group.groupName,
      group.leadName,
      group.leadPhone,
      groupRoomTypeSummary(group),
      groupRoomSummary(group),
      groupStatusLabel(group.status),
      'group',
    ].join(' ');
  }

  const group = result.group;
  return [
    group.groupCode,
    group.groupName,
    group.leadName,
    group.masterFolioNumber,
    group.occupiedRooms.join(' '),
    'CHECKED_IN',
    'group',
  ].join(' ');
}

function BookingsPageLoading() {
  return (
    <Stack gap={spacing[3]} aria-label="Loading bookings" aria-busy="true">
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Stack gap={8}>
          <Skeleton height={36} width={180} radius="sm" />
          <Skeleton height={18} width={520} maw="75vw" radius="sm" />
          <Skeleton height={16} width={260} radius="sm" />
        </Stack>

        <Group gap={8}>
          <Skeleton height={36} width={150} radius="md" />
          <Skeleton height={36} width={125} radius="md" />
          <Skeleton height={36} width={125} radius="md" />
          <Skeleton height={36} width={125} radius="md" />
        </Group>
      </Group>

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} wrap="wrap">
          <Skeleton height={38} style={{ flex: 1, minWidth: 280 }} radius="md" />
          <Skeleton height={38} width={220} radius="md" />
        </Group>
      </Card>

      <Card p={0} radius={radius.lg} style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box p={18} bg="#f8fafc">
          <Group justify="space-between" wrap="nowrap">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton
                key={`booking-header-${index}`}
                height={12}
                width={index < 2 ? 110 : 75}
                radius="sm"
              />
            ))}
          </Group>
        </Box>

        <Stack gap={0}>
          {Array.from({ length: 7 }).map((_, rowIndex) => (
            <Box
              key={`booking-loading-row-${rowIndex}`}
              px={18}
              py={16}
              style={{ borderTop: '1px solid #eef2f7' }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Skeleton height={16} width={105} radius="sm" />
                <Stack gap={5} w={145}>
                  <Skeleton height={15} width="80%" radius="sm" />
                  <Skeleton height={11} width="60%" radius="sm" />
                </Stack>
                <Skeleton height={15} width={115} radius="sm" />
                <Skeleton height={15} width={90} radius="sm" />
                <Skeleton height={24} width={78} radius="xl" />
                <Skeleton height={24} width={78} radius="xl" />
                <Skeleton height={30} width={92} radius="md" />
              </Group>
            </Box>
          ))}
        </Stack>
      </Card>

      <Group justify="center" gap={8} py={4}>
        <Loader color="stayosBrand" size="xs" />
        <Text c="#64748b" size="sm">
          Loading complete booking information...
        </Text>
      </Group>
    </Stack>
  );
}

export default function BookingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const bookingState = useBookings({ allowMockFallback, enabled });
  const initialQuery = searchParams.get('q') ?? defaultBookingsView.query;
  const initialFilter = bookingFilterOptions.some(
    (option) => option.value === searchParams.get('filter'),
  )
    ? (searchParams.get('filter') as BookingFilter)
    : defaultBookingsView.filter;
  const initialDateScope = dateScopeOptions.some(
    (option) => option.value === searchParams.get('dateScope'),
  )
    ? (searchParams.get('dateScope') as DateScope)
    : defaultBookingsView.dateScope;
  const initialPageSize = pageSizeOptions.some(
    (option) => option.value === searchParams.get('pageSize'),
  )
    ? Number(searchParams.get('pageSize'))
    : defaultBookingsView.pageSize;
  const initialPage = Math.max(
    1,
    Number(searchParams.get('page') ?? defaultBookingsView.page) || 1,
  );
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<BookingFilter>(initialFilter);
  const [dateScope, setDateScope] = useState<DateScope>(initialDateScope);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [groupHolds, setGroupHolds] = useState<GroupHoldDto[]>([]);
  const [recentlyDepartedGroups, setRecentlyDepartedGroups] = useState<GroupHoldDto[]>([]);
  const [inHouseGroups, setInHouseGroups] = useState<InHouseGroupDto[]>([]);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [extendGroup, setExtendGroup] = useState<InHouseGroupDto | null>(null);
  const [extendDepartureDate, setExtendDepartureDate] = useState('');
  const [checkoutGroup, setCheckoutGroup] = useState<InHouseGroupDto | null>(null);
  const [checkoutFolio, setCheckoutFolio] = useState<GroupMasterFolioDetailDto | null>(null);
  const [groupActionError, setGroupActionError] = useState('');
  const [isGroupActionLoading, setIsGroupActionLoading] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string>('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const didHydrateListState = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') void bookingState.refreshBookings();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [bookingState.refreshBookings, enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoadingGroups(false);
      return undefined;
    }

    const controller = new AbortController();
    setIsLoadingGroups(true);

    (async () => {
      try {
        const properties = await getProperties(controller.signal);
        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];

        const propertyId = typeof active?.id === 'string' ? active.id : '';

        if (!propertyId) {
          setActivePropertyId('');
          setGroupHolds([]);
          setRecentlyDepartedGroups([]);
          setInHouseGroups([]);
          return;
        }

        setActivePropertyId(propertyId);

        const [holds, groups] = await Promise.all([
          getGroupHolds(propertyId, controller.signal),
          getInHouseGroups(propertyId, controller.signal),
        ]);

        setGroupHolds(
          holds.filter((hold) => hold.status === 'ON_HOLD' || hold.status === 'CONFIRMED'),
        );
        setRecentlyDepartedGroups(holds.filter((hold) => hold.status === 'CHECKED_OUT'));
        setInHouseGroups(groups);
      } catch {
        if (!controller.signal.aborted) {
          setGroupHolds([]);
          setRecentlyDepartedGroups([]);
          setInHouseGroups([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingGroups(false);
        }
      }
    })();

    return () => controller.abort();
  }, [enabled]);

  const refreshGroups = useCallback(async () => {
    if (!activePropertyId) return;
    try {
      const [holds, groups] = await Promise.all([
        getGroupHolds(activePropertyId),
        getInHouseGroups(activePropertyId),
      ]);
      setGroupHolds(holds.filter((h) => h.status === 'ON_HOLD' || h.status === 'CONFIRMED'));
      setRecentlyDepartedGroups(holds.filter((h) => h.status === 'CHECKED_OUT'));
      setInHouseGroups(groups);
    } catch {
      // swallow
    }
  }, [activePropertyId]);

  const bookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = bookingState.bookings.filter((booking) => {
      const searchable = [
        booking.guestName,
        booking.bookingId,
        booking.phone,
        booking.roomType,
        sourceLabel(booking.source),
      ]
        .join(' ')
        .toLowerCase();
      return (!normalized || searchable.includes(normalized)) && matchesFilter(booking, filter);
    });
    return filtered;
  }, [bookingState.bookings, filter, query]);

  const visibleGroupBookings = useMemo((): GroupBookingResult[] => {
    const normalized = query.trim().toLowerCase();
    const candidates: GroupBookingResult[] = [
      ...groupHolds.map((group) => ({ kind: 'hold' as const, group })),
      ...recentlyDepartedGroups.map((group) => ({ kind: 'hold' as const, group })),
      ...inHouseGroups.map((group) => ({ kind: 'inHouse' as const, group })),
    ];
    const seen = new Set<string>();

    return candidates.filter((result) => {
      const id = groupResultId(result);
      if (seen.has(id)) return false;
      seen.add(id);

      const matchesSearch =
        !normalized || groupResultSearchText(result).toLowerCase().includes(normalized);
      const matchesGroupFilter =
        result.kind === 'hold'
          ? groupMatchesFilter(result.group, filter)
          : filter === 'all' ||
            filter === 'groups' ||
            filter === 'checked-in' ||
            (filter === 'departures-today' && result.group.departureDate === dateKey(new Date()));

      return matchesSearch && matchesGroupFilter;
    });
  }, [filter, groupHolds, inHouseGroups, query, recentlyDepartedGroups]);

  const visibleRows = useMemo((): BookingListRow[] => {
    const rows: BookingListRow[] = [
      ...bookings.map((booking) => ({
        id: booking.backendId,
        kind: 'booking' as const,
        booking,
      })),
      ...visibleGroupBookings.map((result) => ({
        id: groupResultId(result),
        kind: 'group' as const,
        result,
      })),
    ];

    const scopedRows = rows.filter((row) => rowMatchesDateScope(row, dateScope));

    return query.trim() ? scopedRows : sortOperationalRows(scopedRows);
  }, [bookings, dateScope, query, visibleGroupBookings]);

  useEffect(() => {
    if (!didHydrateListState.current) {
      didHydrateListState.current = true;
      return;
    }
    setCurrentPage(1);
  }, [dateScope, filter, pageSize, query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query);
    if (filter !== defaultBookingsView.filter) params.set('filter', filter);
    if (dateScope !== defaultBookingsView.dateScope) params.set('dateScope', dateScope);
    if (pageSize !== defaultBookingsView.pageSize) params.set('pageSize', String(pageSize));
    if (currentPage !== defaultBookingsView.page) params.set('page', String(currentPage));

    const nextUrl = params.toString() ? `${pathname}?${params}` : pathname;
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [currentPage, dateScope, filter, pageSize, pathname, query, router, searchParams]);

  useEffect(() => {
    const y = Number(sessionStorage.getItem('stayos.reservations.scrollY') ?? 0);
    if (y > 0) {
      sessionStorage.removeItem('stayos.reservations.scrollY');
      window.requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [activePage, pageSize, visibleRows]);
  const firstRowNumber = visibleRows.length === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const lastRowNumber = visibleRows.length === 0 ? 0 : firstRowNumber + paginatedRows.length - 1;

  const operationalSummary = useMemo(() => {
    const today = dateKey(new Date());
    const activeGroupHolds = groupHolds.filter(
      (group) => group.status === 'ON_HOLD' || group.status === 'CONFIRMED',
    );

    const arrivingBookings = bookingState.bookings.filter(
      (booking) => booking.arrivalDate === today,
    );
    const arrivingGroups = activeGroupHolds.filter((group) => group.arrivalDate === today);
    const inHouseBookings = bookingState.bookings.filter(
      (booking) => booking.status === 'CHECKED_IN',
    );
    const departingBookings = bookingState.bookings.filter(
      (booking) => booking.departureDate === today && booking.status === 'CHECKED_IN',
    );
    const departingGroups = inHouseGroups.filter((group) => group.departureDate === today);
    const attentionGroups = activeGroupHolds.filter(hasGroupAttention);
    const actionableUnassignedBookings = bookingState.bookings.filter(
      isActionableUnassignedBooking,
    );
    const arrivingUnassigned =
      arrivingBookings.filter(isActionableUnassignedBooking).length +
      arrivingGroups.filter((group) => group.roomAssignments.length === 0).length;
    const inHouseRooms =
      inHouseBookings.filter((booking) => booking.room !== 'Unassigned').length +
      inHouseGroups.reduce((sum, group) => sum + group.roomCount, 0);
    const checkoutDue = departingBookings.length + departingGroups.length;
    const needsAttentionCount = actionableUnassignedBookings.length + attentionGroups.length;

    return [
      {
        context: arrivingUnassigned > 0 ? `${arrivingUnassigned} unassigned` : undefined,
        count: arrivingBookings.length + arrivingGroups.length,
        filter: 'arrivals-today' as const,
        label: 'Arriving Today',
      },
      {
        context: inHouseRooms > 0 ? `${inHouseRooms} rooms occupied` : undefined,
        count: inHouseBookings.length + inHouseGroups.length,
        filter: 'checked-in' as const,
        label: 'In-House',
      },
      {
        context: checkoutDue > 0 ? `${checkoutDue} checkout due` : undefined,
        count: departingBookings.length + departingGroups.length,
        filter: 'departures-today' as const,
        label: 'Departing Today',
      },
      {
        context: needsAttentionCount > 0 ? 'Review' : undefined,
        count: needsAttentionCount,
        filter: 'needs-attention' as const,
        label: 'Needs Attention',
      },
    ];
  }, [bookingState.bookings, groupHolds, inHouseGroups]);

  const operationalTabs = useMemo(() => {
    const today = dateKey(new Date());
    const activeGroupHolds = groupHolds.filter(
      (group) => group.status === 'ON_HOLD' || group.status === 'CONFIRMED',
    );
    const allGroups = groupHolds.length + recentlyDepartedGroups.length + inHouseGroups.length;
    const upcomingBookings = bookingState.bookings.filter((booking) =>
      isUpcomingBooking(booking, today),
    );
    const upcomingGroups = activeGroupHolds.filter((group) => isUpcomingGroupHold(group, today));

    return [
      { count: bookingState.bookings.length + allGroups, filter: 'all' as const, label: 'All' },
      {
        count:
          bookingState.bookings.filter((booking) => booking.arrivalDate === today).length +
          activeGroupHolds.filter((group) => group.arrivalDate === today).length,
        filter: 'arrivals-today' as const,
        label: 'Arriving',
      },
      {
        count:
          bookingState.bookings.filter((booking) => booking.status === 'CHECKED_IN').length +
          inHouseGroups.length,
        filter: 'checked-in' as const,
        label: 'In-House',
      },
      {
        count:
          bookingState.bookings.filter(
            (booking) => booking.departureDate === today && booking.status === 'CHECKED_IN',
          ).length + inHouseGroups.filter((group) => group.departureDate === today).length,
        filter: 'departures-today' as const,
        label: 'Departing',
      },
      {
        count: upcomingBookings.length + upcomingGroups.length,
        filter: 'upcoming' as const,
        label: 'Upcoming',
      },
      { count: allGroups, filter: 'groups' as const, label: 'Groups' },
      {
        count:
          bookingState.bookings.filter(hasBookingAttention).length +
          activeGroupHolds.filter(hasGroupAttention).length,
        filter: 'needs-attention' as const,
        label: 'Needs Attention',
      },
    ];
  }, [bookingState.bookings, groupHolds, inHouseGroups, recentlyDepartedGroups]);

  const setOperationalFilter = (targetFilter: BookingFilter) => {
    setFilter((current) => (current === targetFilter ? 'all' : targetFilter));
  };

  const hasActiveFilters =
    Boolean(query.trim()) ||
    filter !== defaultBookingsView.filter ||
    dateScope !== defaultBookingsView.dateScope;

  const clearFilters = () => {
    setQuery(defaultBookingsView.query);
    setFilter(defaultBookingsView.filter);
    setDateScope(defaultBookingsView.dateScope);
    setPageSize(defaultBookingsView.pageSize);
    setCurrentPage(defaultBookingsView.page);
    window.scrollTo({ top: 0 });
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ color: 'green', message: `${label} copied`, title: 'Copied' });
    } catch {
      showToast({
        color: 'red',
        message: 'Clipboard access is unavailable in this browser context.',
        title: 'Copy failed',
      });
    }
  };

  const rememberScrollPosition = () => {
    sessionStorage.setItem('stayos.reservations.scrollY', String(window.scrollY));
  };

  const openExtendGroup = (group: InHouseGroupDto) => {
    setGroupActionError('');
    setExtendGroup(group);
    setExtendDepartureDate(group.departureDate);
  };

  const submitExtendGroup = async () => {
    if (!activePropertyId || !extendGroup || !extendDepartureDate) return;
    setGroupActionError('');
    setIsGroupActionLoading(true);
    try {
      await extendGroupStay(activePropertyId, extendGroup.groupBookingId, extendDepartureDate);
      setExtendGroup(null);
      await refreshGroups();
    } catch (err) {
      setGroupActionError(err instanceof Error ? err.message : 'Unable to extend group stay.');
    } finally {
      setIsGroupActionLoading(false);
    }
  };

  const openCheckoutGroup = async (group: InHouseGroupDto) => {
    if (!activePropertyId) return;
    setGroupActionError('');
    setCheckoutGroup(group);
    setCheckoutFolio(null);
    setIsGroupActionLoading(true);
    try {
      setCheckoutFolio(await getGroupMasterFolio(activePropertyId, group.groupBookingId));
    } catch (err) {
      setGroupActionError(err instanceof Error ? err.message : 'Unable to load master folio.');
    } finally {
      setIsGroupActionLoading(false);
    }
  };

  const submitCheckoutGroup = async () => {
    if (!activePropertyId || !checkoutGroup) return;
    setGroupActionError('');
    setIsGroupActionLoading(true);
    try {
      await completeGroupCheckout(activePropertyId, checkoutGroup.groupBookingId);
      setCheckoutGroup(null);
      setCheckoutFolio(null);
      await refreshGroups();
    } catch (err) {
      setGroupActionError(err instanceof Error ? err.message : 'Unable to check out group.');
    } finally {
      setIsGroupActionLoading(false);
    }
  };

  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();
  const visibleBookingCount = visibleRows.length;
  const emptyResultTitle = query.trim()
    ? `No bookings match "${query.trim()}".`
    : filter === 'arrivals-today'
      ? 'No arrivals found for this view.'
      : filter === 'groups'
        ? 'No group bookings found.'
        : filter === 'needs-attention'
          ? 'Nothing needs attention right now.'
          : 'No bookings found.';
  const emptyResultDetail = hasActiveFilters
    ? 'Clear filters to return to the default Bookings view.'
    : 'Try another guest, booking ID, source, or filter.';
  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>
          Bookings
        </Title>
        <Text c="#64748b" mt={spacing[1]} size="sm">
          {filter === 'departures-today'
            ? 'Guests expected to leave today. Open each stay, settle balance, then complete checkout.'
            : 'Create bookings, assign rooms, start check-in, and track payment status.'}
        </Text>
        <Text c="#334155" mt={spacing[2]} size="sm" fw={600}>
          {visibleBookingCount} {filter === 'all' ? 'bookings' : 'shown'}
        </Text>
      </Box>
      <Group gap={8}>
        <Button
          component={Link}
          href="/"
          variant="light"
          color="gray"
          leftSection={<ChevronLeft size={16} />}
        >
          Back to Front Desk
        </Button>
        <Button
          component={Link}
          href="/reservations/group-quote"
          variant="light"
          color="stayosBrand"
          leftSection={<Users size={16} />}
        >
          Group Quote
        </Button>
        <Button
          variant="light"
          color="teal"
          leftSection={<UserPlus size={16} />}
          onClick={() => setWalkInOpen(true)}
          data-testid="walk-in-group-button"
          disabled={!activePropertyId}
        >
          Walk-in Group
        </Button>
        <Button
          component={Link}
          href="/reservations/new"
          color="stayosBrand"
          leftSection={<Plus size={16} />}
        >
          New Booking
        </Button>
      </Group>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING')
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING')
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  if (
    !allowMockFallback &&
    bookingState.error &&
    !bookingState.isLoading &&
    bookingState.bookings.length === 0
  )
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <GenericError
          onAction={() => void bookingState.refreshBookings()}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );

  const isInitialPageLoading = bookingState.isLoading || isLoadingGroups;

  if (isInitialPageLoading) {
    return <BookingsPageLoading />;
  }

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}
      <WalkInGroupModal
        opened={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        propertyId={activePropertyId}
        onCreated={async () => {
          await refreshGroups();
          await bookingState.refreshBookings();
        }}
      />
      <GroupExtendStayModal
        opened={Boolean(extendGroup)}
        group={extendGroup}
        departureDate={extendDepartureDate}
        error={groupActionError}
        isLoading={isGroupActionLoading}
        onClose={() => setExtendGroup(null)}
        onDepartureDateChange={setExtendDepartureDate}
        onSubmit={() => void submitExtendGroup()}
      />
      <Modal
        opened={Boolean(checkoutGroup)}
        onClose={() => setCheckoutGroup(null)}
        title="Check out group"
      >
        <Stack gap={spacing[3]}>
          <Text fw={700}>
            {checkoutGroup?.groupCode} - {checkoutGroup?.groupName}
          </Text>
          <Text size="sm" c="#475569">
            {checkoutGroup?.roomCount ?? 0} rooms will move to post-checkout cleaning after the
            master folio is settled.
          </Text>
          {checkoutFolio ? (
            <Alert color={checkoutFolio.checkoutSummary.checkoutEligible ? 'green' : 'orange'}>
              Balance due: Rs {checkoutFolio.checkoutSummary.balanceDue.toLocaleString('en-IN')} -
              Payments: Rs {checkoutFolio.checkoutSummary.totalPaid.toLocaleString('en-IN')}
              {checkoutFolio.checkoutSummary.checkoutBlockers.length
                ? ` - ${checkoutFolio.checkoutSummary.checkoutBlockers.join(' ')}`
                : ''}
            </Alert>
          ) : null}
          {groupActionError ? <Alert color="red">{groupActionError}</Alert> : null}
          <Group justify="space-between">
            <Button
              component={Link}
              href={
                checkoutGroup
                  ? `/reservations/group-holds/${checkoutGroup.groupBookingId}/master-folio`
                  : '#'
              }
              variant="light"
              color="gray"
            >
              Open folio
            </Button>
            <Group>
              <Button variant="subtle" color="gray" onClick={() => setCheckoutGroup(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                loading={isGroupActionLoading}
                disabled={!checkoutFolio?.checkoutSummary.checkoutEligible}
                onClick={() => void submitCheckoutGroup()}
              >
                Check Out
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
      {filter === 'departures-today' ? (
        <Alert color="orange" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Showing checked-in guests departing today. Open a booking to settle dues and complete
          checkout.
        </Alert>
      ) : null}
      {filter === 'arrivals-today' ? (
        <Alert color="blue" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Showing guests arriving today. Open a booking to assign a room and start check-in.
        </Alert>
      ) : null}
      {filter === 'checked-in' ? (
        <Alert color="green" variant="light" icon={<CalendarDays size={17} />} radius={radius.lg}>
          Showing guests currently in house. Open a stay to manage service, payment, or checkout.
        </Alert>
      ) : null}
      {bookingState.isFallback && bookingState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Bookings is showing sample data.
        </Alert>
      ) : null}
      {hasActiveFilters ? (
        <Group gap={6} wrap="wrap" data-testid="bookings-active-filter-context">
          {dateScope !== defaultBookingsView.dateScope ? (
            <Badge variant="light" color="gray">
              {dateScopeOptions.find((scope) => scope.value === dateScope)?.label}
            </Badge>
          ) : null}
          {filter !== defaultBookingsView.filter ? (
            <Badge variant="light" color="gray">
              {bookingFilterOptions.find((option) => option.value === filter)?.label}
            </Badge>
          ) : null}
          {query.trim() ? (
            <Badge variant="light" color="gray">
              Search: {query.trim()}
            </Badge>
          ) : null}
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={clearFilters}
            data-testid="bookings-clear-filters"
          >
            Clear filters
          </Button>
        </Group>
      ) : null}

      <Group gap={spacing[2]} grow align="stretch" wrap="wrap" data-testid="bookings-summary-cards">
        {operationalSummary.map((item) => {
          const isSelected = filter === item.filter;
          const tone = summaryToneByFilter[item.filter] ?? defaultSummaryTone;
          return (
            <Box
              key={item.filter}
              component="button"
              type="button"
              aria-pressed={isSelected}
              data-testid={`bookings-summary-card-${item.filter}`}
              onClick={() => setOperationalFilter(item.filter)}
              className={[
                styles.summaryCard,
                isSelected ? styles.summaryCardSelected : '',
                item.filter === 'needs-attention' ? styles.summaryCardAttention : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                background: isSelected
                  ? `color-mix(in srgb, ${tone.soft} 46%, #ffffff)`
                  : '#ffffff',
                borderStyle: 'solid',
                borderWidth: 1,
                borderTopColor: isSelected ? tone.color : 'rgba(226, 232, 240, 0.9)',
                borderRightColor: isSelected ? tone.color : 'rgba(226, 232, 240, 0.9)',
                borderBottomColor: isSelected ? tone.color : 'rgba(226, 232, 240, 0.9)',
                borderLeftColor: tone.color,
                boxShadow: cardStyle.boxShadow,
                color: tone.color,
              }}
            >
              <Group
                className={styles.summaryCardInner}
                justify="space-between"
                align="flex-start"
                gap={spacing[2]}
                wrap="nowrap"
              >
                <Stack gap={3}>
                  <Text
                    className={styles.summaryCardLabel}
                    c="#64748b"
                    size="xs"
                    fw={800}
                    tt="uppercase"
                  >
                    {item.label}
                  </Text>
                  <Text className={styles.summaryCardCount} c="#101828" fw={850}>
                    {item.count}
                  </Text>
                  {item.context ? (
                    <Text
                      c={item.filter === 'needs-attention' ? tone.color : '#64748b'}
                      size="xs"
                      fw={600}
                    >
                      {item.context}
                    </Text>
                  ) : null}
                </Stack>
                <ThemeIcon
                  color={tone.mantineColor}
                  variant="light"
                  size={26}
                  radius={radius.sm}
                  aria-hidden="true"
                  className={styles.summaryIcon}
                >
                  <SummaryIcon filter={item.filter} />
                </ThemeIcon>
              </Group>
            </Box>
          );
        })}
      </Group>

      <Card radius={radius.lg} p={12} style={cardStyle} className={styles.stickyToolbar}>
        <Group className={styles.toolbar} gap={spacing[2]} wrap="wrap">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder="Search guest, booking ID, phone, room type or source..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className={styles.searchControl}
          />
          <Box className={styles.toolbarDivider} aria-hidden="true" />
          <Group className={styles.navigationControls} gap={8} wrap="nowrap">
            <Select
              aria-label="Rows per page"
              data={pageSizeOptions}
              value={String(pageSize)}
              onChange={(value) => setPageSize(Number(value ?? 10))}
              w={{ base: 116, md: 122 }}
            />
            <Box className={styles.paginationControl}>
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={activePage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                data-testid="bookings-pagination-prev"
                aria-label="Previous page"
                size={32}
              >
                <ChevronLeft size={17} />
              </ActionIcon>
              <Text
                c="#334155"
                size="sm"
                fw={700}
                className={styles.pageIndicator}
                data-testid="bookings-pagination-current"
              >
                Page {activePage} of {totalPages}
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={activePage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                data-testid="bookings-pagination-next"
                aria-label="Next page"
                size={32}
              >
                <ChevronRight size={17} />
              </ActionIcon>
            </Box>
          </Group>
          <Box className={styles.toolbarDivider} aria-hidden="true" />
          <Select
            aria-label="Scope"
            data={bookingFilterOptions}
            value={filter}
            onChange={(value) => setFilter((value as BookingFilter | null) ?? 'all')}
            w={{ base: 190, md: 220 }}
          />
        </Group>
        <Group
          className={styles.dateScopeControls}
          mt={10}
          data-testid="bookings-date-scope-controls"
        >
          {dateScopeOptions.map((scope) => {
            const isSelected = dateScope === scope.value;
            return (
              <Box
                key={scope.value}
                component="button"
                type="button"
                className={[
                  styles.dateScopeButton,
                  isSelected ? styles.dateScopeButtonSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={isSelected}
                data-testid={`bookings-date-scope-${scope.value}`}
                onClick={() => setDateScope(scope.value)}
              >
                {scope.label}
              </Box>
            );
          })}
        </Group>
        <Group className={styles.operationalTabs} mt={10} data-testid="bookings-operational-tabs">
          {operationalTabs.map((tab) => {
            const isSelected = filter === tab.filter;
            return (
              <Box
                key={tab.filter}
                component="button"
                type="button"
                className={[styles.operationalTab, isSelected ? styles.operationalTabSelected : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={isSelected}
                data-testid={`bookings-operational-tab-${tab.filter}`}
                onClick={() => setOperationalFilter(tab.filter)}
              >
                <span>{tab.label}</span>
                <span className={styles.operationalTabCount}>{tab.count}</span>
              </Box>
            );
          })}
        </Group>
      </Card>

      {bookingState.bookings.length === 0 &&
      visibleGroupBookings.length === 0 &&
      !bookingState.isLoading ? (
        <EmptyData
          title="No bookings yet"
          detail="The active property has no bookings to show yet."
        />
      ) : visibleRows.length > 0 ? (
        <Card p={0} radius={radius.lg} style={{ ...cardStyle, overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={820}>
            <Table className={styles.table} verticalSpacing={11} horizontalSpacing={16}>
              <Table.Thead className={styles.tableHeader}>
                <Table.Tr>
                  {[
                    'Guest / Booking',
                    'Stay',
                    'Room / Accommodation',
                    'Status & Payment',
                    'Action',
                  ].map((header) => (
                    <Table.Th
                      key={header}
                      className={styles.tableHeaderCell}
                      w={header === 'Action' ? 176 : undefined}
                    >
                      {header}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedRows.map((row) => {
                  if (row.kind === 'group') {
                    const result = row.result;
                    const group = result.group;
                    const id = groupResultId(result);
                    const status = groupResultStatus(result);
                    const href = `/reservations/group-holds/${id}`;

                    return (
                      <Table.Tr
                        key={`group-${id}`}
                        data-testid={`group-booking-row-${id}`}
                        className={styles.groupRow}
                      >
                        <Table.Td className={styles.leadCell}>
                          <Stack gap={2}>
                            <Group className={styles.guestIdentity} gap={8} wrap="nowrap">
                              <Badge
                                className={styles.groupIdentityBadge}
                                color="violet"
                                variant="light"
                                size="xs"
                                radius={radius.sm}
                              >
                                [GRP]
                              </Badge>
                              <Text
                                component={Link}
                                href={href}
                                onClick={rememberScrollPosition}
                                fw={800}
                                c="#101828"
                                className={styles.guestName}
                                style={{ textDecoration: 'none' }}
                              >
                                {group.groupName}
                              </Text>
                            </Group>
                            <Text className={styles.secondaryText} size="xs">
                              {group.groupCode}
                              {group.leadName ? ` - Lead: ${group.leadName}` : ''}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text className={styles.stayText} size="sm">
                            {formatStayDates(group.arrivalDate, group.departureDate)}
                          </Text>
                          <Text className={styles.secondaryText} size="xs">
                            {groupResultNightCount(result)} nights - {groupResultSecondary(result)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className={styles.roomText} size="sm">
                            {groupResultRoomTypes(result)}
                          </Text>
                          <Text className={styles.secondaryText} size="xs">
                            {groupRoomAssignmentDetail(result)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={6} align="flex-start">
                            <Badge color={groupStatusColor(status)} variant="light">
                              {groupStatusLabel(status)}
                            </Badge>
                            <Text c="#64748b" size="sm">
                              {status === 'CHECKED_IN' || status === 'CHECKED_OUT'
                                ? 'Master folio'
                                : '-'}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td className={styles.actionCell}>
                          <Group className={styles.actionGroup} gap={6} wrap="nowrap">
                            <Button
                              component={Link}
                              data-testid={`group-booking-next-action-${id}`}
                              href={href}
                              onClick={rememberScrollPosition}
                              size="compact-sm"
                              variant="light"
                              color="stayosBrand"
                              className={styles.primaryAction}
                            >
                              Open Group
                            </Button>
                            <Menu shadow="md" width={200} position="bottom-end" withinPortal>
                              <Menu.Target>
                                <ActionIcon
                                  className={styles.kebabButton}
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`More actions for ${group.groupCode}`}
                                  data-testid={`group-booking-actions-menu-${id}`}
                                >
                                  <MoreHorizontal size={18} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item component={Link} href={href}>
                                  Group Hub
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<Copy size={14} />}
                                  onClick={() => void copyToClipboard(id, 'Group ID')}
                                >
                                  Copy Group ID
                                </Menu.Item>
                                {result.kind === 'hold' && result.group.leadPhone ? (
                                  <Menu.Item
                                    leftSection={<Copy size={14} />}
                                    onClick={() =>
                                      void copyToClipboard(result.group.leadPhone, 'Phone number')
                                    }
                                  >
                                    Copy Phone
                                  </Menu.Item>
                                ) : null}
                                {result.kind === 'inHouse' ? (
                                  <>
                                    <Menu.Item
                                      component={Link}
                                      href={`/reservations/group-holds/${id}/master-folio`}
                                    >
                                      Open Folio
                                    </Menu.Item>
                                    <Menu.Item onClick={() => openExtendGroup(result.group)}>
                                      Extend Stay
                                    </Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item
                                      color="red"
                                      onClick={() => void openCheckoutGroup(result.group)}
                                    >
                                      Check Out Group
                                    </Menu.Item>
                                  </>
                                ) : null}
                                {result.kind === 'hold' && result.group.status === 'CHECKED_OUT' ? (
                                  <Menu.Item
                                    component={Link}
                                    href={`/reservations/group-holds/${id}/master-folio`}
                                  >
                                    Open Folio
                                  </Menu.Item>
                                ) : null}
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  }

                  const booking = row.booking;
                  const warningState = unassignedWarningState(booking);

                  return (
                    <Table.Tr
                      key={booking.backendId}
                      data-testid={`booking-row-${booking.backendId}`}
                      className={styles.bookingRow}
                    >
                      <Table.Td>
                        <Group
                          className={styles.guestIdentity}
                          gap={10}
                          wrap="nowrap"
                          align="flex-start"
                        >
                          <Avatar
                            className={styles.guestAvatar}
                            color="stayosBrand"
                            radius={radius.full}
                            size={32}
                          >
                            {guestInitials(booking.guestName)}
                          </Avatar>
                          <Stack gap={2} miw={0}>
                            <Text className={styles.guestName}>{booking.guestName}</Text>
                            <Group className={styles.sourceMeta} gap={5} wrap="nowrap">
                              <Text
                                component={Link}
                                href={`/reservations/${booking.backendId}`}
                                onClick={rememberScrollPosition}
                                inherit
                                c="inherit"
                                style={{ textDecoration: 'none' }}
                              >
                                {booking.bookingId}
                              </Text>
                              <span aria-hidden="true">-</span>
                              <SourceIcon source={booking.source} />
                              <span>{sourceLabel(booking.source)}</span>
                            </Group>
                            {booking.isVip ? (
                              <Badge color="stayosBrand" variant="light" mt={3} size="xs">
                                VIP
                              </Badge>
                            ) : null}
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text className={styles.stayText} size="sm">
                          {formatStayDates(booking.arrivalDate, booking.departureDate)}
                        </Text>
                        <Text className={styles.secondaryText} size="xs">
                          {booking.nights} nights
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text className={styles.roomText} size="sm">
                          {booking.roomType} - {booking.room}
                        </Text>
                        {booking.roomReadinessLabel && booking.status !== 'CHECKED_IN' ? (
                          <Text
                            className={[
                              styles.roomReadiness,
                              roomReadinessClassName(booking.roomReadinessLabel),
                            ].join(' ')}
                            size="xs"
                            fw={750}
                          >
                            {booking.roomReadinessLabel}
                          </Text>
                        ) : null}
                        {warningState ? (
                          <Text className={warningState.className} size="xs" fw={750}>
                            <AlertCircle aria-hidden="true" size={12} />
                            {warningState.label}
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={6} align="flex-start">
                          <BookingStatusBadge status={booking.status} />
                          <PaymentStatusBadge status={booking.paymentStatus} />
                        </Stack>
                      </Table.Td>
                      <Table.Td className={styles.actionCell}>
                        <Group className={styles.actionGroup} gap={6} wrap="nowrap">
                          <Button
                            component={Link}
                            data-testid={`booking-next-action-${booking.backendId}`}
                            href={`/reservations/${booking.backendId}`}
                            onClick={rememberScrollPosition}
                            size="compact-sm"
                            variant="light"
                            color="stayosBrand"
                            className={styles.primaryAction}
                          >
                            {primaryBookingActionLabel(booking)}
                          </Button>
                          <Menu shadow="md" width={190} position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon
                                className={styles.kebabButton}
                                variant="subtle"
                                color="gray"
                                aria-label={`More actions for ${booking.bookingId}`}
                                data-testid={`booking-actions-menu-${booking.backendId}`}
                              >
                                <MoreHorizontal size={18} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                component={Link}
                                href={`/reservations/${booking.backendId}`}
                                onClick={rememberScrollPosition}
                              >
                                View Booking
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<Copy size={14} />}
                                onClick={() =>
                                  void copyToClipboard(booking.bookingId, 'Booking ID')
                                }
                              >
                                Copy Booking ID
                              </Menu.Item>
                              {booking.phone && booking.phone !== 'Not recorded' ? (
                                <Menu.Item
                                  leftSection={<Copy size={14} />}
                                  onClick={() =>
                                    void copyToClipboard(booking.phone, 'Phone number')
                                  }
                                >
                                  Copy Phone
                                </Menu.Item>
                              ) : null}
                              {booking.status === 'CHECKED_OUT' ? (
                                <Menu.Item
                                  component={Link}
                                  href={`/reservations/${booking.backendId}`}
                                >
                                  View Stay History
                                </Menu.Item>
                              ) : null}
                              {/* prettier-ignore */}
                              {booking.status !== 'CANCELLED' &&
                              booking.status !== 'CHECKED_OUT' ? (
                                <Menu.Item
                                  component={Link}
                                  href={`/reservations/${booking.backendId}/edit`}
                                  leftSection={<Edit size={14} />}
                                >
                                  Edit Booking
                                </Menu.Item>
                              ) : null}
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group
            className={styles.paginationBar}
            justify="flex-start"
            gap={spacing[2]}
            wrap="wrap"
            data-testid="bookings-pagination"
          >
            <Text c="#64748b" size="sm" fw={600}>
              Showing {firstRowNumber}-{lastRowNumber} of {visibleRows.length}
            </Text>
          </Group>
        </Card>
      ) : (
        <Card className={styles.emptyState} ta="center" radius={radius.lg} style={cardStyle}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44} mx="auto">
            <Search size={20} />
          </ThemeIcon>
          <Title order={3} mt={spacing[4]} c="#101828">
            {emptyResultTitle}
          </Title>
          <Text c="#64748b" mt={spacing[2]}>
            {emptyResultDetail}
          </Text>
          {hasActiveFilters ? (
            <Button
              mt={spacing[3]}
              size="compact-sm"
              variant="subtle"
              color="gray"
              onClick={clearFilters}
              data-testid="bookings-empty-clear-filters"
            >
              Clear filters
            </Button>
          ) : null}
        </Card>
      )}
    </Stack>
  );
}
