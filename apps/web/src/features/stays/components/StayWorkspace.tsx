'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
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
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  AlertCircle,
  BedDouble,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  DoorOpen,
  FileText,
  IdCard,
  MessageSquare,
  NotebookText,
  ReceiptText,
  RefreshCw,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, GenericError, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { useStayWorkspace } from '../hooks/useStayWorkspace';
import type { Stay } from '../types/stay.types';
import { formatDisplayDate } from '../utils/stay-formatters';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

type SectionKey = 'guest' | 'room' | 'billing' | 'documents' | 'additionalGuests' | 'preferences' | 'notes' | 'requests' | 'timeline';

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
          <Button component={Link} href="/rooms" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">
            Back to Rooms
          </Button>
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
          <Button disabled={!stay.allowedActions.canCheckOut} color="red" leftSection={<DoorOpen size={16} />} onClick={onCheckOut}>Check Out</Button>
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

function OverviewPanel({ stay }: { stay: Stay }) {
  const items = [
    ['Guest', `${stay.guestName}${stay.isVip ? ' - VIP' : ''}`],
    ['Room', `Room ${stay.roomNumber} - ${stay.roomType}`],
    ['Booking', stay.bookingId],
    ['Payment', stay.billing.paymentStatus],
    ['Current Stay', `${stay.nights} nights, ${stay.remainingNights} remaining`],
    ['Recent Activity', stay.activity[0]?.title ?? 'No activity yet'],
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
      {items.map(([label, value]) => <DetailTile key={label} label={label} value={value} />)}
    </SimpleGrid>
  );
}

function OperationalSection({
  children,
  icon,
  isOpen,
  onToggle,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <Card radius={radius.lg} p={0} style={{ ...cardStyle, overflow: 'hidden' }}>
      <UnstyledButton onClick={onToggle} style={{ display: 'block', padding: 16, width: '100%' }}>
        <Group justify="space-between">
          <Group gap={10}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={34}>{icon}</ThemeIcon>
            <Text c="#101828" fw={800}>{title}</Text>
          </Group>
          <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
        </Group>
      </UnstyledButton>
      {isOpen ? <Box px={16} pb={16}>{children}</Box> : null}
    </Card>
  );
}

function OperationalSections({ onMoveRoom, stay }: { onMoveRoom: () => void; stay: Stay }) {
  const [openSection, setOpenSection] = useState<SectionKey>('guest');
  const toggle = (section: SectionKey) => setOpenSection((current) => (current === section ? 'guest' : section));

  return (
    <Stack gap={spacing[3]}>
      <OperationalSection title="Guest Information" icon={<UserRound size={17} />} isOpen={openSection === 'guest'} onToggle={() => toggle('guest')}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
          <DetailTile label="Phone" value={stay.guestPhone} />
          <DetailTile label="Email" value={stay.guestEmail} />
          <DetailTile label="Nationality" value={stay.nationality} />
          <DetailTile label="Language" value={stay.language} />
          <DetailTile label="VIP" value={stay.isVip ? 'Yes' : 'No'} />
          <DetailTile label="Blacklist" value={stay.blacklistStatus ? 'Yes' : 'No'} />
        </SimpleGrid>
        <Button component={Link} href={stay.guestId ? `/guests/${stay.guestId}` : '/guests'} mt={spacing[3]} variant="light" color="stayosBrand">View Full Guest Profile</Button>
      </OperationalSection>

      <OperationalSection title="Room Information" icon={<BedDouble size={17} />} isOpen={openSection === 'room'} onToggle={() => toggle('room')}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={spacing[3]}>
          <DetailTile label="Room Number" value={stay.roomNumber} />
          <DetailTile label="Room Type" value={stay.roomType} />
          <DetailTile label="Current Status" value={stay.roomStatus} />
          <DetailTile label="Floor" value={stay.floor} />
          <DetailTile label="Current Occupancy" value={`${stay.adults} adult${stay.adults === 1 ? '' : 's'}, ${stay.children} child${stay.children === 1 ? '' : 'ren'}`} />
        </SimpleGrid>
        <Group mt={spacing[3]}><Button disabled={!stay.allowedActions.canMoveRoom} variant="light" color="stayosBrand" onClick={onMoveRoom}>Move Room</Button><Button component={Link} href={stay.roomId ? `/rooms/${stay.roomId}` : '/rooms'} variant="subtle" color="gray">View Room</Button></Group>
      </OperationalSection>

      <OperationalSection title="Billing" icon={<ReceiptText size={17} />} isOpen={openSection === 'billing'} onToggle={() => toggle('billing')}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
          <DetailTile label="Payment Status" value={stay.billing.paymentStatus} />
          <DetailTile label="Outstanding Amount" value={stay.billing.outstandingAmount} />
          <DetailTile label="Deposit" value={stay.billing.deposit} />
          <DetailTile label="Balance" value={stay.billing.balance} />
          <DetailTile label="Room Charges" value={stay.billing.roomCharges} />
          <DetailTile label="Collect Payment" value={<Button disabled size="compact-sm" variant="light" color="gray" leftSection={<CreditCard size={14} />}>Collect Payment</Button>} />
        </SimpleGrid>
        {!stay.billing.isConnected ? <Text c="#64748b" mt={spacing[3]} size="sm">Billing module coming soon.</Text> : null}
      </OperationalSection>

      <OperationalSection title="Documents" icon={<IdCard size={17} />} isOpen={openSection === 'documents'} onToggle={() => toggle('documents')}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          {stay.documents.map((document) => <DetailTile key={document.label} label={document.label} value={document.status} />)}
        </SimpleGrid>
      </OperationalSection>

      <OperationalSection title="Additional Guests" icon={<UserPlus size={17} />} isOpen={openSection === 'additionalGuests'} onToggle={() => toggle('additionalGuests')}>
        {stay.additionalGuests.length > 0 ? (
          <Stack gap={spacing[2]}>{stay.additionalGuests.map((guest) => <DetailTile key={guest} label="Occupant" value={guest} />)}</Stack>
        ) : (
          <Text c="#64748b" size="sm">No additional guests added.</Text>
        )}
      </OperationalSection>

      <OperationalSection title="Preferences" icon={<Sparkles size={17} />} isOpen={openSection === 'preferences'} onToggle={() => toggle('preferences')}>
        {stay.preferences.length > 0 ? (
          <Group gap={8}>{stay.preferences.map((item) => <Badge key={item} color="stayosBrand" variant="light" radius={radius.full}>{item}</Badge>)}</Group>
        ) : (
          <Text c="#64748b" size="sm">No preferences recorded.</Text>
        )}
      </OperationalSection>

      <OperationalSection title="Notes" icon={<NotebookText size={17} />} isOpen={openSection === 'notes'} onToggle={() => toggle('notes')}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <DetailTile label="Guest Notes" value={stay.guestNotes} />
          <DetailTile label="Internal Staff Notes" value={stay.internalNotes} />
        </SimpleGrid>
      </OperationalSection>

      <OperationalSection title="Requests" icon={<MessageSquare size={17} />} isOpen={openSection === 'requests'} onToggle={() => toggle('requests')}>
        {stay.requests.length > 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
            {stay.requests.map((request) => <DetailTile key={request} label={request} value="Requested" />)}
          </SimpleGrid>
        ) : (
          <Text c="#64748b" size="sm">No guest requests recorded. Future request integrations will appear here.</Text>
        )}
      </OperationalSection>

      <OperationalSection title="Timeline" icon={<FileText size={17} />} isOpen={openSection === 'timeline'} onToggle={() => toggle('timeline')}>
        {stay.activity.length > 0 ? (
          <Stack gap={spacing[2]}>
            {stay.activity.map((item) => <DetailTile key={`${item.timestamp}-${item.title}`} label={`${item.timestamp} - ${item.title}`} value={item.detail} />)}
          </Stack>
        ) : (
          <Text c="#64748b" size="sm">No activity has been recorded for this stay yet.</Text>
        )}
      </OperationalSection>
    </Stack>
  );
}

