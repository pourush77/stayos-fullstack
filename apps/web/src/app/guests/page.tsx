'use client';

import Link from 'next/link';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Hotel,
  Repeat2,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import {
  BackendUnavailable,
  EmptyData,
  GenericError,
  ServerStarting,
  useBackendStatus,
} from '@stayos/ui';
import { type Guest, useGuests } from '../../lib/guest-hooks';

type StatusFilter = 'all' | 'in-house' | 'arriving' | 'departed' | 'vip';

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'In House', value: 'in-house' },
  { label: 'Arriving', value: 'arriving' },
  { label: 'Departed', value: 'departed' },
  { label: 'VIP', value: 'vip' },
];

function isReturningGuest(guest: Guest) {
  return guest.badges.includes('Returning Guest') || !['Not connected', '0 stays', '1 stay'].includes(guest.totalStays);
}

function isCorporateGuest(guest: Guest) {
  return Boolean(guest.companyName) || guest.badges.includes('Corporate');
}

function guestStatus(guest: Guest): StatusFilter {
  const statusSource = [guest.lastStay, guest.preferredRoom, guest.badges.join(' ')].join(' ').toLowerCase();

  if (guest.isVip) return 'vip';
  if (statusSource.includes('in house') || statusSource.includes('room')) return 'in-house';
  if (statusSource.includes('arriv')) return 'arriving';
  if (statusSource.includes('depart') || statusSource.includes('last')) return 'departed';
  return 'all';
}

function statusLabel(status: StatusFilter) {
  if (status === 'in-house') return 'In House';
  if (status === 'arriving') return 'Arriving';
  if (status === 'departed') return 'Departed';
  if (status === 'vip') return 'VIP';
  return 'Guest';
}

function tagTone(tag: string) {
  if (tag === 'VIP') return { color: '#6d5dfc', background: '#f5f3ff' };
  if (tag === 'Corporate') return { color: '#2563eb', background: '#eff6ff' };
  if (tag === 'Returning Guest') return { color: '#16a34a', background: '#f0fdf4' };
  return { color: '#64748b', background: '#f8fafc' };
}

function TokenBadge({ children }: { children: ReactNode }) {
  const tone = tagTone(String(children));

  return (
    <Badge
      radius={radius.full}
      style={{
        background: tone.background,
        border: '1px solid rgba(226, 232, 240, 0.9)',
        color: tone.color,
        fontSize: 11,
        fontWeight: 600,
        height: 24,
        paddingInline: 10,
        textTransform: 'none',
      }}
    >
      {children}
    </Badge>
  );
}

function SummaryCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <Paper radius={radius.lg} p={15} style={{ ...cardStyle, minHeight: 84 }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c="#334155" style={{ fontSize: 12, fontWeight: 600, lineHeight: '15px' }}>
            {label}
          </Text>
          <Text c="#111827" mt={4} style={{ fontSize: 22, fontWeight: 700, lineHeight: '26px' }}>
            {value}
          </Text>
          <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
            {detail}
          </Text>
        </Box>
        <Box
          aria-hidden
          style={{
            alignItems: 'center',
            background: `${tone}12`,
            borderRadius: radius.full,
            color: tone,
            display: 'flex',
            flex: '0 0 34px',
            height: 34,
            justifyContent: 'center',
            width: 34,
          }}
        >
          {icon}
        </Box>
      </Group>
    </Paper>
  );
}

function GuestTags({ guest }: { guest: Guest }) {
  const tags = Array.from(
    new Set([
      ...guest.badges.filter((badge) => ['VIP', 'Corporate', 'Returning Guest', 'Loyalty'].includes(badge)),
      guest.isVip ? 'VIP' : '',
      isCorporateGuest(guest) ? 'Corporate' : '',
      isReturningGuest(guest) ? 'Returning Guest' : '',
    ].filter(Boolean)),
  );

  return (
    <Group gap={6}>
      {tags.length > 0 ? tags.slice(0, 3).map((tag) => <TokenBadge key={tag}>{tag}</TokenBadge>) : <TokenBadge>Guest</TokenBadge>}
    </Group>
  );
}

function GuestsIndexPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuests =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guests = useGuests({
    allowMockFallback,
    enabled: canLoadGuests,
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [companyFilter, setCompanyFilter] = useState('all');

  const companyOptions = useMemo(
    () => [
      { label: 'All Companies', value: 'all' },
      ...Array.from(new Set(guests.guests.map((guest) => guest.companyName).filter(Boolean))).map((company) => ({
        label: company as string,
        value: company as string,
      })),
    ],
    [guests.guests],
  );

  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return guests.guests.filter((guest) => {
      const matchesQuery = normalized
        ? [
            guest.name,
            guest.mobile,
            guest.email,
            guest.companyName,
            guest.preferredRoom,
            guest.lastStay,
            guest.badges.join(' '),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalized)
        : true;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'vip' ? guest.isVip : guestStatus(guest) === statusFilter);
      const matchesCompany = companyFilter === 'all' || guest.companyName === companyFilter;

      return matchesQuery && matchesStatus && matchesCompany;
    });
  }, [companyFilter, guests.guests, query, statusFilter]);

  const summary = [
    {
      label: 'Total Guests',
      value: guests.guests.length,
      detail: 'Guest profiles loaded.',
      tone: '#2563eb',
      icon: <Users size={17} />,
    },
    {
      label: 'In-House Guests',
      value: guests.guests.filter((guest) => guestStatus(guest) === 'in-house').length,
      detail: 'Currently staying.',
      tone: '#16a34a',
      icon: <Hotel size={17} />,
    },
    {
      label: 'VIP Guests',
      value: guests.guests.filter((guest) => guest.isVip).length,
      detail: 'High-touch profiles.',
      tone: '#6d5dfc',
      icon: <Sparkles size={17} />,
    },
    {
      label: 'Corporate Guests',
      value: guests.guests.filter(isCorporateGuest).length,
      detail: 'Company context.',
      tone: '#2563eb',
      icon: <BriefcaseBusiness size={17} />,
    },
    {
      label: 'Returning Guests',
      value: guests.guests.filter(isReturningGuest).length,
      detail: 'Repeat stay history.',
      tone: '#64748b',
      icon: <Repeat2 size={17} />,
    },
  ];

  const retryBackend = () => {
    void backend.retry();
  };

  const checkBackendStatus = () => {
    void backend.checkHealth();
  };

  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
          Guests
        </Title>
        <Text mt={spacing[1]} c="#64748b" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
          Guest profiles, stay context and service preferences.
        </Text>
        <Text mt={spacing[2]} c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>
          {guests.guests.length} guests - {summary[2].value} VIP - {summary[3].value} corporate
        </Text>
      </Box>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (
    !allowMockFallback &&
    backend.status === 'CONNECTING' &&
    backend.lastSuccessfulConnection === null &&
    guests.guests.length === 0
  ) {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <ServerStarting
          title="Connecting to StayOS"
          detail="We are checking the hotel server before loading live guest profiles."
          onAction={retryBackend}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  if (!allowMockFallback && guests.error && !guests.isLoading && guests.guests.length === 0) {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}
        <GenericError onAction={() => void guests.refreshGuests()} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing={spacing[3]}>
        {summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </SimpleGrid>

      {guests.isLoading ? (
        <Alert color="blue" variant="light" icon={<Users size={17} />} radius={radius.lg}>
          Loading live guest profiles...
        </Alert>
      ) : null}

      {guests.isFallback && guests.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Guests is showing mock profiles while the backend is unavailable.
        </Alert>
      ) : null}

      {!guests.isFallback && guests.activePropertyName ? (
        <Alert color="green" variant="light" icon={<CheckCircle2 size={17} />} radius={radius.lg}>
          Showing live guests for {guests.activePropertyName}.
        </Alert>
      ) : null}

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} align="center">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder="Search guest, room, phone, email or company..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 280 }}
            styles={{
              input: {
                borderColor: '#dbe3ef',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 400,
                minHeight: 38,
              },
            }}
          />
          <Select
            w={{ base: 150, md: 172 }}
            data={statusOptions}
            value={statusFilter}
            onChange={(value) => setStatusFilter((value as StatusFilter | null) ?? 'all')}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
          <Select
            w={{ base: 160, md: 210 }}
            data={companyOptions}
            value={companyFilter}
            onChange={(value) => setCompanyFilter(value ?? 'all')}
            styles={{ input: { borderColor: '#dbe3ef', borderRadius: 12, minHeight: 38 } }}
          />
        </Group>
      </Card>

      {guests.guests.length === 0 && !guests.isLoading ? (
        <EmptyData title="No guests yet" detail="The active property has no guest profiles to show." />
      ) : filteredGuests.length > 0 ? (
        <>
          <Card visibleFrom="md" p={0} radius={radius.lg} style={{ ...cardStyle, overflow: 'hidden' }}>
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing={13} horizontalSpacing={18} highlightOnHover={false}>
                <Table.Thead bg="#f8fafc">
                  <Table.Tr>
                    {['Guest', 'Contact', 'Current Stay / Room', 'Company', 'Tags', 'Next Action'].map((header) => (
                      <Table.Th
                        key={header}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          color: '#64748b',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: 0,
                          textTransform: 'none',
                        }}
                      >
                        {header}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredGuests.map((guest) => (
                    <Table.Tr
                      key={guest.id}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = '#fbfdff';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = '#ffffff';
                      }}
                      style={{
                        background: '#ffffff',
                        borderBottom: '1px solid #edf2f7',
                        transition: 'background 160ms ease',
                      }}
                    >
                      <Table.Td>
                        <Group gap={spacing[3]} wrap="nowrap">
                          <Avatar color="stayosBrand" radius={radius.md} size={38}>
                            {guest.initials}
                          </Avatar>
                          <Box>
                            <Text
                              component={Link}
                              href={guest.profileUrl}
                              c="#101828"
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                lineHeight: '18px',
                                textDecoration: 'none',
                              }}
                            >
                              {guest.name}
                            </Text>
                            <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
                              {statusLabel(guestStatus(guest))}
                            </Text>
                          </Box>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text c="#182230" style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>
                          {guest.mobile}
                        </Text>
                        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
                          {guest.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="#182230" style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>
                          {guest.preferredRoom}
                        </Text>
                        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '15px' }}>
                          Last stay: {guest.lastStay}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="#334155" style={{ fontSize: 13, fontWeight: 500, lineHeight: '17px' }}>
                          {guest.companyName ?? 'Not recorded'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <GuestTags guest={guest} />
                      </Table.Td>
                      <Table.Td>
                        <Button
                          component={Link}
                          href={guest.profileUrl}
                          variant="light"
                          color="stayosBrand"
                          size="compact-sm"
                          style={{ fontWeight: 600 }}
                        >
                          Open Guest 360
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          <Stack hiddenFrom="md" gap={spacing[3]}>
            {filteredGuests.map((guest) => (
              <UnstyledButton key={guest.id} component={Link} href={guest.profileUrl}>
                <Card p={spacing[4]} radius={radius.lg} style={cardStyle}>
                  <Group justify="space-between" align="flex-start">
                    <Group gap={spacing[3]} wrap="nowrap">
                      <Avatar color="stayosBrand" radius={radius.md} size={40}>
                        {guest.initials}
                      </Avatar>
                      <Box>
                        <Text c="#101828" style={{ fontSize: 16, fontWeight: 700, lineHeight: '22px' }}>
                          {guest.name}
                        </Text>
                        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                          {guest.mobile} - {guest.email}
                        </Text>
                      </Box>
                    </Group>
                    <TokenBadge>{statusLabel(guestStatus(guest))}</TokenBadge>
                  </Group>
                  <Group mt={spacing[3]} justify="space-between" align="flex-end">
                    <Box>
                      <Text c="#334155" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
                        {guest.preferredRoom}
                      </Text>
                      <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
                        {guest.companyName ?? 'No company linked'}
                      </Text>
                    </Box>
                    <GuestTags guest={guest} />
                  </Group>
                  <Button
                    component="span"
                    mt={spacing[3]}
                    variant="light"
                    color="stayosBrand"
                    size="compact-sm"
                    style={{ fontWeight: 600 }}
                  >
                    Open Guest 360
                  </Button>
                </Card>
              </UnstyledButton>
            ))}
          </Stack>
        </>
      ) : (
        <Card p={spacing[8]} ta="center" radius={radius.lg} style={cardStyle}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44} mx="auto">
            <Search size={20} />
          </ThemeIcon>
          <Title order={3} c="#101828" mt={spacing[4]} style={{ fontSize: 24, fontWeight: 700, lineHeight: '30px' }}>
            No guests found
          </Title>
          <Text c="#64748b" mt={spacing[2]} style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
            Try another guest name, room, phone, email, company, or status.
          </Text>
        </Card>
      )}
    </Stack>
  );
}

export default GuestsIndexPage;
