'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { AlertCircle, Edit, Plus, Search } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import {
  BackendUnavailable,
  EmptyData,
  GenericError,
  ServerStarting,
  useBackendStatus,
} from '@stayos/ui';
import { useGuests } from '../../lib/guest-hooks';
import { GuestStatusBadge } from './components/GuestStatusBadge';
import { guestFilterOptions } from './constants/guest.constants';
import type { Guest, GuestFilter } from './types/guest.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function matchesFilter(guest: Guest, filter: GuestFilter) {
  if (filter === 'vip') return guest.vipStatus;
  if (filter === 'active') return guest.status === 'ACTIVE';

  if (filter === 'blacklisted') {
    return guest.blacklistStatus || guest.status === 'BLACKLISTED';
  }

  return true;
}

function GuestsPageLoading() {
  return (
    <Stack gap={spacing[3]} aria-label="Loading guests" aria-busy="true">
      {/* Header */}
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Skeleton height={38} width={145} radius="sm" />

          <Skeleton mt={spacing[1]} height={16} width={470} maw="70vw" radius="sm" />

          <Skeleton mt={spacing[2]} height={13} width={210} radius="sm" />
        </Box>

        <Skeleton height={36} width={125} radius="md" />
      </Group>

      {/* Search / filter */}
      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} wrap="wrap">
          <Skeleton
            height={38}
            radius="md"
            style={{
              flex: 1,
              minWidth: 280,
            }}
          />

          <Skeleton height={38} width={190} radius="md" />
        </Group>
      </Card>

      {/* Guest table */}
      <Card
        p={0}
        radius={radius.lg}
        style={{
          ...cardStyle,
          overflow: 'hidden',
        }}
      >
        <Box px={18} py={15} bg="#f8fafc">
          <Group justify="space-between" wrap="nowrap">
            <Skeleton height={12} width={120} radius="sm" />
            <Skeleton height={12} width={110} radius="sm" />
            <Skeleton height={12} width={85} radius="sm" />
            <Skeleton height={12} width={70} radius="sm" />
            <Skeleton height={12} width={85} radius="sm" />
            <Skeleton height={12} width={110} radius="sm" />
            <Skeleton height={12} width={100} radius="sm" />
          </Group>
        </Box>

        <Stack gap={0}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Box
              key={`guest-loading-row-${index}`}
              px={18}
              py={14}
              style={{
                borderTop: '1px solid #eef2f7',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                {/* Guest */}
                <Group gap={12} wrap="nowrap" w={180}>
                  <Skeleton height={38} width={38} radius={radius.md} />

                  <Stack gap={5}>
                    <Skeleton height={14} width={105} radius="sm" />
                    <Skeleton height={10} width={55} radius="sm" />
                  </Stack>
                </Group>

                {/* Contact */}
                <Stack gap={5} w={145}>
                  <Skeleton height={13} width={100} radius="sm" />
                  <Skeleton height={10} width={125} radius="sm" />
                </Stack>

                <Skeleton height={13} width={75} radius="sm" />

                <Skeleton height={24} width={75} radius={radius.full} />

                <Skeleton height={13} width={80} radius="sm" />

                <Skeleton height={13} width={100} radius="sm" />

                <Group gap={7} wrap="nowrap">
                  <Skeleton height={30} width={92} radius="md" />
                  <Skeleton height={30} width={65} radius="md" />
                </Group>
              </Group>
            </Box>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

export default function GuestsPage() {
  const backend = useBackendStatus();

  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';

  const canLoadGuests =
    backend.isOnline ||
    (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);

  const guestState = useGuests({
    allowMockFallback,
    enabled: canLoadGuests,
  });

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('all');

  useEffect(() => {
    if (!canLoadGuests) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void guestState.refreshGuests();
      }
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [canLoadGuests, guestState.refreshGuests]);

  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return guestState.guests.filter((guest) => {
      const searchable = [guest.fullName, guest.phone, guest.email, guest.nationality]
        .join(' ')
        .toLowerCase();

      return (!normalized || searchable.includes(normalized)) && matchesFilter(guest, filter);
    });
  }, [filter, guestState.guests, query]);

  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title
          order={1}
          c="#101828"
          style={{
            fontSize: 30,
            fontWeight: 700,
            lineHeight: '38px',
          }}
        >
          Guests
        </Title>

        <Text
          mt={spacing[1]}
          c="#64748b"
          style={{
            fontSize: 14,
            lineHeight: '22px',
          }}
        >
          Search guest profiles, contact details, VIP status, notes and stay context.
        </Text>

        <Text
          mt={spacing[2]}
          c="#334155"
          style={{
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {guestState.guests.length} guests -{' '}
          {guestState.guests.filter((guest) => guest.vipStatus).length} VIP -{' '}
          {guestState.guests.filter((guest) => guest.blacklistStatus).length} blacklisted
        </Text>
      </Box>

      <Button
        component={Link}
        href="/guests/new"
        color="stayosBrand"
        leftSection={<Plus size={16} />}
      >
        New Guest
      </Button>
    </Group>
  );

  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

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
    guestState.error &&
    !guestState.isLoading &&
    guestState.guests.length === 0
  ) {
    return (
      <Stack gap={spacing[4]}>
        {pageHeader}

        <GenericError
          onAction={() => void guestState.refreshGuests()}
          onCheckStatus={checkBackendStatus}
        />
      </Stack>
    );
  }

  // Initial page loading:
  // keep the complete Guests page in skeleton state until guest data arrives.
  if (guestState.isLoading) {
    return <GuestsPageLoading />;
  }

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}

      {guestState.isFallback && guestState.error ? (
        <Alert color="yellow" variant="light" icon={<AlertCircle size={17} />} radius={radius.lg}>
          Demo fallback is enabled, so Guests is showing realistic sample profiles.
        </Alert>
      ) : null}

      <Card radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={spacing[2]} wrap="wrap">
          <TextInput
            leftSection={<Search size={15} />}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, phone, email or nationality..."
            style={{
              flex: 1,
              minWidth: 280,
            }}
            value={query}
          />

          <Select
            data={guestFilterOptions}
            onChange={(value) => setFilter((value as GuestFilter | null) ?? 'all')}
            value={filter}
            w={{
              base: 160,
              md: 190,
            }}
          />
        </Group>
      </Card>

      {guestState.guests.length === 0 ? (
        <EmptyData
          title="No guests found"
          detail="The active property has no guest profiles yet."
        />
      ) : filteredGuests.length > 0 ? (
        <Card
          p={0}
          radius={radius.lg}
          style={{
            ...cardStyle,
            overflow: 'hidden',
          }}
        >
          <Table.ScrollContainer minWidth={920}>
            <Table verticalSpacing={13} horizontalSpacing={18}>
              <Table.Thead bg="#f8fafc">
                <Table.Tr>
                  {[
                    'Guest',
                    'Contact',
                    'Nationality',
                    'Status',
                    'Last Stay',
                    'Upcoming Booking',
                    'Actions',
                  ].map((header) => (
                    <Table.Th
                      key={header}
                      style={{
                        color: '#64748b',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {header}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {filteredGuests.map((guest) => (
                  <Table.Tr key={guest.id}>
                    <Table.Td>
                      <Group gap={spacing[3]} wrap="nowrap">
                        <Avatar color="stayosBrand" radius={radius.md}>
                          {guest.initials}
                        </Avatar>

                        <Box>
                          <Text
                            component={Link}
                            href={`/guests/${guest.id}`}
                            c="#101828"
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              textDecoration: 'none',
                            }}
                          >
                            {guest.fullName}
                          </Text>

                          {guest.vipStatus ? (
                            <Group gap={6} mt={4}>
                              <ThemeIcon
                                color="yellow"
                                variant="light"
                                size={20}
                                radius={radius.full}
                              >
                                <Text size="8px" fw={800}>
                                  VIP
                                </Text>
                              </ThemeIcon>
                            </Group>
                          ) : null}
                        </Box>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Text fw={600} size="sm">
                        {guest.phone}
                      </Text>

                      <Text c="#64748b" size="xs">
                        {guest.email}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm">{guest.nationality}</Text>
                    </Table.Td>

                    <Table.Td>
                      <GuestStatusBadge status={guest.status} />
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm">{guest.lastStay}</Text>
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm">{guest.upcomingBooking}</Text>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <Button
                          component={Link}
                          href={`/guests/${guest.id}`}
                          size="compact-sm"
                          variant="light"
                          color="stayosBrand"
                        >
                          View Profile
                        </Button>

                        <Button
                          component={Link}
                          href={`/guests/${guest.id}/edit`}
                          size="compact-sm"
                          variant="subtle"
                          color="gray"
                          leftSection={<Edit size={14} />}
                        >
                          Edit
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      ) : (
        <Card p={spacing[8]} ta="center" radius={radius.lg} style={cardStyle}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44} mx="auto">
            <Search size={20} />
          </ThemeIcon>

          <Title
            order={3}
            c="#101828"
            mt={spacing[4]}
            style={{
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            No guests found
          </Title>

          <Text c="#64748b" mt={spacing[2]}>
            Try another name, phone, email, nationality, or filter.
          </Text>
        </Card>
      )}
    </Stack>
  );
}
