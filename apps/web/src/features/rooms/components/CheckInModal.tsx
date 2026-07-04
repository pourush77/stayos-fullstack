import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { radius, spacing } from '@stayos/theme';
import {
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Hotel,
  IdCard,
  Smartphone,
  Upload,
  UserRound,
} from 'lucide-react';
import type { Reservation } from '../../../lib/reservation-hooks';
import styles from '../RoomsPage.module.css';
import type { Room } from '../types';
import { DetailTile } from './DetailTile';

function guestBreakdown(occupancy: string) {
  const adults = occupancy.match(/(\d+)\s+Adult/i)?.[1] ?? 'Not recorded';
  const children = occupancy.match(/(\d+)\s+Child/i)?.[1] ?? '0';

  return { adults, children };
}

function isPaymentDue(payment?: string) {
  const normalized = (payment ?? '').toLowerCase();

  return (
    normalized.includes('due') || normalized.includes('partial') || normalized.includes('pending')
  );
}

function SectionHeader({
  detail,
  icon,
  title,
}: {
  detail: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Group gap={10} align="flex-start" wrap="nowrap">
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={34}>
        {icon}
      </ThemeIcon>
      <Box>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          {title}
        </Text>
        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 450, lineHeight: '17px' }}>
          {detail}
        </Text>
      </Box>
    </Group>
  );
}

