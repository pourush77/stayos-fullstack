'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Baby, CalendarDays, Copy, Hotel, Pencil, Trash2, Undo2, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties } from '../../lib/guest-api';
import {
  cancelGroupHold,
  createGroupHold,
  type GroupBookingSource,
  getGroupHolds,
  getGroupRoomMixSuggestions,
  type GroupHoldDto,
  type GroupRoomMixOptionDto,
  type GroupRoomMixPreference,
  type GroupRoomMixSuggestionDto,
  releaseGroupHold,
  updateGroupHold,
} from '../../lib/operations-api';

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateToValue(value: Date | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(
    new Date(`${value}T00:00:00`),
  );
}

function optionSummary(option: GroupRoomMixOptionDto) {
  return option.roomBlocks
    .map((block) => `${block.rooms} ${block.roomTypeName}`)
    .join(' + ');
}

function quoteText(option: GroupRoomMixOptionDto, suggestion: GroupRoomMixSuggestionDto) {
  return [
    `Group quote for ${formatDate(suggestion.arrivalDate)} to ${formatDate(suggestion.departureDate)}`,
    `${suggestion.adults} adults, ${suggestion.children} children, ${suggestion.nights} night${suggestion.nights === 1 ? '' : 's'}`,
    `Suggested room mix: ${optionSummary(option)}`,
    `Estimated total: ${formatCurrency(option.estimatedTotal)}`,
    'Reply YES to create a tentative group hold.',
  ].join('\n');
}

