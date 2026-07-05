'use client';

import { Badge } from '@mantine/core';
import { radius } from '@stayos/theme';
import type { BookingPaymentStatus, BookingStatus } from '../types/booking.types';
import { bookingStatusLabel, paymentStatusLabel } from '../utils/booking-formatters';

function badgeStyle(color: string, background: string, border = 'rgba(226, 232, 240, 0.9)') {
  return {
    background,
    border: `1px solid ${border}`,
    color,
    fontSize: 11,
    fontWeight: 700,
    height: 24,
    textTransform: 'none' as const,
  };
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const tone =
    status === 'CANCELLED'
      ? badgeStyle('#b91c1c', '#fef2f2', '#fecaca')
      : status === 'CHECKED_IN'
        ? badgeStyle('#1d4ed8', '#eff6ff', '#bfdbfe')
        : status === 'PENDING'
          ? badgeStyle('#b45309', '#fffbeb', '#fde68a')
          : status === 'CHECKED_OUT'
            ? badgeStyle('#475569', '#f8fafc')
            : badgeStyle('#15803d', '#f0fdf4', '#bbf7d0');

  return <Badge radius={radius.full} style={tone}>{bookingStatusLabel(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: BookingPaymentStatus }) {
  return (
    <Badge
      radius={radius.full}
      style={
        status === 'PAID'
          ? badgeStyle('#15803d', '#f0fdf4', '#bbf7d0')
          : badgeStyle('#b91c1c', '#fef2f2', '#fecaca')
      }
    >
      {paymentStatusLabel(status)}
    </Badge>
  );
}
