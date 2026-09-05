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
import { CheckCircle2, DoorClosed, Receipt, User } from 'lucide-react';
import { radius } from '@stayos/theme';
import { formatCurrency } from '../api/night-audit-api';
import type {
  NightAuditActionDto,
  NightAuditFolioExceptionItemDto,
  NightAuditFolioExceptionsSectionDto,
  NightAuditFolioExceptionType,
} from '../types/night-audit.types';

export interface FolioExceptionsSectionProps {
  section: NightAuditFolioExceptionsSectionDto;
}

function renderExceptionTypeBadge(type: NightAuditFolioExceptionType) {
  switch (type) {
    case 'OUTSTANDING_BALANCE':
      return (
        <Badge data-testid="exception-type-badge" color="red" variant="light" size="sm" fw={700}>
          Outstanding Balance
        </Badge>
      );
    case 'UNSETTLED_ZERO_BALANCE':
      return (
        <Badge data-testid="exception-type-badge" color="yellow" variant="light" size="sm" fw={700}>
          Unsettled (₹0 Balance)
        </Badge>
      );
    case 'MISSING_FOLIO':
      return (
        <Badge data-testid="exception-type-badge" color="red" variant="filled" size="sm" fw={800}>
          Missing Folio
        </Badge>
      );
    default:
      return (
        <Badge data-testid="exception-type-badge" color="gray" variant="light" size="sm">
          {type}
        </Badge>
      );
  }
}

function renderActionButtons(
  reservationId: string,
  folioId: string | null,
  actions: NightAuditActionDto[],
) {
  const actionTypes = (actions ?? []).map((a) => a.type);
  const elements = [];
  const folioTarget = folioId ? `/billing/${folioId}` : '/billing';

  if (actionTypes.includes('SETTLE_FOLIO')) {
    elements.push(
      <Button
        key="action-settle"
        component={Link}
        href={folioTarget}
        size="xs"
        variant="filled"
        color="stayosBrand"
      >
        Settle Folio
      </Button>,
    );
  }

  if (actionTypes.includes('RECORD_PAYMENT')) {
    elements.push(
      <Button
        key="action-payment"
        component={Link}
        href={folioTarget}
        size="xs"
        variant="light"
        color="stayosBrand"
      >
        Record Payment
      </Button>,
    );
  }

  if (actionTypes.includes('OPEN_FOLIO')) {
    elements.push(
      <Button
        key="action-open-folio"
        component={Link}
        href={folioTarget}
        size="xs"
        variant="default"
      >
        Open Folio
      </Button>,
    );
  }

  if (actionTypes.includes('OPEN_STAY')) {
    elements.push(
      <Button
        key="action-open-stay"
        component={Link}
        href={`/guest-stay/${reservationId}`}
        size="xs"
        variant="default"
      >
        Open Stay
      </Button>,
    );
  }

  if (elements.length === 0) {
    elements.push(
      <Button
        key="action-fallback"
        component={Link}
        href={folioTarget}
        size="xs"
        variant="default"
      >
        View Folio
      </Button>,
    );
  }

  return <Group gap={6} wrap="wrap">{elements}</Group>;
}

export function FolioExceptionsSection({ section }: FolioExceptionsSectionProps) {
  const items = section.items ?? [];
  const hasItems = items.length > 0;
  const summary = section.summary ?? {
    outstandingBalance: 0,
    unsettledZeroBalance: 0,
    missingFolio: 0,
  };
  const blockingCount = section.blockingCount ?? 0;

  return (
    <Card
      id="section-folio-exceptions"
      data-testid="section-folio-exceptions"
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
              Folio Exceptions
            </Title>
            <Badge size="sm" variant="light" color="gray">
              {section.count} {section.count === 1 ? 'folio' : 'folios'} total
            </Badge>
          </Group>

          <Group gap={10} align="center">
            <Group gap={6}>
              {summary.outstandingBalance > 0 ? (
                <Badge color="red" variant="light" size="xs">
                  {summary.outstandingBalance} balance due
                </Badge>
              ) : null}
              {summary.unsettledZeroBalance > 0 ? (
                <Badge color="yellow" variant="light" size="xs">
                  {summary.unsettledZeroBalance} unsettled ₹0
                </Badge>
              ) : null}
              {summary.missingFolio > 0 ? (
                <Badge color="red" variant="filled" size="xs">
                  {summary.missingFolio} missing folio
                </Badge>
              ) : null}
            </Group>

            {blockingCount > 0 ? (
              <Badge data-testid="folio-exceptions-blocker-count" color="red" variant="filled" size="sm">
                {blockingCount} {blockingCount === 1 ? 'blocker' : 'blockers'}
              </Badge>
            ) : (
              <Badge data-testid="folio-exceptions-blocker-count" color="green" variant="light" size="sm">
                Clear
              </Badge>
            )}
          </Group>
        </Group>

        {!hasItems ? (
          <Paper
            data-testid="empty-folio-exceptions"
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
                No folio exceptions
              </Text>
            </Group>
          </Paper>
        ) : (
          <Table.ScrollContainer minWidth={750}>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>GUEST & ROOM</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>STAY STATE</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>EXCEPTION TYPE</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>CHARGES</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>PAID</Table.Th>
                  <Table.Th style={{ color: '#475569', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>BALANCE DUE</Table.Th>
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
                    key={`${item.reservationId}-${item.folioId || 'missing'}`}
                    data-testid={`folio-exception-row-${item.reservationId}`}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <Table.Td>
                      <Stack gap={2}>
                        <Group gap={8} align="center" wrap="nowrap">
                          <User size={15} color="#64748b" />
                          <Text size="sm" fw={600} c="#0f172a">
                            {item.guestName || 'Unnamed Guest'}
                          </Text>
                        </Group>
                        <Group gap={6} align="center">
                          <Text size="xs" c="#64748b">
                            {item.roomNumber ? `Room ${item.roomNumber}` : 'No Room'}
                          </Text>
                          <Text size="xs" c="#cbd5e1">•</Text>
                          <Text size="xs" c="#64748b">
                            {item.reservationCode || item.confirmationNumber}
                          </Text>
                        </Group>
                      </Stack>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        color={item.stayReviewState === 'OVERDUE' ? 'red' : item.stayReviewState === 'DUE_OUT' ? 'orange' : 'gray'}
                        variant="light"
                        size="xs"
                      >
                        {item.stayReviewState}
                      </Badge>
                    </Table.Td>

                    <Table.Td>{renderExceptionTypeBadge(item.exceptionType)}</Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500} c="#0f172a">
                        {formatCurrency(item.totalCharges)}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500} c="#16a34a">
                        {formatCurrency(item.totalPayments)}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text
                        data-testid={`folio-balance-due-${item.reservationId}`}
                        size="sm"
                        fw={700}
                        c={item.balanceDue && parseFloat(item.balanceDue) > 0 ? '#ef4444' : '#0f172a'}
                      >
                        {formatCurrency(item.balanceDue)}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Badge color="gray" variant="light" size="xs">
                        {item.folioStatus || 'NO FOLIO'}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      {item.blocking ? (
                        <Badge
                          data-testid={`folio-blocking-badge-${item.reservationId}`}
                          color="red"
                          variant="filled"
                          size="sm"
                          fw={700}
                        >
                          Blocking
                        </Badge>
                      ) : (
                        <Badge
                          data-testid={`folio-blocking-badge-${item.reservationId}`}
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
                        {renderActionButtons(item.reservationId, item.folioId, item.actions)}
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
