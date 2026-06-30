'use client';

import { Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { colors, spacing, typography } from '@stayos/theme';

export type EmptyStateProps = {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
};

export function EmptyState({ icon, eyebrow, title, description }: EmptyStateProps) {
  return (
    <Stack align="center" gap={spacing[3]} py={spacing[16]} ta="center">
      <ThemeIcon c={colors.brand[500]} bg={colors.brand[50]} size={48} radius="xl">
        {icon ?? <Building2 size={22} />}
      </ThemeIcon>
      {eyebrow ? (
        <Text c={colors.text.muted} tt="uppercase" style={typography.styles.caption}>
          {eyebrow}
        </Text>
      ) : null}
      <Title c={colors.text.strong} order={1} style={typography.styles.h2}>
        {title}
      </Title>
      {description ? (
        <Text c={colors.text.body} maw={520} style={typography.styles.body}>
          {description}
        </Text>
      ) : null}
    </Stack>
  );
}
