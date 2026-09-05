'use client';

import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DoorClosed,
  User,
} from 'lucide-react';
import { radius } from '@stayos/theme';
import { formatBusinessDate } from '../api/night-audit-api';
import type {
  NightAuditActionDto,
  NightAuditStayReviewItemDto,
  NightAuditStayReviewSectionDto,
  NightAuditStayReviewState,
} from '../types/night-audit.types';

export interface StayReviewSectionProps {
  section: NightAuditStayReviewSectionDto;
}

function renderStayReviewStateBadge(state: NightAuditStayReviewState) {
  switch (state) {
    case 'OVERDUE':
      return (
        <Badge
          data-testid="stay-review-state-overdue"
          color="red"
          variant="filled"
          size="sm"
          fw={800}
        >
          OVERDUE
        </Badge>
      );
    case 'DUE_OUT':
      return (
        <Badge
          data-testid="stay-review-state-due-out"
          color="orange"
          variant="light"
          size="sm"
          fw={700}
        >
          DUE OUT
        </Badge>
      );
    case 'STAYOVER':
    default:
      return (
        <Badge
          data-testid="stay-review-state-stayover"
          color="gray"
          variant="light"
          size="sm"
          fw={500}
        >
          STAYOVER
        </Badge>
      );
  }
}

function renderActionButtons(reservationId: string, actions: NightAuditActionDto[]) {
  const actionTypes = (actions ?? []).map((a) => a.type);
  const elements = [];

  if (actionTypes.includes('CHECK_OUT')) {
    elements.push(
      <Button
        key="action-checkout"
        component={Link}
        href={`/guest-stay/${reservationId}`}
        size="xs"
        variant="filled"
        color="stayosBrand"
      >
        Check Out
      </Button>,
    );
  }

  if (actionTypes.includes('EXTEND_STAY')) {
    elements.push(
      <Button
        key="action-extend"
        component={Link}
        href={`/guest-stay/${reservationId}`}
        size="xs"
        variant="default"
      >
        Extend Stay
      </Button>,
    );
  }

  if (actionTypes.includes('OPEN_STAY') || elements.length === 0) {
    elements.push(
      <Button
        key="action-open"
        component={Link}
        href={`/guest-stay/${reservationId}`}
        size="xs"
        variant="default"
      >
        Open Stay
      </Button>,
    );
  }

  return <Group gap={6} wrap="wrap">{elements}</Group>;
}

export function StayReviewSection({ section }: StayReviewSectionProps) {
  const items = section.items ?? [];
  const hasItems = items.length > 0;
  const summary = section.summary ?? { stayover: 0, dueOut: 0, overdue: 0 };
  const blockingCount = section.blockingCount ?? 0;

  return (
    <Card
      id="section-stay-review"
      data-testid="section-stay-review"
      radius={radius.lg}
      p={20}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
      }}
    >
      <Stack gap={16}>
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap={10} align="center">
            <Title order={3} style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              Due-Out / Overdue Stays
            </Title>
            <Badge size="sm" variant="light" color="gray">
              {section.count} {section.count === 1 ? 'stay' : 'stays'} total
            </Badge>
          </Group>

          <Group gap={10} align="center">
            <Group gap={6}>
              {summary.overdue > 0 ? (
                <Badge color="red" variant="filled" size="xs">
                  {summary.overdue} overdue
                </Badge>
              ) : null}
              {summary.dueOut > 0 ? (
                <Badge color="orange" variant="light" size="xs">
                  {summary.dueOut} due out
                </Badge>
              ) : null}
              {summary.stayover > 0 ? (
                <Badge color="gray" variant="light" size="xs">
                  {summary.stayover} stayover
                </Badge>
              ) : null}
            </Group>

            {blockingCount > 0 ? (
              <Badge data-testid="stay-review-blocker-count" color="red" variant="filled" size="sm">
                {blockingCount} {blockingCount === 1 ? 'blocker' : 'blockers'}
              </Badge>
            ) : (
              <Badge data-testid="stay-review-blocker-count" color="green" variant="light" size="sm">
                Clear
              </Badge>
            )}
          </Group>
        </Group>

        {!hasItems ? (
          <Paper
            data-testid="empty-stay-review"
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
                No due-outs or overdue stays
              </Text>
            </Group>
          </Paper>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>GUEST</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>ROOM</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>STAY DATES</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>REVIEW STATE</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>BLOCKING</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                    ACTIONS
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => {
                  const isOverdue = item.reviewState === 'OVERDUE';
                  const isDueOut = item.reviewState === 'DUE_OUT';

                  return (
                    <Table.Tr
                      key={item.reservationId}
                      data-testid={`stay-review-row-${item.reservationId}`}
                      style={{
                        backgroundColor: isOverdue ? '#fef2f2' : undefined,
                        borderLeft: isOverdue
                          ? '4px solid #ef4444'
                          : isDueOut
                            ? '4px solid #f59e0b'
                            : '4px solid transparent',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <Table.Td>
                        <Stack gap={2}>
                          <Group gap={8} align="center" wrap="nowrap">
                            <User size={15} color={isOverdue ? '#dc2626' : '#64748b'} />
                            <Text
                              size="sm"
                              fw={isOverdue ? 700 : 600}
                              c={isOverdue ? '#b91c1c' : '#0f172a'}
                            >
                              {item.guestName || 'Unnamed Guest'}
                            </Text>
                          </Group>
                          <Text size="xs" c="#64748b">
                            {item.reservationCode || item.confirmationNumber}
                          </Text>
                        </Stack>
                      </Table.Td>

                      <Table.Td>
                        <Stack gap={2}>
                          <Group gap={6} align="center" wrap="nowrap">
                            <DoorClosed size={14} color="#64748b" />
                            <Text size="sm" fw={500} c={item.roomNumber ? '#0f172a' : '#94a3b8'}>
                              {item.roomNumber ? `Room ${item.roomNumber}` : 'Unassigned'}
                            </Text>
                          </Group>
                          {item.roomAssignmentMissing ? (
                            <Badge color="red" variant="outline" size="xs">
                              Missing Room
                            </Badge>
                          ) : null}
                        </Stack>
                      </Table.Td>

                      <Table.Td>
                        <Group gap={6} align="center" wrap="nowrap">
                          <Text size="xs" fw={500} c="#64748b">
                            {formatBusinessDate(item.arrivalDate)}
                          </Text>
                          <ArrowRight size={12} color="#94a3b8" />
                          <Text
                            size="xs"
                            fw={isOverdue ? 700 : 600}
                            c={isOverdue ? '#dc2626' : '#0f172a'}
                          >
                            {formatBusinessDate(item.departureDate)}
                          </Text>
                        </Group>
                      </Table.Td>

                      <Table.Td>{renderStayReviewStateBadge(item.reviewState)}</Table.Td>

                      <Table.Td>
                        {item.blocking ? (
                          <Badge
                            data-testid={`stay-review-blocking-badge-${item.reservationId}`}
                            color={isOverdue ? 'red' : 'orange'}
                            variant="filled"
                            size="sm"
                            fw={700}
                          >
                            Blocking
                          </Badge>
                        ) : (
                          <Badge
                            data-testid={`stay-review-blocking-badge-${item.reservationId}`}
                            color="green"
                            variant="subtle"
                            size="sm"
                          >
                            Non-blocking
                          </Badge>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'right' }}>
                        <Group justify="flex-end">
                          {renderActionButtons(item.reservationId, item.actions)}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Card>
  );
}
