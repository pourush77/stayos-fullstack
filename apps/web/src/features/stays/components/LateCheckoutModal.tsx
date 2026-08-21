'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  approveLateCheckout,
  getCheckInWorkspace,
  type CheckInWorkspaceDto,
} from '../../../lib/reservation-api';

export type LateCheckoutModalProps = {
  opened: boolean;
  onClose: () => void;
  propertyId: string;
  reservationId: string;
  guestName: string;
  roomNumber?: string | null;
  bookingCode: string;
  departureDate: string;
  standardCheckoutTime?: string | null;
  currentApprovedUntil?: string | null;
  currentNotes?: string | null;
  operationalStatus?: string | null;
  onApproved?: (data: { approvedUntil: string; notes?: string }) => void | Promise<void>;
};

function formatTimeDisplay(timeStr?: string | null): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  const [hStr, mStr] = clean.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMinute = m === 0 ? ':00' : `:${String(m).padStart(2, '0')}`;
  return `${displayHour}${displayMinute} ${period}`;
}

function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const [h, m] = clean.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatCurrency(value: string | number, currency = 'INR') {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(num);
}

export function LateCheckoutModal({
  opened,
  onClose,
  propertyId,
  reservationId,
  guestName,
  roomNumber,
  bookingCode,
  departureDate,
  standardCheckoutTime = '11:00:00',
  currentApprovedUntil,
  currentNotes,
  operationalStatus,
  onApproved,
}: LateCheckoutModalProps) {
  const isEditing = Boolean(currentApprovedUntil);
  const [approvedUntil, setApprovedUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [applyFee, setApplyFee] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Operational context from backend
  const [workspace, setWorkspace] = useState<CheckInWorkspaceDto | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  const effectiveStandardCheckout =
    workspace?.operational?.standardCheckOutTime || standardCheckoutTime || '11:00:00';
  const lateCheckoutFee = workspace?.operational?.lateCheckoutFee ?? null;
  const feeAlreadyApplied = Boolean(workspace?.operational?.lateCheckoutFeeAlreadyApplied);

  useEffect(() => {
    if (!opened) return;

    setErrorMessage(null);
    setNotes(currentNotes || '');

    // Default approved until time:
    // If already approved, use existing approvedUntil.
    // Else default to 2 hours after standard checkout (or 13:00 / 14:00).
    if (currentApprovedUntil) {
      setApprovedUntil(currentApprovedUntil.slice(0, 5));
    } else {
      const stdMinutes = parseTimeToMinutes(effectiveStandardCheckout);
      const defaultMinutes = Math.min(20 * 60, stdMinutes + 120); // 2 hours later, cap at 8 PM
      setApprovedUntil(minutesToTimeString(defaultMinutes));
    }

    // Load workspace for accurate fee resolution & operational metadata
    if (propertyId && reservationId) {
      setIsLoadingWorkspace(true);
      const controller = new AbortController();
      getCheckInWorkspace(propertyId, reservationId, controller.signal)
        .then((ws) => {
          setWorkspace(ws);
        })
        .catch(() => {
          // Non-blocking fallback
        })
        .finally(() => {
          setIsLoadingWorkspace(false);
        });

      return () => controller.abort();
    }
  }, [opened, propertyId, reservationId, currentApprovedUntil, currentNotes, effectiveStandardCheckout]);

  // Client validation
  const stdMinutes = parseTimeToMinutes(effectiveStandardCheckout);
  const approvedMinutes = parseTimeToMinutes(approvedUntil);

  const isTimeValid = Boolean(approvedUntil && approvedMinutes > stdMinutes);

  let validationError = '';
  if (!approvedUntil) {
    validationError = 'Please specify an approved late checkout time.';
  } else if (approvedMinutes <= stdMinutes) {
    validationError = `Approved time must be later than standard checkout (${formatTimeDisplay(effectiveStandardCheckout)}).`;
  }

  const handlePreset = (minutesToAdd: number) => {
    const baseMinutes = Math.max(stdMinutes, parseTimeToMinutes(approvedUntil || effectiveStandardCheckout));
    const newMinutes = Math.min(23 * 60, baseMinutes + minutesToAdd);
    setApprovedUntil(minutesToTimeString(newMinutes));
    setErrorMessage(null);
  };

  const handleSetTime = (timeStr: string) => {
    setApprovedUntil(timeStr);
    setErrorMessage(null);
  };

  const handleApprove = async () => {
    if (!isTimeValid || isSubmitting || !propertyId || !reservationId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await approveLateCheckout(propertyId, reservationId, {
        approvedUntil,
        notes: notes.trim() || undefined,
        applyLateCheckoutFee: applyFee && !feeAlreadyApplied,
      });

      const displayTime = formatTimeDisplay(approvedUntil);
      showToast({
        color: 'green',
        title: isEditing ? 'Late checkout updated' : 'Late checkout approved',
        message: `Late checkout approved for ${guestName} until ${displayTime}.`,
      });

      if (onApproved) {
        await onApproved({ approvedUntil, notes: notes.trim() || undefined });
      }

      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to approve late checkout. Please check the time and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      closeOnClickOutside={!isSubmitting}
      closeOnEscape={!isSubmitting}
      withCloseButton={!isSubmitting}
      size="md"
      centered
      title={
        <Group gap={8}>
          <ThemeIcon color="stayosBrand" variant="light" size={28} radius={radius.md}>
            <Clock size={16} />
          </ThemeIcon>
          <Text fw={800} size="md">
            {isEditing ? 'Update Late Checkout' : 'Approve Late Checkout'}
          </Text>
        </Group>
      }
    >
      <Stack gap={spacing[3]} data-testid="late-checkout-modal">
        {errorMessage ? (
          <Alert
            color="red"
            variant="light"
            icon={<AlertCircle size={16} />}
            radius={radius.md}
            data-testid="late-checkout-error"
          >
            {errorMessage}
          </Alert>
        ) : null}

        {/* Guest & Stay Context */}
        <Paper
          p={14}
          radius={radius.md}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          <Group justify="space-between" align="flex-start" mb={6}>
            <Box>
              <Text fw={800} size="sm" c="#101828">
                {guestName}
              </Text>
              <Text size="xs" c="#64748b">
                {roomNumber ? `Room ${roomNumber}` : 'Unassigned'} · Booking {bookingCode}
              </Text>
            </Box>
            {isEditing ? (
              <Badge color="violet" variant="light" radius={radius.full}>
                Approved until {formatTimeDisplay(currentApprovedUntil)}
              </Badge>
            ) : operationalStatus === 'OVERDUE_CHECKOUT' ? (
              <Badge color="red" variant="light" radius={radius.full}>
                Overdue Checkout
              </Badge>
            ) : (
              <Badge color="blue" variant="light" radius={radius.full}>
                In-House Stay
              </Badge>
            )}
          </Group>
          <Divider color="#e2e8f0" my={8} />
          <Group justify="space-between">
            <Text size="xs" c="#64748b">
              Standard checkout time:
            </Text>
            <Text size="xs" fw={700} c="#334155">
              {formatTimeDisplay(effectiveStandardCheckout)}
            </Text>
          </Group>
        </Paper>

        {/* Time Selection */}
        <Stack gap={6}>
          <TextInput
            label="Approved checkout time"
            description={`Must be later than standard checkout (${formatTimeDisplay(effectiveStandardCheckout)})`}
            type="time"
            value={approvedUntil}
            onChange={(e) => {
              setApprovedUntil(e.currentTarget.value);
              setErrorMessage(null);
            }}
            disabled={isSubmitting}
            error={approvedUntil && !isTimeValid ? validationError : undefined}
            data-testid="late-checkout-time-input"
            required
          />

          {/* Quick presets */}
          <Group gap={6} mt={2}>
            <Text size="xs" c="#64748b" fw={600}>
              Presets:
            </Text>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              disabled={isSubmitting}
              onClick={() => handleSetTime('13:00')}
            >
              1:00 PM
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              disabled={isSubmitting}
              onClick={() => handleSetTime('14:00')}
            >
              2:00 PM
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              disabled={isSubmitting}
              onClick={() => handleSetTime('15:00')}
            >
              3:00 PM
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="stayosBrand"
              disabled={isSubmitting}
              onClick={() => handlePreset(60)}
            >
              +1 hr
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="stayosBrand"
              disabled={isSubmitting}
              onClick={() => handlePreset(120)}
            >
              +2 hrs
            </Button>
          </Group>
        </Stack>

        {/* Policy / Fee Section */}
        {lateCheckoutFee ? (
          <Paper
            p={12}
            radius={radius.md}
            style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
            data-testid="late-checkout-fee-panel"
          >
            <Group justify="space-between" align="center">
              <Group gap={8}>
                <ThemeIcon color="orange" variant="light" size={24} radius={radius.sm}>
                  <Sparkles size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" fw={700} c="#9a3412">
                    Late Checkout Policy Fee
                  </Text>
                  <Text size="xs" c="#7c2d12">
                    Applicable rate: <b>{formatCurrency(lateCheckoutFee.amount)}</b>
                  </Text>
                </Box>
              </Group>

              {feeAlreadyApplied ? (
                <Badge color="green" variant="light">
                  Already posted
                </Badge>
              ) : (
                <Checkbox
                  color="orange"
                  label={`Apply fee (${formatCurrency(lateCheckoutFee.amount)})`}
                  checked={applyFee}
                  onChange={(e) => setApplyFee(e.currentTarget.checked)}
                  disabled={isSubmitting}
                  data-testid="late-checkout-apply-fee"
                />
              )}
            </Group>
          </Paper>
        ) : null}

        {/* Staff Notes */}
        <Textarea
          label="Staff notes / reason (optional)"
          placeholder="e.g. Late flight, member benefit, manager approval"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          disabled={isSubmitting}
          minRows={2}
          maxRows={4}
          data-testid="late-checkout-notes-input"
        />

        {/* Modal Actions */}
        <Group justify="flex-end" mt={spacing[2]}>
          <Button
            variant="subtle"
            color="gray"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            loading={isSubmitting}
            disabled={!isTimeValid}
            onClick={() => void handleApprove()}
            data-testid="late-checkout-submit-button"
          >
            {isEditing ? 'Save Changes' : 'Approve Late Checkout'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
