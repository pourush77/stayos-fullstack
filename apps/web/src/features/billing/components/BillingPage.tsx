'use client';

import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Box,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ChevronRight, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { useAuth } from '../../auth/auth-context';
import { formatCurrency, getBillingOverview, listFolios } from '../api/billing-api';
import type { BillingOverview, Folio, FolioStatus } from '../types/billing.types';

const statusFilters: Array<{ value: FolioStatus; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'VOID', label: 'Void' },
];

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function statusColor(status: FolioStatus): string {
  if (status === 'OPEN') return 'yellow';
  if (status === 'SETTLED') return 'green';
  return 'red';
}

function StatCard({
  label,
  value,
  color = '#101828',
  testId,
}: {
  label: string;
  value: string;
  color?: string;
  testId?: string;
}) {
  return (
    <Paper data-testid={testId} radius={radius.lg} p={18} style={{ border: '1px solid #e2e8f0' }}>
      <Text c="#64748b" size="xs" fw={800} tt="uppercase">
        {label}
      </Text>
      <Text c={color} fw={800} mt={6} style={{ fontSize: 24 }}>
        {value}
      </Text>
    </Paper>
  );
}

function BillingPageLoading() {
  return (
    <Stack gap={spacing[3]} aria-label="Loading billing" aria-busy="true">
      <Box>
        <Skeleton height={38} width={145} radius="sm" />
        <Skeleton mt={6} height={15} width={380} maw="70vw" radius="sm" />
      </Box>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing={spacing[3]}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Paper
            key={`billing-stat-skeleton-${index}`}
            radius={radius.lg}
            p={18}
            style={{ border: '1px solid #e2e8f0' }}
          >
            <Skeleton height={11} width={95} radius="sm" />
            <Skeleton mt={9} height={27} width={78} radius="sm" />
          </Paper>
        ))}
      </SimpleGrid>

      <Paper radius={radius.lg} p={16} style={{ border: '1px solid #e2e8f0' }}>
        <Group grow align="flex-end" wrap="wrap">
          <Box>
            <Skeleton height={12} width={55} radius="sm" />
            <Skeleton mt={7} height={38} width="100%" radius="md" />
          </Box>
          <Box>
            <Skeleton height={12} width={45} radius="sm" />
            <Skeleton mt={7} height={38} width="100%" radius="md" />
          </Box>
        </Group>
      </Paper>

      <Paper radius={radius.lg} p={0} style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box px={18} py={14} bg="#f8fafc">
          <Group justify="space-between" wrap="nowrap">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton
                key={`billing-header-skeleton-${index}`}
                height={11}
                width={index < 3 ? 90 : 65}
                radius="sm"
              />
            ))}
          </Group>
        </Box>

        <Stack gap={0}>
          {Array.from({ length: 7 }).map((_, rowIndex) => (
            <Box
              key={`billing-row-skeleton-${rowIndex}`}
              px={18}
              py={14}
              style={{ borderTop: '1px solid #eef2f7' }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Skeleton height={14} width={90} radius="sm" />
                <Skeleton height={14} width={120} radius="sm" />
                <Skeleton height={14} width={95} radius="sm" />
                <Skeleton height={24} width={68} radius={radius.full} />
                <Skeleton height={14} width={70} radius="sm" />
                <Skeleton height={14} width={70} radius="sm" />
                <Skeleton height={14} width={70} radius="sm" />
                <Skeleton height={28} width={58} radius="md" />
              </Group>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

export function BillingPage() {
  const auth = useAuth();
  const canView = hasPermission(auth.user?.permissions, 'billing.view');
  const propertyId = auth.user?.propertyId;

  const [folios, setFolios] = useState<Folio[]>([]);
  const [overview, setOverview] = useState<BillingOverview | undefined>();
  const [status, setStatus] = useState<FolioStatus | undefined>();
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!canView || !propertyId) {
        setIsLoading(false);
        setHasLoadedOnce(true);
        return;
      }
      setIsLoading(true);
      setError(undefined);
      try {
        const [foliosResult, overviewResult] = await Promise.all([
          listFolios(propertyId, status ? { status } : undefined, signal),
          getBillingOverview(propertyId, signal),
        ]);
        setFolios(foliosResult);
        setOverview(overviewResult);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Unable to load billing data.');
      } finally {
        // An aborted request is not a completed load. This matters in
        // React development mode and when filters change quickly, because
        // effect cleanup can cancel an in-flight request before the next
        // request starts.
        if (!signal?.aborted) {
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
      }
    },
    [canView, propertyId, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return folios;
    return folios.filter((folio) => {
      const haystack =
        `${folio.folioNumber} ${folio.guest.displayName} ${folio.reservation.reservationCode}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [folios, search]);

  if (!canView) {
    return (
      <Alert color="red" title="Billing unavailable" data-testid="billing-forbidden">
        You do not have permission to view billing.
      </Alert>
    );
  }

  if (!hasLoadedOnce && isLoading) {
    return <BillingPageLoading />;
  }

  return (
    <Stack gap={spacing[3]} data-testid="billing-page">
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
          Billing
        </Title>
        <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
          Review guest accounts, outstanding balances, payments, and settlement status.
        </Text>
      </Box>

      {overview ? (
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing={spacing[3]}>
          <StatCard
            label="Open Folios"
            value={String(overview.openFolios)}
            testId="stat-open-folios"
          />
          <StatCard
            label="Settled"
            value={String(overview.settledFolios)}
            testId="stat-settled-folios"
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(overview.outstandingBalance)}
            color={Number(overview.outstandingBalance) > 0 ? '#c92a2a' : '#101828'}
            testId="stat-outstanding"
          />
          <StatCard
            label="Today's Revenue"
            value={formatCurrency(overview.todayRevenue)}
            color="#0f8f4b"
            testId="stat-today-revenue"
          />
          <StatCard
            label="This Month"
            value={formatCurrency(overview.monthRevenue)}
            color="#0f8f4b"
            testId="stat-month-revenue"
          />
        </SimpleGrid>
      ) : null}

      <Paper radius={radius.lg} p={16} style={{ border: '1px solid #e2e8f0' }}>
        <Group justify="space-between" align="flex-end" gap={spacing[3]} wrap="wrap">
          <Group grow align="flex-end" wrap="wrap" style={{ flex: 1, minWidth: 280 }}>
            <TextInput
              data-testid="billing-search"
              label="Search"
              placeholder="Search by folio, guest or reservation"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              clearable
              data={statusFilters}
              data-testid="billing-status-filter"
              label="Status"
              value={status ?? null}
              onChange={(value) => {
                setError(undefined);
                setStatus((value as FolioStatus | null) ?? undefined);
              }}
            />
          </Group>
          <Text c="#64748b" size="xs" fw={700}>
            {filtered.length} {filtered.length === 1 ? 'folio' : 'folios'}
          </Text>
        </Group>
      </Paper>

      {error ? (
        <Alert color="red" title="Unable to load billing data." data-testid="billing-error">
          <Stack gap={8}>
            <Text size="sm">{error}</Text>
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<RefreshCcw size={14} />}
              onClick={() => void load()}
              loading={isLoading}
              style={{ alignSelf: 'flex-start' }}
            >
              Retry
            </Button>
          </Stack>
        </Alert>
      ) : null}

      {isLoading && hasLoadedOnce ? (
        <Group gap={8} role="status" aria-live="polite">
          <Loader color="stayosBrand" size="xs" />
          <Text c="#64748b" size="sm" fw={600}>
            Updating folios…
          </Text>
        </Group>
      ) : null}

      {!isLoading && !error && filtered.length === 0 ? (
        <Paper radius={radius.lg} p={28} style={{ border: '1px solid #e2e8f0' }}>
          <Text c="#101828" fw={800} size="md">
            {search.trim() || status ? 'No matching folios' : 'No folios yet'}
          </Text>
          <Text c="#64748b" size="sm" mt={4}>
            {search.trim() || status
              ? 'Try clearing the search or status filter.'
              : 'Folios open automatically when a reservation is checked in. You can then manage the account from Billing or the Stay Workspace.'}
          </Text>
          {search.trim() || status ? (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              mt={10}
              onClick={() => {
                setSearch('');
                setStatus(undefined);
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </Paper>
      ) : null}

      {filtered.length > 0 ? (
        <Paper radius={radius.lg} p={0} style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Folio</Table.Th>
                  <Table.Th>Guest</Table.Th>
                  <Table.Th>Reservation</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Paid</Table.Th>
                  <Table.Th>Balance</Table.Th>
                  <Table.Th aria-label="Actions"></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((folio) => (
                  <Table.Tr key={folio.id} data-testid={`folio-row-${folio.id}`}>
                    <Table.Td>
                      <Text c="#101828" fw={800}>
                        {folio.folioNumber}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Text>{folio.guest.displayName}</Text>
                        {folio.guest.isVip ? (
                          <Badge color="grape" size="xs" variant="light">
                            VIP
                          </Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>{folio.reservation.reservationCode}</Table.Td>
                    <Table.Td>
                      <Stack gap={3} align="flex-start">
                        <Badge color={statusColor(folio.status)} variant="light">
                          {folio.status}
                        </Badge>
                        {folio.status === 'OPEN' && Number(folio.totals.balance) > 0 ? (
                          <Text c="#b45309" size="xs" fw={700}>
                            Payment due
                          </Text>
                        ) : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={700}>{formatCurrency(folio.totals.total)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="#0f8f4b" fw={700}>
                        {formatCurrency(folio.totals.paid)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c={Number(folio.totals.balance) > 0 ? '#c92a2a' : '#0f8f4b'} fw={800}>
                        {formatCurrency(folio.totals.balance)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Link
                        href={`/billing/${folio.id}`}
                        style={{ textDecoration: 'none', color: '#0f172a' }}
                        data-testid={`open-folio-${folio.id}`}
                      >
                        <Group gap={4}>
                          <Text c="#0f172a" fw={700} size="sm">
                            View folio
                          </Text>
                          <ChevronRight size={14} />
                        </Group>
                      </Link>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : null}
    </Stack>
  );
}
