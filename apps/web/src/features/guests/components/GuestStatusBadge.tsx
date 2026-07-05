'use client';

import { Badge } from '@mantine/core';
import { radius } from '@stayos/theme';
import type { GuestStatus } from '../types/guest.types';
import { statusLabel } from '../utils/guest-formatters';

export function GuestStatusBadge({ status }: { status: GuestStatus }) {
  const tone =
    status === 'BLACKLISTED'
      ? { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
      : status === 'INACTIVE'
        ? { background: '#f8fafc', border: '#e2e8f0', color: '#64748b' }
        : { background: '#f0fdf4', border: '#bbf7d0', color: '#15803d' };

  return (
    <Badge
      radius={radius.full}
      style={{
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
        height: 24,
        textTransform: 'none',
      }}
    >
      {statusLabel(status)}
    </Badge>
  );
}
