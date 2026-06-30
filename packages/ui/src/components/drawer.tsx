'use client';

import { Drawer as MantineDrawer } from '@mantine/core';
import type { DrawerProps as MantineDrawerProps } from '@mantine/core';

export type DrawerProps = MantineDrawerProps;

export function Drawer(props: DrawerProps) {
  return <MantineDrawer position="left" {...props} />;
}
