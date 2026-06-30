'use client';

import { Text } from '@mantine/core';
import { colors, typography } from '@stayos/theme';

export type KPIProps = {
  label: string;
  value: string;
};

export function KPI({ label, value }: KPIProps) {
  return (
    <div>
      <Text c={colors.text.muted} style={typography.styles.caption}>
        {label}
      </Text>
      <Text c={colors.text.strong} style={typography.styles.h3}>
        {value}
      </Text>
    </div>
  );
}
