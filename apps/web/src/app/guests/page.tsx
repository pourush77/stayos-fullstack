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
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { AlertCircle, CheckCircle2, Search, Sparkles, UserRound, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { BackendUnavailable, EmptyData, GenericError, ServerStarting, useBackendStatus } from '@stayos/ui';
import { useGuests } from '../../lib/guest-hooks';

export default function GuestsIndexPage() {
  const backend = useBackendStatus();
  const allowMockFallback = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === 'true';
  const canLoadGuests = backend.isOnline || (backend.status === 'CONNECTING' && backend.lastSuccessfulConnection !== null);
  const guests = useGuests({
    allowMockFallback,
    enabled: canLoadGuests,
  });
  const [query, setQuery] = useState('');

  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return guests.guests;

    return guests.guests.filter((guest) =>
      [guest.name, guest.mobile, guest.email, guest.companyName, guest.badges.join(' ')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [guests.guests, query]);

  const retryBackend = () => {
    void backend.retry();
  };

  const checkBackendStatus = () => {
    void backend.checkHealth();
  };

  const pageHeader = (
    <Group justify="space-between" align="flex-start" gap={spacing[4]}>
      <Group gap={spacing[3]}>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
          <Users size={20} />
        </ThemeIcon>
        <Box>
          <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
            Guests
          </Title>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
            Guest profiles and service context from the active property.
          </Text>
        </Box>
      </Group>
    </Group>
  );

  if (!allowMockFallback && backend.status === 'SERVER_STARTING') {
    return (
      <Stack gap={spacing[6]}>
        {pageHeader}
        <ServerStarting onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && !backend.isOnline && backend.status !== 'CONNECTING') {
    return (
      <Stack gap={spacing[6]}>
        {pageHeader}
        <BackendUnavailable onAction={retryBackend} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  if (!allowMockFallback && backend.status === 'CONNECTING' && backend.lastSuccessfulConnection === null && guests.guests.length === 0) {
    return (
      <Stack gap={spacing[6]}>
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
      <Stack gap={spacing[6]}>
        {pageHeader}
        <GenericError onAction={() => void guests.refreshGuests()} onCheckStatus={checkBackendStatus} />
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[6]}>
      {pageHeader}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        <SummaryCard title="Profiles" value={guests.guests.length} detail="Guests loaded." icon={<UserRound size={17} />} />
        <SummaryCard title="VIP" value={guests.guests.filter((guest) => guest.isVip).length} detail="High-touch guests." icon={<Sparkles size={17} />} />
        <SummaryCard title="Companies" value={guests.guests.filter((guest) => guest.companyName).length} detail="Corporate context." icon={<Users size={17} />} />
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

      <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <TextInput
          leftSection={<Search size={16} />}
          placeholder="Search guest, phone, email, company, or status"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </Card>

      {guests.guests.length === 0 && !guests.isLoading ? (
        <EmptyData title="No guests yet" detail="The active property has no guest profiles to show yet." />
      ) : (
        <Card p={0} radius={radius.lg} shadow="xs" style={{ border: 'none', overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Guest</Table.Th>
                  <Table.Th>Contact</Table.Th>
                  <Table.Th>Company</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
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
                          <Text c={colors.text.strong} style={typography.styles.label}>
                            {guest.name}
                          </Text>
                          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
                            {guest.preferredRoom}
                          </Text>
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text c={colors.text.strong} style={typography.styles.small}>
                        {guest.mobile}
                      </Text>
                      <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
                        {guest.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>{guest.companyName ?? 'Not recorded'}</Table.Td>
                    <Table.Td>
                      <Group gap={spacing[2]}>
                        {guest.badges.map((badge) => (
                          <Badge key={badge} color={badge === 'VIP' ? 'stayosBrand' : 'gray'} variant="light" radius={radius.full}>
                            {badge}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Button component={Link} href={guest.profileUrl} variant="light" color="stayosBrand" size="xs">
                        Open Guest 360
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}

function SummaryCard({
  detail,
  icon,
  title,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <Paper p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            {title}
          </Text>
          <Title order={2} c={colors.text.strong} mt={spacing[1]} style={typography.styles.h2}>
            {value}
          </Title>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
            {detail}
          </Text>
        </Box>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
