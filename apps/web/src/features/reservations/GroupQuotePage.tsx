'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  Baby,
  CalendarDays,
  ChevronLeft,
  Copy,
  Hotel,
  Info,
  Pencil,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties } from '../../lib/guest-api';
import {
  cancelGroupHold,
  createGroupHold,
  type GroupBookingSource,
  type GroupBookingDepositDto,
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
  return option.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ');
}

function quoteText(option: GroupRoomMixOptionDto, suggestion: GroupRoomMixSuggestionDto) {
  const pricing = option.pricing;
  const total = pricing?.grandTotal ?? option.estimatedTotal;
  return [
    `Group quote for ${formatDate(suggestion.arrivalDate)} to ${formatDate(suggestion.departureDate)}`,
    `${suggestion.adults} adults, ${suggestion.children} children, ${suggestion.nights} night${suggestion.nights === 1 ? '' : 's'}`,
    `Room combination: ${optionSummary(option)}`,
    pricing
      ? `Room charges: ${formatCurrency(pricing.roomSubtotal)}; taxes & charges: ${formatCurrency(pricing.taxAmount + pricing.otherCharges)}; estimated total: ${formatCurrency(total)}`
      : `Estimated total: ${formatCurrency(total)}`,
    'Reply YES if you would like us to temporarily hold these rooms.',
  ].join('\n');
}

function friendlyOptionLabel(option: GroupRoomMixOptionDto) {
  const type = String(option.type ?? '').toUpperCase();
  if (type === 'BEST_FIT') return 'Recommended';
  if (type === 'COMFORT') return 'More space';
  if (type === 'BUDGET') return 'Lowest price';
  return option.label;
}

function formatHoldUntil(value?: string | null) {
  if (!value) return undefined;
  return `Held until ${formatDate(String(value).slice(0, 10))}`;
}

function depositExplanation(deposit: GroupBookingDepositDto, estimatedTotal: number) {
  const prefix = deposit.required ? 'Required deposit' : 'Suggested deposit';

  if (deposit.policyType === 'PERCENTAGE') {
    return `${prefix}: ${deposit.policyValue}% of the estimated booking total (${formatCurrency(estimatedTotal)}).`;
  }

  if (deposit.policyType === 'FIXED_AMOUNT') {
    return `${prefix}: ${formatCurrency(deposit.suggestedAmount)} set by the hotel policy.`;
  }

  return deposit.required
    ? `A deposit of ${formatCurrency(deposit.suggestedAmount)} is required by the hotel policy.`
    : "No deposit is required by the hotel's current group booking policy.";
}

