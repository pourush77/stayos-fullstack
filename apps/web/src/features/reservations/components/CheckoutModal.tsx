'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Divider, Group, Loader, Modal, NumberInput, Paper, Select, Stack, Table, Text, TextInput, ThemeIcon } from '@mantine/core';
import { AlertTriangle, CheckCircle2, CreditCard, Download, Mail, MessageCircle, Receipt, Smartphone } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { API_BASE_URL } from '../../../lib/api-base';
import { showToast } from '@stayos/ui';
import { addPayment, createRazorpayOrder, getFolioForReservation, getRazorpayConfig, verifyRazorpayPayment } from '../../billing/api/billing-api';
import type { Folio, FolioPaymentMethod } from '../../billing/types/billing.types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (payload: unknown) => void) => void };
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
  const [isRazorpaying, setIsRazorpaying] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | undefined>(undefined);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<FolioPaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);

  useEffect(() => {
    if (!opened || !folio?.id) return;
    const controller = new AbortController();
    getRazorpayConfig(propertyId, folio.id)
      .then((cfg) => {
        if (controller.signal.aborted) return;
        setRazorpayEnabled(Boolean(cfg?.configured));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRazorpayEnabled(false);
      });
    return () => controller.abort();
  }, [opened, propertyId, folio?.id]);

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
      setLastPaymentId(next.payments?.[next.payments.length - 1]?.id);
      showToast({ color: 'green', title: 'Payment recorded', message: `${formatCurrency(paymentAmount)} received via ${paymentMethod}.` });
    } catch (error) {
      showToast({ color: 'red', title: 'Payment failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsPaying(false);
    }
  };

  const payViaRazorpay = async () => {
    if (!folio) return;
    if (paymentAmount <= 0) {
      showToast({ color: 'red', title: 'Amount required', message: 'Enter the amount to charge.' });
      return;
    }
    setIsRazorpaying(true);
    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) throw new Error('Could not load Razorpay Checkout script.');
      const order = await createRazorpayOrder(propertyId, folio.id, {
        amount: String(paymentAmount),
        reservationId,
        guestName,
      });
      if (!window.Razorpay) throw new Error('Razorpay SDK unavailable');
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'StayOS',
        description: `Folio ${folio.folioNumber}`,
        order_id: order.orderId,
        prefill: { name: guestName },
        theme: { color: '#6d28d9' },
        handler: async (response: unknown) => {
          const r = response as { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
          try {
            const nextFolio = await verifyRazorpayPayment(propertyId, folio.id, {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
              amount: String(paymentAmount),
            });
            setFolio(nextFolio);
            setPaymentAmount(Math.max(0, Number(nextFolio.totals.balance)));
            setLastPaymentId(nextFolio.payments?.[nextFolio.payments.length - 1]?.id);
            showToast({ color: 'green', title: 'Payment captured', message: `Razorpay confirmed ${formatCurrency(paymentAmount)}.` });
          } catch (verifyError) {
            showToast({ color: 'red', title: 'Verification failed', message: verifyError instanceof Error ? verifyError.message : 'Please try again.' });
          } finally {
            setIsRazorpaying(false);
          }
        },
        modal: {
          ondismiss: () => setIsRazorpaying(false),
        },
      });
      rzp.on('payment.failed', (payload: unknown) => {
        console.error('Razorpay payment failed', payload);
        showToast({ color: 'red', title: 'Payment failed', message: 'Guest can retry or pay by another method.' });
        setIsRazorpaying(false);
      });
      rzp.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Razorpay unavailable.';
      // Special case: keys not configured on server
      if (/RAZORPAY_NOT_CONFIGURED/.test(message) || /not configured/i.test(message)) {
        showToast({ color: 'yellow', title: 'Razorpay not configured', message: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in stayos-api/.env, then restart the API.' });
      } else {
        showToast({ color: 'red', title: 'Razorpay error', message });
      }
      setIsRazorpaying(false);
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

          {/* Receipt actions (visible after a successful payment) */}
          {lastPaymentId && folio ? (
            <Paper p={12} radius={radius.md} style={{ background: '#ecfdf5', border: '1px solid #bbf7d0' }}>
              <Group justify="space-between" wrap="wrap" gap={8}>
                <Group gap={8}>
                  <ThemeIcon color="green" variant="light" size={28}><CheckCircle2 size={14} /></ThemeIcon>
                  <Text fw={700} c="#166534" size="sm">Receipt ready to share</Text>
                </Group>
                <Group gap={6}>
                  <Button
                    variant="light"
                    color="green"
                    size="xs"
                    leftSection={<Download size={13} />}
                    component="a"
                    href={`${API_BASE_URL}/properties/${propertyId}/folios/${folio.id}/payments/${lastPaymentId}/receipt.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="receipt-download"
                  >
                    Download PDF
                  </Button>
                  <Button
                    variant="light"
                    color="green"
                    size="xs"
                    leftSection={<Mail size={13} />}
                    component="a"
                    href={`mailto:?subject=${encodeURIComponent(`Payment receipt · Folio ${folio.folioNumber}`)}&body=${encodeURIComponent(
                      `Hi ${guestName},\n\nThank you for your payment. Your receipt is available at:\n${API_BASE_URL}/properties/${propertyId}/folios/${folio.id}/payments/${lastPaymentId}/receipt.pdf\n\n— StayOS`,
                    )}`}
                    data-testid="receipt-email"
                  >
                    Email
                  </Button>
                  <Button
                    variant="light"
                    color="green"
                    size="xs"
                    leftSection={<MessageCircle size={13} />}
                    component="a"
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Thank you for your payment to StayOS. Your receipt: ${API_BASE_URL}/properties/${propertyId}/folios/${folio.id}/payments/${lastPaymentId}/receipt.pdf`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="receipt-whatsapp"
                  >
                    WhatsApp
                  </Button>
                </Group>
              </Group>
            </Paper>
          ) : null}

          {/* Payment collector */}
          {hasBalance ? (
            <>
              <Divider label="Collect payment" labelPosition="left" />
              <Group grow>
                <NumberInput label="Amount" min={0} value={paymentAmount} onChange={(v) => setPaymentAmount(Number(v) || 0)} data-testid="checkout-amount" />
                <Select label="Method" value={paymentMethod} onChange={(v) => setPaymentMethod((v as FolioPaymentMethod) ?? 'CASH')} data={PAYMENT_METHODS} data-testid="checkout-method" />
              </Group>
              <TextInput label="Reference (optional)" placeholder="Card txn id / UPI ref" value={paymentReference} onChange={(e) => setPaymentReference(e.currentTarget.value)} />
              <Group justify="space-between">
                {razorpayEnabled ? (
                  <Button
                    variant="light"
                    color="stayosBrand"
                    leftSection={<Smartphone size={16} />}
                    loading={isRazorpaying}
                    onClick={() => void payViaRazorpay()}
                    data-testid="checkout-razorpay"
                  >
                    Charge via Razorpay
                  </Button>
                ) : <span />}
                <Button variant="light" color="stayosBrand" loading={isPaying} onClick={() => void recordPayment()} data-testid="checkout-record-payment">Record manual payment</Button>
              </Group>
              <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
                {razorpayEnabled
                  ? <>Use <b>Charge via Razorpay</b> for cards / UPI / netbanking with instant capture, or <b>Record manual payment</b> for cash or offline receipts.</>
                  : <>Collect payment at reception via cash, card (swipe) or UPI, then <b>Record manual payment</b>. Online payments will appear once Razorpay is enabled.</>}
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
