'use client';

import Link from 'next/link';
import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { radius } from '@stayos/theme';
import type { GroupHoldDto } from '../../../lib/operations-api';
import { formatStayDates } from '../utils/booking-formatters';

function groupRoomTypeSummary(group: GroupHoldDto) {
  return group.roomBlocks.length
    ? group.roomBlocks.map((block) => `${block.rooms} ${block.roomTypeName}`).join(' + ')
    : 'Room mix pending';
}

function groupRoomCount(group: GroupHoldDto) {
  const rooms = group.roomBlocks.reduce((total, block) => total + block.rooms, 0);
  if (rooms > 0) return `${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;
  return 'Room count pending';
}

function groupStatusLabel(status: GroupHoldDto['status']) {
  return status.replace(/_/g, ' ');
}

function groupStatusColor(status: GroupHoldDto['status']) {
  if (status === 'CONFIRMED') return 'blue';
  if (status === 'ON_HOLD') return 'yellow';
  return 'gray';
}

function arrivalRank(group: GroupHoldDto, today: string) {
  return group.arrivalDate >= today ? 0 : 1;
}

export function getActiveGroupsForBookingsPage(groups: GroupHoldDto[], today: string) {
  return groups
    .filter(
      (group) =>
        (group.status === 'ON_HOLD' || group.status === 'CONFIRMED') &&
        group.departureDate >= today,
    )
    .sort((a, b) => {
      const rankDiff = arrivalRank(a, today) - arrivalRank(b, today);
      if (rankDiff !== 0) return rankDiff;
      const dateDiff = a.arrivalDate.localeCompare(b.arrivalDate);
      if (dateDiff !== 0) return dateDiff;
      return a.groupCode.localeCompare(b.groupCode);
    });
}

export function ActiveGroupsSection({
  groups,
  today,
}: {
  groups: GroupHoldDto[];
  today: string;
}) {
  const activeGroups = getActiveGroupsForBookingsPage(groups, today);

  if (!activeGroups.length) return null;

  return (
    <Card radius={radius.lg} p={12} style={{ background: '#fffdf8', border: '1px solid #fed7aa' }}>
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={800} c="#7c2d12">
              Active groups
            </Text>
            <Text size="sm" c="#9a3412">
              Upcoming group holds and confirmed groups, sorted by next arrival.
            </Text>
          </Stack>
          <Badge color="orange" variant="light">
            {activeGroups.length} active
          </Badge>
        </Group>

        <Stack gap={8}>
          {activeGroups.map((group) => (
            <Card
              key={group.id}
              radius="md"
              p="sm"
              style={{ background: '#ffffff', border: '1px solid #fed7aa' }}
              data-testid={`active-group-card-${group.id}`}
            >
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={2}>
                  <Group gap={8} wrap="wrap">
                    <Text fw={800} c="#101828">
                      {group.groupCode}
                    </Text>
                    <Text c="#475569">{group.groupName || group.leadName}</Text>
                    <Badge color={groupStatusColor(group.status)} variant="light">
                      {groupStatusLabel(group.status)}
                    </Badge>
                  </Group>
                  <Text size="sm" c="#334155">
                    {formatStayDates(group.arrivalDate, group.departureDate)}
                  </Text>
                  <Text size="xs" c="#64748b">
                    {groupRoomCount(group)} - {groupRoomTypeSummary(group)} - Lead {group.leadName}
                  </Text>
                </Stack>

                <Button
                  component={Link}
                  href={`/reservations/group-holds/${group.id}`}
                  variant="light"
                  color="orange"
                  size="xs"
                >
                  View group
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