export default function StayWorkspace() {
  const params = useParams<{ stayId?: string }>();
  const router = useRouter();
  const backend = useBackendStatus();
  const enabled = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const stayState = useStayWorkspace({ enabled, stayId: params.stayId });
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [extendOpened, setExtendOpened] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (backend.status === 'SERVER_STARTING') return <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (!backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />;
  if (stayState.error && !stayState.isLoading && !stayState.stay) return <GenericError onAction={() => void stayState.refreshStay()} onCheckStatus={checkBackendStatus} />;
  if (!stayState.stay) return <Alert color="blue" variant="light" icon={<DoorOpen size={17} />} radius={radius.lg}>Loading stay workspace...</Alert>;

  const stay = stayState.stay;

  const moveRoom = () => {
    showToast({ color: 'blue', title: 'Move room', message: 'Use Rooms to change an assigned room before check-out.' });
    router.push('/rooms');
  };

  const checkOut = async () => {
    setIsCheckingOut(true);
    try {
      await stayState.checkOutStay();
      showToast({ color: 'green', title: 'Guest checked out', message: 'Guest checked out successfully.' });
      setCheckoutOpened(false);
      router.push('/rooms');
    } catch {
      showToast({ color: 'red', title: 'Check out failed', message: 'Unable to check out this guest. Please try again.' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Stack gap={spacing[3]}>
      {stayState.error ? <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>{stayState.error}</Alert> : null}
      <StayHeader stay={stay} onMoveRoom={moveRoom} onExtendStay={() => setExtendOpened(true)} onCheckOut={() => setCheckoutOpened(true)} />
      <AttentionPanel stay={stay} />
      <Card radius={radius.lg} p={16} style={cardStyle}>
        <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>Overview</Title>
        <Box mt={spacing[3]}><OverviewPanel stay={stay} /></Box>
      </Card>
      <OperationalSections stay={stay} onMoveRoom={moveRoom} />

      <Modal opened={checkoutOpened} onClose={() => setCheckoutOpened(false)} centered title="Check out guest?">
        <Stack gap={spacing[4]}>
          <Text>This keeps the existing confirmation flow for now. TODO: Future Checkout Workspace.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCheckoutOpened(false)}>Cancel</Button>
            <Button color="red" loading={isCheckingOut} onClick={() => void checkOut()}>Check Out</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={extendOpened} onClose={() => setExtendOpened(false)} centered title="Extend stay">
        <Stack gap={spacing[4]}>
          <TextInput label="New departure date" placeholder="Select date in future workspace" disabled />
          <Text c="#64748b" size="sm">TODO: Extend Stay workflow will save a new departure date here.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setExtendOpened(false)}>Close</Button>
            <Button disabled color="stayosBrand">Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
