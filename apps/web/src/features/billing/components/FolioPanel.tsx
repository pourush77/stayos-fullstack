'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  CreditCard,
  Download,
  Mail,
  MessageCircle,
  PlusCircle,
  ReceiptText,
  RotateCcw,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  addCharge,
  addPayment,
  addRefund,
  createRazorpayOrder,
  formatCurrency,
  friendlyBillingError,
  getFinalBillUrl,
  getPaymentReceiptUrl,
  getRazorpayConfig,
  settleFolio,
  verifyRazorpayPayment,
} from '../api/billing-api';
import type {
  Folio,
  FolioChargeType,
  FolioPayment,
  FolioPaymentMethod,
} from '../types/billing.types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (payload: unknown) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const chargeTypes: Array<{
  label: string;
  value: FolioChargeType;
}> = [
  { label: 'Room Charge', value: 'ROOM' },
  { label: 'Food & Beverage', value: 'FOOD_AND_BEVERAGE' },
  { label: 'Mini Bar', value: 'MINIBAR' },
  { label: 'Laundry', value: 'LAUNDRY' },
  { label: 'Spa & Wellness', value: 'SPA' },
  { label: 'Tax', value: 'TAX' },
  { label: 'Discount', value: 'DISCOUNT' },
  { label: 'Miscellaneous', value: 'MISC' },
];

const paymentMethods: Array<{
  label: string;
  value: FolioPaymentMethod;
}> = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'Wallet', value: 'WALLET' },
  { label: 'Other', value: 'OTHER' },
];

function chargeTypeColor(type: FolioChargeType): string {
  switch (type) {
    case 'ROOM':
      return 'blue';
    case 'FOOD_AND_BEVERAGE':
      return 'orange';
    case 'MINIBAR':
      return 'grape';
    case 'LAUNDRY':
      return 'cyan';
    case 'SPA':
      return 'teal';
    case 'TAX':
      return 'gray';
    case 'DISCOUNT':
      return 'red';
    default:
      return 'yellow';
  }
}

function chargeTypeLabel(type: FolioChargeType): string {
  return chargeTypes.find((option) => option.value === type)?.label ?? type;
}

