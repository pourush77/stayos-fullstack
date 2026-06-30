'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  BedDouble,
  Brush,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  DoorOpen,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import {
  getProperties,
  getPropertyRoomTypes,
  getPropertyRooms,
  type InventoryPropertyDto,
  type InventoryRoomDto,
  type InventoryRoomTypeDto,
} from '../../../lib/inventory-api';

type RoomDetail = {
  number: string;
  type: string;
  status: string;
  guest: string;
  housekeeping: string;
  arrival: string;
  departure: string;
  maintenance: string;
  notes: string;
  timeline: string[];
};

const fallbackRoom: RoomDetail = {
  number: '402',
  type: 'Premium Suite',
  status: 'Guest Staying',
  guest: 'Ananya Rao',
  housekeeping: 'Clean and inspected',
  arrival: '28 Jun, 09:10 AM',
  departure: '01 Jul, 11:00 AM',
  maintenance: 'No active issues',
  notes: 'Guest prefers high floor, vegetarian meals, and extra pillow.',
  timeline: [
    '09:10 Guest checked in',
    '09:23 Room keys issued',
    '11:05 Housekeeping completed',
    '17:30 Laundry requested',
  ],
};

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function activeProperty(properties: InventoryPropertyDto[]) {
  return properties.find(isActiveRecord);
}

function typeLookup(roomTypes: InventoryRoomTypeDto[]) {
  return new Map(roomTypes.map((roomType) => [getString(roomType, ['id']), roomType]));
}

function displayStatus(room: InventoryRoomDto) {
  const status = getString(room, ['operationalStatus', 'operational_status'], 'READY').replace(/_/g, ' ').toLowerCase();
  return status.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapRoomDetail(room: InventoryRoomDto, roomTypes: InventoryRoomTypeDto[]): RoomDetail {
  const roomType = typeLookup(roomTypes).get(getString(room, ['roomTypeId', 'room_type_id']));
  const roomNumber = getString(room, ['roomNumber', 'number', 'displayName'], 'Room');
  const roomTypeName = getString(roomType, ['name'], 'Room');

  return {
    number: roomNumber,
    type: roomTypeName,
    status: displayStatus(room),
    guest: 'None',
    housekeeping: displayStatus(room),
    arrival: 'No arrival connected',
    departure: 'No departure connected',
    maintenance: 'No active issues',
    notes: getString(room, ['description'], `${roomTypeName} room loaded from Hillston inventory.`),
    timeline: [`Room ${roomNumber} loaded from backend inventory`, `${displayStatus(room)} operational status`],
  };
}

function loadingRoom(roomId: string): RoomDetail {
  return {
    number: roomId,
    type: 'Loading inventory',
    status: 'Loading',
    guest: 'Loading',
    housekeeping: 'Loading',
    arrival: 'Loading',
    departure: 'Loading',
    maintenance: 'Loading',
    notes: 'Loading live Hillston room inventory.',
    timeline: ['Loading live Hillston room inventory'],
  };
}

function useRoomDetail(roomId: string): { isFallback: boolean; isLoading: boolean; room: RoomDetail } {
  const [state, setState] = useState({ isFallback: false, isLoading: true, room: loadingRoom(roomId) });

  useEffect(() => {
    const controller = new AbortController();
    setState({ isFallback: false, isLoading: true, room: loadingRoom(roomId) });

    async function loadRoom() {
      try {
        const properties = await getProperties(controller.signal);
        const property = activeProperty(properties);
        const propertyId = getString(property, ['id']);

        if (!propertyId) throw new Error('No active property returned.');

        const [rooms, roomTypes] = await Promise.all([
          getPropertyRooms(propertyId, controller.signal),
          getPropertyRoomTypes(propertyId, controller.signal),
        ]);
        const matchedRoom = rooms
          .filter(isActiveRecord)
          .find((room) => getString(room, ['roomNumber', 'number', 'displayName']) === roomId);

        if (!matchedRoom) throw new Error(`Room ${roomId} was not found.`);

        setState({
          isFallback: false,
          isLoading: false,
          room: mapRoomDetail(matchedRoom, roomTypes.filter(isActiveRecord)),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ isFallback: true, isLoading: false, room: fallbackRoom });
      }
    }

    void loadRoom();

    return () => controller.abort();
  }, [roomId]);

  return state;
}

export default function RoomWorkspacePlaceholderPage() {
  const pathname = usePathname();
  const roomId = pathname.split('/').filter(Boolean).at(-1) ?? fallbackRoom.number;
  const { isFallback, isLoading, room } = useRoomDetail(roomId);

  return (
    <Stack gap={spacing[5]}>
      <Button
        component="a"
        href="/rooms"
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        w="fit-content"
      >
        Back to Room Operations
      </Button>

      <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
        <Group justify="space-between" align="flex-start" gap={spacing[5]}>
          <Group gap={spacing[4]} align="flex-start">
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={52}>
              <BedDouble size={24} />
            </ThemeIcon>
            <Box>
              <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
                Room {room.number}
              </Title>
              <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.bodyLarge}>
                {room.type}
              </Text>
            </Box>
          </Group>
          <Badge
            radius={radius.full}
            variant="light"
            color="stayosBrand"
            styles={{ root: { textTransform: 'none' } }}
          >
            {room.status}
          </Badge>
        </Group>
      </Card>

      {isLoading ? (
        <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Text c={colors.text.body} style={typography.styles.small}>
            Loading live Hillston room inventory...
          </Text>
        </Card>
      ) : null}

      {isFallback ? (
        <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Text c={colors.text.body} style={typography.styles.small}>
            Backend room inventory is unavailable, so this room is showing fallback data.
          </Text>
        </Card>
      ) : null}

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing={spacing[4]}>
        {[
          ['Current Guest', room.guest, <DoorOpen size={17} />],
          ['Housekeeping', room.housekeeping, <Brush size={17} />],
          ['Arrival / Departure', `${room.arrival} - ${room.departure}`, <CalendarClock size={17} />],
          ['Maintenance', room.maintenance, <Wrench size={17} />],
          ['Room Notes', room.notes, <ClipboardList size={17} />],
        ].map(([label, value, icon]) => (
          <Paper key={String(label)} p={spacing[4]} radius={radius.lg} bg={colors.surface.base}>
            <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
              <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
                {icon}
              </ThemeIcon>
              <Box>
                <Text c={colors.text.muted} style={typography.styles.caption}>
                  {label}
                </Text>
                <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
                  {value}
                </Text>
              </Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            Timeline
          </Title>
          <Stack mt={spacing[4]} gap={spacing[3]}>
            {room.timeline.map((item) => (
              <Text key={item} c={colors.text.body} style={typography.styles.small}>
                {item}
              </Text>
            ))}
          </Stack>
        </Card>

        <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            Quick Actions
          </Title>
          <Group mt={spacing[4]} gap={spacing[3]}>
            <Button component="a" href="/guest-stay/ST1842" color="stayosBrand" leftSection={<DoorOpen size={16} />}>
              View Stay
            </Button>
            <Button variant="light" color="stayosBrand" leftSection={<Brush size={16} />}>
              Housekeeping
            </Button>
            <Button variant="light" color="stayosBrand" leftSection={<CreditCard size={16} />}>
              Billing
            </Button>
            <Button variant="subtle" color="gray" leftSection={<MessageSquare size={16} />}>
              Add Note
            </Button>
          </Group>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
