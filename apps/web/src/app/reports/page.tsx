'use client';

import {
  Alert,
  Box,
  Card,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  BarChart3,
  CalendarDays,
  IndianRupee,
  Percent,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { radius, spacing } from '@stayos/theme';
import { StayOSOperationsCard } from '@stayos/ui';
import { useAuth } from '../../features/auth/auth-context';
import { useReports } from '../../features/reports/hooks/useReports';

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function presetRange(preset: string) {
  const today = new Date();

  if (preset === 'TODAY') {
    return { from: dateKey(today), to: dateKey(today) };
  }

  if (preset === 'LAST_7') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: dateKey(from), to: dateKey(today) };
  }

  if (preset === 'THIS_MONTH') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: dateKey(from), to: dateKey(today) };
  }

  const from = new Date(today);
  from.setDate(from.getDate() - 29);

  return { from: dateKey(from), to: dateKey(today) };
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

const chartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

function ReportsPageLoading() {
  return (
    <Stack gap={spacing[3]} aria-label="Loading reports" aria-busy="true">
      <Box>
        <Skeleton height={38} width={150} radius="sm" />
        <Skeleton mt={6} height={15} width={440} maw="70vw" radius="sm" />
      </Box>

      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group align="flex-end" wrap="wrap">
          <Skeleton height={38} width={430} radius="md" />
          <Box>
            <Skeleton height={12} width={45} radius="sm" />
            <Skeleton mt={7} height={38} width={150} radius="md" />
          </Box>
          <Box>
            <Skeleton height={12} width={20} radius="sm" />
            <Skeleton mt={7} height={38} width={150} radius="md" />
          </Box>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing={spacing[3]}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`report-stat-skeleton-${index}`}
            p={spacing[4]}
            radius={radius.lg}
            shadow="xs"
            style={{ border: 'none' }}
          >
            <Skeleton height={12} width={95} radius="sm" />
            <Skeleton mt={9} height={30} width={120} radius="sm" />
            <Skeleton mt={8} height={11} width={150} radius="sm" />
          </Card>
        ))}
      </SimpleGrid>

      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group gap={10}>
          <Skeleton height={34} width={115} radius="md" />
          <Skeleton height={34} width={100} radius="md" />
          <Skeleton height={34} width={115} radius="md" />
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Skeleton height={20} width={165} radius="sm" />
          <Skeleton mt={spacing[4]} height={280} width="100%" radius="md" />
        </Card>

        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Skeleton height={20} width={110} radius="sm" />

          <Stack gap={12} mt={spacing[4]}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Group key={`metric-skeleton-${index}`} justify="space-between">
                <Skeleton height={14} width={150} radius="sm" />
                <Skeleton height={14} width={75} radius="sm" />
              </Group>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

