'use client';

import { Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '@stayos/theme';
import { Card } from './card';

export type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <Card p={spacing[5]}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={spacing[1]}>
          <Text c={colors.text.muted} style={typography.styles.label}>
            {label}
          </Text>
          <Text c={colors.text.strong} style={typography.styles.h3}>
            {value}
          </Text>
          {helper ? (
            <Text c={colors.text.body} style={typography.styles.small}>
              {helper}
            </Text>
          ) : null}
        </Stack>
        {icon}
      </Group>
    </Card>
  );
}
