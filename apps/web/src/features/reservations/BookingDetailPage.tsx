'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  CreditCard,
  Edit,
  IdCard,
  Mail,
  MoreHorizontal,
  MoveRight,
  NotebookText,
  Plus,
  ReceiptIndianRupee,
  UserRound,
  XCircle,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import {
  BackendUnavailable,
  GenericError,
  ServerStarting,
  showToast,
  useBackendStatus,
} from '@stayos/ui';
import { updatePropertyGuest } from '../../lib/guest-api';
import { friendlyGuestError } from '../../lib/guest-hooks';
import { BookingStatusBadge, PaymentStatusBadge } from './components/BookingBadges';
import { friendlyBookingError, useBookingDetails } from './hooks/useBookings';
import type { AvailableRoomOption, Booking } from './types/booking.types';
import { bookingStatusLabel, paymentStatusLabel, sourceLabel } from './utils/booking-formatters';
import { CheckoutModal } from './components/CheckoutModal';
import { ExtendStayModal } from './components/ExtendStayModal';
import { getFolioForReservation } from '../billing/api/billing-api';
import {
  moveReservationRoom,
  resendFinalInvoiceEmail,
  resendReservationConfirmationEmail,
} from '../../lib/reservation-api';
import type { Folio } from '../billing/types/billing.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function DetailTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#64748b" size="xs" fw={650}>
        {label}
      </Text>
      <Text c="#111827" mt={3} size="sm" fw={550}>
        {value}
      </Text>
    </Paper>
  );
}

function isMissing(value: string) {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === 'not recorded' || normalized === 'guest not connected';
}

function formatCurrency(amount?: number) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return 'Loading...';
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

