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
import { CreditCard, Download, PlusCircle, ReceiptText, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  addCharge,
  addPayment,
  formatCurrency,
  friendlyBillingError,
  getPaymentReceiptUrl,
  settleFolio,
} from '../api/billing-api';
import type {
  Folio,
  FolioChargeType,
  FolioPaymentMethod,
} from '../types/billing.types';

const chargeTypes: Array<{ label: string; value: FolioChargeType }> = [
  { label: 'Room Charge', value: 'ROOM' },
  { label: 'Food & Beverage', value: 'FOOD_AND_BEVERAGE' },
  { label: 'Mini Bar', value: 'MINIBAR' },
  { label: 'Laundry', value: 'LAUNDRY' },
  { label: 'Spa & Wellness', value: 'SPA' },
  { label: 'Tax', value: 'TAX' },
  { label: 'Discount', value: 'DISCOUNT' },
  { label: 'Miscellaneous', value: 'MISC' },
];

const paymentMethods: Array<{ label: string; value: FolioPaymentMethod }> = [
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
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  return (
    <Modal opened={opened} onClose={onClose} centered title="Add charge" size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
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
          />
          <TextInput
            data-testid="charge-description"
            label="Description"
            required
            placeholder="e.g., Room service dinner"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <Group grow>
            <NumberInput
              data-testid="charge-quantity"
              label="Quantity"
              min={1}
              value={quantity}
              onChange={(value) => setQuantity(typeof value === 'number' ? value : 1)}
            />
            <NumberInput
              data-testid="charge-unit-amount"
              label="Unit Amount (INR)"
              min={0}
              decimalScale={2}
              value={unitAmount}
              onChange={(value) => setUnitAmount(typeof value === 'number' ? value : 0)}
            />
            <NumberInput
              data-testid="charge-tax-amount"
              label="Tax (INR)"
              min={0}
              decimalScale={2}
              value={taxAmount}
              onChange={(value) => setTaxAmount(typeof value === 'number' ? value : 0)}
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
            <Button color="gray" variant="light" onClick={onClose}>
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
}: {
  balanceDue: number;
  onClose: () => void;
  onSubmit: (payload: {
    method: FolioPaymentMethod;
    amount: string;
    reference?: string;
    notes?: string;
  }) => Promise<void>;
  opened: boolean;
  submitting: boolean;
}) {
  const [method, setMethod] = useState<FolioPaymentMethod>('CARD');
  const [amount, setAmount] = useState<number>(0);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (opened) {
      setMethod('CARD');
      setAmount(balanceDue > 0 ? balanceDue : 0);
      setReference('');
      setNotes('');
      setError(undefined);
    }
  }, [opened, balanceDue]);

  return (
    <Modal opened={opened} onClose={onClose} centered title="Record payment" size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (amount <= 0) {
            setError('Amount must be greater than 0.');
            return;
          }
          setError(undefined);
          void onSubmit({
            method,
            amount: amount.toFixed(2),
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
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
            />
            <NumberInput
              data-testid="payment-amount"
              label="Amount (INR)"
              min={0}
              decimalScale={2}
              value={amount}
              onChange={(value) => setAmount(typeof value === 'number' ? value : 0)}
              required
            />
          </Group>
          <TextInput
            data-testid="payment-reference"
            label="Reference"
            placeholder="Transaction / auth code (optional)"
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
          />
          <TextInput
            data-testid="payment-notes"
            label="Notes"
            placeholder="Optional notes"
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button color="stayosBrand" data-testid="add-payment-submit" loading={submitting} type="submit">
              Collect Payment
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
  onFolioChanged?: (folio: Folio) => void;
  compact?: boolean;
};

export function FolioPanel({
  folio,
  propertyId,
  canManage,
  onFolioChanged,
  compact = false,
}: FolioPanelProps) {
  const [current, setCurrent] = useState<Folio>(folio);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCurrent(folio);
  }, [folio]);

  const balance = useMemo(() => Number(current.totals.balance), [current.totals.balance]);
  const isSettled = current.status === 'SETTLED';
  const isVoid = current.status === 'VOID';

  const handleAddCharge = async (payload: {
    type: FolioChargeType;
    description: string;
    quantity: number;
    unitAmount: string;
    taxAmount: string;
  }) => {
    setSubmitting(true);
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
      showToast({ color: 'red', title: 'Unable to add charge', message: friendlyBillingError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async (payload: {
    method: FolioPaymentMethod;
    amount: string;
    reference?: string;
    notes?: string;
  }) => {
    setSubmitting(true);
    try {
      const next = await addPayment(propertyId, current.id, payload);
      setCurrent(next);
      onFolioChanged?.(next);
      setPaymentOpen(false);
      showToast({
        color: 'green',
        title: 'Payment recorded',
        message: `${formatCurrency(payload.amount)} received via ${paymentMethodLabel(payload.method)}.`,
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Unable to record payment',
        message: friendlyBillingError(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async () => {
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const statusColor = isSettled ? 'green' : isVoid ? 'red' : 'yellow';
  const statusLabel = isSettled ? 'Settled' : isVoid ? 'Void' : 'Open';

  return (
    <Stack gap={spacing[3]} data-testid={`folio-panel-${current.id}`}>
      <Paper radius={radius.lg} p={20} style={{ border: '1px solid #e2e8f0' }}>
        <Group justify="space-between" wrap="wrap" gap={spacing[3]}>
          <Box>
            <Group gap={10} align="center">
              <ReceiptText size={20} color="#0f172a" />
              <Title order={3} c="#101828" style={{ fontSize: 20, fontWeight: 750 }}>
                {current.folioNumber}
              </Title>
              <Badge color={statusColor} variant="light">
                {statusLabel}
              </Badge>
            </Group>
            <Text c="#64748b" size="sm" mt={4}>
              {current.guest.displayName}
              {current.guest.isVip ? (
                <Badge color="grape" ml={8} size="xs" variant="light">
                  VIP
                </Badge>
              ) : null}
              {' · '}
              Reservation {current.reservation.reservationCode}
              {' · '}
              {current.reservation.arrivalDate} → {current.reservation.departureDate}
            </Text>
          </Box>
          <Group gap={spacing[3]} align="flex-start" wrap="wrap">
            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Subtotal
              </Text>
              <Text c="#101828" fw={750} size="md">
                {formatCurrency(current.totals.subtotal)}
              </Text>
            </Box>
            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Tax
              </Text>
              <Text c="#101828" fw={750} size="md">
                {formatCurrency(current.totals.tax)}
              </Text>
            </Box>
            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Paid
              </Text>
              <Text c="#0f8f4b" fw={750} size="md">
                {formatCurrency(current.totals.paid)}
              </Text>
            </Box>
            <Box>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">
                Balance
              </Text>
              <Text c={balance > 0 ? '#c92a2a' : '#0f8f4b'} fw={800} size="lg">
                {formatCurrency(current.totals.balance)}
              </Text>
            </Box>
          </Group>
        </Group>

        {canManage && !isVoid ? (
          <Group mt={spacing[3]} gap={10} wrap="wrap">
            <Button
              data-testid="folio-add-charge"
              disabled={isSettled}
              leftSection={<PlusCircle size={16} />}
              onClick={() => setChargeOpen(true)}
              variant="light"
            >
              Add Charge
            </Button>
            <Button
              color="stayosBrand"
              data-testid="folio-collect-payment"
              disabled={isSettled}
              leftSection={<CreditCard size={16} />}
              onClick={() => setPaymentOpen(true)}
            >
              Collect Payment
            </Button>
            <Button
              color="green"
              data-testid="folio-settle"
              disabled={balance > 0.01 || isSettled}
              leftSection={<Wallet size={16} />}
              onClick={() => void handleSettle()}
              loading={submitting}
              variant="light"
            >
              Settle Folio
            </Button>
          </Group>
        ) : null}
      </Paper>

      <Paper radius={radius.lg} p={16} style={{ border: '1px solid #e2e8f0' }}>
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
                        {formatCurrency(
                          Number(charge.amount) + Number(charge.taxAmount),
                        )}
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

      <Paper radius={radius.lg} p={16} style={{ border: '1px solid #e2e8f0' }}>
        <Text c="#101828" fw={800} size="md" mb={8}>
          Payments
        </Text>
        {current.payments.length === 0 ? (
          <Text c="#94a3b8" size="sm">
            No payments recorded yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing={compact ? 'xs' : 'sm'}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th>Received</Table.Th>
                  <Table.Th style={{ width: 100 }}>Receipt</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {current.payments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td>
                      <Badge color="teal" variant="light">
                        {paymentMethodLabel(payment.method)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c="#0f8f4b" fw={700}>
                        {formatCurrency(payment.amount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>{payment.reference ?? '-'}</Table.Td>
                    <Table.Td>{payment.notes ?? '-'}</Table.Td>
                    <Table.Td>{formatDateTime(payment.receivedAt)}</Table.Td>
                    <Table.Td>
                      <Button
                        variant="light"
                        color="stayosBrand"
                        size="xs"
                        leftSection={<Download size={12} />}
                        data-testid={`receipt-download-${payment.id}`}
                        onClick={async () => {
                          const url = getPaymentReceiptUrl(propertyId, current.id, payment.id);
                          try {
                            const response = await fetch(url);
                            if (!response.ok) throw new Error('Could not download receipt');
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
                          }
                        }}
                      >
                        PDF
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Divider />
      <Text c="#94a3b8" size="xs">
        Folio opened {formatDateTime(current.createdAt)} · Last updated{' '}
        {formatDateTime(current.updatedAt)}
        {current.settledAt ? ` · Settled ${formatDateTime(current.settledAt)}` : ''}
      </Text>

      <ChargeModal
        onClose={() => setChargeOpen(false)}
        onSubmit={handleAddCharge}
        opened={chargeOpen}
        submitting={submitting}
      />
      <PaymentModal
        balanceDue={balance}
        onClose={() => setPaymentOpen(false)}
        onSubmit={handleAddPayment}
        opened={paymentOpen}
        submitting={submitting}
      />
    </Stack>
  );
}
