'use client';

import { Box } from '@mantine/core';
import type { BoxProps } from '@mantine/core';
import { spacing } from '@stayos/theme';
import type { ReactNode } from 'react';

export type ShellContentProps = BoxProps & {
  children?: ReactNode;
};

export function ShellContent(props: ShellContentProps) {
  return (
    <Box
      mx="auto"
      h="100%"
      w="100%"
      maw={1440}
      px={{ base: spacing[4], sm: spacing[5], md: spacing[5] }}
      py={{ base: spacing[4], md: spacing[5] }}
      pb={{ base: 88, md: spacing[5] }}
      {...props}
    />
  );
}