export default function ReportsPage() {
  const auth = useAuth();

  const canViewReports = Boolean(
    auth.user &&
    ['ACCOUNTS', 'MANAGER', 'ADMIN', 'OWNER'].includes(String(auth.user.role)) &&
    (auth.user.permissions.includes('reports.view') || auth.user.permissions.includes('*')),
  );

  const [preset, setPreset] = useState('LAST_30');

  const initialRange = useMemo(() => presetRange('LAST_30'), []);

  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const reports = useReports(canViewReports ? auth.user?.propertyId : undefined, from, to);

  const overview = reports.data?.overview;

  const setRangePreset = (value: string) => {
    setPreset(value);

    if (value !== 'CUSTOM') {
      const next = presetRange(value);
      setFrom(next.from);
      setTo(next.to);
    }
  };

  if (!canViewReports) {
    return (
      <Alert color="red" title="Reports unavailable">
        Reports are available to Accounts, Managers, Admins, and Owners.
      </Alert>
    );
  }

  const isInitialLoading = reports.isLoading && !reports.data;

  if (isInitialLoading) {
    return <ReportsPageLoading />;
  }

  return (
    <Stack gap={spacing[3]}>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
          Reports
        </Title>

        <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
          Occupancy, revenue, and operations performance for the selected period.
        </Text>
      </Box>

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

          <TextInput
            label="From"
            type="date"
            value={from}
            onChange={(event) => {
              setPreset('CUSTOM');
              setFrom(event.currentTarget.value);
            }}
          />

          <TextInput
            label="To"
            type="date"
            value={to}
            onChange={(event) => {
              setPreset('CUSTOM');
              setTo(event.currentTarget.value);
            }}
          />
        </Group>
      </Card>

      {reports.error ? (
        <Alert color="red" variant="light" radius={radius.lg}>
          {reports.error}
        </Alert>
      ) : null}

      {reports.isLoading && reports.data ? (
        <Group gap={8} role="status" aria-live="polite">
          <Loader color="stayosBrand" size="xs" />
          <Text c="#64748b" size="sm" fw={600}>
            Updating report data...
          </Text>
        </Group>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing={spacing[3]}>
        <StayOSOperationsCard
          title="Occupancy"
          value={`${overview?.occupancyPercent ?? 0}%`}
          detail="Room-night utilization"
          icon={<Percent size={17} />}
          tone={(overview?.occupancyPercent ?? 0) < 50 ? 'danger' : 'success'}
        />

        <StayOSOperationsCard
          title="Revenue"
          value={money(overview?.revenue ?? 0)}
          detail="Charges posted"
          icon={<IndianRupee size={17} />}
          tone="premium"
        />

        <StayOSOperationsCard
          title="ADR"
          value={money(overview?.adr ?? 0)}
          detail="Average daily rate"
          icon={<TrendingUp size={17} />}
          tone="info"
        />

        <StayOSOperationsCard
          title="RevPAR"
          value={money(overview?.revPar ?? 0)}
          detail="Revenue per available room"
          icon={<BarChart3 size={17} />}
          tone="attention"
        />
      </SimpleGrid>

      <Tabs defaultValue="occupancy">
        <Tabs.List>
          <Tabs.Tab value="occupancy" leftSection={<CalendarDays size={15} />}>
            Occupancy
          </Tabs.Tab>

          <Tabs.Tab value="revenue" leftSection={<IndianRupee size={15} />}>
            Revenue
          </Tabs.Tab>

          <Tabs.Tab value="operations" leftSection={<UsersRound size={15} />}>
            Operations
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="occupancy" pt={spacing[4]}>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
            <ChartCard title="Reservation Source">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reports.data?.occupancy.bySource ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <MetricPanel
              rows={[
                ['Total rooms', reports.data?.occupancy.totalRooms ?? 0],
                ['Available room nights', reports.data?.occupancy.roomNightsAvailable ?? 0],
                ['Occupied room nights', reports.data?.occupancy.roomNightsOccupied ?? 0],
              ]}
            />
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="revenue" pt={spacing[4]}>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
            <ChartCard title="Revenue by Charge Type">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={reports.data?.revenue.byChargeType ?? []}
                    dataKey="value"
                    nameKey="label"
                    outerRadius={96}
                  >
                    {(reports.data?.revenue.byChargeType ?? []).map((entry, index) => (
                      <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>

                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Payments by Method">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reports.data?.revenue.byPaymentMethod ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar dataKey="value" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="operations" pt={spacing[4]}>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
            <MetricPanel
              rows={[
                ['Arrivals', reports.data?.operations.arrivals ?? 0],
                ['Departures', reports.data?.operations.departures ?? 0],
                ['Open requests', reports.data?.operations.openRequests ?? 0],
                ['Completed requests', reports.data?.operations.completedRequests ?? 0],
                ['Overdue requests', reports.data?.operations.overdueRequests ?? 0],
                [
                  'Avg resolution minutes',
                  reports.data?.operations.avgRequestResolutionMinutes ?? 0,
                ],
              ]}
            />

            <MetricPanel
              rows={(reports.data?.topGuests ?? []).map((guest) => [
                guest.guestDisplayName,
                `${guest.stays} stays - ${money(guest.revenue)}`,
              ])}
              title="Top Guests"
            />
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ChartCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Title order={3} c="#101828" style={{ fontSize: 18, fontWeight: 700 }}>
        {title}
      </Title>

      <Box mt={spacing[4]}>{children}</Box>
    </Card>
  );
}

function MetricPanel({
  rows,
  title = 'Metrics',
}: {
  rows: Array<[string, React.ReactNode]>;
  title?: string;
}) {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Title order={3} c="#101828" style={{ fontSize: 18, fontWeight: 700 }}>
        {title}
      </Title>

      <Stack gap={12} mt={spacing[4]}>
        {rows.map(([label, value]) => (
          <Group key={label} justify="space-between" align="center">
            <Text c="#64748b" size="sm">
              {label}
            </Text>

            <Text c="#101828" fw={700} size="sm">
              {value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
