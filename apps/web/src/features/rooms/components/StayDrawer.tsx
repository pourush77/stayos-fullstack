import { Badge, Box, Button, Drawer, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { DoorOpen, History } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import type { Reservation } from '../../../lib/reservation-hooks';
import styles from '../RoomsPage.module.css';
import type { Room } from '../types';
import { statusLabel } from '../utils';
import { DetailTile } from './DetailTile';

export function StayDrawer({
  onCheckOut,
  onClose,
  opened,
  reservation,
  room,
}: {
  onCheckOut: () => void;
  onClose: () => void;
  opened: boolean;
  reservation?: Reservation;
  room: Room | null;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(92vw, 500px)"
      title={
        <Group gap={10}>
          <Text style={{ fontSize: 20, fontWeight: 700 }}>Stay Details</Text>
          <Badge color="blue" variant="light" radius={radius.full}>
            Occupied
          </Badge>
        </Group>
      }
    >
      <Stack gap={spacing[4]}>
        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <SimpleGrid cols={2} spacing={spacing[3]}>
            <DetailTile label="Guest" value={reservation?.guest ?? room?.guest ?? 'Guest'} />
            <DetailTile label="Reservation" value={reservation?.id ?? room?.reservation ?? 'Not recorded'} />
            <DetailTile label="Room" value={room ? `Room ${room.number}` : 'Not recorded'} />
            <DetailTile label="Check-in time" value={room?.checkInTime ?? 'Checked in today'} />
            <DetailTile
              label="Expected check-out"
              value={reservation?.departureDate ?? room?.reservationDepartureDate ?? 'Not recorded'}
            />
            <DetailTile label="Room type" value={room?.roomType ?? reservation?.roomType ?? 'Not recorded'} />
            <DetailTile
              label="Current room status"
              value={room ? statusLabel(room.status) : 'Not recorded'}
            />
            <DetailTile label="Payment status" value={reservation?.payment ?? room?.paymentStatus ?? 'Not recorded'} />
          </SimpleGrid>
          <Box mt={spacing[3]}>
            <DetailTile
              label="Special requests"
              value={
                reservation?.requests && reservation.requests.length > 0
                  ? reservation.requests.join(', ')
                  : 'No special requests'
              }
            />
          </Box>
        </Paper>

        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <Text className={styles.drawerSectionTitle}>Operations</Text>
          <Stack gap={8} mt={spacing[3]}>
            <Button color="red" leftSection={<DoorOpen size={16} />} onClick={onCheckOut}>
              Check Out
            </Button>
            <Button variant="light" color="gray" leftSection={<History size={16} />}>
              View History
            </Button>
            <Group gap={8}>
              <Button variant="subtle" color="gray" disabled>
                Billing
              </Button>
              <Button variant="subtle" color="gray" disabled>
                Charges
              </Button>
              <Button variant="subtle" color="gray" disabled>
                Housekeeping
              </Button>
              <Button variant="subtle" color="gray" disabled>
                Notes
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Drawer>
  );
}