function OptionCard({
  option,
  onCreateHold,
  suggestion,
}: {
  onCreateHold: (option: GroupRoomMixOptionDto) => void;
  option: GroupRoomMixOptionDto;
  suggestion: GroupRoomMixSuggestionDto;
}) {
  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(quoteText(option, suggestion));
      showToast({ color: 'green', message: 'Paste it into WhatsApp, SMS, or email.', title: 'Group quote copied' });
    } catch {
      showToast({ color: 'red', message: 'Clipboard is unavailable in this browser context.', title: 'Copy failed' });
    }
  };

  return (
    <Card radius={radius.lg} p={16} style={panelStyle}>
      <Stack gap={spacing[3]}>
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap={8}>
              <Badge color="stayosBrand" variant="light">
                {option.label}
              </Badge>
              <Badge color={option.spareCapacity === 0 ? 'green' : 'yellow'} variant="light">
                {option.spareCapacity} spare capacity
              </Badge>
            </Group>
            <Title order={2} c="#101828" mt={8} style={{ fontSize: 22, fontWeight: 850 }}>
              {optionSummary(option)}
            </Title>
            <Text c="#64748b" size="sm" mt={4}>
              {option.reason}
            </Text>
          </Box>
          <Text c="#101828" fw={850} size="lg">
            {formatCurrency(option.estimatedTotal)}
          </Text>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={8}>
          <Paper radius={radius.md} p={10} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Text c="#64748b" size="xs" fw={700}>Rooms</Text>
            <Text c="#101828" fw={850}>{option.totalRooms}</Text>
          </Paper>
          <Paper radius={radius.md} p={10} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Text c="#64748b" size="xs" fw={700}>Adult cap</Text>
            <Text c="#101828" fw={850}>{option.adultCapacity}</Text>
          </Paper>
          <Paper radius={radius.md} p={10} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Text c="#64748b" size="xs" fw={700}>Child cap</Text>
            <Text c="#101828" fw={850}>{option.childCapacity}</Text>
          </Paper>
          <Paper radius={radius.md} p={10} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Text c="#64748b" size="xs" fw={700}>Total cap</Text>
            <Text c="#101828" fw={850}>{option.totalCapacity}</Text>
          </Paper>
        </SimpleGrid>

        <Stack gap={6}>
          {option.roomBlocks.map((block) => (
            <Group key={block.roomTypeId} justify="space-between">
              <Text c="#334155" size="sm">
                {block.rooms} x {block.roomTypeName}
              </Text>
              <Text c="#64748b" size="sm">
                {block.maxAdults} adults + {block.maxChildren} children per room
              </Text>
            </Group>
          ))}
        </Stack>

        <Group gap={8}>
          <Button leftSection={<Copy size={14} />} color="stayosBrand" onClick={() => void copyQuote()}>
            Copy Quote
          </Button>
          <Button variant="light" color="stayosBrand" onClick={() => onCreateHold(option)}>
            Create Hold
          </Button>
          <Button variant="light" color="gray" disabled>
            Walk-in Group
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function GroupQuotePage() {
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const start = new Date(today().getTime() + 86_400_000);
    const end = new Date(start.getTime() + 172_800_000);
    return [start, end];
  });
  const [adults, setAdults] = useState(10);
  const [children, setChildren] = useState(6);
  const [preference, setPreference] = useState<GroupRoomMixPreference>('BEST_FIT');
  const [suggestion, setSuggestion] = useState<GroupRoomMixSuggestionDto | undefined>();
  const [groupHolds, setGroupHolds] = useState<GroupHoldDto[]>([]);
  const [selectedOption, setSelectedOption] = useState<GroupRoomMixOptionDto | undefined>();
  const [selectedHold, setSelectedHold] = useState<GroupHoldDto | undefined>();
  const [groupName, setGroupName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [source, setSource] = useState<GroupBookingSource>('PHONE');
  const [releaseDate, setReleaseDate] = useState<Date | null>(() => new Date(today().getTime() + 86_400_000));
  const [depositRequired, setDepositRequired] = useState(0);
  const [notes, setNotes] = useState('');
  const [holdNotes, setHoldNotes] = useState('');
  const [isSavingHold, setIsSavingHold] = useState(false);
  const [isUpdatingHold, setIsUpdatingHold] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const canSearch = Boolean(propertyId && arrivalDate && departureDate && adults > 0);

  useEffect(() => {
    const controller = new AbortController();
    getProperties(controller.signal)
      .then((properties) => {
        const active = properties.find((property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ?? properties[0];
        setPropertyId(typeof active?.id === 'string' ? active.id : '');
      })
      .catch(() => setError('Unable to load property.'))
      .finally(() => undefined);
    return () => controller.abort();
  }, []);

  const search = async () => {
    if (!canSearch) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await getGroupRoomMixSuggestions(propertyId, {
        adults,
        arrivalDate,
        children,
        departureDate,
        preference,
      });
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to suggest room mix.');
      setSuggestion(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupHolds = async (id = propertyId) => {
    if (!id) return;
    const holds = await getGroupHolds(id);
    setGroupHolds(holds);
  };

  const openHoldModal = (option: GroupRoomMixOptionDto) => {
    setSelectedOption(option);
    setGroupName(groupName || `${adults + children} guest group`);
    setDepositRequired(Math.round(option.estimatedTotal * 0.2));
  };

  const saveGroupHold = async () => {
    if (!selectedOption || !propertyId || !groupName.trim() || !leadName.trim() || !leadPhone.trim()) {
      showToast({ color: 'red', message: 'Group name, lead name, and phone are required.', title: 'Missing details' });
      return;
    }

    setIsSavingHold(true);
    try {
      const hold = await createGroupHold(propertyId, {
        adults,
        arrivalDate,
        children,
        departureDate,
        depositRequired,
        estimatedTotal: selectedOption.estimatedTotal,
        groupName: groupName.trim(),
        leadEmail: leadEmail.trim() || undefined,
        leadName: leadName.trim(),
        leadPhone: leadPhone.trim(),
        notes: notes.trim() || undefined,
        releaseAt: releaseDate ? dateToValue(releaseDate) : undefined,
        roomBlocks: selectedOption.roomBlocks.map((block) => ({
          adultsPerRoom: block.adultsPerRoom,
          baseRate: block.baseRate,
          childrenPerRoom: block.childrenPerRoom,
          estimatedTotal: block.estimatedTotal,
          roomTypeId: block.roomTypeId,
          rooms: block.rooms,
        })),
        source,
      });
      showToast({ color: 'green', message: `${hold.groupCode} is holding ${selectedOption.totalRooms} rooms.`, title: 'Group hold created' });
      setSelectedOption(undefined);
      await loadGroupHolds();
      await search();
    } catch (err) {
      showToast({ color: 'red', message: err instanceof Error ? err.message : 'Unable to create group hold.', title: 'Hold failed' });
    } finally {
      setIsSavingHold(false);
    }
  };

  const openHoldDetails = (hold: GroupHoldDto) => {
    setSelectedHold(hold);
    setGroupName(hold.groupName);
    setLeadName(hold.leadName);
    setLeadPhone(hold.leadPhone);
    setLeadEmail(hold.leadEmail ?? '');
    setReleaseDate(hold.releaseAt ? new Date(hold.releaseAt) : null);
    setDepositRequired(hold.depositRequired);
    setHoldNotes('');
  };

  const saveHoldDetails = async () => {
    if (!selectedHold || !propertyId || !groupName.trim() || !leadName.trim() || !leadPhone.trim()) return;
    setIsUpdatingHold(true);
    try {
      const updated = await updateGroupHold(propertyId, selectedHold.id, {
        depositRequired,
        groupName: groupName.trim(),
        leadEmail: leadEmail.trim() || undefined,
        leadName: leadName.trim(),
        leadPhone: leadPhone.trim(),
        notes: holdNotes.trim() || undefined,
        releaseAt: releaseDate ? dateToValue(releaseDate) : undefined,
      });
      showToast({ color: 'green', message: `${updated.groupCode} details updated.`, title: 'Group hold saved' });
      setSelectedHold(undefined);
      await loadGroupHolds();
    } catch (err) {
      showToast({ color: 'red', message: err instanceof Error ? err.message : 'Unable to update group hold.', title: 'Update failed' });
    } finally {
      setIsUpdatingHold(false);
    }
  };

  const transitionHold = async (action: 'release' | 'cancel') => {
    if (!selectedHold || !propertyId) return;
    setIsUpdatingHold(true);
    try {
      const updated = action === 'release'
        ? await releaseGroupHold(propertyId, selectedHold.id)
        : await cancelGroupHold(propertyId, selectedHold.id);
      showToast({ color: 'green', message: `${updated.groupCode} is ${updated.status.toLowerCase().replace('_', ' ')}.`, title: action === 'release' ? 'Hold released' : 'Hold cancelled' });
      setSelectedHold(undefined);
      await loadGroupHolds();
      await search();
    } catch (err) {
      showToast({ color: 'red', message: err instanceof Error ? err.message : 'Unable to update group hold.', title: 'Action failed' });
    } finally {
      setIsUpdatingHold(false);
    }
  };

  useEffect(() => {
    if (canSearch) void search();
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) void loadGroupHolds(propertyId);
  }, [propertyId]);

  const totalGuests = adults + children;
  const availabilityCount = useMemo(
    () => suggestion?.availability.reduce((sum, item) => sum + item.availableRooms, 0) ?? 0,
    [suggestion],
  );

  if (!backend.isOnline && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;
  if (!backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;

  return (
    <Box py={spacing[5]} px={{ base: spacing[2], sm: spacing[4] }} style={{ background: '#fbfcff', minHeight: 'calc(100vh - 180px)' }}>
      <Stack gap={spacing[3]} maw={1080} mx="auto">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1} c="#101828" style={{ fontSize: 32, fontWeight: 900 }}>
              Group Quote
            </Title>
            <Text c="#64748b" size="sm" mt={4}>
              Suggest room mixes for families, groups, walk-ins, corporate bookings, and future channel-manager sourced groups.
            </Text>
          </Box>
          <Button component={Link} href="/reservations/quote" variant="light" color="gray">
            Single-room quote
          </Button>
        </Group>

        <Card radius={radius.lg} p={18} style={panelStyle}>
          <Stack gap={spacing[3]}>
            <SimpleGrid cols={{ base: 1, md: 4 }} spacing={spacing[3]}>
              <DatePickerInput
                clearable
                label="Stay dates"
                leftSection={<CalendarDays size={18} />}
                minDate={today()}
                onChange={(value) => setDateRange(value as [Date | null, Date | null])}
                placeholder="Select dates"
                type="range"
                value={dateRange}
              />
              <NumberInput
                label="Adults"
                leftSection={<Users size={16} />}
                min={1}
                onChange={(value) => setAdults(Number(value) || 1)}
                value={adults}
              />
              <NumberInput
                label="Children"
                leftSection={<Baby size={16} />}
                min={0}
                onChange={(value) => setChildren(Number(value) || 0)}
                value={children}
              />
              <Select
                data={[
                  { label: 'Best fit', value: 'BEST_FIT' },
                  { label: 'Comfort', value: 'COMFORT' },
                  { label: 'Budget', value: 'BUDGET' },
                ]}
                label="Preference"
                onChange={(value) => setPreference((value ?? 'BEST_FIT') as GroupRoomMixPreference)}
                value={preference}
              />
            </SimpleGrid>
            <Group justify="space-between">
              <Text c="#64748b" size="sm">
                {formatDate(arrivalDate)} to {formatDate(departureDate)} - {totalGuests} guests
              </Text>
              <Button color="stayosBrand" leftSection={<Hotel size={16} />} loading={isLoading} onClick={() => void search()} disabled={!canSearch}>
                Find Room Mix
              </Button>
            </Group>
          </Stack>
        </Card>

        {error ? <Alert color="red">{error}</Alert> : null}

        {groupHolds.length ? (
          <Card radius={radius.lg} p={16} style={panelStyle}>
            <Group justify="space-between" align="flex-start" mb={spacing[2]}>
              <Box>
                <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 850 }}>Current Group Holds</Title>
                <Text c="#64748b" size="sm">Open, edit, release, or cancel saved inventory blocks.</Text>
              </Box>
              <Badge color="stayosBrand" variant="light">{groupHolds.length} total</Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[2]}>
              {groupHolds.map((hold) => (
                <Paper key={hold.id} radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Group gap={6}>
                        <Text fw={850} c="#101828">{hold.groupCode}</Text>
                        <Badge color={hold.status === 'ON_HOLD' ? 'yellow' : hold.status === 'CONFIRMED' ? 'green' : 'gray'} variant="light">{hold.status.replace('_', ' ')}</Badge>
                      </Group>
                      <Text c="#101828" fw={750}>{hold.groupName}</Text>
                      <Text c="#64748b" size="sm">{formatDate(hold.arrivalDate)} to {formatDate(hold.departureDate)} - {hold.adults + hold.children} guests</Text>
                      <Text c="#64748b" size="sm">{hold.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ')}</Text>
                    </Box>
                    <Group gap={6}>
                      <Button component={Link} href={`/reservations/group-holds/${hold.id}`} size="xs" variant="light" color="stayosBrand">Details</Button>
                      <Button size="xs" variant="light" color="gray" leftSection={<Pencil size={13} />} onClick={() => openHoldDetails(hold)}>
                        Edit
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          </Card>
        ) : null}

        {suggestion ? (
          <SimpleGrid cols={{ base: 1, lg: 3 }} spacing={spacing[3]}>
            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 850 }}>
                Availability
              </Title>
              <Text c="#64748b" size="sm" mt={4}>
                {availabilityCount} assignable rooms for selected dates.
              </Text>
              <Stack gap={8} mt={spacing[3]}>
                {suggestion.availability.map((item) => (
                  <Paper key={item.roomTypeId} radius={radius.md} p={10} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
                    <Group justify="space-between">
                      <Box>
                        <Text fw={800} c="#101828">{item.roomTypeName}</Text>
                        <Text c="#64748b" size="xs">{item.maxAdults} adults + {item.maxChildren} children</Text>
                      </Box>
                      <Badge color={item.availableRooms > 2 ? 'green' : 'yellow'} variant="light">
                        {item.availableRooms} available
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Card>

            <Stack gap={spacing[3]} style={{ gridColumn: 'span 2' }}>
              {suggestion.warnings.length ? (
                <Alert color="yellow">
                  {suggestion.warnings.join(' ')}
                </Alert>
              ) : null}
              {suggestion.options.length ? (
                suggestion.options.map((option) => (
                  <OptionCard key={option.type} onCreateHold={openHoldModal} option={option} suggestion={suggestion} />
                ))
              ) : (
                <Card radius={radius.lg} p={20} style={panelStyle}>
                  <Text fw={800} c="#101828">No feasible mix found</Text>
                  <Text c="#64748b" size="sm" mt={4}>
                    Try fewer guests, alternate dates, or splitting the party across multiple dates/properties.
                  </Text>
                </Card>
              )}
            </Stack>
          </SimpleGrid>
        ) : null}
      </Stack>
      <Modal
        centered
        opened={Boolean(selectedOption)}
        onClose={() => setSelectedOption(undefined)}
        title="Create Group Hold"
      >
        <Stack gap={spacing[3]}>
          <Text c="#64748b" size="sm">
            {selectedOption ? optionSummary(selectedOption) : ''} will be blocked from room-type inventory without assigning room numbers.
          </Text>
          <TextInput label="Group name" value={groupName} onChange={(event) => setGroupName(event.currentTarget.value)} required />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <TextInput label="Lead name" value={leadName} onChange={(event) => setLeadName(event.currentTarget.value)} required />
            <TextInput label="Phone" value={leadPhone} onChange={(event) => setLeadPhone(event.currentTarget.value)} required />
          </SimpleGrid>
          <TextInput label="Email" value={leadEmail} onChange={(event) => setLeadEmail(event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <Select
              data={[
                { label: 'Phone', value: 'PHONE' },
                { label: 'Walk-in query', value: 'WALK_IN' },
                { label: 'Travel agent', value: 'AGENT' },
                { label: 'Corporate', value: 'CORPORATE' },
                { label: 'Channel manager', value: 'CHANNEL_MANAGER' },
              ]}
              label="Source"
              onChange={(value) => setSource((value ?? 'PHONE') as GroupBookingSource)}
              value={source}
            />
            <DatePickerInput
              clearable
              label="Release date"
              minDate={today()}
              onChange={(value) => setReleaseDate(value as Date | null)}
              value={releaseDate}
            />
          </SimpleGrid>
          <NumberInput
            label="Deposit required"
            min={0}
            onChange={(value) => setDepositRequired(Number(value) || 0)}
            prefix="₹"
            value={depositRequired}
          />
          <Textarea label="Notes" minRows={3} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setSelectedOption(undefined)}>
              Cancel
            </Button>
            <Button color="stayosBrand" loading={isSavingHold} onClick={() => void saveGroupHold()}>
              Create Hold
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        centered
        opened={Boolean(selectedHold)}
        onClose={() => setSelectedHold(undefined)}
        title={selectedHold ? `${selectedHold.groupCode} Group Hold` : 'Group Hold'}
      >
        <Stack gap={spacing[3]}>
          <Text c="#64748b" size="sm">
            {selectedHold?.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ')} - {selectedHold ? formatCurrency(selectedHold.estimatedTotal) : ''}
          </Text>
          <TextInput label="Group name" value={groupName} onChange={(event) => setGroupName(event.currentTarget.value)} required />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <TextInput label="Lead name" value={leadName} onChange={(event) => setLeadName(event.currentTarget.value)} required />
            <TextInput label="Phone" value={leadPhone} onChange={(event) => setLeadPhone(event.currentTarget.value)} required />
          </SimpleGrid>
          <TextInput label="Email" value={leadEmail} onChange={(event) => setLeadEmail(event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <DatePickerInput
              clearable
              label="Release date"
              minDate={today()}
              onChange={(value) => setReleaseDate(value as Date | null)}
              value={releaseDate}
            />
            <NumberInput
              label="Deposit required"
              min={0}
              onChange={(value) => setDepositRequired(Number(value) || 0)}
              prefix="₹"
              value={depositRequired}
            />
          </SimpleGrid>
          <Textarea label="Notes" minRows={3} value={holdNotes} onChange={(event) => setHoldNotes(event.currentTarget.value)} />
          <Group justify="space-between">
            <Group gap={8}>
              <Button color="orange" variant="light" leftSection={<Undo2 size={14} />} loading={isUpdatingHold} onClick={() => void transitionHold('release')} disabled={selectedHold?.status !== 'ON_HOLD' && selectedHold?.status !== 'CONFIRMED'}>
                Release
              </Button>
              <Button color="red" variant="light" leftSection={<Trash2 size={14} />} loading={isUpdatingHold} onClick={() => void transitionHold('cancel')} disabled={selectedHold?.status !== 'ON_HOLD' && selectedHold?.status !== 'CONFIRMED'}>
                Cancel
              </Button>
            </Group>
            <Button color="stayosBrand" loading={isUpdatingHold} onClick={() => void saveHoldDetails()} disabled={selectedHold?.status !== 'ON_HOLD' && selectedHold?.status !== 'CONFIRMED'}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default GroupQuotePage;
