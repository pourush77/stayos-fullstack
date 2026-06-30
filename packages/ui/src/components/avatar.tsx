'use client';

import { Avatar as MantineAvatar } from '@mantine/core';
import type { AvatarProps as MantineAvatarProps } from '@mantine/core';

export type AvatarProps = MantineAvatarProps;

export function Avatar(props: AvatarProps) {
  return <MantineAvatar radius="xl" {...props} />;
}
