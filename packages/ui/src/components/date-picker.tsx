'use client';

import { DatePickerInput } from '@mantine/dates';
import type { DatePickerInputProps } from '@mantine/dates';

export type DatePickerProps = DatePickerInputProps;

export function DatePicker(props: DatePickerProps) {
  return <DatePickerInput {...props} />;
}
