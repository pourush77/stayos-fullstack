'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ArrowLeft, ClipboardList, Eye, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { useAuth } from '../../auth/auth-context';
import {
  getNightAuditHistory,
  getNightAuditHistoryDetail,
  type NightAuditCompletionSnapshot,
  type NightAuditHistoryDetailDto,
  type NightAuditHistoryRowDto,
  type NightAuditHistorySectionCounts,
} from '../api/reports-api';

const limitedHistoryNotice =
  'Limited historical data - this Night Audit was completed before detailed Night Audit snapshots were introduced.';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function presetRange(preset: string) {
  const today = new Date();
  if (preset === 'TODAY') return { from: dateKey(today), to: dateKey(today) };
  if (preset === 'LAST_7') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: dateKey(from), to: dateKey(today) };
  }
  if (preset === 'THIS_MONTH') return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today) };
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { from: dateKey(from), to: dateKey(today) };
}

function canViewReports(user: ReturnType<typeof useAuth>['user']) {
  return Boolean(
    user &&
    ['ACCOUNTS', 'MANAGER', 'ADMIN', 'OWNER'].includes(String(user.role)) &&
    (user.permissions.includes('reports.view') || user.permissions.includes('*')),
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDisplayDate(value)}, ${new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
}

function formatDisplayDate(value?: string | null) {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, '0')} ${monthLabels[month - 1]} ${year}`;
}

function countText(count?: { count: number | null; blockingCount: number | null }) {
  const total = count?.count ?? '-';
  const blockers = count?.blockingCount ?? '-';
  return `${total} / ${blockers}`;
}

function getStringField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function resolveUserName(source: Record<string, unknown>, prefix: 'started' | 'completed') {
  return getStringField(source, [
    `${prefix}ByUserDisplayName`,
    `${prefix}ByDisplayName`,
    `${prefix}ByUserName`,
    `${prefix}ByName`,
    `${prefix}ByEmail`,
  ]);
}

function userLabel(source: Record<string, unknown>, prefix: 'started' | 'completed') {
  return resolveUserName(source, prefix) ?? 'Name not available';
}

function valueOf(source: Record<string, number> | undefined, keys: string[]) {
  if (!source) return 0;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') return value;
  }
  return 0;
}

function compactStatus(count: number) {
  return count === 0 ? 'Clear' : count;
}

export function NightAuditHistoryListPage() {
  const auth = useAuth();
  const allowed = canViewReports(auth.user);
  const initialRange = useMemo(() => presetRange('LAST_30'), []);
  const [preset, setPreset] = useState('LAST_30');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [rows, setRows] = useState<NightAuditHistoryRowDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propertyId = allowed ? auth.user?.propertyId : undefined;

  const load = async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(null);
    try {
      setRows(await getNightAuditHistory(propertyId, from, to));
    } catch {
      setError('Unable to load Night Audit history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [propertyId, from, to]);

  const setRangePreset = (value: string) => {
    setPreset(value);
    if (value !== 'CUSTOM') {
      const next = presetRange(value);
      setFrom(next.from);
      setTo(next.to);
    }
  };

  if (!allowed) {
    return <Alert color="red" title="Reports unavailable">Reports are available to Accounts, Managers, Admins, and Owners.</Alert>;
  }

  return (
    <Stack gap={spacing[3]} data-testid="night-audit-history-page">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
            Night Audit History
          </Title>
          <Text c="#64748b" mt={4} size="sm">
            Completed Night Audits and their immutable operational snapshots.
          </Text>
        </Box>
        <Button component={Link} href="/reports" variant="subtle" leftSection={<ArrowLeft size={16} />}>
          Reports
        </Button>
      </Group>

      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group align="flex-end" wrap="wrap">
          <SegmentedControl
            data={[
              { label: 'Today', value: 'TODAY' },
              { label: 'Last 7', value: 'LAST_7' },
              { label: 'This Month', value: 'THIS_MONTH' },
              { label: 'Last 30', value: 'LAST_30' },
              { label: 'Custom', value: 'CUSTOM' },
            ]}
            onChange={setRangePreset}
            value={preset}
          />
          <TextInput label="From" type="date" value={from} onChange={(event) => { setPreset('CUSTOM'); setFrom(event.currentTarget.value); }} />
          <TextInput label="To" type="date" value={to} onChange={(event) => { setPreset('CUSTOM'); setTo(event.currentTarget.value); }} />
        </Group>
      </Card>

      {error ? (
        <Alert
          color="red"
          variant="light"
          radius={radius.lg}
          title="Night Audit history unavailable"
          data-testid="night-audit-history-error"
        >
          <Group justify="space-between" gap={spacing[3]}>
            <Text size="sm">{error}</Text>
            <Button variant="light" size="xs" leftSection={<RotateCcw size={14} />} onClick={() => void load()}>
              Retry
            </Button>
          </Group>
        </Alert>
      ) : null}

      {isLoading ? (
        <Group gap={8} role="status" aria-live="polite" data-testid="night-audit-history-loading">
          <Loader color="stayosBrand" size="xs" />
          <Text c="#64748b" size="sm" fw={600}>Loading Night Audit history...</Text>
        </Group>
      ) : null}

      <Card p={0} radius={radius.lg} shadow="xs" style={{ border: 'none', overflow: 'hidden' }}>
        {rows.length === 0 && !isLoading && !error ? (
          <Stack align="center" gap={8} p={spacing[6]} data-testid="night-audit-history-empty">
            <ClipboardList size={28} color="#64748b" />
            <Text fw={700} c="#101828">No completed Night Audits found</Text>
            <Text c="#64748b" size="sm">Try a wider business date range.</Text>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={980}>
            <Table verticalSpacing="sm" data-testid="night-audit-history-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Business Date</Table.Th>
                  <Table.Th>Closed At</Table.Th>
                  <Table.Th>Closed By</Table.Th>
                  <Table.Th>Snapshot</Table.Th>
                  <Table.Th>Pending Arrivals</Table.Th>
                  <Table.Th>Stay Review</Table.Th>
                  <Table.Th>Folio Exceptions</Table.Th>
                  <Table.Th>Group Review</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.runId} data-testid="night-audit-history-row">
                    <Table.Td><Text fw={700}>{formatDisplayDate(row.businessDate)}</Text></Table.Td>
                    <Table.Td>{formatDateTime(row.completedAt)}</Table.Td>
                    <Table.Td><Text size="sm" truncate maw={180}>{userLabel(row as unknown as Record<string, unknown>, 'completed')}</Text></Table.Td>
                    <Table.Td>{row.hasSnapshot ? row.completionSnapshotVersion : 'Legacy'}</Table.Td>
                    <Table.Td>{countText(row.sectionCounts.pendingArrivals)}</Table.Td>
                    <Table.Td>{countText(row.sectionCounts.stayReview)}</Table.Td>
                    <Table.Td>{countText(row.sectionCounts.folioExceptions)}</Table.Td>
                    <Table.Td>{countText(row.sectionCounts.groupReview)}</Table.Td>
                    <Table.Td>
                      <Button component={Link} href={`/reports/night-audit-history/${row.runId}`} size="xs" leftSection={<Eye size={14} />}>
                        View Report
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  );
}

export function NightAuditHistoryDetailPage({ runId }: { runId: string }) {
  const auth = useAuth();
  const allowed = canViewReports(auth.user);
  const [detail, setDetail] = useState<NightAuditHistoryDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propertyId = allowed ? auth.user?.propertyId : undefined;

  const load = async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(null);
    try {
      setDetail(await getNightAuditHistoryDetail(propertyId, runId));
    } catch {
      setError('Unable to load Night Audit report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [propertyId, runId]);

  if (!allowed) return <Alert color="red" title="Reports unavailable">Reports are available to Accounts, Managers, Admins, and Owners.</Alert>;
  if (isLoading && !detail) return <Group data-testid="night-audit-report-loading"><Loader size="sm" /><Text>Loading Night Audit report...</Text></Group>;

  return (
    <Stack gap={spacing[3]} data-testid="night-audit-report-page">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>Night Audit Report</Title>
          <Text c="#64748b" mt={4} size="sm">Final operational record for the closed business day.</Text>
        </Box>
        <Button component={Link} href="/reports/night-audit-history" variant="subtle" leftSection={<ArrowLeft size={16} />}>
          Night Audit History
        </Button>
      </Group>

      {error ? (
        <Alert color="red" title="Night Audit report unavailable" data-testid="night-audit-report-error">
          <Group justify="space-between">
            <Text size="sm">{error}</Text>
            <Button size="xs" variant="light" leftSection={<RotateCcw size={14} />} onClick={() => void load()}>Retry</Button>
          </Group>
        </Alert>
      ) : null}

      {detail ? <NightAuditHistoryDetail detail={detail} /> : null}
    </Stack>
  );
}

function NightAuditHistoryDetail({ detail }: { detail: NightAuditHistoryDetailDto }) {
  if (!detail.hasSnapshot || !detail.completionSnapshot) {
    return (
      <Stack gap={spacing[3]}>
        <Alert color="yellow" title="Limited historical data" data-testid="night-audit-legacy-notice">
          {limitedHistoryNotice}
        </Alert>
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Title order={3} style={{ fontSize: 18 }}>Legacy Summary</Title>
          <pre style={{ margin: 0, marginTop: spacing[3], whiteSpace: 'pre-wrap', color: '#344054' }}>
            {JSON.stringify(detail.legacySummary ?? {}, null, 2)}
          </pre>
        </Card>
      </Stack>
    );
  }

  const snapshot = detail.completionSnapshot;
  const financial = snapshot.financial;
  const operationalSummary = [
    ['Pending Arrivals', compactStatus(snapshot.sections.pendingArrivals.count)],
    ['In-House', compactStatus(valueOf(snapshot.inHouseSummary, ['totalInHouse', 'inHouse', 'checkedIn', 'occupied']))],
    [
      'Due-Out/Overdue',
      compactStatus(
        valueOf(snapshot.sections.stayReview.summary, ['dueOut', 'dueOutCount']) +
          valueOf(snapshot.sections.stayReview.summary, ['overdue', 'overdueCount']),
      ),
    ],
    ['Folio Exceptions', compactStatus(snapshot.sections.folioExceptions.count)],
    ['Group Issues', compactStatus(snapshot.sections.groupReview.count)],
  ] as Array<[string, React.ReactNode]>;
  return (
    <Stack gap={spacing[3]} data-testid="night-audit-snapshot-detail">
      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group justify="space-between" align="flex-start" mb={spacing[3]}>
          <Box>
            <Title order={2} style={{ fontSize: 22 }}>Business Date {formatDisplayDate(snapshot.businessDate)}</Title>
            <Text c="green" fw={700} size="sm" mt={4}>Closed successfully</Text>
          </Box>
          <Badge size="sm" variant="light">Snapshot {snapshot.version}</Badge>
        </Group>
        <SimpleFacts
          rows={[
            ['Next Business Date', formatDisplayDate(snapshot.nextBusinessDate)],
            ['Closed by / time', `${userLabel(snapshot as unknown as Record<string, unknown>, 'completed')} / ${formatDateTime(snapshot.completedAt)}`],
          ]}
        />
      </Card>
      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={3} style={{ fontSize: 18 }}>Operational Summary</Title>
        <SimpleFacts rows={operationalSummary} />
      </Card>
      {financial ? <FinancialClosingSummary financial={financial} /> : null}
      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group justify="space-between">
          <Text fw={700} c="#101828">Close Result</Text>
          <Badge color="green" variant="light">Successful close</Badge>
        </Group>
        <Text c="#64748b" size="sm" mt={4}>All Night Audit blockers were clear when the day was closed.</Text>
      </Card>
      <SnapshotSection title="Pending Arrivals" section={snapshot.sections.pendingArrivals} columns={['reservation', 'arrivalDate', 'status']} />
      <SnapshotSection title="Stay Review" section={snapshot.sections.stayReview} columns={['reservation', 'departureDate', 'reviewState', 'roomNumber']} />
      <SnapshotSection title="Folio Exceptions" section={snapshot.sections.folioExceptions} columns={['reservation', 'folioId', 'exceptionType', 'blocking']} />
      <SnapshotSection title="Group Issues" section={snapshot.sections.groupReview} columns={['groupCode', 'reviewState', 'assignedRoomCount', 'blocking']} />
      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={3} style={{ fontSize: 18 }}>In-House Summary</Title>
        <SimpleFacts rows={friendlyInHouseRows(snapshot.inHouseSummary)} />
      </Card>
    </Stack>
  );
}

function FinancialClosingSummary({
  financial,
}: {
  financial: NonNullable<NightAuditCompletionSnapshot['financial']>;
}) {
  const { financialSummary: fin, paymentBreakdown, operationalSummary: ops, groupSummary } = financial;
  const currency = fin.currency ?? 'INR';
  const money = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

  return (
    <Stack gap={spacing[3]} data-testid="night-audit-financial-summary">
      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group justify="space-between">
          <Title order={3} style={{ fontSize: 18 }}>Financial Summary</Title>
          <Badge size="sm" variant="light" color="grape">Closing figures</Badge>
        </Group>
        <SimpleFacts
          rows={[
            ['Room Revenue', money(fin.roomRevenue)],
            ['Other Charges', money(fin.otherChargeRevenue)],
            ['Tax', money(fin.taxAmount)],
            ['Gross Charges', money(fin.grossCharges)],
            ['Payments Collected', money(fin.paymentsCollected)],
            ['Refunds', money(fin.refunds)],
            ['Net Collections', money(fin.netCollections)],
            ['Outstanding Balance', money(fin.outstandingBalance)],
          ]}
        />
      </Card>

      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={3} style={{ fontSize: 18 }}>Payment Breakdown</Title>
        {paymentBreakdown.length === 0 ? (
          <Text c="#64748b" size="sm" mt={spacing[3]} data-testid="night-audit-payment-breakdown-empty">
            No payments recorded for this business date.
          </Text>
        ) : (
          <SimpleFacts
            rows={paymentBreakdown.map((entry) => [labelize(entry.method.toLowerCase()), money(entry.amount)])}
          />
        )}
      </Card>

      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={3} style={{ fontSize: 18 }}>Operations</Title>
        <SimpleFacts
          rows={[
            ['Total Rooms', ops.totalRooms],
            ['In-House Rooms', ops.inHouseRooms],
            ['Stayovers', ops.stayovers],
            ['Arrivals', ops.arrivals],
            ['Departures', ops.departures],
            ['No-Shows', ops.noShows],
          ]}
        />
      </Card>

      <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={3} style={{ fontSize: 18 }}>Groups</Title>
        <SimpleFacts
          rows={[
            ['In-House Groups', groupSummary.inHouseGroups],
            ['Group Stayovers', groupSummary.stayoverGroups],
            ['Master Folio Payments', money(groupSummary.masterFolioPaymentsCollected)],
            ['Master Folio Refunds', money(groupSummary.masterFolioRefunds)],
          ]}
        />
        <Text c="#94a3b8" size="xs" mt={spacing[3]}>
          Group accommodation revenue is tracked separately and is not included in room revenue.
        </Text>
      </Card>
    </Stack>
  );
}

function SnapshotSection({
  title,
  section,
  columns,
}: {
  title: string;
  section: NightAuditCompletionSnapshot['sections'][keyof NightAuditCompletionSnapshot['sections']];
  columns: string[];
}) {
  const summary = 'summary' in section ? section.summary : undefined;
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Group justify="space-between">
        <Title order={3} style={{ fontSize: 18 }}>{title}</Title>
        <Group gap={6}>
          <Badge variant="light">Total {section.count}</Badge>
          <Badge variant="light" color={section.blockingCount > 0 ? 'red' : 'green'}>Blockers {section.blockingCount}</Badge>
        </Group>
      </Group>
      {summary ? <SimpleFacts rows={Object.entries(summary).map(([key, value]) => [labelize(key), value])} /> : null}
      {section.refs.length === 0 ? (
        <Table mt={spacing[3]} verticalSpacing="xs">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td><Text c="#64748b" size="sm">{section.blockingCount === 0 ? 'Clear' : 'None'}</Text></Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table mt={spacing[3]} verticalSpacing="sm">
            <Table.Thead><Table.Tr>{columns.map((column) => <Table.Th key={column}>{labelize(column)}</Table.Th>)}</Table.Tr></Table.Thead>
            <Table.Tbody>
              {section.refs.map((ref, index) => (
                <Table.Tr key={String(ref.reservationId ?? ref.groupBookingId ?? index)}>
                  {columns.map((column) => <Table.Td key={column}>{formatRefValue(ref, column)}</Table.Td>)}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}

function SimpleFacts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <Stack gap={10} mt={spacing[3]}>
      {rows.map(([label, value]) => (
        <Group key={label} justify="space-between" align="center">
          <Text c="#64748b" size="sm">{label}</Text>
          <Text c="#101828" fw={700} size="sm" ta="right">{value}</Text>
        </Group>
      ))}
    </Stack>
  );
}

function labelize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRefValue(ref: Record<string, unknown>, column: string) {
  if (column === 'reservation') {
    return String(ref.confirmationNumber ?? ref.reservationCode ?? '-');
  }
  if (column.endsWith('Date')) {
    const value = ref[column];
    return typeof value === 'string' ? formatDisplayDate(value) : '-';
  }
  const value = ref[column];
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && value.includes('_')) return labelize(value.toLowerCase());
  return String(value ?? '-');
}

function friendlyInHouseRows(summary: Record<string, number>) {
  const rows = [
    ['Guests currently in house', valueOf(summary, ['totalInHouse', 'inHouse', 'checkedIn', 'occupied'])],
    ['Stayovers', valueOf(summary, ['stayover', 'stayovers'])],
    ['Due out today', valueOf(summary, ['dueOut', 'dueOutToday'])],
    ['Overdue departures', valueOf(summary, ['overdue', 'overdueDepartures'])],
  ] as Array<[string, React.ReactNode]>;

  const known = new Set(['totalInHouse', 'inHouse', 'checkedIn', 'occupied', 'stayover', 'stayovers', 'dueOut', 'dueOutToday', 'overdue', 'overdueDepartures']);
  for (const [key, value] of Object.entries(summary)) {
    if (!known.has(key)) rows.push([labelize(key), value]);
  }
  return rows;
}
