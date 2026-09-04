'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Modal,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ArrowLeft, BedDouble, CheckCircle2, Receipt, Wallet } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import {
  completeGroupCheckout,
  getGroupMasterFolio,
  postGroupMasterFolioCharge,
  postGroupMasterFolioPayment,
  type GroupMasterFolioDetailDto,
} from '../../lib/operations-api';
import { getProperties } from '../../lib/inventory-api';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function isAbortError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && /aborted|abort/i.test(err.message))
  );
}

export function GroupMasterFolioPage({ groupBookingId }: { groupBookingId: string }) {
  const backend = useBackendStatus();
  const router = useRouter();
  const [propertyId, setPropertyId] = useState('');
  const [folio, setFolio] = useState<GroupMasterFolioDetailDto | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [chargeLabel, setChargeLabel] = useState('');
  const [chargeAmount, setChargeAmount] = useState<number | ''>(0);
  const [chargeType, setChargeType] = useState('MISC');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(undefined);
    getProperties(controller.signal)
      .then(async (properties) => {
        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        if (!id) throw new Error('No active property is available.');
        setPropertyId(id);
        try {
          const next = await getGroupMasterFolio(id, groupBookingId, controller.signal);
          if (!controller.signal.aborted) setFolio(next);
        } catch (err) {
          if (controller.signal.aborted || isAbortError(err)) return;
          setError(err instanceof Error ? err.message : 'Unable to load group master folio.');
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'Unable to load property.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [groupBookingId]);

  const refreshFolio = async (id: string) => {
    const next = await getGroupMasterFolio(id, groupBookingId);
    setFolio(next);
    return next;
  };

  const handleChargeSubmit = async () => {
    if (!propertyId || !chargeLabel.trim() || typeof chargeAmount !== 'number' || chargeAmount <= 0)
      return;
    setSubmitting(true);
    setError(undefined);
    try {
      await postGroupMasterFolioCharge(propertyId, groupBookingId, {
        amount: Number(chargeAmount),
        label: chargeLabel.trim(),
        type: chargeType,
      });
      await refreshFolio(propertyId);
      setChargeLabel('');
      setChargeAmount(0);
      setChargeType('MISC');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post the charge.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (
      !propertyId ||
      !folio ||
      typeof paymentAmount !== 'number' ||
      paymentAmount <= 0 ||
      paymentAmount > folio.checkoutSummary.balanceDue
    )
      return;
    setSubmitting(true);
    setError(undefined);
    try {
      await postGroupMasterFolioPayment(propertyId, groupBookingId, {
        amount: Number(paymentAmount),
        method: paymentMethod,
        reference: paymentReference || undefined,
      });
      await refreshFolio(propertyId);
      setPaymentAmount(0);
      setPaymentMethod('CASH');
      setPaymentReference('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Payment may have posted, but the latest folio could not be loaded. Please retry refresh.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutSubmit = async () => {
    if (!propertyId || !folio) return;
    setCheckingOut(true);
    setError(undefined);
    try {
      const checkedOutRoomCount = folio.checkoutSummary.occupiedRoomCount;
      const next = await completeGroupCheckout(propertyId, groupBookingId);
      setFolio(next);
      setCheckoutOpened(false);
      showToast({
        color: 'green',
        message: `${next.groupName} · ${checkedOutRoomCount} rooms checked out`,
        title: 'Checkout complete',
      });
      router.push('/reservations');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete checkout.');
    } finally {
      setCheckingOut(false);
    }
  };

  const chargeIsValid =
    Boolean(chargeLabel.trim()) && typeof chargeAmount === 'number' && chargeAmount > 0;
  const paymentIsValid =
    Boolean(folio) &&
    typeof paymentAmount === 'number' &&
    paymentAmount > 0 &&
    paymentAmount <= (folio?.checkoutSummary.balanceDue ?? 0);
  const folioClosed = folio?.status === 'CLOSED';
  const canCompleteCheckout =
    Boolean(folio) &&
    folio.checkoutSummary.checkoutEligible &&
    folio.checkoutSummary.balanceDue <= 0.01;

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
        <Group justify="space-between" align="flex-start" gap={spacing[3]} wrap="wrap">
          <Box style={{ minWidth: 0 }}>
            <Group gap={8}>
              <Button
                component={Link}
                href={`/reservations/group-holds/${groupBookingId}`}
                variant="light"
                color="gray"
                leftSection={<ArrowLeft size={16} />}
              >
                Back
              </Button>
              <Badge color="green" variant="light">
                {folio?.status ?? 'OPEN'}
              </Badge>
            </Group>
            <Title order={1} c="#101828" mt={10} style={{ fontSize: 30, fontWeight: 900 }}>
              {folio?.folioNumber ?? 'Group Master Folio'}
            </Title>
            <Text c="#64748b" size="sm">
              {folio ? `${folio.groupCode} · ${folio.groupName}` : 'Loading group folio...'}
            </Text>
          </Box>
          <Box ta={{ base: 'left', sm: 'right' }}>
            <Text c="#64748b" size="sm">
              Estimated total
            </Text>
            <Text fw={800} size="xl" c="#101828">
              {folio ? formatCurrency(folio.estimatedTotal) : '—'}
            </Text>
            {folio && !folioClosed ? (
              <Button
                mt={12}
                color="green"
                leftSection={<CheckCircle2 size={15} />}
                onClick={() => setCheckoutOpened(true)}
                loading={checkingOut}
                disabled={!canCompleteCheckout || checkingOut || submitting}
              >
                Complete checkout
              </Button>
            ) : null}
          </Box>
        </Group>

        {error ? (
          <Alert color="red" variant="light" title="Folio needs attention">
            {error}
          </Alert>
        ) : null}

        {isLoading && !folio && !error ? (
          <Card
            radius={radius.lg}
            p={20}
            style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
          >
            <Text fw={800} c="#101828">
              Loading master folio…
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              Getting charges, payments, room balances, and checkout readiness.
            </Text>
          </Card>
        ) : null}

        {folio ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
              <Card
                data-testid="group-payment-summary"
                radius={radius.lg}
                p={16}
                style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
              >
                <Group gap={8}>
                  <BedDouble size={18} color="#2563eb" />
                  <Text fw={700}>Group stay</Text>
                </Group>
                <Text c="#64748b" size="sm" mt={10}>
                  {formatDate(folio.arrivalDate)} to {formatDate(folio.departureDate)}
                </Text>
                <Text c="#334155" size="sm" mt={4}>
                  Rooms:{' '}
                  {folio.rooms.map((room) => room.roomNumber).join(', ') || 'Pending assignment'}
                </Text>
              </Card>
              <Card
                radius={radius.lg}
                p={16}
                style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
              >
                <Group gap={8}>
                  <Receipt size={18} color="#7c3aed" />
                  <Text fw={700}>Charges</Text>
                </Group>
                <Stack gap={8} mt={10}>
                  {folio.charges.length ? (
                    folio.charges.map((charge) => (
                      <Group key={charge.id} justify="space-between" wrap="wrap">
                        <Box>
                          <Text fw={600} size="sm">
                            {charge.label}
                          </Text>
                          <Text c="#64748b" size="xs">
                            {charge.quantity} room{charge.quantity > 1 ? 's' : ''}
                          </Text>
                        </Box>
                        <Text fw={700} size="sm">
                          {formatCurrency(charge.amount)}
                        </Text>
                      </Group>
                    ))
                  ) : (
                    <Text c="#64748b" size="sm">
                      No charge rows have been posted yet.
                    </Text>
                  )}
                </Stack>
              </Card>
              <Card
                radius={radius.lg}
                p={16}
                style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
              >
                <Group gap={8}>
                  <Wallet size={18} color="#059669" />
                  <Text fw={700}>Payment summary</Text>
                </Group>
                <Stack gap={8} mt={10}>
                  <Group justify="space-between">
                    <Text c="#64748b" size="sm">
                      Total charges
                    </Text>
                    <Text fw={700} size="sm">
                      <span data-testid="group-total-charges">
                        {formatCurrency(folio.checkoutSummary.totalCharges)}
                      </span>
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text c="#64748b" size="sm">
                      Total paid
                    </Text>
                    <Text fw={700} size="sm">
                      <span data-testid="group-total-paid">
                        {formatCurrency(folio.checkoutSummary.totalPaid)}
                      </span>
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text c="#64748b" size="sm">
                      Balance due
                    </Text>
                    <Text
                      fw={800}
                      size="sm"
                      c={folio.checkoutSummary.balanceDue > 0 ? 'orange.8' : 'green.8'}
                    >
                      <span data-testid="group-balance-due">
                        {formatCurrency(folio.checkoutSummary.balanceDue)}
                      </span>
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text c="#64748b" size="sm">
                      Payment status
                    </Text>
                    <Badge
                      data-testid="group-payment-status"
                      color={
                        folio.checkoutSummary.paymentStatus === 'PAID'
                          ? 'green'
                          : folio.checkoutSummary.paymentStatus === 'PARTIALLY_PAID'
                            ? 'yellow'
                            : 'gray'
                      }
                      variant="light"
                    >
                      {folio.checkoutSummary.paymentStatus.replace(/_/g, ' ')}
                    </Badge>
                  </Group>
                  <Divider />
                  <Group justify="space-between">
                    <Text c="#64748b" size="sm">
                      Occupied rooms
                    </Text>
                    <Text fw={700} size="sm">
                      {folio.checkoutSummary.occupiedRoomCount}
                    </Text>
                  </Group>
                  {folio.checkoutSummary.checkoutBlockers.length ? (
                    <Text c="#dc2626" size="xs">
                      {folio.checkoutSummary.checkoutBlockers.join(' • ')}
                    </Text>
                  ) : (
                    <Text c="#059669" size="xs">
                      Ready for checkout preparation.
                    </Text>
                  )}
                </Stack>
              </Card>
            </SimpleGrid>

            <Card
              radius={radius.lg}
              p={16}
              style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
            >
              <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>
                Payment history
              </Title>
              {folio.payments.length ? (
                <Box style={{ overflowX: 'auto' }}>
                  <Table
                    data-testid="group-payment-history"
                    mt={12}
                    verticalSpacing="sm"
                    highlightOnHover
                    miw={640}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date & time</Table.Th>
                        <Table.Th>Method</Table.Th>
                        <Table.Th>Reference</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {folio.payments.map((payment) => (
                        <Table.Tr key={payment.id}>
                          <Table.Td>{formatDateTime(payment.receivedAt)}</Table.Td>
                          <Table.Td>{payment.method}</Table.Td>
                          <Table.Td>{payment.reference || '-'}</Table.Td>
                          <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(payment.amount)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              ) : (
                <Text c="#64748b" mt={12} size="sm">
                  No payments recorded yet.
                </Text>
              )}
            </Card>

            <Card
              radius={radius.lg}
              p={16}
              style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
            >
              <Group justify="space-between" gap={spacing[2]} wrap="wrap">
                <Box>
                  <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>
                    Post to folio
                  </Title>
                  <Text c="#64748b" size="sm" mt={2}>
                    Add incidental charges or record money actually received.
                  </Text>
                </Box>
                {folioClosed ? <Badge color="gray">FOLIO CLOSED</Badge> : null}
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]} mt={12}>
                <Stack gap={10}>
                  <Text fw={700}>Add charge</Text>
                  <TextInput
                    label="Description"
                    value={chargeLabel}
                    onChange={(event) => setChargeLabel(event.currentTarget.value)}
                    placeholder="Mini bar"
                  />
                  <NumberInput
                    data-testid="group-payment-amount"
                    label="Amount"
                    value={chargeAmount}
                    onChange={(value) => setChargeAmount(typeof value === 'number' ? value : '')}
                    min={0.01}
                    decimalScale={2}
                    prefix="₹"
                  />
                  <Select
                    label="Type"
                    data={[
                      'ROOM',
                      'FOOD_AND_BEVERAGE',
                      'MINIBAR',
                      'LAUNDRY',
                      'SPA',
                      'TAX',
                      'DISCOUNT',
                      'MISC',
                    ]}
                    value={chargeType}
                    onChange={(value) => setChargeType(value ?? 'MISC')}
                  />
                  <Button
                    onClick={() => void handleChargeSubmit()}
                    loading={submitting}
                    disabled={!chargeIsValid || folioClosed || checkingOut}
                  >
                    Post charge
                  </Button>
                </Stack>
                <Stack gap={10}>
                  <Text fw={700}>Record payment</Text>
                  <NumberInput
                    label="Amount"
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(typeof value === 'number' ? value : '')}
                    min={0.01}
                    max={folio.checkoutSummary.balanceDue}
                    decimalScale={2}
                    prefix="₹"
                    description={`Balance due: ${formatCurrency(folio.checkoutSummary.balanceDue)}`}
                  />
                  <Select
                    data-testid="group-payment-method"
                    label="Method"
                    data={['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'OTHER']}
                    value={paymentMethod}
                    onChange={(value) => setPaymentMethod(value ?? 'CASH')}
                  />
                  <TextInput
                    data-testid="group-payment-reference"
                    label="Reference (optional)"
                    description="Transaction, UPI, bank, or card reference when available."
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.currentTarget.value)}
                    placeholder="TXN-001"
                  />
                  {folio.checkoutSummary.balanceDue > 0 ? (
                    <Button
                      variant="subtle"
                      color="gray"
                      size="compact-sm"
                      onClick={() => setPaymentAmount(folio.checkoutSummary.balanceDue)}
                      disabled={folioClosed || submitting || checkingOut}
                    >
                      Use full balance · {formatCurrency(folio.checkoutSummary.balanceDue)}
                    </Button>
                  ) : (
                    <Alert color="green" variant="light">
                      No balance is due.
                    </Alert>
                  )}
                  <Button
                    data-testid="group-record-payment"
                    onClick={() => void handlePaymentSubmit()}
                    loading={submitting}
                    variant="light"
                    disabled={!paymentIsValid || folioClosed || checkingOut}
                  >
                    Record payment
                  </Button>
                </Stack>
              </SimpleGrid>
            </Card>

            <Card
              radius={radius.lg}
              p={16}
              style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.95)' }}
            >
              <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>
                Master folio rooms
              </Title>
              <Stack gap={8} mt={12}>
                {folio.rooms.length ? (
                  folio.rooms.map((room) => (
                    <Box
                      key={room.roomId}
                      p={12}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                      }}
                    >
                      <Group justify="space-between" wrap="wrap">
                        <Text fw={700}>{room.roomNumber}</Text>
                        <Text c="#64748b" size="sm">
                          {room.roomTypeName}
                        </Text>
                      </Group>
                    </Box>
                  ))
                ) : (
                  <Text c="#64748b">No rooms assigned to this group folio yet.</Text>
                )}
              </Stack>
            </Card>
          </>
        ) : null}
      </Stack>

      <Modal
        centered
        opened={checkoutOpened}
        onClose={() => {
          if (!checkingOut) setCheckoutOpened(false);
        }}
        title="Complete group checkout?"
      >
        <Stack gap={spacing[3]}>
          {canCompleteCheckout ? (
            <Alert color="green" variant="light">
              The master folio is settled and the group is eligible for checkout.
            </Alert>
          ) : (
            <Alert color="red" variant="light" title="Checkout blocked">
              {folio && folio.checkoutSummary.balanceDue > 0.01
                ? `Settle the remaining balance of ${formatCurrency(
                    folio.checkoutSummary.balanceDue,
                  )} before completing checkout.`
                : folio?.checkoutSummary.checkoutBlockers.length
                  ? folio.checkoutSummary.checkoutBlockers.join(' • ')
                  : 'This group is not currently eligible for checkout.'}
            </Alert>
          )}
          <Box>
            <Text fw={800}>
              {folio?.groupCode} · {folio?.groupName}
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              {folio?.checkoutSummary.occupiedRoomCount ?? 0} occupied rooms will be checked out.
            </Text>
          </Box>
          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button
              variant="subtle"
              color="gray"
              disabled={checkingOut}
              onClick={() => setCheckoutOpened(false)}
            >
              Go back
            </Button>
            <Button
              color="green"
              leftSection={<CheckCircle2 size={15} />}
              loading={checkingOut}
              disabled={!canCompleteCheckout || checkingOut}
              onClick={() => void handleCheckoutSubmit()}
            >
              Confirm checkout
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
