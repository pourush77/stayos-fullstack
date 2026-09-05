'use client';

import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import { radius } from '@stayos/theme';
import type { NightAuditValidationBlockersDto } from '../types/night-audit.types';

export interface NightAuditSummaryProps {
  blockers: NightAuditValidationBlockersDto;
  onSelectSection?: (sectionKey: 'pending-arrivals' | 'stay-review' | 'folio-exceptions' | 'group-review') => void;
}

interface SummaryCardItem {
  id: 'pending-arrivals' | 'stay-review' | 'folio-exceptions' | 'group-review';
  label: string;
  blockerCount: number;
}

export function NightAuditSummary({ blockers, onSelectSection }: NightAuditSummaryProps) {
  const cards: SummaryCardItem[] = [
    {
      id: 'pending-arrivals',
      label: 'Pending Arrivals',
      blockerCount: blockers.pendingArrivals ?? 0,
    },
    {
      id: 'stay-review',
      label: 'Due-Out / Overdue',
      blockerCount: blockers.stayReview ?? 0,
    },
    {
      id: 'folio-exceptions',
      label: 'Folio Exceptions',
      blockerCount: blockers.folioExceptions ?? 0,
    },
    {
      id: 'group-review',
      label: 'Groups',
      blockerCount: blockers.groupReview ?? 0,
    },
  ];

  return (
    <SimpleGrid
      data-testid="night-audit-top-summary"
      cols={{ base: 1, sm: 2, lg: 4 }}
      spacing={14}
    >
      {cards.map((card) => {
        const hasBlockers = card.blockerCount > 0;

        return (
          <UnstyledButton
            key={card.id}
            data-testid={`summary-card-${card.id}`}
            onClick={() => onSelectSection?.(card.id)}
            style={{ width: '100%', outline: 'none' }}
          >
            <Paper
              p={14}
              radius={radius.md}
              style={{
                backgroundColor: '#ffffff',
                border: hasBlockers ? '1px solid #fecaca' : '1px solid #e2e8f0',
                borderLeft: hasBlockers ? '4px solid #ef4444' : '4px solid #16a34a',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Stack gap={3}>
                  <Text size="xs" fw={700} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
                    {card.label}
                  </Text>
                  <Group gap={6} align="center" mt={2}>
                    {hasBlockers ? (
                      <Badge
                        data-testid={`summary-blocker-badge-${card.id}`}
                        color="red"
                        variant="filled"
                        size="sm"
                        fw={700}
                      >
                        {card.blockerCount} {card.blockerCount === 1 ? 'blocker' : 'blockers'}
                      </Badge>
                    ) : (
                      <Badge
                        data-testid={`summary-blocker-badge-${card.id}`}
                        color="green"
                        variant="light"
                        size="sm"
                        fw={700}
                      >
                        Clear
                      </Badge>
                    )}
                  </Group>
                </Stack>

                <ChevronDown size={16} color="#94a3b8" />
              </Group>
            </Paper>
          </UnstyledButton>
        );
      })}
    </SimpleGrid>
  );
}
