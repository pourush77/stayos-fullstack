'use client';

import { Calendar as MantineCalendar } from '@mantine/dates';
import type { CalendarProps as MantineCalendarProps } from '@mantine/dates';

export type CalendarProps = MantineCalendarProps;

export function Calendar(props: CalendarProps) {
  return <MantineCalendar {...props} />;
}
