'use client';

import { Search } from 'lucide-react';
import { Input } from './input';
import type { InputProps } from './input';

export type SearchInputProps = InputProps;

export function SearchInput(props: SearchInputProps) {
  return <Input leftSection={<Search size={16} />} placeholder="Search" {...props} />;
}