function paymentMethodLabel(method: FolioPaymentMethod): string {
  return paymentMethods.find((option) => option.value === method)?.label ?? method;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createIdempotencyKey(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ChargeModal({
  onClose,
  onSubmit,
  opened,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    type: FolioChargeType;
    description: string;
    quantity: number;
    unitAmount: string;
    taxAmount: string;
  }) => Promise<void>;
  opened: boolean;
  submitting: boolean;
}) {
  const [type, setType] = useState<FolioChargeType>('FOOD_AND_BEVERAGE');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitAmount, setUnitAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (opened) {
      setType('FOOD_AND_BEVERAGE');
      setDescription('');
      setQuantity(1);
      setUnitAmount(0);
      setTaxAmount(0);
      setError(undefined);
    }
  }, [opened]);

  const total = quantity * unitAmount + taxAmount;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      title="Add charge"
      size="lg"
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
      withCloseButton={!submitting}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (submitting) return;

          if (!description.trim()) {
            setError('Description is required.');
            return;
          }

          if (quantity < 1) {
            setError('Quantity must be at least 1.');
            return;
          }

          if (unitAmount <= 0) {
            setError('Unit amount must be greater than 0.');
            return;
          }

          setError(undefined);

          void onSubmit({
            type,
            description: description.trim(),
            quantity,
            unitAmount: unitAmount.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
          });
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" data-testid="add-charge-error">
              {error}
            </Alert>
          ) : null}

          <Select
            data={chargeTypes}
            data-testid="charge-type"
            label="Type"
            required
            value={type}
            onChange={(value) => setType((value as FolioChargeType) ?? 'MISC')}
            disabled={submitting}
          />

          <TextInput
            data-testid="charge-description"
            label="Description"
            required
            placeholder="e.g., Room service dinner"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            disabled={submitting}
          />

          <Group grow>
            <NumberInput
              data-testid="charge-quantity"
              label="Quantity"
              min={1}
              value={quantity}
              onChange={(value) => setQuantity(typeof value === 'number' ? value : 1)}
              disabled={submitting}
            />

            <NumberInput
              data-testid="charge-unit-amount"
              label="Unit Amount (INR)"
              min={0}
              decimalScale={2}
              value={unitAmount}
              onChange={(value) => setUnitAmount(typeof value === 'number' ? value : 0)}
              disabled={submitting}
            />

            <NumberInput
              data-testid="charge-tax-amount"
              label="Tax (INR)"
              min={0}
              decimalScale={2}
              value={taxAmount}
              onChange={(value) => setTaxAmount(typeof value === 'number' ? value : 0)}
              disabled={submitting}
            />
          </Group>

          <Group justify="space-between" mt="xs">
            <Text c="#64748b" size="sm">
              Total (incl. tax)
            </Text>

            <Text c="#101828" fw={800} size="lg">
              {formatCurrency(total)}
            </Text>
          </Group>

          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>

            <Button data-testid="add-charge-submit" loading={submitting} type="submit">
              Add Charge
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function PaymentModal({
  balanceDue,
  onClose,
  onSubmit,
  opened,
  submitting,
  propertyId,
  folioId,
  onRazorpaySuccess,
}: {
  balanceDue: number;
  onClose: () => void;
  onSubmit: (payload: {
    method: FolioPaymentMethod;
    amount: string;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) => Promise<void>;
  opened: boolean;
  submitting: boolean;
  propertyId: string;
  folioId: string;
  onRazorpaySuccess: (folio: Folio) => void;
}) {
  const [method, setMethod] = useState<FolioPaymentMethod>('CARD');
  const [amount, setAmount] = useState<number>(0);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [isRazorpaying, setIsRazorpaying] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (opened) {
      setMethod('CARD');
      setAmount(balanceDue > 0 ? balanceDue : 0);
      setReference('');
      setNotes('');
      setError(undefined);
      setIdempotencyKey(createIdempotencyKey('pay'));

      getRazorpayConfig(propertyId, folioId)
        .then((cfg) => setRazorpayEnabled(Boolean(cfg?.configured)))
        .catch(() => setRazorpayEnabled(false));
    }
  }, [opened, balanceDue, propertyId, folioId]);

  const busy = submitting || isRazorpaying;

  const validateAmount = () => {
    if (balanceDue <= 0) {
      setError('This folio has no outstanding balance.');
      return false;
    }

    if (amount <= 0) {
      setError('Amount must be greater than 0.');
      return false;
    }

    if (amount > balanceDue + 0.001) {
      setError(`Payment cannot exceed the outstanding balance of ${formatCurrency(balanceDue)}.`);
      return false;
    }

    return true;
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const payViaRazorpay = async () => {
    if (busy) return;

    if (!validateAmount()) return;

    setError(undefined);
    setIsRazorpaying(true);

    try {
      const scriptOk = await loadRazorpayScript();

      if (!scriptOk) {
        throw new Error('Could not load Razorpay Checkout script.');
      }

      const order = await createRazorpayOrder(propertyId, folioId, {
        amount: amount.toFixed(2),
      });

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK unavailable');
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'StayOS',
        description: 'Folio payment',
        order_id: order.orderId,
        theme: {
          color: '#6d28d9',
        },

        handler: async (response: unknown) => {
          const r = response as {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          };

          try {
            const nextFolio = await verifyRazorpayPayment(propertyId, folioId, {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
              amount: amount.toFixed(2),
            });

            showToast({
              color: 'green',
              title: 'Payment captured',
              message: `Razorpay confirmed ${formatCurrency(amount)}.`,
            });

            onRazorpaySuccess(nextFolio);
          } catch (verifyError) {
            showToast({
              color: 'red',
              title: 'Verification failed',
              message: verifyError instanceof Error ? verifyError.message : 'Please try again.',
            });
          } finally {
            setIsRazorpaying(false);
          }
        },

        modal: {
          ondismiss: () => setIsRazorpaying(false),
        },
      });

      rzp.on('payment.failed', () => {
        showToast({
          color: 'red',
          title: 'Payment failed',
          message: 'Guest can retry or pay by another method.',
        });

        setIsRazorpaying(false);
      });

      rzp.open();
    } catch (err) {
      showToast({
        color: 'red',
        title: 'Razorpay error',
        message: err instanceof Error ? err.message : 'Razorpay unavailable.',
      });

      setIsRazorpaying(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      title="Record payment"
      size="lg"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (busy) return;

          if (!validateAmount()) return;

          setError(undefined);

          void onSubmit({
            method,
            amount: amount.toFixed(2),
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
            idempotencyKey: idempotencyKey || undefined,
          });
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" data-testid="add-payment-error">
              {error}
            </Alert>
          ) : null}

          <Alert color={balanceDue > 0 ? 'yellow' : 'green'} variant="light">
            Outstanding balance: <strong>{formatCurrency(balanceDue)}</strong>
          </Alert>

          <Group grow>
            <Select
              data={paymentMethods}
              data-testid="payment-method"
              label="Method"
              required
              value={method}
              onChange={(value) => setMethod((value as FolioPaymentMethod) ?? 'CASH')}
              disabled={busy}
            />

            <NumberInput
              data-testid="payment-amount"
              label="Amount (INR)"
              min={0}
              max={Math.max(balanceDue, 0)}
              decimalScale={2}
              value={amount}
              onChange={(value) => setAmount(typeof value === 'number' ? value : 0)}
              required
              disabled={busy || balanceDue <= 0}
            />
          </Group>

          <TextInput
            data-testid="payment-reference"
            label="Reference"
            placeholder="Transaction / auth code (optional)"
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
            disabled={busy}
          />

          <TextInput
            data-testid="payment-notes"
            label="Notes"
            placeholder="Optional notes"
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            disabled={busy}
          />

          <Group justify="space-between" wrap="wrap" gap={8}>
            {razorpayEnabled ? (
              <Button
                type="button"
                variant="light"
                color="stayosBrand"
                leftSection={<Smartphone size={16} />}
                loading={isRazorpaying}
                onClick={() => void payViaRazorpay()}
                data-testid="payment-razorpay"
                disabled={submitting || balanceDue <= 0}
              >
                Charge via Razorpay
              </Button>
            ) : (
              <Button
                type="button"
                variant="light"
                color="gray"
                leftSection={<Smartphone size={16} />}
                disabled
                data-testid="payment-razorpay-disabled"
              >
                Razorpay not configured
              </Button>
            )}

            <Group gap={8}>
              <Button color="gray" variant="light" onClick={handleClose} disabled={busy}>
                Cancel
              </Button>

              <Button
                color="stayosBrand"
                data-testid="add-payment-submit"
                loading={submitting}
                disabled={isRazorpaying || balanceDue <= 0}
                type="submit"
              >
                Record manual payment
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function RefundModal({
  opened,
  payment,
  refundableAmount,
  submitting,
  onClose,
  onSubmit,
}: {
  opened: boolean;
  payment: FolioPayment | null;
  refundableAmount: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    amount: string;
    reference?: string;
    notes: string;
    idempotencyKey: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (opened && payment) {
      setAmount(refundableAmount);
      setReference('');
      setNotes('');
      setError(undefined);
      setIdempotencyKey(createIdempotencyKey('refund'));
    }
  }, [opened, payment, refundableAmount]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      title="Refund payment"
      size="md"
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
      withCloseButton={!submitting}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (submitting || !payment) return;

          if (amount <= 0) {
            setError('Refund amount must be greater than 0.');
            return;
          }

          if (amount > refundableAmount + 0.001) {
            setError(`Refund cannot exceed ${formatCurrency(refundableAmount)}.`);
            return;
          }

          if (!notes.trim()) {
            setError('Refund reason is required.');
            return;
          }

          setError(undefined);

          void onSubmit({
            amount: amount.toFixed(2),
            reference: reference.trim() || undefined,
            notes: notes.trim(),
            idempotencyKey,
          });
        }}
      >
        <Stack gap="md">
          {error ? <Alert color="red">{error}</Alert> : null}

          <Alert color="yellow" variant="light">
            Original payment: <strong>{payment ? formatCurrency(payment.amount) : '-'}</strong>
            <br />
            Remaining refundable: <strong>{formatCurrency(refundableAmount)}</strong>
          </Alert>

          <NumberInput
            label="Refund amount (INR)"
            min={0}
            max={refundableAmount}
            decimalScale={2}
            value={amount}
            onChange={(value) => setAmount(typeof value === 'number' ? value : 0)}
            required
            disabled={submitting}
          />

          <TextInput
            label="Reference"
            placeholder="Refund transaction/reference (optional)"
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
            disabled={submitting}
          />

          <TextInput
            label="Reason"
            placeholder="Why is this payment being refunded?"
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            required
            disabled={submitting}
          />

          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>

            <Button
              color="red"
              type="submit"
              loading={submitting}
              leftSection={<RotateCcw size={16} />}
            >
              Refund {formatCurrency(amount)}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export type FolioPanelProps = {
  folio: Folio;
  propertyId: string;
  canManage: boolean;

  /**
   * Sensitive permission.
   *
   * Keep separate from canManage because FRONT_DESK may manage
   * ordinary billing but must not automatically gain refund authority.
   */
  canRefund?: boolean;

  onFolioChanged?: (folio: Folio) => void;
  compact?: boolean;
};

