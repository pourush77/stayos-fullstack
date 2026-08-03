'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  DoorOpen,
  FileText,
  IdCard,
  MessageSquare,
  ReceiptText,
  RefreshCw,
  UserRound,
  Plus,
  Utensils,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { useAuth } from '../../auth/auth-context';
import { getAvailableRooms, type OperationsAvailableRoomDto } from '../../../lib/operations-api';
import { extendReservationStay, moveReservationRoom } from '../../../lib/reservation-api';
import { useStayWorkspace } from '../hooks/useStayWorkspace';
import { StayBillingPanel } from './StayBillingPanel';
import type { Stay } from '../types/stay.types';
import { formatDisplayDate } from '../utils/stay-formatters';
import { createGuestRequest, listGuestRequests, transitionGuestRequest, type GuestRequestDto, type GuestRequestSuggestionDto } from '../../requests/api/guest-requests-api';
import { CreateRequestDrawer } from '../../requests/components/CreateRequestDrawer';
import { RequestCard } from '../../requests/components/RequestCard';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function DetailTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <Text c="#64748b" size="xs" fw={700}>{label}</Text>
      <Text c="#182230" mt={3} size="sm" fw={700}>{value}</Text>
    </Paper>
  );
}

function StayHeader({
  onCheckOut,
  onExtendStay,
  onMoveRoom,
  stay,
}: {
  onCheckOut: () => void;
  onExtendStay: () => void;
  onMoveRoom: () => void;
  stay: Stay;
}) {
  return (
    <Card radius={radius.lg} p={20} style={cardStyle}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Stack gap={8}>
          <Group gap={12}>
            <Button component={Link} href="/rooms" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">
              Back to Rooms
            </Button>
            <Button component={Link} href="/" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">
              Back to Front Desk
            </Button>
          </Group>
          <Group gap={8}>
            <Badge color="blue" variant="light" radius={radius.full}>{stay.status}</Badge>
            {stay.isVip ? <Badge color="stayosBrand" variant="light" radius={radius.full}>VIP</Badge> : null}
            <Badge color={stay.paymentStatus === 'Paid' ? 'green' : 'red'} variant="light" radius={radius.full}>{stay.paymentStatus}</Badge>
          </Group>
          <Title order={1} c="#101828" style={{ fontSize: 34, fontWeight: 800 }}>{stay.guestName}</Title>
          <Text c="#334155" size="sm" fw={700}>Room {stay.roomNumber} - {stay.roomType}</Text>
          <Group gap={spacing[4]} wrap="wrap">
            <Text c="#64748b" size="sm">Arrival: {formatDisplayDate(stay.arrivalDate)}</Text>
            <Text c="#64748b" size="sm">Departure: {formatDisplayDate(stay.departureDate)}</Text>
            <Text c="#64748b" size="sm">Remaining nights: {stay.remainingNights}</Text>
            <Text c="#64748b" size="sm">Booking: {stay.bookingId}</Text>
          </Group>
        </Stack>
        <Group gap={8}>
          <Button disabled={!stay.allowedActions.canMoveRoom} variant="light" color="stayosBrand" leftSection={<RefreshCw size={16} />} onClick={onMoveRoom}>Move Room</Button>
          <Button disabled={!stay.allowedActions.canExtendStay} variant="light" color="stayosBrand" onClick={onExtendStay}>Extend Stay</Button>
          <Button disabled={!stay.allowedActions.canCheckOut} color="red" leftSection={<DoorOpen size={16} />} onClick={onCheckOut}>
            {stay.paymentStatus === 'Paid' ? 'Check Out' : 'Settle & Check Out'}
          </Button>
        </Group>
      </Group>
    </Card>
  );
}

