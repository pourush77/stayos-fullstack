'use client';

import { TextInput } from '@mantine/core';
import type { TextInputProps } from '@mantine/core';

export type InputProps = TextInputProps;

export function Input(props: InputProps) {
  return <TextInput {...props} />;
}
