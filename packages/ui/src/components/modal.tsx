'use client';

import { Modal as MantineModal } from '@mantine/core';
import type { ModalProps as MantineModalProps } from '@mantine/core';

export type ModalProps = MantineModalProps;

export function Modal(props: ModalProps) {
  return <MantineModal centered {...props} />;
}