function ReviewItem({ label, tone = 'green' }: { label: string; tone?: 'green' | 'yellow' }) {
  const isWarning = tone === 'yellow';

  return (
    <Group gap={8} wrap="nowrap">
      <CheckCircle2 size={16} color={isWarning ? '#d97706' : '#16a34a'} />
      <Text
        c={isWarning ? '#92400e' : '#334155'}
        style={{ fontSize: 13, fontWeight: 550, lineHeight: '18px' }}
      >
        {label}
      </Text>
    </Group>
  );
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
  const paymentStatus = reservation?.payment ?? room?.paymentStatus ?? 'Not recorded';
  const paymentDue = isPaymentDue(paymentStatus);
  const hasAssignment = Boolean(room?.reservationId);
  const canComplete = Boolean(hasAssignment && room && room.status !== 'occupied');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="min(94vw, 920px)"
      title={
        <Box>
          <Text className={styles.modalTitle}>Check In</Text>
          <Text mt={3} className={styles.modalSubtitle}>
            Complete guest arrival steps before marking the room occupied.
          </Text>
        </Box>
      }
    >
      <Stack gap={spacing[4]}>
        <Paper radius={radius.lg} p={14} className={styles.surfaceCard}>
          <Group gap={8} wrap="wrap">
            {['Booking', 'Guest', 'Payment', 'Room', 'Review'].map((step, index) => (
              <Badge
                key={step}
                color={index === 0 ? 'stayosBrand' : 'gray'}
                variant={index === 0 ? 'filled' : 'light'}
                radius={radius.full}
                style={{ textTransform: 'none' }}
              >
                {step}
              </Badge>
            ))}
          </Group>
        </Paper>

        {!hasAssignment ? (
          <Alert color="red" variant="light" radius={radius.lg}>
            This booking does not have an assigned room. Please assign a room before check-in.
          </Alert>
        ) : null}

        {room?.status === 'occupied' ? (
          <Alert color="yellow" variant="light" radius={radius.lg}>
            This guest is already checked in.
          </Alert>
        ) : null}

        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <Stack gap={spacing[3]}>
            <SectionHeader
              icon={<FileCheck2 size={17} />}
              title="Booking Review"
              detail="Confirm the booking and stay details."
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Guest" value={reservation?.guest ?? room?.guest ?? 'Guest'} />
              <DetailTile
                label="Booking"
                value={reservation?.id ?? room?.reservation ?? 'Not recorded'}
              />
              <DetailTile label="Room" value={room ? `Room ${room.number}` : 'Not recorded'} />
              <DetailTile
                label="Room type"
                value={room?.roomType ?? reservation?.roomType ?? 'Not recorded'}
              />
              <DetailTile
                label="Arrival Date"
                value={reservation?.arrivalDate ?? room?.reservationArrivalDate ?? 'Not recorded'}
              />
              <DetailTile
                label="Departure Date"
                value={
                  reservation?.departureDate ?? room?.reservationDepartureDate ?? 'Not recorded'
                }
              />
              <DetailTile label="Adults" value={guests.adults} />
              <DetailTile label="Children" value={guests.children} />
            </SimpleGrid>

            <DetailTile
              label="Special Requests"
              value={
                reservation?.requests && reservation.requests.length > 0
                  ? reservation.requests.join(', ')
                  : 'No special requests'
              }
            />
          </Stack>
        </Paper>

        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <Stack gap={spacing[3]}>
            <SectionHeader
              icon={<IdCard size={17} />}
              title="Guest Verification"
              detail="Document capture will be connected here later."
            />

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
              <Paper
                radius={radius.md}
                p={13}
                style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}
              >
                <Group gap={8}>
                  <UserRound size={16} color="#475569" />
                  <Box>
                    <Text c="#101828" style={{ fontSize: 13, fontWeight: 650 }}>
                      Lead Guest
                    </Text>
                    <Text c="#64748b" mt={2} style={{ fontSize: 12 }}>
                      {reservation?.guest ?? room?.guest ?? 'Guest'}
                    </Text>
                  </Box>
                </Group>
              </Paper>

              <Button variant="light" color="gray" leftSection={<Upload size={15} />} disabled>
                Upload ID
              </Button>

              <Button variant="light" color="gray" leftSection={<Smartphone size={15} />} disabled>
                Use Mobile
              </Button>
            </SimpleGrid>

            <Alert color="yellow" variant="light" radius={radius.lg}>
              ID verification is not completed yet. For now, StayOS allows check-in while document
              capture is being built.
            </Alert>
          </Stack>
        </Paper>

        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <Stack gap={spacing[3]}>
            <SectionHeader
              icon={<CreditCard size={17} />}
              title="Payment Status"
              detail="Review payment before completing check-in."
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile label="Payment Status" value={paymentStatus} />
              <DetailTile label="Outstanding Amount" value={paymentDue ? 'Pending' : 'None'} />
            </SimpleGrid>

            {paymentDue ? (
              <Alert color="yellow" variant="light" radius={radius.lg}>
                Payment is still pending. Billing will handle collection in the payment workflow.
              </Alert>
            ) : (
              <Alert color="green" variant="light" radius={radius.lg}>
                Payment verified.
              </Alert>
            )}

            <Button variant="light" color="gray" disabled>
              Collect Payment
            </Button>
          </Stack>
        </Paper>

        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <Stack gap={spacing[3]}>
            <SectionHeader
              icon={<Hotel size={17} />}
              title="Room Assignment"
              detail="Confirm the room before completing check-in."
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              <DetailTile
                label="Current Room"
                value={room ? `Room ${room.number}` : 'Not recorded'}
              />
              <DetailTile label="Room Status" value={room?.status ?? 'Not recorded'} />
              <DetailTile label="Capacity" value={room?.capacity ?? 'Not recorded'} />
              <DetailTile label="Bed" value={room?.bedType ?? 'Not recorded'} />
            </SimpleGrid>

            <Alert color="blue" variant="light" radius={radius.lg}>
              Room can still be changed before completing check-in. Close this workspace and use
              Change Room if needed.
            </Alert>
          </Stack>
        </Paper>

        <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
          <Stack gap={spacing[3]}>
            <SectionHeader
              icon={<CheckCircle2 size={17} />}
              title="Final Review"
              detail="Complete check-in only when the guest is ready to occupy the room."
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
              <ReviewItem label="Booking reviewed" />
              <ReviewItem label="Guest verification reviewed" tone="yellow" />
              <ReviewItem label="Room assigned" />
              <ReviewItem
                label={paymentDue ? 'Payment pending reviewed' : 'Payment reviewed'}
                tone={paymentDue ? 'yellow' : 'green'}
              />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Divider />

        <Group justify="space-between" align="center">
          <Text c="#64748b" style={{ fontSize: 13, fontWeight: 450 }}>
            Completing check-in will mark this room as occupied.
          </Text>

          <Group>
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="stayosBrand"
              disabled={!canComplete}
              loading={loading}
              onClick={onConfirm}
              className={styles.primaryButtonText}
            >
              Complete Check In
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