type BillingAction = 'charge' | 'payment' | 'refund' | 'settle' | null;

export function FolioPanel({
  folio,
  propertyId,
  canManage,
  canRefund = false,
  onFolioChanged,
  compact = false,
}: FolioPanelProps) {
  const [current, setCurrent] = useState<Folio>(folio);

  const [chargeOpen, setChargeOpen] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);

  const [refundTarget, setRefundTarget] = useState<FolioPayment | null>(null);

  const [billingAction, setBillingAction] = useState<BillingAction>(null);

  const [downloadingFinalBill, setDownloadingFinalBill] = useState(false);

  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(folio);
  }, [folio]);

  const balance = useMemo(() => Number(current.totals.balance), [current.totals.balance]);

  const isSettled = current.status === 'SETTLED';

  const isVoid = current.status === 'VOID';

  const isOverpaid = balance < -0.01;

  const isExactZero = Math.abs(balance) <= 0.01;

  const isBillingBusy = billingAction !== null;

  const canGenerateFinalBill =
    !isVoid &&
    isExactZero &&
    current.payments.some((payment) => payment.type === 'PAYMENT' && Number(payment.amount) > 0);

  const refundableByPayment = useMemo(() => {
    const result = new Map<string, number>();

    for (const payment of current.payments) {
      if (payment.type !== 'PAYMENT') {
        continue;
      }

      const originalAmount = Math.max(0, Number(payment.amount) || 0);

      const refundedAmount = current.payments
        .filter(
          (candidate) =>
            candidate.type === 'REFUND' && candidate.reversalOfPaymentId === payment.id,
        )
        .reduce((sum, refund) => sum + Math.abs(Number(refund.amount) || 0), 0);

      result.set(payment.id, Math.max(0, Number((originalAmount - refundedAmount).toFixed(2))));
    }

    return result;
  }, [current.payments]);

  const selectedRefundableAmount = refundTarget
    ? (refundableByPayment.get(refundTarget.id) ?? 0)
    : 0;

  const handleAddCharge = async (payload: {
    type: FolioChargeType;
    description: string;
    quantity: number;
    unitAmount: string;
    taxAmount: string;
  }) => {
    if (billingAction !== null) return;

    setBillingAction('charge');

    try {
      const next = await addCharge(propertyId, current.id, payload);

      setCurrent(next);
      onFolioChanged?.(next);
      setChargeOpen(false);

      showToast({
        color: 'green',
        title: 'Charge added',
        message: `${payload.description} added to folio ${next.folioNumber}.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to add charge',
        message: friendlyBillingError(error),
      });
    } finally {
      setBillingAction(null);
    }
  };

  const handleAddPayment = async (payload: {
    method: FolioPaymentMethod;
    amount: string;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) => {
    if (billingAction !== null) return;

    setBillingAction('payment');

    try {
      const next = await addPayment(propertyId, current.id, payload);

      setCurrent(next);
      onFolioChanged?.(next);
      setPaymentOpen(false);

      showToast({
        color: 'green',
        title: 'Payment recorded',
        message: `${formatCurrency(payload.amount)} received via ${paymentMethodLabel(
          payload.method,
        )}.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to record payment',
        message: friendlyBillingError(error),
      });
    } finally {
      setBillingAction(null);
    }
  };

  const handleRefund = async (payload: {
    amount: string;
    reference?: string;
    notes: string;
    idempotencyKey: string;
  }) => {
    if (billingAction !== null || !refundTarget || refundTarget.type !== 'PAYMENT') {
      return;
    }

    setBillingAction('refund');

    try {
      const next = await addRefund(propertyId, current.id, {
        originalPaymentId: refundTarget.id,
        amount: payload.amount,
        method: refundTarget.method,
        reference: payload.reference,
        notes: payload.notes,
        idempotencyKey: payload.idempotencyKey,
      });

      setCurrent(next);
      onFolioChanged?.(next);
      setRefundTarget(null);

      showToast({
        color: 'green',
        title: 'Refund recorded',
        message: `${formatCurrency(payload.amount)} refunded against the selected payment.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to refund payment',
        message: friendlyBillingError(error),
      });
    } finally {
      setBillingAction(null);
    }
  };

  const handleSettle = async () => {
    if (billingAction !== null || !isExactZero || isSettled) {
      return;
    }

    setBillingAction('settle');

    try {
      const next = await settleFolio(propertyId, current.id);

      setCurrent(next);
      onFolioChanged?.(next);

      showToast({
        color: 'green',
        title: 'Folio settled',
        message: `Folio ${next.folioNumber} is now settled.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to settle folio',
        message: friendlyBillingError(error),
      });
    } finally {
      setBillingAction(null);
    }
  };

  const handleDownloadFinalBill = async () => {
    if (downloadingFinalBill || !canGenerateFinalBill) {
      return;
    }

    setDownloadingFinalBill(true);

    try {
      const response = await fetch(getFinalBillUrl(propertyId, current.id));

      if (!response.ok) {
        throw new Error('Could not download final bill');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      window.open(objectUrl, '_blank', 'noopener');

      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      showToast({
        color: 'red',
        title: 'Final bill failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setDownloadingFinalBill(false);
    }
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    if (downloadingReceiptId !== null) {
      return;
    }

    setDownloadingReceiptId(paymentId);

    try {
      const response = await fetch(getPaymentReceiptUrl(propertyId, current.id, paymentId));

      if (!response.ok) {
        throw new Error('Could not download receipt');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      window.open(objectUrl, '_blank', 'noopener');

      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      showToast({
        color: 'red',
        title: 'Receipt download failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const statusColor = isSettled ? 'green' : isVoid ? 'red' : 'yellow';

  const statusLabel = isSettled ? 'Settled' : isVoid ? 'Void' : 'Open';

  const formatStayDate = (value?: string | null) => {
    if (!value) return '—';

    const [year, month, day] = value.slice(0, 10).split('-').map(Number);

    if (!year || !month || !day) {
      return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(new Date(year, month - 1, day))
      .replace(/ /g, '-');
  };

  return (
    <Stack gap={spacing[3]} data-testid={`folio-panel-${current.id}`}>
      <Paper
        radius={radius.lg}
        p={20}
        style={{
          border: '1px solid #e2e8f0',
        }}
      >
        <Group justify="space-between" wrap="wrap" gap={spacing[3]}>
          <Box>
            <Group gap={10} align="center">
              <ReceiptText size={20} color="#0f172a" />

              <Title
                order={3}
                c="#101828"
                style={{
                  fontSize: 20,
                  fontWeight: 750,
                }}
              >
                {current.folioNumber}
              </Title>

              <Badge color={statusColor} variant="light">
                {statusLabel}
              </Badge>
            </Group>

            <Group c="#64748b" mt={4}>
              {current.guest.displayName}
              {current.guest.isVip ? (
                <Badge color="grape" ml={8} size="xs" variant="light">
                  VIP
                </Badge>
              ) : null}
              {' · '}Reservation {current.reservation.reservationCode}
              {' · '}
              {formatStayDate(current.reservation.arrivalDate)}
              {' → '}
              {formatStayDate(current.reservation.departureDate)}
            </Group>
          </Box>

          <Group gap={spacing[3]} align="flex-start" wrap="wrap">
            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Subtotal
              </Text>
              <Text c="#101828" fw={750}>
                {formatCurrency(current.totals.subtotal)}
              </Text>
            </Box>

            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Tax
              </Text>
              <Text c="#101828" fw={750}>
                {formatCurrency(current.totals.tax)}
              </Text>
            </Box>

            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Paid
              </Text>
              <Text c="#0f8f4b" fw={750}>
                {formatCurrency(current.totals.paid)}
              </Text>
            </Box>

            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                {isOverpaid ? 'Credit (Overpaid)' : 'Balance'}
              </Text>

              <Text
                c={balance > 0.01 ? '#c92a2a' : isOverpaid ? '#6536b5' : '#0f8f4b'}
                fw={800}
                size="lg"
                data-testid="folio-balance"
              >
                {isOverpaid
                  ? `${formatCurrency(Math.abs(balance))} credit`
                  : formatCurrency(current.totals.balance)}
              </Text>
            </Box>
          </Group>
        </Group>

        <Group mt={spacing[3]} gap={10} wrap="wrap">
          <Button
            variant="light"
            color="stayosBrand"
            leftSection={<ReceiptText size={16} />}
            disabled={!canGenerateFinalBill || isBillingBusy}
            loading={downloadingFinalBill}
            onClick={() => void handleDownloadFinalBill()}
          >
            Final Bill
          </Button>

          <Button
            variant="light"
            color="gray"
            leftSection={<Mail size={16} />}
            disabled={!canGenerateFinalBill || isBillingBusy || downloadingFinalBill}
            onClick={() =>
              showToast({
                color: 'yellow',
                title: 'Email not connected',
                message:
                  'Email sending will use the final bill once the invoice endpoint is available.',
              })
            }
          >
            Email Bill
          </Button>

          <Button
            variant="light"
            color="gray"
            leftSection={<MessageCircle size={16} />}
            disabled={!canGenerateFinalBill || isBillingBusy || downloadingFinalBill}
            onClick={() =>
              showToast({
                color: 'yellow',
                title: 'WhatsApp not connected',
                message:
                  'WhatsApp resend will use the final bill once messaging integration is available.',
              })
            }
          >
            WhatsApp
          </Button>
        </Group>

        {canManage && !isVoid ? (
          <Group mt={spacing[3]} gap={10} wrap="wrap">
            <Button
              data-testid="folio-add-charge"
              disabled={isSettled || isBillingBusy}
              leftSection={<PlusCircle size={16} />}
              onClick={() => setChargeOpen(true)}
              variant="light"
            >
              Add Charge
            </Button>

            <Button
              color="stayosBrand"
              data-testid="folio-collect-payment"
              disabled={isSettled || isBillingBusy || balance <= 0}
              leftSection={<CreditCard size={16} />}
              onClick={() => setPaymentOpen(true)}
            >
              Collect Payment
            </Button>

            <Button
              color="green"
              data-testid="folio-settle"
              disabled={!isExactZero || isSettled || (isBillingBusy && billingAction !== 'settle')}
              leftSection={<Wallet size={16} />}
              onClick={() => void handleSettle()}
              loading={billingAction === 'settle'}
              variant="light"
            >
              Settle Folio
            </Button>
          </Group>
        ) : null}
      </Paper>

      <Paper
        radius={radius.lg}
        p={16}
        style={{
          border: '1px solid #e2e8f0',
        }}
      >
        <Text c="#101828" fw={800} size="md" mb={8}>
          Charges
        </Text>

        {current.charges.length === 0 ? (
          <Text c="#94a3b8" size="sm">
            No charges added yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing={compact ? 'xs' : 'sm'}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Tax</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Time</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {current.charges.map((charge) => (
                  <Table.Tr key={charge.id}>
                    <Table.Td>
                      <Badge color={chargeTypeColor(charge.type)} variant="light">
                        {chargeTypeLabel(charge.type)}
                      </Badge>
                    </Table.Td>

                    <Table.Td>{charge.description}</Table.Td>

                    <Table.Td>{charge.quantity}</Table.Td>

                    <Table.Td>{formatCurrency(charge.unitAmount)}</Table.Td>

                    <Table.Td>{formatCurrency(charge.taxAmount)}</Table.Td>

                    <Table.Td>
                      <Text c="#101828" fw={700}>
                        {formatCurrency(Number(charge.amount) + Number(charge.taxAmount))}
                      </Text>
                    </Table.Td>

                    <Table.Td>{formatDateTime(charge.chargedAt)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Paper
        radius={radius.lg}
        p={16}
        style={{
          border: '1px solid #e2e8f0',
        }}
      >
        <Text c="#101828" fw={800} size="md" mb={8}>
          Payments
        </Text>

        {current.payments.length === 0 ? (
          <Text c="#94a3b8" size="sm">
            No payments recorded yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing={compact ? 'xs' : 'sm'}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th>Received</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {current.payments.map((payment) => {
                  const isRefund = payment.type === 'REFUND';

                  const refundable = refundableByPayment.get(payment.id) ?? 0;

                  return (
                    <Table.Tr key={payment.id}>
                      <Table.Td>
                        <Badge color={isRefund ? 'red' : 'green'} variant="light">
                          {isRefund ? 'Refund' : 'Payment'}
                        </Badge>
                      </Table.Td>

                      <Table.Td>
                        <Badge color={isRefund ? 'gray' : 'teal'} variant="light">
                          {paymentMethodLabel(payment.method)}
                        </Badge>
                      </Table.Td>

                      <Table.Td>
                        <Text c={isRefund ? '#c92a2a' : '#0f8f4b'} fw={700}>
                          {formatCurrency(payment.amount)}
                        </Text>
                      </Table.Td>

                      <Table.Td>{payment.reference ?? '-'}</Table.Td>

                      <Table.Td>{payment.notes ?? '-'}</Table.Td>

                      <Table.Td>{formatDateTime(payment.receivedAt)}</Table.Td>

                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Button
                            variant="light"
                            color="stayosBrand"
                            size="xs"
                            leftSection={<Download size={12} />}
                            data-testid={`receipt-download-${payment.id}`}
                            loading={downloadingReceiptId === payment.id}
                            disabled={
                              downloadingReceiptId !== null && downloadingReceiptId !== payment.id
                            }
                            onClick={() => void handleDownloadReceipt(payment.id)}
                          >
                            PDF
                          </Button>

                          {canRefund && !isRefund && !isSettled && !isVoid && refundable > 0 ? (
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              leftSection={<RotateCcw size={12} />}
                              disabled={isBillingBusy}
                              onClick={() => setRefundTarget(payment)}
                            >
                              Refund
                            </Button>
                          ) : null}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Divider />

      <Text c="#94a3b8" size="xs">
        Folio opened {formatDateTime(current.createdAt)}
        {' · '}
        Last updated {formatDateTime(current.updatedAt)}
        {current.settledAt ? ` · Settled ${formatDateTime(current.settledAt)}` : ''}
      </Text>

      <ChargeModal
        onClose={() => {
          if (billingAction !== 'charge') {
            setChargeOpen(false);
          }
        }}
        onSubmit={handleAddCharge}
        opened={chargeOpen}
        submitting={billingAction === 'charge'}
      />

      <PaymentModal
        balanceDue={balance}
        onClose={() => {
          if (billingAction !== 'payment') {
            setPaymentOpen(false);
          }
        }}
        onSubmit={handleAddPayment}
        opened={paymentOpen}
        submitting={billingAction === 'payment'}
        propertyId={propertyId}
        folioId={current.id}
        onRazorpaySuccess={(next) => {
          setCurrent(next);
          onFolioChanged?.(next);
          setPaymentOpen(false);
        }}
      />

      <RefundModal
        opened={refundTarget !== null}
        payment={refundTarget}
        refundableAmount={selectedRefundableAmount}
        submitting={billingAction === 'refund'}
        onClose={() => {
          if (billingAction !== 'refund') {
            setRefundTarget(null);
          }
        }}
        onSubmit={handleRefund}
      />
    </Stack>
  );
}
