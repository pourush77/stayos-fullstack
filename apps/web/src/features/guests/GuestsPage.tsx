'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { AlertCircle, Edit, Plus, Search, UserRound } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, EmptyData, GenericError, ServerStarting, useBackendStatus } from '@stayos/ui';
import { useGuests } from '../../lib/guest-hooks';
import { guestFilterOptions } from './constants/guest.constants';
import { GuestStatusBadge } from './components/GuestStatusBadge';
import type { Guest, GuestFilter } from './types/guest.types';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

function matchesFilter(guest: Guest, filter: GuestFilter) {
  if (filter === 'vip') return guest.vipStatus;
  if (filter === 'active') return guest.status === 'ACTIVE';
  if (filter === 'blacklisted') return guest.blacklistStatus || guest.status === 'BLACKLISTED';
  return true;
}

export default function GuestsPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuests = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guestState = useGuests({ allowMockFallback, enabled: canLoadGuests });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('all');

  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return guestState.guests.filter((guest) => {
      const searchable = [guest.fullName, guest.phone, guest.email, guest.nationality].join(' ').toLowerCase();
      return (!normalized || searchable.includes(normalized)) && matchesFilter(guest, filter);
    });
  }, [filter, guestState.guests, query]);

  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
          Guests
        </Title>
        <Text mt={spacing[1]} c="#64748b" style={{ fontSize: 14, lineHeight: '22px' }}>
          Search guest profiles, contact details, VIP status, notes and stay context.
        </Text>
        <Text mt={spacing[2]} c="#334155" style={{ fontSize: 13, fontWeight: 600 }}>
          {guestState.guests.length} guests - {guestState.guests.filter((guest) => guest.vipStatus).length} VIP -{' '}
          {guestState.guests.filter((guest) => guest.blacklistStatus).length} blacklisted
        </Text>
      </Box>
      <Button component={Link} href="/guests/new" color="stayosBrand" leftSection={<Plus size={16} />}>
        New Guest
      </Button>
    </Group>
  );

  const retryBackend = () => void backend.retry();
  const checkBackendStatus = () => void backend.checkHealth();

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return <Stack gap={spacing[4]}>{pageHeader}<ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} /></Stack>;
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return <Stack gap={spacing[4]}>{pageHeader}<BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} /></Stack>;
  }

  if (!allowMockFallback && guestState.error && !guestState.isLoading && guestState.guests.length === 0) {
    return <Stack gap={spacing[4]}>{pageHeader}<GenericError onAction={() => void guestState.refreshGuests()} onCheckStatus={checkBackendStatus} /></Stack>;
  }

  return (
    <Stack gap={spacing[3]}>
      {pageHeader}

      {guestState.isLoading ? (
        <Alert color="blue" variant="light" icon={<UserRound size={17} />} radius={radius.lg}>
          Loading guests...
        </Alert>
      ) : null}

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
            style={{ flex: 1, minWidth: 280 }}
            value={query}
          />
          <Select
            data={guestFilterOptions}
            onChange={(value) => setFilter((value as GuestFilter | null) ?? 'all')}
            value={filter}
            w={{ base: 160, md: 190 }}
          />
        </Group>
      </Card>

      {guestState.guests.length === 0 && !guestState.isLoading ? (
        <EmptyData title="No guests found" detail="The active property has no guest profiles yet." />
      ) : filteredGuests.length > 0 ? (
        <Card p={0} radius={radius.lg} style={{ ...cardStyle, overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={920}>
            <Table verticalSpacing={13} horizontalSpacing={18}>
              <Table.Thead bg="#f8fafc">
                <Table.Tr>
                  {['Guest', 'Contact', 'Nationality', 'Status', 'Last Stay', 'Upcoming Booking', 'Actions'].map((header) => (
                    <Table.Th key={header} style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>
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
                        <Avatar color="stayosBrand" radius={radius.md}>{guest.initials}</Avatar>
                        <Box>
                          <Text component={Link} href={`/guests/${guest.id}`} c="#101828" style={{ fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
                            {guest.fullName}
                          </Text>
                          <Group gap={6} mt={4}>
                            {guest.vipStatus ? <ThemeIcon color="yellow" variant="light" size={20} radius={radius.full}>VIP</ThemeIcon> : null}
                          </Group>
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text fw={600} size="sm">{guest.phone}</Text><Text c="#64748b" size="xs">{guest.email}</Text></Table.Td>
                    <Table.Td><Text size="sm">{guest.nationality}</Text></Table.Td>
                    <Table.Td><GuestStatusBadge status={guest.status} /></Table.Td>
                    <Table.Td><Text size="sm">{guest.lastStay}</Text></Table.Td>
                    <Table.Td><Text size="sm">{guest.upcomingBooking}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <Button component={Link} href={`/guests/${guest.id}`} size="compact-sm" variant="light" color="stayosBrand">
                          View Profile
                        </Button>
                        <Button component={Link} href={`/guests/${guest.id}/edit`} size="compact-sm" variant="subtle" color="gray" leftSection={<Edit size={14} />}>
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
          <Title order={3} c="#101828" mt={spacing[4]} style={{ fontSize: 24, fontWeight: 700 }}>
            No guests found
          </Title>
          <Text c="#64748b" mt={spacing[2]}>Try another name, phone, email, nationality, or filter.</Text>
        </Card>
      )}
    </Stack>
  );
}
