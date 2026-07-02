'use client';

import { Search } from 'lucide-react';
import { forwardRef } from 'react';
import { Input } from './input';
import type { InputProps } from './input';

export type SearchInputProps = InputProps;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(props, ref) {
    return <Input ref={ref} leftSection={<Search size={16} />} placeholder="Search" {...props} />;
  },
);

SearchInput.displayName = 'SearchInput';
