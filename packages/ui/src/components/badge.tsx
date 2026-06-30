'use client';

import { Badge as MantineBadge } from '@mantine/core';
import type { BadgeProps as MantineBadgeProps } from '@mantine/core';

export type BadgeProps = MantineBadgeProps;

export function Badge(props: BadgeProps) {
  return <MantineBadge variant="light" {...props} />;
}
