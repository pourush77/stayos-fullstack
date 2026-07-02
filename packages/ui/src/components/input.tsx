'use client';

import { TextInput } from '@mantine/core';
import type { TextInputProps } from '@mantine/core';
import { forwardRef } from 'react';

export type InputProps = TextInputProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <TextInput ref={ref} {...props} />;
});

Input.displayName = 'Input';