function formatHeaderStayDates(arrivalDate: string, departureDate: string) {
  const format = (value: string) => {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  return `${format(arrivalDate)} to ${format(departureDate)}`;
}

function formatStayDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isFutureArrival(arrivalDate: string) {
  return arrivalDate.slice(0, 10) > localDateKey();
}

function formatPhoneForDisplay(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return value;
}

type FolioSummary = {
  balance: number;
  paid: number;
  total: number;
};

function bookingActionState(booking: Booking, folio?: FolioSummary) {
  const hasRoom = booking.room !== 'Unassigned';
  const balance = folio?.balance;
  const paid = folio?.paid ?? 0;
  const hasBalance = typeof balance === 'number' && balance > 0.01;
  const hasAnyPayment = paid > 0.01;

  if (booking.status === 'CHECKED_OUT') {
    return {
      title: 'Stay complete',
      description: 'Guest has checked out and the room is with housekeeping.',
      paymentCopy: hasBalance
        ? `${formatCurrency(balance)} still needs review in folio.`
        : 'Folio is settled.',
    };
  }

  if (!hasRoom) {
    return {
      title: 'Assign room first',
      description: hasBalance
        ? 'Room is still pending. You can collect payment now, but check-in cannot start until a ready room is assigned.'
        : 'Payment is already clear. Assign a ready room, then start check-in.',
      paymentCopy: hasBalance
        ? hasAnyPayment
          ? `${formatCurrency(paid)} paid. ${formatCurrency(balance)} balance.`
          : `${formatCurrency(balance)} due.`
        : 'No collection needed at check-in unless new charges are added.',
    };
  }

  if (booking.status === 'CONFIRMED') {
    return {
      title: hasBalance ? 'Start check-in: verify ID and collect balance' : 'Ready for check-in',
      description: hasBalance
        ? 'Click Start Check-In. The check-in flow will guide ID verification and payment collection before completion.'
        : 'Room is assigned and payment is clear. At check-in, just review payment and verify ID.',
      paymentCopy: hasBalance
        ? hasAnyPayment
          ? `${formatCurrency(paid)} paid. ${formatCurrency(balance)} balance.`
          : `${formatCurrency(balance)} due.`
        : 'Already paid. Do not collect again at check-in.',
    };
  }

  if (booking.status === 'CHECKED_IN') {
    return {
      title: 'Guest in-house',
      description: hasBalance
        ? 'Keep the balance visible and collect it before checkout.'
        : 'Folio is clear. Add any in-stay charges as needed.',
      paymentCopy: hasBalance
        ? `${formatCurrency(balance)} due before checkout.`
        : 'No balance due.',
    };
  }

  return {
    title: 'Confirm booking',
    description:
      booking.room === 'Unassigned'
        ? 'This hold is already consuming inventory. Confirm the booking, then assign a ready room before check-in.'
        : 'This hold is already consuming inventory. Confirm the booking before continuing to check-in.',
    paymentCopy: hasBalance
      ? `${formatCurrency(balance)} outstanding.`
      : 'No collection needed yet.',
  };
}

function GuestFieldEditor({
  disabled,
  field,
  label,
  onSave,
  value,
}: {
  disabled: boolean;
  field: 'phone' | 'email' | 'nationality';
  label: string;
  onSave: (field: 'phone' | 'email' | 'nationality', value: string) => Promise<void>;
  value: string;
}) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isMissing(value)) return <>{value}</>;

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onSave(field, draft.trim());
      setOpened(false);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={260}>
      <Popover.Target>
        <Button
          data-testid={`booking-guest-add-${field}`}
          disabled={disabled}
          size="compact-sm"
          variant="subtle"
          color="stayosBrand"
          px={0}
          onClick={() => setOpened((current) => !current)}
        >
          + Add {label.toLowerCase()}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={spacing[2]}>
          <TextInput
            autoFocus
            label={label}
            onChange={(event) => setDraft(event.currentTarget.value)}
            value={draft}
          />
          <Button
            color="stayosBrand"
            loading={saving}
            disabled={!draft.trim()}
            onClick={() => void save()}
          >
            Save
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function FrontDeskConsole({
  assignedRoomUnavailable,
  assignedRoomUiStatus,
  booking,
  folio,
  isActing,
  onAssignRoom,
  onChangeRoom,
  onCheckOut,
  onConfirmBooking,
}: {
  assignedRoomUnavailable: boolean;
  assignedRoomUiStatus?: string;
  booking: Booking;
  folio?: FolioSummary;
  isActing: boolean;
  onAssignRoom: () => void;
  onChangeRoom: () => void;
  onCheckOut: () => Promise<void>;
  onConfirmBooking: () => Promise<void>;
}) {
  if (booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') return null;

  const unassigned = booking.room === 'Unassigned';
  const futureArrival = booking.status === 'CONFIRMED' && isFutureArrival(booking.arrivalDate);
  const hasBalance = typeof folio?.balance === 'number' && folio.balance > 0.01;
  const hasAnyPayment = (folio?.paid ?? 0) > 0.01;
  const normalState = bookingActionState(booking, folio);
  const state = futureArrival
    ? {
        title: 'Check-in not available yet',
        description: `This guest is scheduled to arrive on ${formatStayDate(booking.arrivalDate)}. Check-in can start on the arrival date.`,
        paymentCopy: normalState.paymentCopy,
      }
    : booking.status === 'CONFIRMED' && assignedRoomUnavailable
      ? {
          title: 'Change room before check-in',
          description: `${booking.room} is currently unavailable${
            assignedRoomUiStatus ? ` (${assignedRoomUiStatus.toLowerCase()})` : ''
          }. Choose another ready room to continue.`,
          paymentCopy: normalState.paymentCopy,
        }
      : normalState;
  const chips = [
    {
      color: unassigned ? 'orange' : assignedRoomUnavailable ? 'red' : 'green',
      label: unassigned
        ? 'Room pending'
        : assignedRoomUnavailable
          ? `${booking.room} unavailable`
          : booking.room,
    },
    {
      color: hasBalance ? 'orange' : 'green',
      label: hasBalance
        ? hasAnyPayment
          ? `${formatCurrency(folio?.balance)} balance`
          : `${formatCurrency(folio?.total)} due`
        : 'Payment clear',
    },
    {
      color: booking.status === 'CHECKED_IN' ? 'green' : 'gray',
      label: booking.status === 'CHECKED_IN' ? 'In-house' : 'ID pending',
    },
  ];

  return (
    <Card
      radius={radius.lg}
      p={18}
      style={{
        background: '#ffffff',
        border: '1px solid #ddd6fe',
        boxShadow: '0 10px 28px rgba(91, 33, 182, 0.08)',
      }}
    >
      <Group justify="space-between" align="center" gap={spacing[4]}>
        <Box style={{ minWidth: 0 }}>
          <Text c="#5b21b6" fw={800} size="xl">
            {state.title}
          </Text>
          <Text c="#475569" size="sm" mt={2}>
            {state.description}
          </Text>
          <Group gap={8} mt={10}>
            {chips.map((chip) => (
              <Badge key={chip.label} color={chip.color} variant="light" radius="xl" size="md">
                {chip.label}
              </Badge>
            ))}
          </Group>
        </Box>
        <Group gap={8}>
          {booking.status === 'PENDING' ? (
            <Button
              data-testid="booking-next-action-cta"
              color="stayosBrand"
              h={48}
              loading={isActing}
              onClick={() => void onConfirmBooking()}
            >
              Confirm Booking
            </Button>
          ) : unassigned ? (
            <Button
              data-testid="booking-next-action-cta"
              color="stayosBrand"
              h={48}
              disabled={isActing}
              onClick={onAssignRoom}
            >
              Assign Room
            </Button>
          ) : booking.status === 'CHECKED_IN' ? (
            <>
              <Button
                component={Link}
                href={`/guest-stay/${booking.backendId}`}
                color="stayosBrand"
                h={48}
              >
                Open Stay
              </Button>
              <Button
                data-testid="booking-next-action-cta"
                variant="light"
                color="red"
                h={48}
                loading={isActing}
                onClick={() => void onCheckOut()}
              >
                Check Out
              </Button>
            </>
          ) : assignedRoomUnavailable ? (
            <Button
              data-testid="booking-next-action-cta"
              color="stayosBrand"
              h={48}
              leftSection={<MoveRight size={16} />}
              onClick={onChangeRoom}
            >
              Change Room
            </Button>
          ) : futureArrival ? (
            <Button data-testid="booking-next-action-cta" color="stayosBrand" h={48} disabled>
              Check-In Available {formatStayDate(booking.arrivalDate)}
            </Button>
          ) : (
            <Button
              component={Link}
              href={`/reservations/${booking.backendId}/check-in`}
              data-testid="booking-next-action-cta"
              color="stayosBrand"
              h={48}
            >
              Start Check-In
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}

function Section({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Card radius={radius.lg} p={16} style={cardStyle}>
      <Group gap={10}>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}>
          {icon}
        </ThemeIcon>
        <Title order={2} c="#101828" style={{ fontSize: 19, fontWeight: 750 }}>
          {title}
        </Title>
      </Group>
      <Box mt={14}>{children}</Box>
    </Card>
  );
}

function AssignRoomModal({
  booking,
  loading,
  mode = 'assign',
  onAssign,
  onClose,
  onLoadRooms,
  opened,
}: {
  booking: Booking;
  loading: boolean;
  mode?: 'assign' | 'change' | 'move';
  onAssign: (roomId: string) => Promise<void>;
  onClose: () => void;
  onLoadRooms: () => Promise<AvailableRoomOption[]>;
  opened: boolean;
}) {
  const [rooms, setRooms] = useState<AvailableRoomOption[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!opened) return;

    let mounted = true;
    setIsLoadingRooms(true);
    setLoadError('');
    setRoomId(null);

    onLoadRooms()
      .then((nextRooms) => {
        if (!mounted) return;
        setRooms(nextRooms);
      })
      .catch(() => {
        if (!mounted) return;
        setRooms([]);
        setLoadError('Unable to load available rooms. Try again.');
      })
      .finally(() => {
        if (mounted) setIsLoadingRooms(false);
      });

    return () => {
      mounted = false;
    };
  }, [onLoadRooms, opened]);

  const emptyMessage = `${booking.roomType} has no ready rooms available for ${booking.adults + booking.children} guest${booking.adults + booking.children === 1 ? '' : 's'} from ${booking.arrivalDate} to ${booking.departureDate}. Try a different room type, reduce guest count, or mark a suitable room Ready from Rooms/Housekeeping.`;

  const retry = async () => {
    setIsLoadingRooms(true);
    setLoadError('');
    try {
      const nextRooms = await onLoadRooms();
      setRooms(nextRooms);
      setRoomId(null);
    } catch {
      setRooms([]);
      setLoadError('Unable to load available rooms. Try again.');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const modalTitle =
    mode === 'move' ? 'Move Room' : mode === 'change' ? 'Change Room' : 'Assign Room';
  const primaryLabel =
    mode === 'move' ? 'Move Room' : mode === 'change' ? 'Change Room' : 'Assign Room';
  const selectPlaceholder =
    mode === 'move'
      ? 'Choose a room to move guest into'
      : mode === 'change'
        ? 'Choose another ready room'
        : 'Choose a ready room';

  return (
    <Modal opened={opened} onClose={onClose} title={modalTitle} centered>
      <Stack gap={spacing[4]}>
        <Paper
          radius={radius.md}
          p={12}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          {mode === 'change' ? (
            <>
              <Text c="#64748b" size="xs" fw={650}>
                Current room
              </Text>
              <Text fw={800} size="sm">
                {booking.room} · {booking.roomType}
              </Text>
            </>
          ) : (
            <Text fw={800} size="sm">
              {booking.roomType}
            </Text>
          )}
          <Text c="#64748b" size="xs" mt={mode === 'change' ? 6 : 0}>
            {formatStayDate(booking.arrivalDate)} to {formatStayDate(booking.departureDate)}
            {' · '}
            {booking.nights} {booking.nights === 1 ? 'night' : 'nights'}
            {' · '}
            {booking.adults} adult{booking.adults === 1 ? '' : 's'}
            {booking.children
              ? ` · ${booking.children} child${booking.children === 1 ? '' : 'ren'}`
              : ''}
          </Text>
        </Paper>
        {isLoadingRooms ? (
          <Group gap={10}>
            <Loader color="stayosBrand" size="sm" />
            <Text c="#64748b" size="sm">
              Checking ready rooms...
            </Text>
          </Group>
        ) : loadError ? (
          <Alert color="red" radius={radius.md} title="Rooms could not be loaded">
            <Stack gap={spacing[2]}>
              <Text size="sm">{loadError}</Text>
              <Button color="red" variant="light" w="fit-content" onClick={() => void retry()}>
                Retry
              </Button>
            </Stack>
          </Alert>
        ) : rooms.length === 0 ? (
          <Alert color="yellow" radius={radius.md} title="No assignable rooms">
            {emptyMessage}
          </Alert>
        ) : (
          <Select
            data={rooms.map((room) => ({
              label: `${room.label} - ${room.roomType}`,
              value: room.id,
            }))}
            label={mode === 'change' ? 'New room' : 'Room'}
            onChange={setRoomId}
            placeholder={selectPlaceholder}
            value={roomId}
          />
        )}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            loading={loading}
            disabled={!roomId}
            onClick={() => roomId && void onAssign(roomId)}
          >
            {primaryLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function BookingDetailSkeleton() {
  return (
    <Stack gap={spacing[3]} data-testid="booking-detail-skeleton">
      <Card radius={radius.lg} p={20} style={cardStyle}>
        <Group justify="space-between" align="flex-start" gap={spacing[4]}>
          <Stack gap={10} style={{ flex: 1 }}>
            <Group gap={12}>
              <Skeleton height={18} width={120} radius="sm" />
              <Skeleton height={18} width={130} radius="sm" />
            </Group>
            <Group gap={8}>
              <Skeleton height={22} width={84} radius="xl" />
              <Skeleton height={22} width={96} radius="xl" />
            </Group>
            <Skeleton height={38} width="32%" radius="sm" />
            <Skeleton height={16} width={180} radius="sm" />
            <Group gap={8} wrap="wrap">
              <Skeleton height={16} width={120} radius="sm" />
              <Skeleton height={16} width={170} radius="sm" />
              <Skeleton height={16} width={72} radius="sm" />
            </Group>
          </Stack>

          <Group gap={8}>
            <Skeleton height={36} width={110} radius="md" />
            <Skeleton height={36} width={120} radius="md" />
            <Skeleton height={36} width={116} radius="md" />
          </Group>
        </Group>
      </Card>

      <Card radius={radius.lg} p={18} style={cardStyle}>
        <Stack gap={10}>
          <Skeleton height={24} width="34%" radius="sm" />
          <Skeleton height={15} width="58%" radius="sm" />
          <Group gap={8}>
            <Skeleton height={24} width={90} radius="xl" />
            <Skeleton height={24} width={110} radius="xl" />
            <Skeleton height={24} width={92} radius="xl" />
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <Card radius={radius.lg} p={16} style={cardStyle}>
            <Stack gap={14}>
              <Group gap={10}>
                <Skeleton circle height={34} />
                <Skeleton height={22} width={110} radius="sm" />
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`guest-${index}`} height={62} radius="md" />
                ))}
              </SimpleGrid>
              <Skeleton height={34} width={150} radius="md" />
            </Stack>
          </Card>

          <Card radius={radius.lg} p={16} style={cardStyle}>
            <Stack gap={14}>
              <Group gap={10}>
                <Skeleton circle height={34} />
                <Skeleton height={22} width={140} radius="sm" />
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
                {Array.from({ length: 9 }).map((_, index) => (
                  <Skeleton key={`stay-${index}`} height={62} radius="md" />
                ))}
              </SimpleGrid>
            </Stack>
          </Card>
        </Stack>

        <Stack gap={spacing[3]} style={{ gridColumn: 'span 4' }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`side-${index}`} radius={radius.lg} p={16} style={cardStyle}>
              <Stack gap={12}>
                <Group gap={10}>
                  <Skeleton circle height={34} />
                  <Skeleton height={22} width={index === 0 ? 110 : 90} radius="sm" />
                </Group>
                <Skeleton height={index === 0 ? 150 : 78} radius="md" />
              </Stack>
            </Card>
          ))}
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

export default function BookingDetailPage() {
  const params = useParams<{ reservationId: string }>();
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const enabled =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const bookingState = useBookingDetails({
    allowMockFallback,
    bookingId: params.reservationId,
    enabled,
  });
  const [cancelOpened, setCancelOpened] = useState(false);
  const [assignOpened, setAssignOpened] = useState(false);
  const [changeOpened, setChangeOpened] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [extendOpened, setExtendOpened] = useState(false);
  const [moveOpened, setMoveOpened] = useState(false);
  const [folioSummary, setFolioSummary] = useState<FolioSummary | undefined>(undefined);
  const [folioId, setFolioId] = useState<string | undefined>(undefined);
  const [isActing, setIsActing] = useState(false);
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const [isSendingFinalInvoice, setIsSendingFinalInvoice] = useState(false);
  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  const currentBooking = bookingState.booking;
  const currentPropertyId = bookingState.propertyId;
  useEffect(() => {
    if (!currentBooking || !currentPropertyId) return;
    if (currentBooking.status === 'CANCELLED' || currentBooking.status === 'PENDING') {
      setFolioSummary(undefined);
      setFolioId(undefined);
      return;
    }
    const controller = new AbortController();
    getFolioForReservation(currentPropertyId, currentBooking.backendId, controller.signal)
      .then((f: Folio) => {
        setFolioId(f.id);
        setFolioSummary({
          balance: Number(f.totals.balance) || 0,
          paid: Number(f.totals.paid) || 0,
          total: Number(f.totals.total) || 0,
        });
      })
      .catch(() => {
        setFolioId(undefined);
        setFolioSummary(undefined);
      });
    return () => controller.abort();
  }, [currentPropertyId, currentBooking?.backendId, currentBooking?.status]);

  if (!allowMockFallback && backend.status === 'SERVER_STARTING')
    return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING')
    return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!allowMockFallback && bookingState.error && !bookingState.isLoading && !bookingState.booking)
    return (
      <GenericError
        onAction={() => void bookingState.refreshBooking()}
        onCheckStatus={checkBackendStatus}
      />
    );
  if (!bookingState.booking) {
    return <BookingDetailSkeleton />;
  }

  const booking = bookingState.booking;
  const futureArrival = booking.status === 'CONFIRMED' && isFutureArrival(booking.arrivalDate);
  const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const canAssignRoom =
    (booking.status === 'PENDING' || booking.status === 'CONFIRMED') &&
    booking.room === 'Unassigned';
  const canChangeRoom = booking.status === 'CONFIRMED' && booking.room !== 'Unassigned';
  const assignedRoomUnavailable =
    booking.status === 'CONFIRMED' && bookingState.assignedRoomUnavailable;
  const assignedRoomUiStatus = bookingState.assignedRoomUiStatus;
  const canEditBooking = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const isReadOnlyBooking = booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT';
  const guestFieldsDisabled =
    !booking.guestId || !bookingState.propertyId || bookingState.isFallback;

  const cancelBooking = async () => {
    setIsActing(true);
    try {
      await bookingState.cancelBooking();
      showToast({
        color: 'green',
        title: 'Booking cancelled',
        message: 'The booking has been cancelled.',
      });
      setCancelOpened(false);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to cancel booking',
        message: friendlyBookingError(error),
      });
    } finally {
      setIsActing(false);
    }
  };

  const confirmBooking = async () => {
    setIsActing(true);
    try {
      await bookingState.confirmBooking();
      showToast({
        color: 'green',
        title: 'Booking confirmed',
        message: 'The booking is confirmed. Assign a room to continue to check-in.',
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to confirm booking',
        message: friendlyBookingError(error),
      });
    } finally {
      setIsActing(false);
    }
  };

  const assignRoom = async (roomId: string) => {
    setIsActing(true);
    try {
      await bookingState.assignRoom(roomId);
      showToast({ color: 'green', title: 'Room assigned', message: 'Room assigned successfully.' });
      setAssignOpened(false);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to assign room',
        message: friendlyBookingError(error),
      });
    } finally {
      setIsActing(false);
    }
  };

  const changeRoom = async (roomId: string) => {
    const previousRoom = booking.room;
    let newRoomLabel = 'the selected room';

    try {
      const availableRooms = await bookingState.getRooms();
      const selectedRoom = availableRooms.find((room) => room.id === roomId);
      if (selectedRoom) newRoomLabel = selectedRoom.label;
    } catch {
      // Room reassignment itself can still proceed even if label lookup fails.
    }

    setIsActing(true);
    try {
      await bookingState.assignRoom(roomId);
      showToast({
        color: 'green',
        title: 'Room changed',
        message: `Room changed successfully from ${previousRoom} to ${newRoomLabel}.`,
      });
      setChangeOpened(false);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to change room',
        message: friendlyBookingError(error),
      });
    } finally {
      setIsActing(false);
    }
  };

  const moveRoom = async (roomId: string) => {
    if (!bookingState.propertyId) return;
    setIsActing(true);
    try {
      await moveReservationRoom(bookingState.propertyId, booking.backendId, roomId);
      showToast({ color: 'green', title: 'Room moved', message: 'Guest moved to the new room.' });
      setMoveOpened(false);
      await bookingState.refreshBooking();
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to move room',
        message: friendlyBookingError(error),
      });
    } finally {
      setIsActing(false);
    }
  };

  const checkOutBooking = async (options: { lateCheckout?: boolean } = {}) => {
    setIsActing(true);
    try {
      await bookingState.checkOutBooking({ lateCheckout: options.lateCheckout ?? false });
      showToast({
        autoClose: 9000,
        color: 'green',
        title: 'Checkout complete',
        message: 'Guest checked out. The room is ready for housekeeping follow-up.',
      });
      setFolioSummary(undefined);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to check out',
        message: friendlyBookingError(error),
      });
      throw error;
    } finally {
      setIsActing(false);
    }
  };

  const openCheckoutFlow = async () => setCheckoutOpened(true);

  const resendConfirmationEmail = async () => {
    if (!bookingState.propertyId || booking.status !== 'CONFIRMED') return;

    if (isMissing(booking.email)) {
      showToast({
        color: 'yellow',
        title: 'Guest email required',
        message: 'Add the guest email address before sending the booking confirmation.',
      });
      return;
    }

    setIsSendingConfirmation(true);

    try {
      const result = await resendReservationConfirmationEmail(
        bookingState.propertyId,
        booking.backendId,
      );

      if (!result.queued) {
        showToast({
          color: 'yellow',
          title: 'Confirmation email not queued',
          message: result.message || 'StayOS could not queue the booking confirmation email.',
        });
        return;
      }

      showToast({
        color: 'green',
        title: 'Confirmation email queued',
        message: `StayOS is sending the booking confirmation to ${booking.email}.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to send confirmation email',
        message:
          error instanceof Error
            ? error.message
            : 'StayOS could not queue the booking confirmation email.',
      });
    } finally {
      setIsSendingConfirmation(false);
    }
  };

  const resendFinalInvoice = async () => {
    if (!bookingState.propertyId || booking.status !== 'CHECKED_OUT') return;

    if (isMissing(booking.email)) {
      showToast({
        color: 'yellow',
        title: 'Guest email required',
        message: 'Add the guest email address before sending the final invoice.',
      });
      return;
    }

    setIsSendingFinalInvoice(true);

    try {
      const result = await resendFinalInvoiceEmail(bookingState.propertyId, booking.backendId);

      if (!result.queued) {
        showToast({
          color: 'yellow',
          title: 'Final invoice email not queued',
          message: result.message || 'StayOS could not queue the final invoice email.',
        });
        return;
      }

      showToast({
        color: 'green',
        title: 'Final invoice email queued',
        message: `StayOS is sending the final invoice to ${booking.email}.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to send final invoice email',
        message:
          error instanceof Error
            ? error.message
            : 'StayOS could not queue the final invoice email.',
      });
    } finally {
      setIsSendingFinalInvoice(false);
    }
  };

  const saveGuestField = async (field: 'phone' | 'email' | 'nationality', value: string) => {
    if (!bookingState.propertyId || !booking.guestId) return;
    try {
      await updatePropertyGuest(bookingState.propertyId, booking.guestId, { [field]: value });
      await bookingState.refreshBooking();
      showToast({
        color: 'green',
        title: 'Guest updated',
        message: `${field[0].toUpperCase()}${field.slice(1)} saved.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to update guest',
        message: friendlyGuestError(error),
      });
    }
  };

  return (
    <Stack gap={spacing[3]}>
      {bookingState.isFallback && bookingState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so this booking is sample data.
        </Alert>
      ) : null}

      <Card radius={radius.lg} p={20} style={cardStyle}>
        <Group justify="space-between" align="flex-start" gap={spacing[4]}>
          <Stack gap={8}>
            <Group gap={12}>
              <Button
                component={Link}
                href="/reservations"
                variant="subtle"
                color="gray"
                leftSection={<ChevronLeft size={16} />}
                px={0}
                w="fit-content"
              >
                Back to Bookings
              </Button>
              <Button
                component={Link}
                href="/"
                variant="subtle"
                color="gray"
                leftSection={<ChevronLeft size={16} />}
                px={0}
                w="fit-content"
              >
                Back to Front Desk
              </Button>
            </Group>
            <Group gap={8}>
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={booking.paymentStatus} />
              {booking.isVip ? (
                <Text c="#7c3aed" size="xs" fw={800}>
                  VIP
                </Text>
              ) : null}
            </Group>

            <Title order={1} c="#101828" style={{ fontSize: 34, fontWeight: 800 }}>
              {booking.guestName}
            </Title>

            <Text c="#64748b" size="sm" fw={650}>
              Booking {booking.bookingId}
            </Text>

            <Group gap={8} wrap="wrap">
              <Text c="#334155" fw={700} size="sm">
                {booking.room === 'Unassigned'
                  ? 'Room unassigned'
                  : `${booking.room} · ${booking.roomType}`}
              </Text>
              <Text c="#94a3b8" size="sm">
                ·
              </Text>
              <Text c="#64748b" size="sm">
                {formatHeaderStayDates(booking.arrivalDate, booking.departureDate)}
              </Text>
              <Text c="#94a3b8" size="sm">
                ·
              </Text>
              <Text c="#334155" fw={650} size="sm">
                {booking.nights} {booking.nights === 1 ? 'night' : 'nights'}
              </Text>
              {folioSummary && folioSummary.balance > 0.01 ? (
                <>
                  <Text c="#94a3b8" size="sm">
                    ·
                  </Text>
                  <Text c="#c2410c" fw={750} size="sm">
                    {formatCurrency(folioSummary.balance)} balance
                  </Text>
                </>
              ) : null}
            </Group>
          </Stack>
          <Group gap={8}>
            {booking.status === 'CHECKED_IN' ? (
              <Button
                component={Link}
                href={`/guest-stay/${booking.backendId}`}
                color="stayosBrand"
              >
                Open Stay
              </Button>
            ) : booking.status === 'CONFIRMED' && booking.room !== 'Unassigned' ? (
              <>
                {!assignedRoomUnavailable && !futureArrival ? (
                  <Button
                    component={Link}
                    href={`/reservations/${booking.backendId}/check-in`}
                    color="stayosBrand"
                  >
                    Start Check In
                  </Button>
                ) : futureArrival ? (
                  <Button color="stayosBrand" disabled>
                    Check-In Available {formatStayDate(booking.arrivalDate)}
                  </Button>
                ) : null}
                <Button
                  variant={assignedRoomUnavailable ? 'filled' : 'light'}
                  color="stayosBrand"
                  leftSection={<MoveRight size={16} />}
                  disabled={isActing}
                  onClick={() => setChangeOpened(true)}
                  data-testid="change-room-open"
                >
                  Change Room
                </Button>
              </>
            ) : booking.status === 'PENDING' ? (
              <Button
                color="stayosBrand"
                loading={isActing}
                onClick={() => void confirmBooking()}
                data-testid="confirm-booking-button"
              >
                Confirm Booking
              </Button>
            ) : canAssignRoom ? (
              <Button color="stayosBrand" disabled={isActing} onClick={() => setAssignOpened(true)}>
                Assign Room
              </Button>
            ) : null}

            {canEditBooking ? (
              <Button
                component={Link}
                href={`/reservations/${booking.backendId}/edit`}
                variant="light"
                color="stayosBrand"
                leftSection={<Edit size={16} />}
              >
                Edit Booking
              </Button>
            ) : null}

            {booking.status === 'CHECKED_IN' || booking.status === 'CONFIRMED' ? (
              <Button
                variant="light"
                color="stayosBrand"
                leftSection={<Plus size={16} />}
                disabled={isActing}
                onClick={() => setExtendOpened(true)}
                data-testid="extend-stay-open"
              >
                Extend Stay
              </Button>
            ) : null}

            {booking.status === 'CHECKED_IN' ? (
              <Button
                variant="light"
                color="stayosBrand"
                leftSection={<MoveRight size={16} />}
                disabled={isActing}
                onClick={() => setMoveOpened(true)}
                data-testid="move-room-open"
              >
                Move Room
              </Button>
            ) : null}

            {booking.status === 'CONFIRMED' || booking.status === 'CHECKED_OUT' ? (
              <Menu position="bottom-end" shadow="md" width={245}>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    color="gray"
                    leftSection={<MoreHorizontal size={16} />}
                    disabled={isActing || isSendingConfirmation || isSendingFinalInvoice}
                    loading={isSendingConfirmation || isSendingFinalInvoice}
                    data-testid="booking-more-actions"
                  >
                    More
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  {booking.status === 'CONFIRMED' ? (
                    <Menu.Item
                      leftSection={<Mail size={16} />}
                      disabled={isMissing(booking.email) || isSendingConfirmation}
                      onClick={() => void resendConfirmationEmail()}
                      data-testid="send-confirmation-email"
                    >
                      Send confirmation email
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      leftSection={<ReceiptIndianRupee size={16} />}
                      disabled={isMissing(booking.email) || isSendingFinalInvoice}
                      onClick={() => void resendFinalInvoice()}
                      data-testid="send-final-invoice-email"
                    >
                      Send final invoice email
                    </Menu.Item>
                  )}

                  {isMissing(booking.email) ? (
                    <Menu.Label>Add guest email to enable this action</Menu.Label>
                  ) : (
                    <Menu.Label>{booking.email}</Menu.Label>
                  )}
                </Menu.Dropdown>
              </Menu>
            ) : null}

            {canCancel ? (
              <Button
                variant="subtle"
                color="red"
                leftSection={<XCircle size={16} />}
                disabled={isActing}
                onClick={() => setCancelOpened(true)}
                data-testid="cancel-booking-trigger"
              >
                Cancel Booking
              </Button>
            ) : null}
          </Group>
        </Group>
      </Card>

      {isReadOnlyBooking ? (
        <Alert
          color={booking.status === 'CANCELLED' ? 'red' : 'gray'}
          variant="light"
          radius={radius.lg}
          icon={<AlertCircle size={17} />}
          title={booking.status === 'CANCELLED' ? 'Cancelled booking' : 'Completed stay'}
        >
          {booking.status === 'CANCELLED'
            ? 'This booking is cancelled. Room assignment, check-in, editing and stay actions are no longer available.'
            : 'This stay has been checked out and is now read-only.'}
        </Alert>
      ) : null}

      {futureArrival ? (
        <Alert
          color="blue"
          variant="light"
          radius={radius.lg}
          icon={<CalendarDays size={17} />}
          title="Check-in not available yet"
        >
          This booking is scheduled to arrive on {formatStayDate(booking.arrivalDate)}. Check-in can
          start on the arrival date.
        </Alert>
      ) : null}

      {assignedRoomUnavailable ? (
        <Alert
          color="red"
          variant="light"
          radius={radius.lg}
          icon={<AlertCircle size={17} />}
          title={`${booking.room} is unavailable`}
        >
          This room is currently {assignedRoomUiStatus?.toLowerCase() || 'unavailable'}. Change the
          assigned room before starting check-in.
        </Alert>
      ) : null}

      <FrontDeskConsole
        assignedRoomUnavailable={assignedRoomUnavailable}
        assignedRoomUiStatus={assignedRoomUiStatus}
        booking={booking}
        folio={folioSummary}
        isActing={isActing}
        onAssignRoom={() => setAssignOpened(true)}
        onChangeRoom={() => setChangeOpened(true)}
        onCheckOut={openCheckoutFlow}
        onConfirmBooking={confirmBooking}
      />

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[3]}>
        <Stack gap={spacing[3]} style={{ gridColumn: 'span 8' }}>
          <Section title="Guest" icon={<UserRound size={17} />}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Guest name" value={booking.guestName} />
              <DetailTile
                label="Phone"
                value={
                  <GuestFieldEditor
                    disabled={guestFieldsDisabled}
                    field="phone"
                    label="Phone"
                    onSave={saveGuestField}
                    value={formatPhoneForDisplay(booking.phone)}
                  />
                }
              />
              <DetailTile
                label="Email"
                value={
                  <GuestFieldEditor
                    disabled={guestFieldsDisabled}
                    field="email"
                    label="Email"
                    onSave={saveGuestField}
                    value={booking.email}
                  />
                }
              />
              <DetailTile
                label="Nationality"
                value={
                  <GuestFieldEditor
                    disabled={guestFieldsDisabled}
                    field="nationality"
                    label="Nationality"
                    onSave={saveGuestField}
                    value={booking.nationality}
                  />
                }
              />
            </SimpleGrid>
            <Button
              component={Link}
              href={booking.guestId ? `/guests/${booking.guestId}` : '/guests'}
              mt={spacing[3]}
              variant="light"
              color="stayosBrand"
            >
              Open Guest Profile
            </Button>
          </Section>

          <Section title="Stay Details" icon={<CalendarDays size={17} />}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
              <DetailTile label="Arrival date" value={formatStayDate(booking.arrivalDate)} />
              <DetailTile label="Departure date" value={formatStayDate(booking.departureDate)} />
              <DetailTile
                label="Length of stay"
                value={`${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'}`}
              />
              <DetailTile label="Adults" value={`${booking.adults}`} />
              <DetailTile label="Children" value={`${booking.children}`} />
              <DetailTile label="Room type" value={booking.roomType} />
              <DetailTile label="Assigned room" value={booking.room} />
              <DetailTile label="Source" value={sourceLabel(booking.source)} />
              <DetailTile label="Special requests" value={booking.specialRequests || 'None'} />
            </SimpleGrid>
          </Section>

          {booking.status === 'CHECKED_IN' || canAssignRoom || canChangeRoom ? (
            <Section title="Room Assignment" icon={<BedDouble size={17} />}>
              {booking.status === 'CHECKED_IN' ? (
                <Alert color="blue" variant="light" radius={radius.md}>
                  Room changes after check-in should happen from Stay.
                </Alert>
              ) : canChangeRoom ? (
                <Stack gap={spacing[3]}>
                  {assignedRoomUnavailable ? (
                    <Alert color="red" variant="light" radius={radius.md}>
                      {booking.room} is {assignedRoomUiStatus?.toLowerCase() || 'unavailable'} and
                      cannot be used for check-in.
                    </Alert>
                  ) : null}
                  <Group justify="space-between" align="center">
                    <Box>
                      <Text c="#64748b" size="xs" fw={650}>
                        Current room
                      </Text>
                      <Group gap={8}>
                        <Text c="#101828" size="sm" fw={750}>
                          {booking.room} · {booking.roomType}
                        </Text>
                        {assignedRoomUnavailable ? (
                          <Badge color="red" variant="light">
                            {assignedRoomUiStatus || 'Unavailable'}
                          </Badge>
                        ) : null}
                      </Group>
                    </Box>
                    <Button
                      variant={assignedRoomUnavailable ? 'filled' : 'light'}
                      color="stayosBrand"
                      leftSection={<MoveRight size={16} />}
                      disabled={isActing}
                      onClick={() => setChangeOpened(true)}
                    >
                      Change Room
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Button color="stayosBrand" onClick={() => setAssignOpened(true)}>
                  Assign Room
                </Button>
              )}
            </Section>
          ) : null}
        </Stack>

        <Stack gap={spacing[3]} style={{ gridColumn: 'span 4' }}>
          <Section title="Payment" icon={<CreditCard size={17} />}>
            <Stack gap={spacing[2]}>
              <PaymentStatusBadge status={booking.paymentStatus} />
              {folioSummary ? (
                <Paper
                  radius={radius.md}
                  p={14}
                  style={{
                    background: folioSummary.balance > 0.01 ? '#fff7ed' : '#f0fdf4',
                    border: `1px solid ${folioSummary.balance > 0.01 ? '#fed7aa' : '#bbf7d0'}`,
                  }}
                >
                  <Text
                    c={folioSummary.balance > 0.01 ? '#9a3412' : '#166534'}
                    size="xs"
                    fw={900}
                    tt="uppercase"
                  >
                    {folioSummary.balance > 0.01 ? 'Balance to collect' : 'Balance clear'}
                  </Text>
                  <Text
                    c={folioSummary.balance > 0.01 ? '#c2410c' : '#166534'}
                    fw={950}
                    style={{ fontSize: 30, lineHeight: 1.1 }}
                  >
                    {formatCurrency(folioSummary.balance)}
                  </Text>
                  <SimpleGrid cols={2} spacing={8} mt={12}>
                    <Paper
                      radius={radius.sm}
                      p={8}
                      style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                    >
                      <Text c="#64748b" size="xs" fw={650}>
                        Paid
                      </Text>
                      <Text c="#166534" size="sm" fw={700}>
                        {formatCurrency(folioSummary.paid)}
                      </Text>
                    </Paper>
                    <Paper
                      radius={radius.sm}
                      p={8}
                      style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                    >
                      <Text c="#64748b" size="xs" fw={650}>
                        Total
                      </Text>
                      <Text c="#101828" size="sm" fw={700}>
                        {formatCurrency(folioSummary.total)}
                      </Text>
                    </Paper>
                  </SimpleGrid>
                </Paper>
              ) : null}
              <Text c="#475569" size="sm">
                {folioSummary && folioSummary.balance > 0.01 && folioSummary.paid <= 0.01
                  ? `No payment recorded yet. Collect ${formatCurrency(folioSummary.total)} during check-in.`
                  : folioSummary && folioSummary.balance > 0.01 && folioSummary.paid > 0.01
                    ? booking.status === 'CONFIRMED'
                      ? `${formatCurrency(folioSummary.paid)} already collected. The remaining ${formatCurrency(folioSummary.balance)} will be handled during check-in.`
                      : `${formatCurrency(folioSummary.paid)} already collected. Collect only the remaining ${formatCurrency(folioSummary.balance)}.`
                    : booking.paymentStatus === 'PAID'
                      ? 'Paid during booking. At check-in, review the payment and do not collect again.'
                      : booking.paymentStatus === 'PARTIALLY_PAID'
                        ? 'Advance received. Collect only the remaining balance from the folio.'
                        : 'No payment recorded yet. Collect during check-in after ID verification.'}
              </Text>
              {booking.status === 'CHECKED_IN' && booking.paymentStatus !== 'PAID' ? (
                <Button
                  component={Link}
                  href={folioId ? `/billing/${folioId}` : '/billing'}
                  data-testid="booking-collect-payment"
                  color="stayosBrand"
                  leftSection={<ReceiptIndianRupee size={16} />}
                >
                  {booking.paymentStatus === 'PARTIALLY_PAID'
                    ? 'Collect balance'
                    : 'Collect payment'}
                </Button>
              ) : booking.status !== 'CHECKED_IN' && booking.paymentStatus !== 'PAID' && folioId ? (
                <Button
                  component={Link}
                  href={`/billing/${folioId}`}
                  data-testid="booking-collect-payment"
                  variant="light"
                  color="stayosBrand"
                  leftSection={<ReceiptIndianRupee size={16} />}
                >
                  Open folio
                </Button>
              ) : folioId ? (
                <Button
                  component={Link}
                  href={`/billing/${folioId}`}
                  variant="light"
                  color="stayosBrand"
                  leftSection={<ReceiptIndianRupee size={16} />}
                >
                  View folio
                </Button>
              ) : null}
            </Stack>
          </Section>
          <Section title="Notes" icon={<NotebookText size={17} />}>
            <Text size="sm" c="#334155">
              {booking.notes}
            </Text>
          </Section>
          <Section title="Activity" icon={<IdCard size={17} />}>
            <Stack gap={spacing[2]}>
              <Text size="sm" c="#334155">
                {booking.status === 'CANCELLED'
                  ? 'Booking cancelled. Its inventory entitlement has been released.'
                  : booking.status === 'NO_SHOW'
                    ? 'Marked as no-show. Its inventory entitlement has been released.'
                    : booking.status === 'PENDING'
                      ? 'On hold. Inventory is reserved while this booking remains pending.'
                      : booking.room !== 'Unassigned'
                        ? 'Room assigned and booking confirmed.'
                        : 'Booking confirmed. Room assignment pending.'}
              </Text>
              <Text size="xs" c="#64748b">
                {bookingStatusLabel(booking.status)} · {paymentStatusLabel(booking.paymentStatus)}
              </Text>
            </Stack>
          </Section>
        </Stack>
      </SimpleGrid>

      <Modal
        opened={cancelOpened}
        onClose={() => setCancelOpened(false)}
        centered
        title="Cancel booking?"
      >
        <Stack gap={spacing[4]}>
          <Text>
            This will cancel the booking and release its inventory entitlement. Any existing room
            assignment is retained in reservation history for audit purposes. This cannot be used
            after check-in.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCancelOpened(false)}>
              Keep Booking
            </Button>
            <Button
              color="red"
              loading={isActing}
              onClick={() => void cancelBooking()}
              data-testid="cancel-confirm-button"
            >
              Cancel Booking
            </Button>
          </Group>
        </Stack>
      </Modal>

      {canAssignRoom ? (
        <AssignRoomModal
          booking={booking}
          loading={isActing}
          opened={assignOpened}
          onAssign={assignRoom}
          onClose={() => setAssignOpened(false)}
          onLoadRooms={bookingState.getRooms}
        />
      ) : null}
      {canChangeRoom ? (
        <AssignRoomModal
          booking={booking}
          loading={isActing}
          mode="change"
          opened={changeOpened}
          onAssign={changeRoom}
          onClose={() => setChangeOpened(false)}
          onLoadRooms={bookingState.getRooms}
        />
      ) : null}
      <AssignRoomModal
        booking={booking}
        loading={isActing}
        mode="move"
        opened={moveOpened}
        onAssign={moveRoom}
        onClose={() => setMoveOpened(false)}
        onLoadRooms={bookingState.getRooms}
      />
      {bookingState.propertyId &&
      (booking.status === 'CHECKED_IN' || booking.status === 'CONFIRMED') ? (
        <ExtendStayModal
          opened={extendOpened}
          onClose={() => setExtendOpened(false)}
          propertyId={bookingState.propertyId}
          reservationId={booking.backendId}
          currentDeparture={booking.departureDate}
          onExtended={async () => {
            await bookingState.refreshBooking();
          }}
        />
      ) : null}
      {bookingState.propertyId ? (
        <CheckoutModal
          opened={checkoutOpened}
          onClose={() => setCheckoutOpened(false)}
          propertyId={bookingState.propertyId}
          reservationId={booking.backendId}
          guestName={booking.guestName || 'Guest'}
          onConfirmCheckout={checkOutBooking}
        />
      ) : null}
    </Stack>
  );
}
