import { Alert, Box, Button, Group, Modal, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { radius, spacing } from '@stayos/theme';
import type { Reservation } from '../../../lib/reservation-hooks';
import styles from '../RoomsPage.module.css';
import type { Room } from '../types';
import { DetailTile } from './DetailTile';

function guestBreakdown(occupancy: string) {
  const adults = occupancy.match(/(\d+)\s+Adult/i)?.[1] ?? 'Not recorded';
  const children = occupancy.match(/(\d+)\s+Child/i)?.[1] ?? '0';
  return { adults, children };
}

export function CheckInModal({
  loading,
  onClose,
  onConfirm,
  opened,
  reservation,
  room,
}: {
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  opened: boolean;
  reservation?: Reservation;
  room: Room | null;
}) {
  const guests = guestBreakdown(reservation?.occupancy ?? '');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="min(92vw, 640px)"
      title={
        <Box>
          <Text className={styles.modalTitle}>Check In</Text>
          <Text mt={3} className={styles.modalSubtitle}>
            Confirm this guest is ready to occupy Room {room?.number ?? ''}.
          </Text>
        </Box>
      }
    >
      <Stack gap={spacing[3]}>
        {!room?.reservationId ? (
          <Alert color="red" variant="light" radius={radius.lg}>
            Unable to load this room assignment. Please refresh and try again.
          </Alert>
        ) : (
          <Paper radius={radius.lg} p={14} className={styles.surfaceCard}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Guest" value={reservation?.guest ?? room.guest ?? 'Guest'} />
              <DetailTile label="Booking" value={reservation?.id ?? room.reservation} />
              <DetailTile label="Room" value={`Room ${room.number}`} />
              <DetailTile label="Arrival Date" value={reservation?.arrivalDate ?? room.reservationArrivalDate ?? 'Not recorded'} />
              <DetailTile label="Departure Date" value={reservation?.departureDate ?? room.reservationDepartureDate ?? 'Not recorded'} />
              <DetailTile label="Adults" value={guests.adults} />
              <DetailTile label="Children" value={guests.children} />
              <DetailTile label="Payment Status" value={reservation?.payment ?? room.paymentStatus ?? 'Not recorded'} />
            </SimpleGrid>
            <Box mt={spacing[3]}>
              <DetailTile
                label="Special Requests"
                value={
                  reservation?.requests && reservation.requests.length > 0
                    ? reservation.requests.join(', ')
                    : 'No special requests'
                }
              />
            </Box>
          </Paper>
        )}

        <Group justify="flex-end" mt={spacing[2]}>
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            disabled={!room?.reservationId}
            loading={loading}
            onClick={onConfirm}
            className={styles.primaryButtonText}
          >
            Confirm Check In
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
