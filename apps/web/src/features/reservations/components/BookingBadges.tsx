'use client';

import { Badge } from '@mantine/core';
import { radius } from '@stayos/theme';
import type { ReactNode } from 'react';
import type { BookingPaymentStatus, BookingStatus } from '../types/booking.types';
import { bookingStatusLabel, paymentStatusLabel } from '../utils/booking-formatters';

function badgeStyle(color: string, background: string, dot: string) {
  return {
    background,
    border: '1px solid transparent',
    color,
    fontSize: 11,
    fontWeight: 700,
    height: 24,
    paddingInline: 9,
    textTransform: 'none' as const,
    ['--booking-badge-dot' as string]: dot,
  };
}

function SoftBadge({
  children,
  style,
}: {
  children: ReactNode;
  style: ReturnType<typeof badgeStyle>;
}) {
  return (
    <Badge
      radius={radius.full}
      style={style}
      leftSection={
        <span
          aria-hidden="true"
          style={{
            background: 'var(--booking-badge-dot)',
            borderRadius: 999,
            display: 'block',
            height: 6,
            width: 6,
          }}
        />
      }
    >
      {children}
    </Badge>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const tone =
    status === 'CANCELLED'
      ? badgeStyle('#b91c1c', '#fef2f2', '#ef4444')
      : status === 'CHECKED_IN'
        ? badgeStyle('#1d4ed8', '#eff6ff', '#3b82f6')
        : status === 'PENDING'
          ? badgeStyle('#b45309', '#fffbeb', '#f59e0b')
          : status === 'CHECKED_OUT'
            ? badgeStyle('#475569', '#f8fafc', '#94a3b8')
            : badgeStyle('#15803d', '#f0fdf4', '#22c55e');

  return <SoftBadge style={tone}>{bookingStatusLabel(status)}</SoftBadge>;
}

export function PaymentStatusBadge({ status }: { status: BookingPaymentStatus }) {
  return (
    <SoftBadge
      style={
        status === 'PAID'
          ? badgeStyle('#15803d', '#f0fdf4', '#22c55e')
          : status === 'PARTIALLY_PAID'
            ? badgeStyle('#b45309', '#fffbeb', '#f59e0b')
            : badgeStyle('#b91c1c', '#fef2f2', '#ef4444')
      }
    >
      {paymentStatusLabel(status)}
    </SoftBadge>
  );
}
