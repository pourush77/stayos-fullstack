'use client';

import { Button as MantineButton } from '@mantine/core';
import type { ButtonProps as MantineButtonProps } from '@mantine/core';
import { typography } from '@stayos/theme';

export type ButtonProps = MantineButtonProps;

export function Button(props: ButtonProps) {
  return <MantineButton fw={typography.styles.button.fontWeight} {...props} />;
}
