'use client';

import Link from 'next/link';
import {
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
import { ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { radius } from '@stayos/theme';
import { formatBusinessDate, formatCurrency } from '../api/night-audit-api';
import type {
  NightAuditActionDto,
  NightAuditGroupReviewItemDto,
  NightAuditGroupReviewSectionDto,
} from '../types/night-audit.types';

export interface GroupReviewSectionProps {
  section: NightAuditGroupReviewSectionDto;
}

function renderActionButtons(groupBookingId: string, actions: NightAuditActionDto[]) {
  const actionTypes = (actions ?? []).map((a) => a.type);
  const elements = [];

  if (actionTypes.includes('CHECK_OUT_GROUP')) {
    elements.push(
      <Button
        key="action-group-checkout"
        component={Link}
        href={`/reservations/group-holds/${groupBookingId}/master-folio`}
        size="xs"
        variant="filled"
        color="stayosBrand"
      >
        Checkout Group
      </Button>,
    );
  }

  if (actionTypes.includes('OPEN_MASTER_FOLIO')) {
    elements.push(
      <Button
        key="action-master-folio"
        component={Link}
        href={`/reservations/group-holds/${groupBookingId}/master-folio`}
        size="xs"
        variant="light"
        color="stayosBrand"
      >
        Master Folio
      </Button>,
    );
  }

  if (actionTypes.includes('EXTEND_GROUP_STAY')) {
    elements.push(
      <Button
        key="action-extend-group"
        component={Link}
        href={`/reservations/group-holds/${groupBookingId}`}
        size="xs"
        variant="default"
      >
        Extend Stay
      </Button>,
    );
  }

  if (actionTypes.includes('OPEN_GROUP') || elements.length === 0) {
    elements.push(
      <Button
        key="action-open-group"
        component={Link}
        href={`/reservations/group-holds/${groupBookingId}`}
        size="xs"
        variant="default"
      >
        Open Group
      </Button>,
    );
  }

  return <Group gap={6} wrap="wrap">{elements}</Group>;
}

export function GroupReviewSection({ section }: GroupReviewSectionProps) {
  const items = section.items ?? [];
  const hasItems = items.length > 0;
  const summary = section.summary ?? {
    stayover: 0,
    dueOut: 0,
    overdue: 0,
    financialExceptions: 0,
    operationalExceptions: 0,
  };
  const blockingCount = section.blockingCount ?? 0;

  return (
    <Card
      id="section-group-review"
      data-testid="section-group-review"
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
              Group Review
            </Title>
            <Badge size="sm" variant="light" color="gray">
              {section.count} {section.count === 1 ? 'group' : 'groups'} total
            </Badge>
          </Group>

          <Group gap={10} align="center">
            <Group gap={6}>
              {summary.financialExceptions > 0 ? (
                <Badge color="red" variant="light" size="xs">
                  {summary.financialExceptions} financial {summary.financialExceptions === 1 ? 'issue' : 'issues'}
                </Badge>
              ) : null}
              {summary.operationalExceptions > 0 ? (
                <Badge color="orange" variant="light" size="xs">
                  {summary.operationalExceptions} operational {summary.operationalExceptions === 1 ? 'issue' : 'issues'}
                </Badge>
              ) : null}
            </Group>

            {blockingCount > 0 ? (
              <Badge data-testid="group-review-blocker-count" color="red" variant="filled" size="sm">
                {blockingCount} {blockingCount === 1 ? 'blocker' : 'blockers'}
              </Badge>
            ) : (
              <Badge data-testid="group-review-blocker-count" color="green" variant="light" size="sm">
                Clear
              </Badge>
            )}
          </Group>
        </Group>

        {!hasItems ? (
          <Paper
            data-testid="empty-group-review"
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
                No group issues
              </Text>
            </Group>
          </Paper>
        ) : (
          <Table.ScrollContainer minWidth={750}>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>GROUP & LEAD</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>STAY DATES</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>STATE</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>ROOMS</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>MASTER BALANCE</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>CHECKOUT</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>BLOCKING</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                    ACTIONS
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr
                    key={item.groupBookingId}
                    data-testid={`group-review-row-${item.groupBookingId}`}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <Table.Td>
                      <Stack gap={2}>
                        <Group gap={8} align="center" wrap="nowrap">
                          <Users size={15} color="#64748b" />
                          <Text size="sm" fw={600} c="#0f172a">
                            {item.groupName}
                          </Text>
                        </Group>
                        <Group gap={6} align="center">
                          <Text size="xs" c="#64748b">
                            {item.groupCode}
                          </Text>
                          <Text size="xs" c="#cbd5e1">•</Text>
                          <Text size="xs" c="#64748b">
                            Lead: {item.leadGuestName || item.leadName || 'None'}
                          </Text>
                        </Group>
                      </Stack>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={6} align="center" wrap="nowrap">
                        <Text size="xs" fw={500} c="#64748b">
                          {formatBusinessDate(item.arrivalDate)}
                        </Text>
                        <ArrowRight size={12} color="#94a3b8" />
                        <Text size="xs" fw={600} c="#0f172a">
                          {formatBusinessDate(item.departureDate)}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        color={item.reviewState === 'OVERDUE' ? 'red' : item.reviewState === 'DUE_OUT' ? 'orange' : 'gray'}
                        variant="light"
                        size="xs"
                      >
                        {item.reviewState}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm" fw={500} c="#0f172a">
                          {item.assignedRoomCount} {item.assignedRoomCount === 1 ? 'room' : 'rooms'}
                        </Text>
                        {item.roomAssignmentMissing ? (
                          <Badge color="red" variant="outline" size="xs">
                            Missing Room
                          </Badge>
                        ) : null}
                      </Stack>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text
                        data-testid={`group-master-balance-${item.groupBookingId}`}
                        size="sm"
                        fw={700}
                        c={item.balanceDue > 0 ? '#ef4444' : '#0f172a'}
                      >
                        {formatCurrency(item.balanceDue)}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      {item.checkoutEligible ? (
                        <Badge color="green" variant="light" size="xs">
                          Eligible
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light" size="xs">
                          Not Eligible
                        </Badge>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {item.blocking ? (
                        <Badge
                          data-testid={`group-blocking-badge-${item.groupBookingId}`}
                          color="red"
                          variant="filled"
                          size="sm"
                          fw={700}
                        >
                          Blocking
                        </Badge>
                      ) : (
                        <Badge
                          data-testid={`group-blocking-badge-${item.groupBookingId}`}
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
                        {renderActionButtons(item.groupBookingId, item.actions)}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Card>
  );
}
