'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ArrowLeft, BedDouble, Receipt, Wallet } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, useBackendStatus } from '@stayos/ui';
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

export function GroupMasterFolioPage({ groupBookingId }: { groupBookingId: string }) {
  const backend = useBackendStatus();
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
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getProperties(controller.signal)
      .then(async (properties) => {
        const active =
          properties.find(
            (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
          ) ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        setPropertyId(id);
        if (!id) return;
        try {
          const next = await getGroupMasterFolio(id, groupBookingId, controller.signal);
          setFolio(next);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to load group master folio.');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load property.'));
    return () => controller.abort();
  }, [groupBookingId]);

  const refreshFolio = async (id: string) => {
    const next = await getGroupMasterFolio(id, groupBookingId);
    setFolio(next);
  };

  const handleChargeSubmit = async () => {
    if (!propertyId || !chargeLabel || !chargeAmount) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const next = await postGroupMasterFolioCharge(propertyId, groupBookingId, {
        amount: Number(chargeAmount),
        label: chargeLabel,
        type: chargeType,
      });
      setFolio(next);
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
    if (!propertyId || !paymentAmount) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const next = await postGroupMasterFolioPayment(propertyId, groupBookingId, {
        amount: Number(paymentAmount),
        method: paymentMethod,
        reference: paymentReference || undefined,
      });
      setFolio(next);
      setPaymentAmount(0);
      setPaymentMethod('CASH');
      setPaymentReference('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record the payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutSubmit = async () => {
    if (!propertyId || !folio) return;
    setCheckingOut(true);
    setError(undefined);
    try {
      const next = await completeGroupCheckout(propertyId, groupBookingId);
      setFolio(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete checkout.');
    } finally {
      setCheckingOut(false);
    }
  };

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
        <Group justify="space-between" align="flex-start">
          <Box>
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
          <Box ta="right">
            <Text c="#64748b" size="sm">
              Estimated total
            </Text>
            <Text fw={800} size="xl" c="#101828">
              {folio ? formatCurrency(folio.estimatedTotal) : '—'}
            </Text>
            {folio ? (
              <Button
                mt={12}
                color="green"
                onClick={handleCheckoutSubmit}
                loading={checkingOut}
                disabled={
                  !folio.checkoutSummary.checkoutEligible || folio.checkoutSummary.balanceDue > 0
                }
              >
                Complete checkout
              </Button>
            ) : null}
          </Box>
        </Group>

        {error ? <Alert color="red">{error}</Alert> : null}

        {folio ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
              <Card
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
                  <Text fw={700}>Payments</Text>
                </Group>
                <Stack gap={8} mt={10}>
                  <Group justify="space-between">
                    <Text c="#64748b" size="sm">
                      Balance due
                    </Text>
                    <Text fw={700} size="sm">
                      {formatCurrency(folio.checkoutSummary.balanceDue)}
                    </Text>
                  </Group>
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
                Post to folio
              </Title>
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
                    label="Amount"
                    value={chargeAmount}
                    onChange={(value) => setChargeAmount(typeof value === 'number' ? value : '')}
                    min={0}
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
                  <Button onClick={handleChargeSubmit} loading={submitting}>
                    Post charge
                  </Button>
                </Stack>
                <Stack gap={10}>
                  <Text fw={700}>Record payment</Text>
                  <NumberInput
                    label="Amount"
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(typeof value === 'number' ? value : '')}
                    min={0}
                    prefix="₹"
                  />
                  <Select
                    label="Method"
                    data={['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'OTHER']}
                    value={paymentMethod}
                    onChange={(value) => setPaymentMethod(value ?? 'CASH')}
                  />
                  <TextInput
                    label="Reference"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.currentTarget.value)}
                    placeholder="TXN-001"
                  />
                  <Button onClick={handlePaymentSubmit} loading={submitting} variant="light">
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
    </Box>
  );
}
