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
import { AlertCircle, BedDouble, Brush, Wrench, ChevronLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import {
  getProperties,
  getPropertyRoomTypes,
  getPropertyRooms,
  type InventoryPropertyDto,
  type InventoryRoomDto,
  type InventoryRoomTypeDto,
} from '../../lib/inventory-api';
import styles from './RoomDetailPage.module.css';

type RoomDetail = {
  number: string;
  type: string;
  status: string;
  notes: string;
  amenities: string[];
};

type RoomDetailState = {
  error?: string;
  isLoading: boolean;
  room?: RoomDetail;
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
  const status = getString(room, ['operationalStatus', 'operational_status'], 'READY')
    .replace(/_/g, ' ')
    .toLowerCase();
  return status.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapRoomDetail(room: InventoryRoomDto, roomTypes: InventoryRoomTypeDto[]): RoomDetail {
  const roomType = typeLookup(roomTypes).get(getString(room, ['roomTypeId', 'room_type_id']));
  const roomNumber = getString(room, ['roomNumber', 'number', 'displayName'], 'Room');
  const roomTypeName = getString(roomType, ['name'], 'Room');
  const roomAmenities = Array.isArray(room.amenities) ? room.amenities : undefined;
  const typeAmenities = Array.isArray(roomType?.amenities) ? roomType.amenities : [];
  const amenities = (roomAmenities ?? typeAmenities)
    .map((amenity) => getString(amenity as Record<string, unknown>, ['label', 'code']))
    .filter(Boolean);

  return {
    number: roomNumber,
    type: roomTypeName,
    status: displayStatus(room),
    notes: getString(room, ['description'], 'No room notes recorded.'),
    amenities,
  };
}

function useRoomDetail(roomId: string): RoomDetailState {
  const [state, setState] = useState<RoomDetailState>({ isLoading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState({ isLoading: true });

    async function loadRoom() {
      try {
        const properties = await getProperties(controller.signal);
        const property = activeProperty(properties);
        const propertyId = getString(property, ['id']);

        if (!propertyId) throw new Error('No active property is available.');

        const [rooms, roomTypes] = await Promise.all([
          getPropertyRooms(propertyId, controller.signal),
          getPropertyRoomTypes(propertyId, controller.signal),
        ]);
        const matchedRoom = rooms
          .filter(isActiveRecord)
          .find((room) => getString(room, ['roomNumber', 'number', 'displayName']) === roomId);

        if (!matchedRoom) throw new Error(`Room ${roomId} was not found in the active property.`);

        setState({
          isLoading: false,
          room: mapRoomDetail(matchedRoom, roomTypes.filter(isActiveRecord)),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          error: error instanceof Error ? error.message : 'Unable to load this room.',
          isLoading: false,
        });
      }
    }

    void loadRoom();
    return () => controller.abort();
  }, [roomId]);

  return state;
}

export default function RoomWorkspacePlaceholderPage() {
  const pathname = usePathname();
  const roomId = pathname.split('/').filter(Boolean).at(-1) ?? '';
  const { error, isLoading, room } = useRoomDetail(roomId);

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
        Back to Rooms
      </Button>

      {isLoading ? (
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" className={styles.plainCard}>
          <Text className={styles.loadingText}>Loading room details…</Text>
          <Text mt={4} c="#64748b" size="sm">
            Getting the latest room type, operational status, and amenities.
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Card p={spacing[5]} radius={radius.lg} shadow="xs" className={styles.plainCard}>
          <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
            <ThemeIcon color="red" variant="light" radius={radius.md}>
              <AlertCircle size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={800} c="#101828">
                Room details unavailable
              </Text>
              <Text mt={4} c="#64748b" size="sm">
                {error}
              </Text>
              <Button component="a" href="/rooms" mt={spacing[3]} variant="light" color="gray">
                Return to room board
              </Button>
            </Box>
          </Group>
        </Card>
      ) : null}

      {room ? (
        <>
          <Card p={spacing[6]} radius={radius.lg} shadow="xs" className={styles.plainCard}>
            <Group justify="space-between" align="flex-start" gap={spacing[4]} wrap="wrap">
              <Group gap={spacing[4]} align="flex-start" wrap="nowrap">
                <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={52}>
                  <BedDouble size={24} />
                </ThemeIcon>
                <Box style={{ minWidth: 0 }}>
                  <Title order={1} className={styles.roomTitle}>
                    Room {room.number}
                  </Title>
                  <Text mt={spacing[1]} className={styles.roomType}>
                    {room.type}
                  </Text>
                  {room.amenities.length ? (
                    <Group mt={spacing[3]} gap={spacing[2]} wrap="wrap">
                      {room.amenities.map((amenity) => (
                        <Badge key={amenity} radius={radius.full} variant="light" color="gray">
                          {amenity}
                        </Badge>
                      ))}
                    </Group>
                  ) : null}
                </Box>
              </Group>
              <Badge radius={radius.full} variant="light" color="stayosBrand">
                {room.status}
              </Badge>
            </Group>
          </Card>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[4]}>
            <Paper p={spacing[4]} radius={radius.lg} className={styles.detailPaper}>
              <Text className={styles.detailLabel}>Room notes</Text>
              <Text mt={spacing[1]} className={styles.detailValue}>
                {room.notes}
              </Text>
            </Paper>
            <Paper p={spacing[4]} radius={radius.lg} className={styles.detailPaper}>
              <Text className={styles.detailLabel}>Operational status</Text>
              <Text mt={spacing[1]} className={styles.detailValue}>
                {room.status}
              </Text>
            </Paper>
          </SimpleGrid>

          <Card p={spacing[5]} radius={radius.lg} shadow="xs" className={styles.plainCard}>
            <Title order={2} className={styles.sectionTitle}>
              Room operations
            </Title>
            <Text mt={spacing[2]} c="#64748b" size="sm">
              Guest stay, billing, assignment, and room-status actions are managed from the live
              room board, where StayOS has the reservation context required to perform them safely.
            </Text>
            <Group mt={spacing[4]} gap={spacing[2]} wrap="wrap">
              <Button
                component="a"
                href="/rooms"
                color="stayosBrand"
                leftSection={<BedDouble size={16} />}
              >
                Open room board
              </Button>
              <Button
                component="a"
                href={`/housekeeping?room=${encodeURIComponent(room.number)}`}
                variant="light"
                color="gray"
                leftSection={<Brush size={16} />}
              >
                Housekeeping
              </Button>
              <Button
                component="a"
                href="/maintenance"
                variant="light"
                color="gray"
                leftSection={<Wrench size={16} />}
              >
                Maintenance
              </Button>
            </Group>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
