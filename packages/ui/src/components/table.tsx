'use client';

import { Table as MantineTable } from '@mantine/core';
import type { TableProps as MantineTableProps } from '@mantine/core';

export type TableProps = MantineTableProps;

export function Table(props: TableProps) {
  return <MantineTable striped highlightOnHover withTableBorder {...props} />;
}
