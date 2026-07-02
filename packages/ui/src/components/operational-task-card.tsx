'use client';

import Link from 'next/link';
import { Badge, Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { colors, radius, spacing, typography } from '@stayos/theme';
import type { OperationalPriority, OperationalTask } from '../operations/task-engine';
import { StayOSStatusBadge } from './visual-language';

function priorityTone(priority: OperationalPriority) {
  if (priority === 'Urgent') return 'danger';
  if (priority === 'High') return 'attention';
  if (priority === 'Normal') return 'info';
  return 'muted';
}

export function OperationalTaskCard({
  task,
  compact = false,
}: {
  task: OperationalTask;
  compact?: boolean;
}) {
  const actionButton = task.href?.startsWith('/') ? (
    <Button component={Link} href={task.href} size="xs" color="stayosBrand" variant="light">
      {task.primaryAction}
    </Button>
  ) : task.href ? (
    <Button component="a" href={task.href} size="xs" color="stayosBrand" variant="light">
      {task.primaryAction}
    </Button>
  ) : (
    <Button size="xs" color="stayosBrand" variant="light">
      {task.primaryAction}
    </Button>
  );

  return (
    <Paper
      radius={radius.md}
      p={compact ? spacing[3] : spacing[4]}
      bg={colors.surface.subtle}
      bd={`1px solid ${colors.border.subtle}`}
    >
      <Stack gap={spacing[3]}>
        <Group justify="space-between" align="flex-start" gap={spacing[3]} wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text c={colors.text.strong} style={typography.styles.label}>
              {task.title}
            </Text>
            <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
              {task.description}
            </Text>
          </Box>
          <StayOSStatusBadge tone={priorityTone(task.priority)}>
            {task.priority}
          </StayOSStatusBadge>
        </Group>

        {!compact ? (
          <Group gap={spacing[2]} wrap="wrap">
            <Badge color="gray" variant="light" radius={radius.full}>
              {task.department}
            </Badge>
            <Badge color="gray" variant="light" radius={radius.full}>
              {task.status}
            </Badge>
            {task.relatedRoom ? (
              <Badge color="gray" variant="light" radius={radius.full}>
                Room {task.relatedRoom}
              </Badge>
            ) : null}
          </Group>
        ) : null}

        <Group justify="space-between" align="center">
          <Text c={colors.text.muted} style={typography.styles.caption}>
            {task.timestamp} - {task.source}
          </Text>
          {actionButton}
        </Group>
      </Stack>
    </Paper>
  );
}