const COUNTRY_CODE_OPTIONS = [
  { label: 'India (+91)', value: '+91' },
  { label: 'UAE (+971)', value: '+971' },
  { label: 'Singapore (+65)', value: '+65' },
  { label: 'United Kingdom (+44)', value: '+44' },
  { label: 'United States (+1)', value: '+1' },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeMobile(countryCode: string, mobile: string) {
  const countryDigits = digitsOnly(countryCode);
  const mobileDigits = digitsOnly(mobile);
  return mobileDigits ? `+${countryDigits}${mobileDigits}` : '';
}

function isValidMobile(countryCode: string, mobile: string) {
  const normalized = normalizeMobile(countryCode, mobile);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function splitMobile(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, '');
  const matchedCode = [...COUNTRY_CODE_OPTIONS]
    .sort((a, b) => b.value.length - a.value.length)
    .find((option) => compact.startsWith(option.value));

  if (!matchedCode) {
    return { countryCode: '+91', mobile: digitsOnly(compact) };
  }

  return {
    countryCode: matchedCode.value,
    mobile: digitsOnly(compact.slice(matchedCode.value.length)),
  };
}

function OptionCard({
  option,
  onCreateHold,
  suggestion,
  highlighted = false,
}: {
  onCreateHold: (option: GroupRoomMixOptionDto) => void;
  option: GroupRoomMixOptionDto;
  suggestion: GroupRoomMixSuggestionDto;
  highlighted?: boolean;
}) {
  const isRecommended = String(option.type ?? '').toUpperCase() === 'BEST_FIT';
  const pricing = option.pricing;
  const roomSubtotal =
    pricing?.roomSubtotal ??
    option.roomBlocks.reduce((sum, block) => sum + block.estimatedTotal, 0);
  const taxesAndCharges = pricing ? pricing.taxAmount + pricing.otherCharges : 0;
  const grandTotal = pricing?.grandTotal ?? option.estimatedTotal;
  const taxesLabel =
    pricing && taxesAndCharges > 0
      ? pricing.taxName
        ? `${pricing.taxName} & charges`
        : 'Taxes & charges'
      : 'Taxes & charges';

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(quoteText(option, suggestion));
      showToast({
        color: 'green',
        message: 'Paste it into WhatsApp, SMS, or email.',
        title: 'Group quote copied',
      });
    } catch {
      showToast({
        color: 'red',
        message: 'Clipboard is unavailable in this browser context.',
        title: 'Copy failed',
      });
    }
  };

  return (
    <Card
      radius={radius.lg}
      p={16}
      style={{
        ...panelStyle,
        background: highlighted ? '#faf8ff' : panelStyle.background,
        border: highlighted
          ? '1px solid #7d4dd6'
          : isRecommended
            ? '1px solid #c4b5fd'
            : panelStyle.border,
        boxShadow: highlighted
          ? '0 0 0 3px rgba(125,77,214,0.10), 0 12px 30px rgba(15,23,42,0.09)'
          : panelStyle.boxShadow,
        transform: highlighted ? 'translateY(-1px)' : 'translateY(0)',
        transition:
          'background .25s ease, border-color .25s ease, box-shadow .25s ease, transform .25s ease',
      }}
    >
      <Stack gap={spacing[3]}>
        <Group justify="space-between" align="flex-start" gap={spacing[3]} wrap="wrap">
          <Box style={{ minWidth: 0 }}>
            <Group gap={8}>
              <Badge color="stayosBrand" variant="light">
                {friendlyOptionLabel(option)}
              </Badge>
              <Badge color={option.spareCapacity === 0 ? 'green' : 'yellow'} variant="light">
                {option.spareCapacity === 0
                  ? 'Exact guest fit'
                  : `${option.spareCapacity} extra guest space${option.spareCapacity === 1 ? '' : 's'}`}
              </Badge>
            </Group>
            <Title order={2} c="#101828" mt={8} style={{ fontSize: 22, fontWeight: 850 }}>
              {optionSummary(option)}
            </Title>
            <Text c="#64748b" size="sm" mt={4}>
              {option.reason}
            </Text>
          </Box>
          <Box ta={{ base: 'left', sm: 'right' }}>
            <Text c="#101828" fw={850} size="xl">
              {formatCurrency(grandTotal)}
            </Text>
            <Text c="#64748b" size="xs" fw={700}>
              {pricing?.taxEnabled && taxesAndCharges > 0
                ? 'Incl. taxes & charges'
                : 'No additional taxes'}
            </Text>
          </Box>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={8}>
          <Paper
            radius={radius.md}
            p={10}
            style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
          >
            <Text c="#64748b" size="xs" fw={700}>
              Rooms
            </Text>
            <Text c="#101828" fw={850}>
              {option.totalRooms}
            </Text>
          </Paper>
          <Paper
            radius={radius.md}
            p={10}
            style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
          >
            <Text c="#64748b" size="xs" fw={700}>
              Adult capacity
            </Text>
            <Text c="#101828" fw={850}>
              {option.adultCapacity}
            </Text>
          </Paper>
          <Paper
            radius={radius.md}
            p={10}
            style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
          >
            <Text c="#64748b" size="xs" fw={700}>
              Child capacity
            </Text>
            <Text c="#101828" fw={850}>
              {option.childCapacity}
            </Text>
          </Paper>
          <Paper
            radius={radius.md}
            p={10}
            style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
          >
            <Text c="#64748b" size="xs" fw={700}>
              Total capacity
            </Text>
            <Text c="#101828" fw={850}>
              {option.totalCapacity}
            </Text>
          </Paper>
        </SimpleGrid>

        <Stack gap={6}>
          {option.roomBlocks.map((block) => (
            <Group key={block.roomTypeId} justify="space-between">
              <Text c="#334155" size="sm">
                {block.rooms} × {block.roomTypeName}
              </Text>
              <Text c="#64748b" size="sm">
                {block.maxAdults} adults + {block.maxChildren} children per room
              </Text>
            </Group>
          ))}
          <Box mt={4} pt={8} style={{ borderTop: '1px solid #e2e8f0' }}>
            <Group justify="space-between">
              <Text c="#475569" size="sm">
                Room charges
              </Text>
              <Text c="#334155" size="sm" fw={700}>
                {formatCurrency(roomSubtotal)}
              </Text>
            </Group>
            <Group justify="space-between" mt={4}>
              <Text c="#475569" size="sm">
                {taxesLabel}
              </Text>
              <Text c="#334155" size="sm" fw={700}>
                {formatCurrency(taxesAndCharges)}
              </Text>
            </Group>
            <Group justify="space-between" mt={8}>
              <Text c="#101828" size="sm" fw={850}>
                Estimated total
              </Text>
              <Text c="#101828" size="md" fw={850}>
                {formatCurrency(grandTotal)}
              </Text>
            </Group>
          </Box>
        </Stack>

        <Group gap={8} wrap="wrap">
          <Button
            leftSection={<Copy size={14} />}
            color="stayosBrand"
            onClick={() => void copyQuote()}
          >
            Copy Quote
          </Button>
          <Button
            data-testid="group-quote-create-hold"
            variant="light"
            color="stayosBrand"
            onClick={() => onCreateHold(option)}
          >
            Hold These Rooms
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function GroupQuotePage() {
  const router = useRouter();
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [adults, setAdults] = useState<number | ''>(2);
  const [children, setChildren] = useState<number | ''>(0);
  const [preference, setPreference] = useState<GroupRoomMixPreference>('BEST_FIT');
  const [suggestion, setSuggestion] = useState<GroupRoomMixSuggestionDto | undefined>();
  const [groupHolds, setGroupHolds] = useState<GroupHoldDto[]>([]);
  const [selectedOption, setSelectedOption] = useState<GroupRoomMixOptionDto | undefined>();
  const [selectedHold, setSelectedHold] = useState<GroupHoldDto | undefined>();
  const [groupName, setGroupName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [contactValidationAttempted, setContactValidationAttempted] = useState(false);
  const [source, setSource] = useState<GroupBookingSource>('PHONE');
  const [releaseDate, setReleaseDate] = useState<Date | null>(
    () => new Date(today().getTime() + 86_400_000),
  );
  const [depositRequired, setDepositRequired] = useState(0);
  const [notes, setNotes] = useState('');
  const [holdNotes, setHoldNotes] = useState('');
  const [isSavingHold, setIsSavingHold] = useState(false);
  const [isUpdatingHold, setIsUpdatingHold] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHolds, setIsLoadingHolds] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [searchNeedsRefresh, setSearchNeedsRefresh] = useState(false);
  const [isSuggestionsHighlighted, setIsSuggestionsHighlighted] = useState(false);
  const [latestHoldId, setLatestHoldId] = useState<string | undefined>();
  const [highlightedHoldId, setHighlightedHoldId] = useState<string | undefined>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const arrivalDate = dateToValue(dateRange[0]);
  const departureDate = dateToValue(dateRange[1]);
  const normalizedAdults = typeof adults === 'number' ? adults : 0;
  const normalizedChildren = typeof children === 'number' ? children : 0;
  const stayDatesAreValid = Boolean(
    arrivalDate &&
    departureDate &&
    new Date(`${departureDate}T00:00:00`).getTime() > new Date(`${arrivalDate}T00:00:00`).getTime(),
  );
  const canSearch = Boolean(
    propertyId && stayDatesAreValid && typeof adults === 'number' && adults > 0,
  );
  const normalizedLeadPhone = normalizeMobile(countryCode, leadPhone);
  const mobileIsValid = isValidMobile(countryCode, leadPhone);
  const emailIsValid = isValidEmail(leadEmail);
  const contactDetailsAreValid =
    Boolean(groupName.trim() && leadName.trim()) && mobileIsValid && emailIsValid;

  const invalidateSuggestions = () => {
    if (suggestion) setSearchNeedsRefresh(true);
    setSuggestion(undefined);
  };

  useEffect(() => {
    const controller = new AbortController();

    getProperties(controller.signal)
      .then((properties) => {
        if (controller.signal.aborted) return;

        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];

        setPropertyId(typeof active?.id === 'string' ? active.id : '');
        setError(undefined);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        setError(
          'We could not prepare room availability for this hotel. Please refresh and try again.',
        );
      });

    return () => controller.abort();
  }, []);

  const search = async () => {
    if (!canSearch || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await getGroupRoomMixSuggestions(propertyId, {
        adults: normalizedAdults,
        arrivalDate,
        children: normalizedChildren,
        departureDate,
        preference,
      });
      setSearchNeedsRefresh(false);
      setSuggestion(result);
    } catch {
      setError('We could not check room availability. Please try again.');
      setSuggestion(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupHolds = async (id = propertyId) => {
    if (!id) return;
    setIsLoadingHolds(true);
    try {
      const holds = await getGroupHolds(id);
      setGroupHolds(holds);
    } catch {
      setGroupHolds([]);
      setError('We could not load the rooms currently on hold. Please try again.');
    } finally {
      setIsLoadingHolds(false);
    }
  };

  const openHoldModal = (option: GroupRoomMixOptionDto) => {
    setSelectedOption(option);
    setContactValidationAttempted(false);
    setGroupName(groupName || `${normalizedAdults + normalizedChildren} guest group`);
    setDepositRequired(option.deposit.suggestedAmount);
  };

  const saveGroupHold = async () => {
    setContactValidationAttempted(true);

    if (!selectedOption || !propertyId || !contactDetailsAreValid) {
      showToast({
        color: 'red',
        message: 'Check the highlighted contact details before holding these rooms.',
        title: 'Complete group details',
      });
      return;
    }

    setIsSavingHold(true);
    try {
      const hold = await createGroupHold(propertyId, {
        adults: normalizedAdults,
        arrivalDate,
        children: normalizedChildren,
        departureDate,
        estimatedTotal: selectedOption.pricing?.grandTotal ?? selectedOption.estimatedTotal,
        groupName: groupName.trim(),
        leadEmail: leadEmail.trim() || undefined,
        leadName: leadName.trim(),
        leadPhone: normalizedLeadPhone,
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
      showToast({
        color: 'green',
        message: `${selectedOption.totalRooms} room${selectedOption.totalRooms === 1 ? '' : 's'} placed on hold for ${hold.groupName}.`,
        title: 'Rooms placed on hold',
      });
      setLatestHoldId(hold.id);
      setHighlightedHoldId(hold.id);
      setSelectedOption(undefined);
      await loadGroupHolds();
    } catch {
      showToast({
        color: 'red',
        message: 'We could not place these rooms on hold. Please try again.',
        title: 'Could not create hold',
      });
    } finally {
      setIsSavingHold(false);
    }
  };

  const openHoldDetails = (hold: GroupHoldDto) => {
    const parsedMobile = splitMobile(hold.leadPhone);
    setSelectedHold(hold);
    setContactValidationAttempted(false);
    setGroupName(hold.groupName);
    setLeadName(hold.leadName);
    setCountryCode(parsedMobile.countryCode);
    setLeadPhone(parsedMobile.mobile);
    setLeadEmail(hold.leadEmail ?? '');
    setReleaseDate(hold.releaseAt ? new Date(hold.releaseAt) : null);
    setDepositRequired(hold.depositRequired);
    setHoldNotes('');
  };

  const saveHoldDetails = async () => {
    setContactValidationAttempted(true);
    if (!selectedHold || !propertyId || !contactDetailsAreValid) {
      showToast({
        color: 'red',
        message: 'Check the highlighted contact details before saving.',
        title: 'Complete group details',
      });
      return;
    }
    setIsUpdatingHold(true);
    try {
      const updated = await updateGroupHold(propertyId, selectedHold.id, {
        groupName: groupName.trim(),
        leadEmail: leadEmail.trim() || undefined,
        leadName: leadName.trim(),
        leadPhone: normalizedLeadPhone,
        notes: holdNotes.trim() || undefined,
        releaseAt: releaseDate ? dateToValue(releaseDate) : undefined,
      });
      showToast({
        color: 'green',
        message: `${updated.groupCode} details updated.`,
        title: 'Group hold saved',
      });
      setSelectedHold(undefined);
      await loadGroupHolds();
    } catch {
      showToast({
        color: 'red',
        message: 'We could not save the group hold changes. Please try again.',
        title: 'Could not save changes',
      });
    } finally {
      setIsUpdatingHold(false);
    }
  };

  const transitionHold = async (action: 'release' | 'cancel') => {
    if (!selectedHold || !propertyId) return;
    setIsUpdatingHold(true);
    try {
      const updated =
        action === 'release'
          ? await releaseGroupHold(propertyId, selectedHold.id)
          : await cancelGroupHold(propertyId, selectedHold.id);
      showToast({
        color: 'green',
        message: `${updated.groupCode} is ${updated.status.toLowerCase().replace('_', ' ')}.`,
        title: action === 'release' ? 'Hold released' : 'Hold cancelled',
      });
      setSelectedHold(undefined);
      await loadGroupHolds();
    } catch {
      showToast({
        color: 'red',
        message: 'We could not update this room hold. Please try again.',
        title: 'Could not update hold',
      });
    } finally {
      setIsUpdatingHold(false);
    }
  };

  useEffect(() => {
    if (propertyId) void loadGroupHolds(propertyId);
  }, [propertyId]);

  useEffect(() => {
    if (!suggestion) return;

    setIsSuggestionsHighlighted(true);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      suggestionsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    });

    const timeout = window.setTimeout(() => setIsSuggestionsHighlighted(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [suggestion]);

  useEffect(() => {
    if (!highlightedHoldId) return;

    const timeout = window.setTimeout(() => setHighlightedHoldId(undefined), 2000);
    const frame = window.requestAnimationFrame(() => {
      const newHoldCard = document.querySelector<HTMLElement>(
        `[data-testid="group-hold-card-${highlightedHoldId}"]`,
      );

      if (!newHoldCard) return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      newHoldCard.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
      });

      // Move keyboard focus to the newly-created hold so front-desk staff
      // immediately land on the result of their action.
      window.setTimeout(
        () => newHoldCard.focus({ preventScroll: true }),
        prefersReducedMotion ? 0 : 250,
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [highlightedHoldId, groupHolds]);

  const totalGuests = normalizedAdults + normalizedChildren;
  const selectedNights = useMemo(() => {
    if (!arrivalDate || !departureDate) return 0;
    const start = new Date(`${arrivalDate}T00:00:00`).getTime();
    const end = new Date(`${departureDate}T00:00:00`).getTime();
    return Math.max(0, Math.round((end - start) / 86_400_000));
  }, [arrivalDate, departureDate]);
  const staySummary =
    arrivalDate && departureDate
      ? `${formatDate(arrivalDate)} → ${formatDate(departureDate)} · ${selectedNights} night${selectedNights === 1 ? '' : 's'} · ${totalGuests} guest${totalGuests === 1 ? '' : 's'}`
      : '';
  const visibleGroupHolds = useMemo(() => {
    const active = groupHolds.filter((hold) => hold.status === 'ON_HOLD');
    return [...active].sort((a, b) => {
      if (a.id === latestHoldId) return -1;
      if (b.id === latestHoldId) return 1;
      return b.groupCode.localeCompare(a.groupCode, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [groupHolds, latestHoldId]);
  const availabilityCount = useMemo(
    () => suggestion?.availability.reduce((sum, item) => sum + item.availableRooms, 0) ?? 0,
    [suggestion],
  );

  if (!backend.isOnline && backend.status === 'SERVER_STARTING')
    return (
      <ServerStarting
        onAction={() => void backend.retry()}
        onCheckStatus={() => void backend.checkHealth()}
      />
    );
  if (!backend.isOnline && backend.status !== 'CONNECTING')
    return (
      <BackendUnavailable
        onAction={() => void backend.retry()}
        onCheckStatus={() => void backend.checkHealth()}
      />
    );

  return (
    <Box
      py={spacing[5]}
      px={{ base: spacing[2], sm: spacing[4] }}
      style={{ background: '#fbfcff', minHeight: 'calc(100vh - 180px)' }}
    >
      <Stack gap={spacing[3]} maw={1080} mx="auto">
        <Group justify="space-between" align="flex-start" gap={spacing[2]} wrap="wrap">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Title order={1} c="#101828" style={{ fontSize: 32, fontWeight: 900 }}>
              Group Booking Quote
            </Title>
            <Text c="#64748b" size="sm" mt={4}>
              Find the best available room combination for a group stay.
            </Text>
          </Box>
          <Group gap={8} wrap="wrap">
            <Button
              component={Link}
              href="/"
              variant="light"
              color="gray"
              leftSection={<ChevronLeft size={16} />}
            >
              Back to Front Desk
            </Button>
            <Button component={Link} href="/reservations/quote" variant="light" color="gray">
              Single Room Quote
            </Button>
          </Group>
        </Group>

        <Card radius={radius.lg} p={18} style={panelStyle}>
          <Stack gap={spacing[3]}>
            <SimpleGrid cols={{ base: 1, md: 4 }} spacing={spacing[3]}>
              <DatePickerInput
                clearable
                label="Check-in & Check-out"
                leftSection={<CalendarDays size={18} />}
                minDate={today()}
                onChange={(value) => {
                  setDateRange(value as [Date | null, Date | null]);
                  invalidateSuggestions();
                }}
                placeholder="Select dates"
                type="range"
                value={dateRange}
              />
              <NumberInput
                label="Adults"
                leftSection={<Users size={16} />}
                min={1}
                onChange={(value) => {
                  setAdults(typeof value === 'number' ? value : '');
                  invalidateSuggestions();
                }}
                placeholder="Enter adults"
                value={adults}
              />
              <NumberInput
                label="Children"
                leftSection={<Baby size={16} />}
                min={0}
                onChange={(value) => {
                  setChildren(typeof value === 'number' ? value : 0);
                  invalidateSuggestions();
                }}
                placeholder="0"
                value={children}
              />
              <Select
                data={[
                  { label: 'Best available mix', value: 'BEST_FIT' },
                  { label: 'More space', value: 'COMFORT' },
                  { label: 'Lowest price', value: 'BUDGET' },
                ]}
                label={
                  <Group gap={5}>
                    <Text size="sm" fw={500}>
                      Room preference
                    </Text>

                    <Tooltip
                      label="Choose how StayOS should balance room availability, space, and price."
                      withArrow
                    >
                      <Info size={14} color="#667085" style={{ cursor: 'help' }} />
                    </Tooltip>
                  </Group>
                }
                onChange={(value) => {
                  setPreference((value ?? 'BEST_FIT') as GroupRoomMixPreference);
                  invalidateSuggestions();
                }}
                value={preference}
              />
            </SimpleGrid>
            <Group justify="space-between" align="flex-end" gap={spacing[3]} wrap="wrap">
              <Box style={{ minWidth: 0 }}>
                {staySummary ? (
                  <Text c="#475569" size="sm" fw={700}>
                    {staySummary}
                  </Text>
                ) : (
                  <Text c="#64748b" size="sm">
                    Select check-in and check-out dates to continue.
                  </Text>
                )}
                {propertyId && arrivalDate && departureDate && !stayDatesAreValid ? (
                  <Text c="orange.7" size="xs" mt={2}>
                    Check-out must be after check-in.
                  </Text>
                ) : !canSearch && propertyId && stayDatesAreValid ? (
                  <Text c="orange.7" size="xs" mt={2}>
                    Enter at least 1 adult to check availability.
                  </Text>
                ) : null}
              </Box>
              <Button
                color="stayosBrand"
                data-testid="group-quote-find-room-mix"
                leftSection={<Hotel size={16} />}
                loading={isLoading}
                onClick={() => void search()}
                disabled={!canSearch || isLoading}
                style={{ flexShrink: 0 }}
              >
                {isLoading ? 'Finding rooms…' : 'Find available rooms'}
              </Button>
            </Group>
          </Stack>
        </Card>

        {error ? (
          <Alert color="red" variant="light" title="Something needs attention">
            {error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing={spacing[3]}>
          <Card radius={radius.lg} p={16} style={{ ...panelStyle, alignSelf: 'start' }}>
            <Group justify="space-between" align="flex-start" mb={spacing[2]}>
              <Box>
                <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 850 }}>
                  Rooms on Hold
                </Title>
                <Text c="#64748b" size="sm">
                  Rooms temporarily reserved for group enquiries.
                </Text>
              </Box>
              <Badge color="stayosBrand" variant="light">
                {visibleGroupHolds.length} active{' '}
                {visibleGroupHolds.length === 1 ? 'hold' : 'holds'}
              </Badge>
            </Group>
            {isLoadingHolds && !groupHolds.length ? (
              <Paper
                radius={radius.md}
                p={14}
                style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}
              >
                <Text fw={800} c="#101828">
                  Loading room holds...
                </Text>
                <Text c="#64748b" size="sm">
                  Checking which rooms are temporarily reserved for group enquiries.
                </Text>
              </Paper>
            ) : visibleGroupHolds.length ? (
              <Stack gap={8} style={{ maxHeight: 520, overflow: 'auto', paddingRight: 2 }}>
                {visibleGroupHolds.map((hold) => (
                  <Paper
                    key={hold.id}
                    data-testid={`group-hold-card-${hold.id}`}
                    role="button"
                    tabIndex={0}
                    radius={radius.md}
                    p={12}
                    onClick={() => router.push(`/reservations/group-holds/${hold.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/reservations/group-holds/${hold.id}`);
                      }
                    }}
                    style={{
                      background: highlightedHoldId === hold.id ? '#faf8ff' : '#f8fafc',
                      border:
                        highlightedHoldId === hold.id ? '1px solid #7d4dd6' : '1px solid #eef2f7',
                      boxShadow:
                        highlightedHoldId === hold.id
                          ? '0 0 0 3px rgba(125,77,214,0.10), 0 10px 24px rgba(15,23,42,0.08)'
                          : 'none',
                      color: 'inherit',
                      display: 'block',
                      textDecoration: 'none',
                      transition:
                        'transform .14s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.borderColor = '#7d4dd6';
                      event.currentTarget.style.boxShadow = '0 10px 22px rgba(15,23,42,0.08)';
                      event.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.borderColor =
                        highlightedHoldId === hold.id ? '#7d4dd6' : '#eef2f7';
                      event.currentTarget.style.boxShadow =
                        highlightedHoldId === hold.id
                          ? '0 0 0 3px rgba(125,77,214,0.10), 0 10px 24px rgba(15,23,42,0.08)'
                          : 'none';
                      event.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Group gap={6}>
                          <Text fw={850} c="#101828">
                            {hold.groupCode}
                          </Text>
                          <Badge
                            color={
                              hold.status === 'ON_HOLD'
                                ? 'yellow'
                                : hold.status === 'CONFIRMED'
                                  ? 'green'
                                  : 'gray'
                            }
                            variant="light"
                          >
                            {hold.status.replace('_', ' ')}
                          </Badge>
                        </Group>
                        <Text c="#101828" fw={750} truncate>
                          {hold.groupName}
                        </Text>
                        <Text c="#64748b" size="sm">
                          {formatDate(hold.arrivalDate)} → {formatDate(hold.departureDate)}
                        </Text>
                        {formatHoldUntil(hold.releaseAt) ? (
                          <Text c="orange.7" size="xs" fw={700}>
                            {formatHoldUntil(hold.releaseAt)}
                          </Text>
                        ) : null}
                        <Text c="#64748b" size="sm" truncate>
                          {hold.roomBlocks
                            .map((block) => `${block.rooms} ${block.roomTypeName}`)
                            .join(' + ')}
                        </Text>
                      </Box>
                      <Button
                        data-testid={`group-hold-edit-${hold.id}`}
                        size="xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<Pencil size={13} />}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openHoldDetails(hold);
                        }}
                      >
                        Edit
                      </Button>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper
                radius={radius.md}
                p={14}
                style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}
              >
                <Text fw={800} c="#101828">
                  No rooms on hold
                </Text>
                <Text c="#64748b" size="sm">
                  Find available rooms, then hold the option that works best for the group.
                </Text>
              </Paper>
            )}
          </Card>

          <Stack
            ref={suggestionsRef}
            gap={spacing[3]}
            style={{ gridColumn: 'span 2' }}
            aria-live="polite"
          >
            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={2} c="#101828" style={{ fontSize: 20, fontWeight: 850 }}>
                    Recommended Room Options
                  </Title>
                  <Text c="#64748b" size="sm">
                    Room combinations available for the selected dates and number of guests.
                  </Text>
                </Box>
                {suggestion ? (
                  <Badge color="green" variant="light">
                    {suggestion.options.length}{' '}
                    {suggestion.options.length === 1 ? 'room option' : 'room options'}
                  </Badge>
                ) : searchNeedsRefresh ? (
                  <Badge color="yellow" variant="light">
                    Update needed
                  </Badge>
                ) : null}
              </Group>
            </Card>

            {suggestion ? (
              <>
                <Card radius={radius.lg} p={16} style={panelStyle}>
                  <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 850 }}>
                    Room Availability
                  </Title>
                  <Text c="#64748b" size="sm" mt={4}>
                    {availabilityCount} room{availabilityCount === 1 ? '' : 's'} available for these
                    dates.
                  </Text>
                  <Stack gap={8} mt={spacing[3]}>
                    {suggestion.availability.map((item) => (
                      <Paper
                        key={item.roomTypeId}
                        radius={radius.md}
                        p={10}
                        style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
                      >
                        <Group justify="space-between">
                          <Box>
                            <Text fw={800} c="#101828">
                              {item.roomTypeName}
                            </Text>
                            <Text c="#64748b" size="xs">
                              {item.maxAdults} adults + {item.maxChildren} children
                            </Text>
                          </Box>
                          <Badge
                            color={
                              item.availableRooms === 0
                                ? 'gray'
                                : item.availableRooms > 2
                                  ? 'green'
                                  : 'yellow'
                            }
                            variant="light"
                          >
                            {item.availableRooms === 0
                              ? 'Sold out'
                              : `${item.availableRooms} available`}
                          </Badge>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Card>

                {suggestion.warnings.length ? (
                  <Alert color="yellow">{suggestion.warnings.join(' ')}</Alert>
                ) : null}
                {suggestion.options.length ? (
                  suggestion.options.map((option) => (
                    <OptionCard
                      key={option.type}
                      onCreateHold={openHoldModal}
                      option={option}
                      suggestion={suggestion}
                      highlighted={
                        isSuggestionsHighlighted &&
                        String(option.type ?? '').toUpperCase() === 'BEST_FIT'
                      }
                    />
                  ))
                ) : (
                  <Card radius={radius.lg} p={20} style={panelStyle}>
                    <Text fw={800} c="#101828">
                      No suitable rooms found
                    </Text>
                    <Text c="#64748b" size="sm" mt={4}>
                      We could not find a suitable room combination for {totalGuests} guest
                      {totalGuests === 1 ? '' : 's'} from {formatDate(arrivalDate)} to{' '}
                      {formatDate(departureDate)}. Try changing the dates, guest count, or room
                      preference.
                    </Text>
                  </Card>
                )}
              </>
            ) : (
              <Card radius={radius.lg} p={24} style={{ ...panelStyle, borderStyle: 'dashed' }}>
                <Text fw={850} c="#101828">
                  {searchNeedsRefresh ? 'Search details changed' : 'Find rooms for this group'}
                </Text>
                <Text c="#64748b" size="sm" mt={4}>
                  {searchNeedsRefresh
                    ? 'Find available rooms again to see options for the updated stay details.'
                    : "Enter the stay dates and number of guests above. We'll show the best available room combinations here."}
                </Text>
              </Card>
            )}
          </Stack>
        </SimpleGrid>
      </Stack>
      <Modal
        centered
        size="lg"
        opened={Boolean(selectedOption)}
        onClose={() => {
          setSelectedOption(undefined);
          setContactValidationAttempted(false);
        }}
        title="Hold Rooms for Group"
      >
        <Stack gap={spacing[3]}>
          {selectedOption ? (
            <Paper
              radius={radius.md}
              p={12}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box>
                  <Text fw={850} c="#101828">
                    {optionSummary(selectedOption)}
                  </Text>
                  <Text c="#64748b" size="sm" mt={2}>
                    {formatDate(arrivalDate)} → {formatDate(departureDate)} · {selectedNights} night
                    {selectedNights === 1 ? '' : 's'} · {totalGuests} guest
                    {totalGuests === 1 ? '' : 's'}
                  </Text>
                </Box>
                <Box ta="right">
                  <Text c="#64748b" size="xs" fw={700}>
                    Estimated total
                  </Text>
                  <Text c="#101828" fw={900} size="lg">
                    {formatCurrency(
                      selectedOption.pricing?.grandTotal ?? selectedOption.estimatedTotal,
                    )}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ) : null}

          <TextInput
            label="Group name"
            placeholder="e.g. Sharma Wedding Group"
            value={groupName}
            onChange={(event) => setGroupName(event.currentTarget.value)}
            error={
              contactValidationAttempted && !groupName.trim() ? 'Enter a group name.' : undefined
            }
            required
          />

          <TextInput
            label="Primary contact"
            placeholder="Guest or organiser name"
            value={leadName}
            onChange={(event) => setLeadName(event.currentTarget.value)}
            error={
              contactValidationAttempted && !leadName.trim()
                ? 'Enter the primary contact name.'
                : undefined
            }
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <Box>
              <Text size="sm" fw={500} mb={5}>
                Mobile number{' '}
                <Text component="span" c="red">
                  *
                </Text>
              </Text>
              <Group gap={6} wrap="nowrap" align="flex-start">
                <Select
                  aria-label="Country code"
                  data={COUNTRY_CODE_OPTIONS}
                  value={countryCode}
                  onChange={(value) => setCountryCode(value ?? '+91')}
                  searchable
                  allowDeselect={false}
                  w={150}
                />
                <TextInput
                  aria-label="Mobile number"
                  placeholder="98765 43210"
                  inputMode="tel"
                  value={leadPhone}
                  onChange={(event) => setLeadPhone(event.currentTarget.value)}
                  error={
                    contactValidationAttempted && !mobileIsValid
                      ? 'Enter a valid mobile number.'
                      : undefined
                  }
                  style={{ flex: 1 }}
                />
              </Group>
            </Box>

            <TextInput
              label="Email (optional)"
              placeholder="name@example.com"
              type="email"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.currentTarget.value)}
              error={
                contactValidationAttempted && !emailIsValid
                  ? 'Enter a valid email address.'
                  : undefined
              }
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <Select
              data={[
                { label: 'Phone', value: 'PHONE' },
                { label: 'Walk-in enquiry', value: 'WALK_IN' },
                { label: 'Travel agent', value: 'AGENT' },
                { label: 'Corporate', value: 'CORPORATE' },
                { label: 'Channel manager', value: 'CHANNEL_MANAGER' },
              ]}
              label="Enquiry source"
              onChange={(value) => setSource((value ?? 'PHONE') as GroupBookingSource)}
              value={source}
            />

            <DatePickerInput
              clearable
              label={
                <Group gap={5}>
                  <Text size="sm" fw={500}>
                    Hold until
                  </Text>
                  <Tooltip
                    label="Rooms may be released after this date if the guest has not confirmed the booking."
                    withArrow
                  >
                    <Info size={14} color="#667085" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
              }
              minDate={today()}
              onChange={(value) => setReleaseDate(value as Date | null)}
              placeholder="No automatic release date"
              value={releaseDate}
            />
          </SimpleGrid>

          <NumberInput
            label={
              <Group gap={5}>
                <Text size="sm" fw={500}>
                  Deposit amount
                </Text>
                <Tooltip
                  label={
                    selectedOption
                      ? depositExplanation(
                          selectedOption.deposit,
                          selectedOption.pricing?.grandTotal ?? selectedOption.estimatedTotal,
                        )
                      : 'Amount the guest needs to pay to confirm this booking.'
                  }
                  withArrow
                >
                  <Info size={14} color="#667085" style={{ cursor: 'help' }} />
                </Tooltip>
              </Group>
            }
            min={0}
            disabled
            hideControls
            inputMode="numeric"
            prefix="₹ "
            thousandSeparator=","
            value={depositRequired}
          />
          {selectedOption ? (
            <Text c="#64748b" size="xs">
              {depositExplanation(
                selectedOption.deposit,
                selectedOption.pricing?.grandTotal ?? selectedOption.estimatedTotal,
              )}
            </Text>
          ) : null}

          <Textarea
            label="Internal notes (optional)"
            placeholder="Follow-up details for front desk staff…"
            minRows={3}
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
          />

          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setSelectedOption(undefined);
                setContactValidationAttempted(false);
              }}
            >
              Cancel
            </Button>
            <Button
              color="stayosBrand"
              loading={isSavingHold}
              disabled={isSavingHold}
              onClick={() => void saveGroupHold()}
            >
              Hold Rooms
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        centered
        size="lg"
        opened={Boolean(selectedHold)}
        onClose={() => {
          setSelectedHold(undefined);
          setContactValidationAttempted(false);
        }}
        title={selectedHold ? `${selectedHold.groupCode} · Group Hold` : 'Group Hold'}
      >
        <Stack gap={spacing[3]}>
          {selectedHold ? (
            <Paper
              radius={radius.md}
              p={12}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box>
                  <Text fw={850} c="#101828">
                    {selectedHold.roomBlocks
                      .map((block) => `${block.rooms} ${block.roomTypeName}`)
                      .join(' + ')}
                  </Text>
                  <Text c="#64748b" size="sm" mt={2}>
                    {formatDate(selectedHold.arrivalDate)} →{' '}
                    {formatDate(selectedHold.departureDate)}
                  </Text>
                </Box>
                <Box ta="right">
                  <Text c="#64748b" size="xs" fw={700}>
                    Estimated total
                  </Text>
                  <Text c="#101828" fw={900} size="lg">
                    {formatCurrency(selectedHold.estimatedTotal)}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ) : null}

          <TextInput
            label="Group name"
            value={groupName}
            onChange={(event) => setGroupName(event.currentTarget.value)}
            error={
              contactValidationAttempted && !groupName.trim() ? 'Enter a group name.' : undefined
            }
            required
          />

          <TextInput
            label="Primary contact"
            value={leadName}
            onChange={(event) => setLeadName(event.currentTarget.value)}
            error={
              contactValidationAttempted && !leadName.trim()
                ? 'Enter the primary contact name.'
                : undefined
            }
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <Box>
              <Text size="sm" fw={500} mb={5}>
                Mobile number{' '}
                <Text component="span" c="red">
                  *
                </Text>
              </Text>
              <Group gap={6} wrap="nowrap" align="flex-start">
                <Select
                  aria-label="Country code"
                  data={COUNTRY_CODE_OPTIONS}
                  value={countryCode}
                  onChange={(value) => setCountryCode(value ?? '+91')}
                  searchable
                  allowDeselect={false}
                  w={150}
                />
                <TextInput
                  aria-label="Mobile number"
                  inputMode="tel"
                  value={leadPhone}
                  onChange={(event) => setLeadPhone(event.currentTarget.value)}
                  error={
                    contactValidationAttempted && !mobileIsValid
                      ? 'Enter a valid mobile number.'
                      : undefined
                  }
                  style={{ flex: 1 }}
                />
              </Group>
            </Box>

            <TextInput
              label="Email (optional)"
              type="email"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.currentTarget.value)}
              error={
                contactValidationAttempted && !emailIsValid
                  ? 'Enter a valid email address.'
                  : undefined
              }
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <DatePickerInput
              clearable
              label={
                <Group gap={5}>
                  <Text size="sm" fw={500}>
                    Hold until
                  </Text>
                  <Tooltip
                    label="Rooms may be released after this date if the guest has not confirmed the booking."
                    withArrow
                  >
                    <Info size={14} color="#667085" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
              }
              minDate={today()}
              onChange={(value) => setReleaseDate(value as Date | null)}
              value={releaseDate}
            />

            <NumberInput
              label={
                <Group gap={5}>
                  <Text size="sm" fw={500}>
                    Deposit to confirm
                  </Text>
                  <Tooltip
                    label={
                      selectedHold
                        ? depositExplanation(selectedHold.deposit, selectedHold.estimatedTotal)
                        : 'Amount the guest needs to pay to confirm this booking.'
                    }
                    withArrow
                  >
                    <Info size={14} color="#667085" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
              }
              min={0}
              disabled
              hideControls
              inputMode="numeric"
              prefix="₹ "
              thousandSeparator=","
              value={depositRequired}
            />
          </SimpleGrid>
          {selectedHold ? (
            <Text c="#64748b" size="xs">
              {depositExplanation(selectedHold.deposit, selectedHold.estimatedTotal)}
            </Text>
          ) : null}

          <Textarea
            label="Notes (optional)"
            minRows={3}
            value={holdNotes}
            onChange={(event) => setHoldNotes(event.currentTarget.value)}
          />

          <Group justify="space-between" gap={spacing[2]} wrap="wrap">
            <Group gap={8} wrap="wrap">
              <Button
                color="orange"
                variant="light"
                leftSection={<Undo2 size={14} />}
                loading={isUpdatingHold}
                onClick={() => void transitionHold('release')}
                disabled={
                  isUpdatingHold ||
                  (selectedHold?.status !== 'ON_HOLD' && selectedHold?.status !== 'CONFIRMED')
                }
              >
                Release Rooms
              </Button>
              <Button
                color="red"
                variant="light"
                leftSection={<Trash2 size={14} />}
                loading={isUpdatingHold}
                onClick={() => void transitionHold('cancel')}
                disabled={
                  isUpdatingHold ||
                  (selectedHold?.status !== 'ON_HOLD' && selectedHold?.status !== 'CONFIRMED')
                }
              >
                Cancel Hold
              </Button>
            </Group>
            <Button
              color="stayosBrand"
              loading={isUpdatingHold}
              onClick={() => void saveHoldDetails()}
              disabled={
                isUpdatingHold ||
                (selectedHold?.status !== 'ON_HOLD' && selectedHold?.status !== 'CONFIRMED')
              }
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default GroupQuotePage;
