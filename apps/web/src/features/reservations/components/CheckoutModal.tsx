'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Divider, Group, Loader, Modal, NumberInput, Paper, Select, Stack, Table, Text, TextInput, ThemeIcon } from '@mantine/core';
import { AlertTriangle, CheckCircle2, CreditCard, Receipt } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { addPayment, getFolioForReservation } from '../../billing/api/billing-api';
import type { Folio, FolioPaymentMethod } from '../../billing/types/billing.types';

const PAYMENT_METHODS: Array<{ label: string; value: FolioPaymentMethod }> = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card (Swipe)', value: 'CARD' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'Wallet', value: 'WALLET' },
  { label: 'Other', value: 'OTHER' },
];

function formatCurrency(value: string | number, currency = 'INR') {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', { currency, maximumFractionDigits: 0, style: 'currency' }).format(num);
}

export type CheckoutModalProps = {
  opened: boolean;
  onClose: () => void;
  propertyId: string;
  reservationId: string;
  guestName: string;
  onConfirmCheckout: () => Promise<void>;
};

export function CheckoutModal({ opened, onClose, propertyId, reservationId, guestName, onConfirmCheckout }: CheckoutModalProps) {
  const [folio, setFolio] = useState<Folio | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<FolioPaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    if (!opened) return;
    setLoadError(undefined);
    setIsLoading(true);
    const controller = new AbortController();
    getFolioForReservation(propertyId, reservationId, controller.signal)
      .then((f) => {
        setFolio(f);
        setPaymentAmount(Number(f.totals.balance) || 0);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load folio.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [opened, propertyId, reservationId]);

  const balance = folio ? Number(folio.totals.balance) : 0;
  const total = folio ? Number(folio.totals.total) : 0;
  const paid = folio ? Number(folio.totals.paid) : 0;
  const hasBalance = balance > 0.01;

  const recordPayment = async () => {
    if (!folio) return;
    if (paymentAmount <= 0) {
      showToast({ color: 'red', title: 'Amount required', message: 'Enter the amount collected.' });
      return;
    }
    setIsPaying(true);
    try {
      const next = await addPayment(propertyId, folio.id, {
        method: paymentMethod,
        amount: String(paymentAmount),
        reference: paymentReference.trim() || undefined,
      });
      setFolio(next);
      setPaymentAmount(Math.max(0, Number(next.totals.balance)));
      setPaymentReference('');
      showToast({ color: 'green', title: 'Payment recorded', message: `${formatCurrency(paymentAmount)} received via ${paymentMethod}.` });
    } catch (error) {
      showToast({ color: 'red', title: 'Payment failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsPaying(false);
    }
  };

  const finalizeCheckout = async () => {
    setIsCheckingOut(true);
    try {
      await onConfirmCheckout();
      onClose();
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Checkout · ${guestName}`} size="lg" centered>
      {loadError ? (
        <Alert color="red" variant="light" icon={<AlertTriangle size={17} />}>{loadError}</Alert>
      ) : isLoading || !folio ? (
        <Group justify="center" p={40}><Loader color="stayosBrand" /></Group>
      ) : (
        <Stack gap={spacing[3]}>
          {/* Bill summary */}
          <Paper p={14} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Group justify="space-between" mb={6}>
              <Group gap={8}>
                <ThemeIcon color="stayosBrand" variant="light" size={28}><Receipt size={14} /></ThemeIcon>
                <Text fw={800}>Folio {folio.folioNumber}</Text>
              </Group>
              <Badge color={hasBalance ? 'orange' : 'green'} variant="light">{hasBalance ? `${formatCurrency(balance)} due` : 'Fully paid'}</Badge>
            </Group>
            <Table withRowBorders={false} verticalSpacing={2}>
              <Table.Tbody>
                <Table.Tr><Table.Td c="#64748b">Total charges</Table.Td><Table.Td ta="right"><b>{formatCurrency(total)}</b></Table.Td></Table.Tr>
                <Table.Tr><Table.Td c="#64748b">Paid so far</Table.Td><Table.Td ta="right" c="green">- {formatCurrency(paid)}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td c="#101828" fw={800}>Balance to collect</Table.Td><Table.Td ta="right" c={hasBalance ? '#b45309' : '#166534'} fw={800}>{formatCurrency(balance)}</Table.Td></Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

          {/* Payment collector */}
          {hasBalance ? (
            <>
              <Divider label="Collect payment" labelPosition="left" />
              <Group grow>
                <NumberInput label="Amount" min={0} value={paymentAmount} onChange={(v) => setPaymentAmount(Number(v) || 0)} data-testid="checkout-amount" />
                <Select label="Method" value={paymentMethod} onChange={(v) => setPaymentMethod((v as FolioPaymentMethod) ?? 'CASH')} data={PAYMENT_METHODS} data-testid="checkout-method" />
              </Group>
              <TextInput label="Reference (optional)" placeholder="Card txn id / UPI ref" value={paymentReference} onChange={(e) => setPaymentReference(e.currentTarget.value)} />
              <Group justify="flex-end">
                <Button variant="light" color="stayosBrand" loading={isPaying} onClick={() => void recordPayment()} data-testid="checkout-record-payment">Record payment</Button>
              </Group>
              <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
                Please collect the balance before completing checkout. You can split a payment across methods by recording one row at a time.
              </Alert>
            </>
          ) : (
            <Alert color="green" variant="light" icon={<CheckCircle2 size={16} />}>
              Folio is fully settled. You can complete checkout.
            </Alert>
          )}

          <Group justify="space-between" mt={spacing[2]}>
            <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
            <Button
              color="red"
              leftSection={<CreditCard size={16} />}
              disabled={hasBalance}
              loading={isCheckingOut}
              onClick={() => void finalizeCheckout()}
              data-testid="checkout-confirm"
            >
              Complete checkout
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