function AttentionPanel({ stay }: { stay: Stay }) {
  return (
    <Card radius={radius.lg} p={16} style={cardStyle}>
      <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>What Needs Attention</Title>
      {stay.warnings.length === 0 ? (
        <Paper mt={spacing[3]} radius={radius.md} p={14} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Text c="#15803d" fw={700}>Everything looks good.</Text>
        </Paper>
      ) : (
        <SimpleGrid mt={spacing[3]} cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
          {stay.warnings.map((item) => (
            <Paper key={item.title} radius={radius.md} p={14} style={{ background: item.tone === 'danger' ? '#fef2f2' : item.tone === 'warning' ? '#fffbeb' : '#eff6ff', border: '1px solid #e2e8f0' }}>
              <Text c="#101828" fw={800} size="sm">{item.title}</Text>
              <Text c="#64748b" mt={4} size="xs">{item.detail}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      )}
    </Card>
  );
}

function OperationalSections({
  billingReservationId,
  billingPropertyId,
  billingReloadSignal,
  canManageBilling,
  canViewBilling,
  billingSectionRef,
  onFolioChanged,
  onOpenRequest,
  onMoveRoom,
  onRequestTransition,
  completedRequests,
  requests,
  stay,
}: {
  billingReservationId: string;
  billingPropertyId: string;
  billingReloadSignal: number;
  canManageBilling: boolean;
  canViewBilling: boolean;
  billingSectionRef: RefObject<HTMLDivElement | null>;
  onFolioChanged: () => void;
  onOpenRequest: (suggestion?: GuestRequestSuggestionDto) => void;
  onMoveRoom: () => void;
  onRequestTransition: (requestId: string, action: 'accept' | 'start' | 'complete' | 'cancel') => void;
  completedRequests: GuestRequestDto[];
  requests: GuestRequestDto[];
  stay: Stay;
}) {
  const [showMore, setShowMore] = useState(false);
  const hasAdditionalGuests = stay.additionalGuests.length > 0;
  const hasPreferences = stay.preferences.length > 0;
  const hasRequests = stay.requests.length > 0;
  const hasNotes = Boolean(stay.guestNotes || stay.internalNotes);
  const hasActivity = stay.activity.length > 0;

  return (
    <Stack gap={spacing[3]}>
      {/* Billing — always visible, this is the busiest tool for the front desk */}
      <Card radius={radius.lg} p={16} style={cardStyle}>
        <Group justify="space-between" align="flex-start" gap={spacing[4]}>
          <Stack gap={6}>
            <Group gap={10}>
              <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}><MessageSquare size={17} /></ThemeIcon>
              <Text c="#101828" fw={800}>Guest service</Text>
            </Group>
            <Text c="#64748b" size="sm">
              Requests create tasks for teams. Restaurant, minibar, laundry, and paid extras should be posted as folio charges.
            </Text>
          </Stack>
          <Group gap={8}>
            <Button color="stayosBrand" leftSection={<Plus size={16} />} onClick={() => onOpenRequest()}>
              Add Request
            </Button>
            <Button
              variant="light"
              color="stayosBrand"
              leftSection={<Utensils size={16} />}
              onClick={() => document.querySelector<HTMLElement>('[data-testid="folio-add-charge"]')?.click()}
            >
              Post Food Charge
            </Button>
          </Group>
        </Group>
        <Group mt={spacing[3]} gap={8}>
          {[
            { title: 'Extra Towels', department: 'HOUSEKEEPING' as const },
            { title: 'Slippers', department: 'HOUSEKEEPING' as const },
            { title: 'Room Cleaning', department: 'HOUSEKEEPING' as const },
            { title: 'Water Bottles', department: 'HOUSEKEEPING' as const },
          ].map((suggestion) => (
            <Button key={suggestion.title} size="xs" variant="light" color="gray" onClick={() => onOpenRequest(suggestion)}>
              {suggestion.title}
            </Button>
          ))}
        </Group>
        {requests.length > 0 ? (
          <Stack mt={spacing[3]} gap={spacing[2]}>
            <Text c="#64748b" size="xs" fw={700} tt="uppercase">Open requests</Text>
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} onTransition={onRequestTransition} />
            ))}
          </Stack>
        ) : null}
        {completedRequests.length > 0 ? (
          <Stack mt={spacing[3]} gap={spacing[2]}>
            <Text c="#64748b" size="xs" fw={700} tt="uppercase">Recently completed</Text>
            {completedRequests.slice(0, 3).map((request) => (
              <Paper key={request.id} radius={radius.md} p={12} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <Group justify="space-between" gap={spacing[3]}>
                  <Box>
                    <Text c="#101828" size="sm" fw={800}>Room {request.roomNumber ?? stay.roomNumber} - {request.title}</Text>
                    <Text c="#64748b" size="xs">
                      Completed by {request.assignedEmployeeName ?? 'housekeeping'} for {request.guestDisplayName ?? stay.guestName}
                    </Text>
                  </Box>
                  <Badge color="green" variant="light" radius={radius.full}>Completed</Badge>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : null}
      </Card>

      <Card ref={billingSectionRef} radius={radius.lg} p={0} style={{ ...cardStyle, overflow: 'hidden' }}>
        <Group justify="space-between" align="center" p={16} style={{ borderBottom: '1px solid #eef2f7' }}>
          <Group gap={10}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}><ReceiptText size={17} /></ThemeIcon>
            <Text c="#101828" fw={800}>Billing &amp; payments</Text>
          </Group>
          <Text c="#94a3b8" size="xs">Add charges, collect payments, download receipts</Text>
        </Group>
        <Box p={16}>
          {billingReservationId && billingPropertyId ? (
            <StayBillingPanel
              canManage={canManageBilling}
              canView={canViewBilling}
              propertyId={billingPropertyId}
              reloadSignal={billingReloadSignal}
              reservationId={billingReservationId}
              onFolioChanged={onFolioChanged}
            />
          ) : (
            <Text c="#64748b" size="sm">Billing unavailable for this stay.</Text>
          )}
        </Box>
      </Card>

      {/* Compact quick-facts strip — Guest + Room in one card */}
      <Card radius={radius.lg} p={16} style={cardStyle}>
        <Group justify="space-between" align="center" mb={12}>
          <Group gap={10}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={30}><UserRound size={16} /></ThemeIcon>
            <Text c="#101828" fw={800}>Guest &amp; room quick facts</Text>
          </Group>
          <Button
            component={Link}
            href={stay.guestId ? `/guests/${stay.guestId}` : '/guests'}
            size="xs"
            variant="light"
            color="stayosBrand"
            data-testid="view-full-guest-profile"
          >
            Full guest profile →
          </Button>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing={spacing[3]}>
          <DetailTile label="Phone" value={stay.guestPhone || '—'} />
          <DetailTile label="Email" value={stay.guestEmail || '—'} />
          <DetailTile label="Nationality" value={stay.nationality || '—'} />
          <DetailTile label="Language" value={stay.language || '—'} />
          <DetailTile label="VIP" value={stay.isVip ? 'Yes' : 'No'} />
          <DetailTile label="Room type" value={stay.roomType || '—'} />
          <DetailTile label="Floor" value={stay.floor || '—'} />
          <DetailTile label="Room status" value={stay.roomStatus || '—'} />
          <DetailTile label="Occupancy" value={`${stay.adults} adult${stay.adults === 1 ? '' : 's'}${stay.children ? `, ${stay.children} child${stay.children === 1 ? '' : 'ren'}` : ''}`} />
        </SimpleGrid>
        <Group mt={spacing[3]} gap={8}>
          <Button disabled={!stay.allowedActions.canMoveRoom} variant="light" color="stayosBrand" size="xs" onClick={onMoveRoom}>Move Room</Button>
          <Button component={Link} href={stay.roomId ? `/rooms/${stay.roomId}` : '/rooms'} variant="subtle" color="gray" size="xs">View Room</Button>
        </Group>
      </Card>

      {/* Documents — visible if there's anything to show */}
      {stay.documents.length > 0 ? (
        <Card radius={radius.lg} p={16} style={cardStyle}>
          <Group gap={10} mb={12}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={30}><IdCard size={16} /></ThemeIcon>
            <Text c="#101828" fw={800}>Documents</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
            {stay.documents.map((document) => <DetailTile key={document.label} label={document.label} value={document.status} />)}
          </SimpleGrid>
        </Card>
      ) : null}

      {/* More details — collapsed by default. Hides the noisy empty sections. */}
      {(hasAdditionalGuests || hasPreferences || hasRequests || hasNotes || hasActivity) ? (
        <Card radius={radius.lg} p={0} style={{ ...cardStyle, overflow: 'hidden' }}>
          <UnstyledButton
            onClick={() => setShowMore((v) => !v)}
            style={{ display: 'block', padding: 14, width: '100%' }}
            data-testid="stay-more-details-toggle"
          >
            <Group justify="space-between">
              <Group gap={10}>
                <ThemeIcon color="gray" variant="light" radius={radius.md} size={30}><FileText size={16} /></ThemeIcon>
                <Text c="#101828" fw={700}>More details</Text>
                <Text c="#94a3b8" size="xs">
                  {[
                    hasAdditionalGuests && `${stay.additionalGuests.length} additional guest${stay.additionalGuests.length === 1 ? '' : 's'}`,
                    hasPreferences && `${stay.preferences.length} preference${stay.preferences.length === 1 ? '' : 's'}`,
                    hasRequests && `${stay.requests.length} request${stay.requests.length === 1 ? '' : 's'}`,
                    hasNotes && 'notes',
                    hasActivity && `${stay.activity.length} activity`,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </Group>
              <ChevronDown size={16} style={{ transform: showMore ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
            </Group>
          </UnstyledButton>
          {showMore ? (
            <Stack gap={spacing[3]} p={16} pt={0}>
              {hasAdditionalGuests ? (
                <Box>
                  <Text c="#64748b" size="xs" fw={700} tt="uppercase" mb={6}>Additional guests</Text>
                  <Stack gap={4}>{stay.additionalGuests.map((g) => <DetailTile key={g} label="Occupant" value={g} />)}</Stack>
                </Box>
              ) : null}
              {hasPreferences ? (
                <Box>
                  <Text c="#64748b" size="xs" fw={700} tt="uppercase" mb={6}>Preferences</Text>
                  <Group gap={8}>{stay.preferences.map((item) => <Badge key={item} color="stayosBrand" variant="light" radius={radius.full}>{item}</Badge>)}</Group>
                </Box>
              ) : null}
              {hasRequests ? (
                <Box>
                  <Text c="#64748b" size="xs" fw={700} tt="uppercase" mb={6}>Requests</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[2]}>
                    {stay.requests.map((request) => <DetailTile key={request} label={request} value="Requested" />)}
                  </SimpleGrid>
                </Box>
              ) : null}
              {hasNotes ? (
                <Box>
                  <Text c="#64748b" size="xs" fw={700} tt="uppercase" mb={6}>Notes</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
                    <DetailTile label="Guest notes" value={stay.guestNotes || '—'} />
                    <DetailTile label="Internal staff notes" value={stay.internalNotes || '—'} />
                  </SimpleGrid>
                </Box>
              ) : null}
              {hasActivity ? (
                <Box>
                  <Text c="#64748b" size="xs" fw={700} tt="uppercase" mb={6}>Timeline</Text>
                  <Stack gap={4}>{stay.activity.map((item) => <DetailTile key={`${item.timestamp}-${item.title}`} label={`${item.timestamp} · ${item.title}`} value={item.detail} />)}</Stack>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Card>
      ) : null}
    </Stack>
  );
}

function roomTypeLabel(room: OperationsAvailableRoomDto) {
  return room.roomType.name || room.roomType.code || 'Room type not recorded';
}

function MoveRoomModal({
  isMoving,
  onClose,
  onConfirm,
  opened,
  reason,
  rooms,
  search,
  selectedRoomId,
  setReason,
  setSearch,
  setSelectedRoomId,
  stay,
}: {
  isMoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
  opened: boolean;
  reason: string;
  rooms: OperationsAvailableRoomDto[];
  search: string;
  selectedRoomId: string;
  setReason: (value: string) => void;
  setSearch: (value: string) => void;
  setSelectedRoomId: (value: string) => void;
  stay: Stay;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleRooms = rooms.filter((room) => {
    if (room.roomId === stay.roomId) return false;
    if (room.operationalStatus !== 'READY' && room.uiStatus !== 'READY') return false;
    if (!normalizedSearch) return true;

    return [room.roomNumber, room.floor.name, room.floor.code, roomTypeLabel(room)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
  const selectedRoom = rooms.find((room) => room.roomId === selectedRoomId);
  const changesRoomType = Boolean(
    selectedRoom && stay.roomTypeId && selectedRoom.roomType.id !== stay.roomTypeId,
  );

  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title="Move room">
      <Stack gap={spacing[4]}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <DetailTile label="Current room" value={`Room ${stay.roomNumber} - ${stay.roomType}`} />
          <DetailTile label="Stay dates" value={`${formatDisplayDate(stay.arrivalDate)} to ${formatDisplayDate(stay.departureDate)}`} />
        </SimpleGrid>
        <TextInput
          label="Search rooms"
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Room number, floor, or type"
          value={search}
        />
        <Stack gap={8} mah={300} style={{ overflowY: 'auto' }}>
          {visibleRooms.length > 0 ? (
            visibleRooms.map((room) => (
              <UnstyledButton
                key={room.roomId}
                onClick={() => setSelectedRoomId(room.roomId)}
                style={{
                  background: selectedRoomId === room.roomId ? '#eef2ff' : '#ffffff',
                  border: selectedRoomId === room.roomId ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                  borderRadius: radius.md,
                  padding: 12,
                  textAlign: 'left',
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text c="#101828" fw={800}>Room {room.roomNumber}</Text>
                    <Text c="#64748b" size="sm">
                      {roomTypeLabel(room)} - {room.floor.name || room.floor.code || 'Floor not recorded'}
                    </Text>
                  </Stack>
                  <Badge color="green" variant="light" radius={radius.full}>Ready</Badge>
                </Group>
              </UnstyledButton>
            ))
          ) : (
            <Alert color="yellow" variant="light" radius={radius.md}>
              No ready rooms match this stay. Adjust the search or check room availability.
            </Alert>
          )}
        </Stack>
        {changesRoomType ? (
          <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.md}>
            This move changes the room type from {stay.roomType} to {selectedRoom ? roomTypeLabel(selectedRoom) : 'the selected room type'}.
          </Alert>
        ) : null}
        <Textarea
          label="Reason"
          maxLength={500}
          minRows={3}
          onChange={(event) => setReason(event.currentTarget.value)}
          placeholder="Optional operational note"
          value={reason}
        />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Close</Button>
          <Button color="stayosBrand" disabled={!selectedRoomId} loading={isMoving} onClick={onConfirm}>Move Room</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function StayWorkspace() {
  const params = useParams<{ stayId?: string }>();
  const router = useRouter();
  const backend = useBackendStatus();
  const auth = useAuth();
  const permissions = auth.user?.permissions ?? [];
  const canViewBilling = permissions.includes('billing.view') || permissions.includes('*');
  const canManageBilling = permissions.includes('billing.manage') || permissions.includes('*');
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const stayState = useStayWorkspace({ enabled, stayId: params.stayId });
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [extendOpened, setExtendOpened] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [extendDepartureDate, setExtendDepartureDate] = useState('');
  const [moveOpened, setMoveOpened] = useState(false);
  const [moveReason, setMoveReason] = useState('');
  const [moveRooms, setMoveRooms] = useState<OperationsAvailableRoomDto[]>([]);
  const [moveSearch, setMoveSearch] = useState('');
  const [selectedMoveRoomId, setSelectedMoveRoomId] = useState('');
  const [requestDrawerOpened, setRequestDrawerOpened] = useState(false);
  const [selectedRequestSuggestion, setSelectedRequestSuggestion] = useState<GuestRequestSuggestionDto | undefined>();
  const [guestRequests, setGuestRequests] = useState<GuestRequestDto[]>([]);
  const [completedGuestRequests, setCompletedGuestRequests] = useState<GuestRequestDto[]>([]);
  const [billingReloadSignal, setBillingReloadSignal] = useState(0);
  const billingSectionRef = useRef<HTMLDivElement | null>(null);

  const loadGuestRequests = useCallback(async () => {
    if (!stayState.propertyId || !params.stayId) return;
    try {
      const items = await listGuestRequests(stayState.propertyId, {});
      const reservationRequests = items.filter((item) => item.reservationId === params.stayId);
      setGuestRequests(reservationRequests.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)));
      setCompletedGuestRequests(reservationRequests.filter((item) => item.status === 'COMPLETED'));
    } catch {
      setGuestRequests([]);
      setCompletedGuestRequests([]);
    }
  }, [params.stayId, stayState.propertyId]);

  useEffect(() => {
    if (enabled) void loadGuestRequests();
  }, [enabled, loadGuestRequests]);

  const refreshAfterFolioChange = useCallback(() => {
    void stayState.refreshStay();
  }, [stayState]);

  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (stayState.error && !stayState.isLoading && !stayState.stay) return <GenericError onAction={() => void stayState.refreshStay()} onCheckStatus={checkBackendStatus} />;
  if (!stayState.stay) return <Alert color="blue" variant="light" icon={<DoorOpen size={17} />} radius={radius.lg}>Loading stay workspace...</Alert>;

  const stay = stayState.stay;
  const hasOutstandingBalance = stay.paymentStatus !== 'Paid';

  const openRequestDrawer = (suggestion?: GuestRequestSuggestionDto) => {
    setSelectedRequestSuggestion(suggestion);
    setRequestDrawerOpened(true);
  };

  const createStayRequest = async (payload: Record<string, unknown>) => {
    if (!stayState.propertyId || !params.stayId) return;
    await createGuestRequest(stayState.propertyId, {
      ...payload,
      guestId: stay.guestId,
      reservationId: params.stayId,
      roomId: stay.roomId,
    });
    await loadGuestRequests();
    showToast({ color: 'green', title: 'Request added', message: 'The team can now pick this up from Guest Requests.' });
  };

  const changeRequestStatus = async (requestId: string, action: 'accept' | 'start' | 'complete' | 'cancel') => {
    if (!stayState.propertyId) return;
    await transitionGuestRequest(stayState.propertyId, requestId, action);
    await loadGuestRequests();
  };

  const openMoveRoom = async () => {
    if (!stayState.propertyId) return;

    setMoveOpened(true);
    setMoveSearch('');
    setMoveReason('');
    setSelectedMoveRoomId('');
    try {
      const rooms = await getAvailableRooms(stayState.propertyId, {
        arrivalDate: stay.arrivalDate,
        departureDate: stay.departureDate,
        guestCount: stay.adults + stay.children,
      });
      setMoveRooms(rooms);
    } catch {
      setMoveRooms([]);
      showToast({ color: 'red', title: 'Rooms unavailable', message: 'Unable to load available rooms.' });
    }
  };

  const moveRoom = async () => {
    if (!stayState.propertyId || !params.stayId || !selectedMoveRoomId) return;

    setIsMoving(true);
    try {
      await moveReservationRoom(stayState.propertyId, params.stayId, selectedMoveRoomId, moveReason);
      await stayState.refreshStay();
      setMoveOpened(false);
      showToast({ color: 'green', title: 'Room moved', message: 'Guest room was updated successfully.' });
    } catch {
      showToast({ color: 'red', title: 'Move room failed', message: 'Unable to move this guest. Check room availability and try again.' });
    } finally {
      setIsMoving(false);
    }
  };

  const checkOut = async () => {
    setIsCheckingOut(true);
    try {
      await stayState.checkOutStay();
      showToast({
        autoClose: 9000,
        color: 'green',
        title: 'Checkout complete',
        message: `${stay.guestName} checked out. Room ${stay.roomNumber} is ready for housekeeping follow-up.`,
      });
      setCheckoutOpened(false);
      const query = new URLSearchParams({
        checkout: 'success',
        guest: stay.guestName,
        room: `Room ${stay.roomNumber}`,
      });
      router.push(`/rooms?${query.toString()}`);
    } catch {
      showToast({ color: 'red', title: 'Check out failed', message: 'Collect the outstanding folio balance before checkout.' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const goToBilling = () => {
    setCheckoutOpened(false);
    window.setTimeout(() => {
      billingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        document.querySelector<HTMLElement>('[data-testid="folio-collect-payment"]')?.click();
      }, 350);
    }, 80);
  };

  const openExtendStay = () => {
    setExtendDepartureDate(stay.departureDate);
    setExtendOpened(true);
  };

  const extendStay = async () => {
    if (!stayState.propertyId || !params.stayId || !extendDepartureDate) return;

    setIsExtending(true);
    try {
      await extendReservationStay(stayState.propertyId, params.stayId, extendDepartureDate);
      await stayState.refreshStay();
      setBillingReloadSignal((value) => value + 1);
      showToast({ color: 'green', title: 'Stay extended', message: `Departure updated to ${formatDisplayDate(extendDepartureDate)}.` });
      setExtendOpened(false);
    } catch {
      showToast({ color: 'red', title: 'Extend stay failed', message: 'Unable to extend this stay. Check room availability and try again.' });
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <Stack gap={spacing[3]}>
      {stayState.error ? <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>{stayState.error}</Alert> : null}
      <StayHeader stay={stay} onMoveRoom={() => void openMoveRoom()} onExtendStay={openExtendStay} onCheckOut={() => setCheckoutOpened(true)} />
      <AttentionPanel stay={stay} />
      <OperationalSections
        billingPropertyId={stayState.propertyId ?? ''}
        billingReservationId={params.stayId ?? ''}
        billingReloadSignal={billingReloadSignal}
        billingSectionRef={billingSectionRef}
        canManageBilling={canManageBilling}
        canViewBilling={canViewBilling}
        completedRequests={completedGuestRequests}
        onFolioChanged={refreshAfterFolioChange}
        onOpenRequest={openRequestDrawer}
        onMoveRoom={() => void openMoveRoom()}
        onRequestTransition={(requestId, action) => void changeRequestStatus(requestId, action)}
        requests={guestRequests}
        stay={stay}
      />

      <CreateRequestDrawer
        context={{
          department: selectedRequestSuggestion?.department ?? 'HOUSEKEEPING',
          guestId: stay.guestId,
          reservationId: params.stayId,
          roomId: stay.roomId,
        }}
        onClose={() => setRequestDrawerOpened(false)}
        onCreate={createStayRequest}
        opened={requestDrawerOpened}
        selected={selectedRequestSuggestion}
      />

      <Modal opened={checkoutOpened} onClose={() => setCheckoutOpened(false)} centered title={hasOutstandingBalance ? 'Settle payment first' : 'Check out guest?'}>
        <Stack gap={spacing[4]} data-testid="stay-checkout-modal">
          <Text c="#64748b" size="sm">
            {hasOutstandingBalance
              ? 'This stay still has a folio balance. Collect payment from Billing & payments, then check out.'
              : 'Confirm checkout. The room will be marked for cleaning and the stay will close.'}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCheckoutOpened(false)}>Cancel</Button>
            {hasOutstandingBalance ? (
              <Button color="stayosBrand" onClick={goToBilling}>Go to Billing</Button>
            ) : (
              <Button color="red" loading={isCheckingOut} onClick={() => void checkOut()}>Check Out</Button>
            )}
          </Group>
        </Stack>
      </Modal>

      <Modal opened={extendOpened} onClose={() => setExtendOpened(false)} centered title="Extend stay">
        <Stack gap={spacing[4]}>
          <TextInput
            label="New departure date"
            min={stay.departureDate}
            onChange={(event) => setExtendDepartureDate(event.currentTarget.value)}
            type="date"
            value={extendDepartureDate}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setExtendOpened(false)}>Close</Button>
            <Button
              color="stayosBrand"
              disabled={!extendDepartureDate || extendDepartureDate <= stay.departureDate}
              loading={isExtending}
              onClick={() => void extendStay()}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <MoveRoomModal
        isMoving={isMoving}
        onClose={() => setMoveOpened(false)}
        onConfirm={() => void moveRoom()}
        opened={moveOpened}
        reason={moveReason}
        rooms={moveRooms}
        search={moveSearch}
        selectedRoomId={selectedMoveRoomId}
        setReason={setMoveReason}
        setSearch={setMoveSearch}
        setSelectedRoomId={setSelectedMoveRoomId}
        stay={stay}
      />
    </Stack>
  );
}
