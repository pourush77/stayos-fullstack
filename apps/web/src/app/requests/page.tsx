'use client';

import { Alert, Box, Button, Card, Group, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Bell, CheckCircle2, Clock, Flower2, MessageSquarePlus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { StayOSOperationsCard } from '@stayos/ui';
import { useAuth } from '../../features/auth/auth-context';
import type { GuestRequestSuggestionDto } from '../../features/requests/api/guest-requests-api';
import { CreateRequestDrawer } from '../../features/requests/components/CreateRequestDrawer';
import { RequestCard } from '../../features/requests/components/RequestCard';
import { useGuestRequests } from '../../features/requests/hooks/useGuestRequests';

export default function GuestRequestsPage() {
  const auth = useAuth();
  const [opened, { open, close }] = useDisclosure(false);
  const [selected, setSelected] = useState<GuestRequestSuggestionDto>();
  const state = useGuestRequests(auth.user?.propertyId);
  const summary = state.summary ?? { active: 0, awaitingAction: 0, completedToday: 0, highPriority: 0, vip: 0, overdue: 0 };

  const summaryCards = useMemo(() => [
    { title: 'Active Requests', value: summary.active, detail: 'Currently being handled', tone: 'info' as const, icon: <MessageSquarePlus size={17} /> },
    { title: 'Awaiting Action', value: summary.awaitingAction, detail: 'Waiting for acceptance', tone: 'attention' as const, icon: <Clock size={17} /> },
    { title: 'Completed Today', value: summary.completedToday, detail: 'Guests assisted', tone: 'success' as const, icon: <CheckCircle2 size={17} /> },
    { title: 'High Priority', value: summary.highPriority, detail: 'Requires attention', tone: 'danger' as const, icon: <Bell size={17} /> },
    { title: 'VIP Requests', value: summary.vip, detail: 'High-touch guest care', tone: 'premium' as const, icon: <Flower2 size={17} /> },
    { title: 'Delayed', value: summary.overdue, detail: 'Past target time', tone: 'danger' as const, icon: <Clock size={17} /> },
  ], [summary]);

  const startRequest = (suggestion: GuestRequestSuggestionDto) => {
    setSelected(suggestion);
    open();
  };

  return (
    <Stack gap={spacing[6]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Box>
          <Title order={1} c={colors.text.strong} style={typography.styles.h1}>Guest Requests</Title>
          <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>Every guest request in one calm, organized workspace.</Text>
          <Text c={colors.text.strong} mt={spacing[3]} style={typography.styles.label}>
            Today you have {summary.active} active requests, {summary.completedToday} completed, and {summary.highPriority} high priority.
          </Text>
        </Box>
      </Group>

      {state.error ? <Alert color="red" variant="light" radius={radius.lg}>{state.error}</Alert> : null}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing={spacing[3]}>
        {summaryCards.map((item) => <StayOSOperationsCard key={item.title} {...item} />)}
      </SimpleGrid>

      <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Title order={2} c={colors.text.strong} style={typography.styles.h2}>What does the guest need?</Title>
        <Group mt={spacing[4]} align="flex-end">
          <TextInput leftSection={<Search size={16} />} placeholder="Search requests" value={state.search} onChange={(event) => state.setSearch(event.currentTarget.value)} style={{ flex: 1 }} />
          <Select placeholder="Status" clearable data={['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']} value={state.status || null} onChange={(value) => state.setStatus((value ?? '') as never)} />
          <Select placeholder="Department" clearable data={['HOUSEKEEPING', 'MAINTENANCE', 'LAUNDRY', 'RECEPTION', 'CONCIERGE', 'F_AND_B']} value={state.department || null} onChange={(value) => state.setDepartment((value ?? '') as never)} />
        </Group>
        <Group mt={spacing[5]} gap={spacing[2]}>
          {state.suggestions.map((suggestion) => (
            <Button key={suggestion.title} variant="light" color="stayosBrand" radius={radius.full} onClick={() => startRequest(suggestion)}>
              {suggestion.title}
            </Button>
          ))}
        </Group>
      </Card>

      <Stack gap={spacing[4]}>
        <Box>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>Requests</Title>
          <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>Who needs what, who owns it, and what happens next.</Text>
        </Box>
        {state.requests.map((request) => (
          <RequestCard key={request.id} request={request} onTransition={(id, action) => void state.transition(id, action)} />
        ))}
        {!state.isLoading && state.requests.length === 0 ? <Alert color="blue" variant="light" radius={radius.lg}>No guest requests match these filters.</Alert> : null}
      </Stack>

      <CreateRequestDrawer opened={opened} onClose={close} selected={selected} onCreate={state.create} />
    </Stack>
  );
}
