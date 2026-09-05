'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ArrowRight, CheckCircle2, DoorClosed, User } from 'lucide-react';
import { radius } from '@stayos/theme';
import {
  NoShowConfirmationModal,
  type NoShowTarget,
} from '../../reservations/components/NoShowConfirmationModal';
import { formatBusinessDate } from '../api/night-audit-api';
import type {
  NightAuditPendingArrivalItemDto,
  NightAuditPendingArrivalsSectionDto,
} from '../types/night-audit.types';

export interface PendingArrivalsSectionProps {
  section: NightAuditPendingArrivalsSectionDto;
  propertyId?: string;
  onRefresh?: () => Promise<void> | void;
}

function renderActionButtons(
  item: NightAuditPendingArrivalItemDto,
  onMarkNoShow: (item: NightAuditPendingArrivalItemDto) => void,
) {
  const reservationId = item.reservationId;
  const actionTypes = (item.actions ?? []).map((a) => a.type);

  // If actions list doesn't include OPEN_BOOKING, we always want a safe way to view
  const elements = [];

  if (actionTypes.includes('CHECK_IN')) {
    elements.push(
      <Button
        key="action-checkin"
        component={Link}
        href={`/reservations/${reservationId}/check-in`}
        size="xs"
        variant="filled"
        color="stayosBrand"
      >
        Check In
      </Button>,
    );
  }

  if (actionTypes.includes('CONFIRM')) {
    elements.push(
      <Button
        key="action-confirm"
        component={Link}
        href={`/reservations/${reservationId}`}
        size="xs"
        variant="default"
      >
        Confirm
      </Button>,
    );
  }

  if (actionTypes.includes('MARK_NO_SHOW')) {
    elements.push(
      <Button
        key="action-noshow"
        size="xs"
        variant="default"
        onClick={() => onMarkNoShow(item)}
        data-testid={`mark-no-show-button-${reservationId}`}
      >
        Mark No-Show
      </Button>,
    );
  }

  if (actionTypes.includes('CANCEL')) {
    elements.push(
      <Button
        key="action-cancel"
        component={Link}
        href={`/reservations/${reservationId}`}
        size="xs"
        variant="subtle"
        color="red"
      >
        Cancel
      </Button>,
    );
  }

  if (actionTypes.includes('OPEN_BOOKING') || elements.length === 0) {
    elements.push(
      <Button
        key="action-open"
        component={Link}
        href={`/reservations/${reservationId}`}
        size="xs"
        variant="default"
      >
        Open Booking
      </Button>,
    );
  }

  return <Group gap={6} wrap="wrap">{elements}</Group>;
}

export function PendingArrivalsSection({
  section,
  propertyId,
  onRefresh,
}: PendingArrivalsSectionProps) {
  const items = section.items ?? [];
  const hasItems = items.length > 0;
  const blockingCount = section.blockingCount ?? items.length;

  const [noShowItem, setNoShowItem] = useState<NightAuditPendingArrivalItemDto | null>(null);

  return (
    <Card
      id="section-pending-arrivals"
      data-testid="section-pending-arrivals"
      radius={radius.lg}
      p={20}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
      }}
    >
      <Stack gap={16}>
        <Group justify="space-between" align="center">
          <Group gap={10} align="center">
            <Title order={3} style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              Pending Arrivals
            </Title>
            <Badge size="sm" variant="light" color="gray">
              {section.count} {section.count === 1 ? 'reservation' : 'reservations'}
            </Badge>
          </Group>

          {blockingCount > 0 ? (
            <Badge data-testid="pending-arrivals-blocker-count" color="red" variant="filled" size="sm">
              {blockingCount} {blockingCount === 1 ? 'blocker' : 'blockers'}
            </Badge>
          ) : (
            <Badge data-testid="pending-arrivals-blocker-count" color="green" variant="light" size="sm">
              Clear
            </Badge>
          )}
        </Group>

        {!hasItems ? (
          <Paper
            data-testid="empty-pending-arrivals"
            p={24}
            radius={radius.md}
            style={{
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              textAlign: 'center',
            }}
          >
            <Group justify="center" gap={8} align="center">
              <CheckCircle2 size={16} color="#16a34a" />
              <Text size="sm" fw={600} c="#475569">
                No pending arrivals
              </Text>
            </Group>
          </Paper>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>GUEST</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>RESERVATION</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>STAY DATES</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>ROOM</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>STATUS</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>BLOCKING</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                    ACTIONS
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr
                    key={item.reservationId}
                    data-testid={`pending-arrival-row-${item.reservationId}`}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <Table.Td>
                      <Group gap={8} align="center" wrap="nowrap">
                        <User size={15} color="#64748b" />
                        <Text size="sm" fw={600} c="#0f172a">
                          {item.guestName || 'Unnamed Guest'}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm" fw={500} c="#475569">
                        {item.reservationCode || item.confirmationNumber}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={6} align="center" wrap="nowrap">
                        <Text size="xs" fw={600} c="#0f172a">
                          {formatBusinessDate(item.arrivalDate)}
                        </Text>
                        <ArrowRight size={12} color="#94a3b8" />
                        <Text size="xs" fw={500} c="#64748b">
                          {formatBusinessDate(item.departureDate)}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={6} align="center" wrap="nowrap">
                        <DoorClosed size={14} color="#64748b" />
                        <Text size="sm" fw={500} c={item.roomNumber ? '#0f172a' : '#94a3b8'}>
                          {item.roomNumber ? `Room ${item.roomNumber}` : 'Unassigned'}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Badge color="blue" variant="light" size="sm">
                        {item.status}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        data-testid={`pending-arrival-blocking-badge-${item.reservationId}`}
                        color="red"
                        variant="filled"
                        size="sm"
                        fw={700}
                      >
                        Blocking
                      </Badge>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Group justify="flex-end">
                        {renderActionButtons(item, (selected) => {
                          setNoShowItem(selected);
                        })}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>

      <NoShowConfirmationModal
        opened={Boolean(noShowItem)}
        target={
          noShowItem && propertyId
            ? {
                propertyId,
                reservationId: noShowItem.reservationId,
                reservationCode: noShowItem.reservationCode || noShowItem.confirmationNumber,
                guestName: noShowItem.guestName,
              }
            : null
        }
        onClose={() => setNoShowItem(null)}
        onSuccess={onRefresh}
      />
    </Card>
  );
}
