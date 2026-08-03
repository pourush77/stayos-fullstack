'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Box, Button, Card, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { BackendUnavailable, ServerStarting, showToast, useBackendStatus } from '@stayos/ui';
import { getProperties } from '../../lib/inventory-api';
import { checkInGroup, getGroupCheckInPreview, type GroupCheckInPreviewDto, type GroupCheckInResultDto } from '../../lib/operations-api';

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

export function GroupCheckInPreviewPage({ groupHoldId }: { groupHoldId: string }) {
  const backend = useBackendStatus();
  const [propertyId, setPropertyId] = useState('');
  const [preview, setPreview] = useState<GroupCheckInPreviewDto | undefined>();
  const [result, setResult] = useState<GroupCheckInResultDto | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getProperties(controller.signal)
      .then(async (properties) => {
        const active = properties.find((property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ?? properties[0];
        const id = typeof active?.id === 'string' ? active.id : '';
        setPropertyId(id);
        setPreview(await getGroupCheckInPreview(id, groupHoldId, controller.signal));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load check-in preview.'));
    return () => controller.abort();
  }, [groupHoldId]);

  const finalCheckIn = async () => {
    if (!preview || !propertyId) return;
    setIsCheckingIn(true);
    try {
      const checkedIn = await checkInGroup(propertyId, groupHoldId);
      setResult(checkedIn);
      setPreview(await getGroupCheckInPreview(propertyId, groupHoldId));
      showToast({ color: 'green', message: `${checkedIn.group.groupCode} checked in.`, title: 'Group checked in' });
    } catch (err) {
      showToast({ color: 'red', message: err instanceof Error ? err.message : 'Unable to check in group.', title: 'Check-in failed' });
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!backend.isOnline && backend.status === 'SERVER_STARTING') return <ServerStarting onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;
  if (!backend.isOnline && backend.status !== 'CONNECTING') return <BackendUnavailable onAction={() => void backend.retry()} onCheckStatus={() => void backend.checkHealth()} />;

  return (
    <Box py={spacing[5]} px={{ base: spacing[2], sm: spacing[4] }} style={{ background: '#fbfcff', minHeight: 'calc(100vh - 180px)' }}>
      <Stack gap={spacing[3]} maw={1080} mx="auto">
        <Group justify="space-between">
          <Box>
            <Title order={1} c="#101828" style={{ fontSize: 32, fontWeight: 900 }}>Group Check-in Preview</Title>
            <Text c="#64748b" size="sm">{preview?.group.groupCode ?? 'Loading'} - master folio mode only</Text>
          </Box>
          <Button component={Link} href={`/reservations/group-holds/${groupHoldId}`} variant="light" color="gray">Back</Button>
        </Group>
        {error ? <Alert color="red">{error}</Alert> : null}
        {preview ? (
          <>
            <Alert color={preview.canCheckIn ? 'green' : 'red'} icon={preview.canCheckIn ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}>
              {preview.canCheckIn ? 'This group is ready for final check-in.' : 'Resolve blockers before final group check-in.'}
            </Alert>
            {result ? (
              <Alert color="green" icon={<CheckCircle2 size={17} />}>
                Checked in with master folio {result.masterFolioNumber}. Occupied rooms: {result.occupiedRooms.join(', ')}.
              </Alert>
            ) : null}
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Title order={2} c="#101828" style={{ fontSize: 18 }}>Group</Title>
                <Text fw={850}>{preview.group.groupName}</Text>
                <Text c="#64748b" size="sm">{preview.group.adults} adults, {preview.group.children} children</Text>
                <Badge mt={8} color="stayosBrand" variant="light">{preview.folioMode.replaceAll('_', ' ')}</Badge>
              </Card>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Title order={2} c="#101828" style={{ fontSize: 18 }}>Blockers</Title>
                <Stack gap={6} mt={8}>{preview.blockers.length ? preview.blockers.map((item) => <Text key={item} c="#b91c1c">{item}</Text>) : <Text c="#166534">No blockers</Text>}</Stack>
              </Card>
              <Card radius={radius.lg} p={16} style={panelStyle}>
                <Title order={2} c="#101828" style={{ fontSize: 18 }}>Warnings</Title>
                <Stack gap={6} mt={8}>{preview.warnings.length ? preview.warnings.map((item) => <Text key={item} c="#9a3412">{item}</Text>) : <Text c="#166534">No warnings</Text>}</Stack>
              </Card>
            </SimpleGrid>
            <Card radius={radius.lg} p={16} style={panelStyle}>
              <Title order={2} c="#101828" style={{ fontSize: 18 }}>Assigned Rooms</Title>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[2]} mt={spacing[2]}>
                {preview.rooms.map((room) => (
                  <Paper key={room.roomId} radius={radius.md} p={10} style={{ background: room.ready ? '#f0fdf4' : '#fff7ed', border: `1px solid ${room.ready ? '#bbf7d0' : '#fed7aa'}` }}>
                    <Text fw={850}>{room.roomNumber}</Text>
                    <Text c="#64748b" size="sm">{room.roomTypeName}</Text>
                    <Badge color={room.ready ? 'green' : 'orange'} variant="light">{room.operationalStatus.replaceAll('_', ' ')}</Badge>
                  </Paper>
                ))}
              </SimpleGrid>
            </Card>
            <Group justify="flex-end">
              <Button color="stayosBrand" size="md" leftSection={<CheckCircle2 size={16} />} loading={isCheckingIn} disabled={!preview.canCheckIn || Boolean(result)} onClick={() => void finalCheckIn()}>
                Check In Group
              </Button>
            </Group>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
