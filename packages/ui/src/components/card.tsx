'use client';

import { Card as MantineCard } from '@mantine/core';
import type { CardProps as MantineCardProps } from '@mantine/core';
import { colors } from '@stayos/theme';

export type CardProps = MantineCardProps;

export function Card(props: CardProps) {
  return (
    <MantineCard
      bg={colors.surface.base}
      bd={`1px solid ${colors.border.subtle}`}
      shadow="none"
      {...props}
    />
  );
}
