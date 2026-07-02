'use client';

import Link from 'next/link';
import { Badge, Box, Card, Group, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';
import { brandPalettes, colors, radius, shadows, spacing, typography } from '@stayos/theme';

export type StayOSStatusTone =
  | 'success'
  | 'info'
  | 'attention'
  | 'progress'
  | 'danger'
  | 'premium'
  | 'muted';

const statusTokens: Record<StayOSStatusTone, { color: string; background: string }> = {
  success: { color: colors.semantic.success, background: colors.brand[50] },
  info: { color: colors.semantic.info, background: brandPalettes.blue[50] },
  attention: { color: colors.semantic.warning, background: brandPalettes.gold[50] },
  progress: { color: brandPalettes.gold[700], background: brandPalettes.gold[50] },
  danger: {
    color: colors.semantic.danger,
    background: `color-mix(in srgb, ${colors.semantic.danger} 9%, ${colors.surface.base})`,
  },
  premium: { color: brandPalettes.purple[600], background: brandPalettes.purple[50] },
  muted: { color: colors.text.muted, background: colors.surface.subtle },
};

export function getStatusTokens(tone: StayOSStatusTone) {
  return statusTokens[tone];
}

export function toneForStatus(status: string): StayOSStatusTone {
  const normalized = status.toLowerCase();

  if (
    normalized.includes('payment due') ||
    normalized.includes('pending payment') ||
    normalized.includes('pending bill') ||
    normalized.includes('cash to collect') ||
    normalized.includes('collect') ||
    normalized.includes('amount due') ||
    normalized.includes('outstanding') ||
    normalized.includes('balance due')
  ) {
    return 'danger';
  }

  if (
    normalized.includes('ready') ||
    normalized.includes('completed') ||
    normalized.includes('paid') ||
    normalized.includes('available') ||
    normalized.includes('verified') ||
    normalized.includes('confirmed')
  ) {
    return 'success';
  }

  if (
    normalized.includes('occupied') ||
    normalized.includes('current') ||
    normalized.includes('reservation') ||
    normalized.includes('accepted')
  ) {
    return 'info';
  }

  if (
    normalized.includes('attention') ||
    normalized.includes('pending') ||
    normalized.includes('arrival') ||
    normalized.includes('waiting') ||
    normalized.includes('inspection') ||
    normalized.includes('due')
  ) {
    return 'attention';
  }

  if (
    normalized.includes('progress') ||
    normalized.includes('cleaning') ||
    normalized.includes('check-in') ||
    normalized.includes('maintenance working')
  ) {
    return 'progress';
  }

  if (
    normalized.includes('urgent') ||
    normalized.includes('out of order') ||
    normalized.includes('complaint') ||
    normalized.includes('blocked') ||
    normalized.includes('delayed') ||
    normalized.includes('maintenance')
  ) {
    return 'danger';
  }

  if (
    normalized.includes('vip') ||
    normalized.includes('corporate') ||
    normalized.includes('premium') ||
    normalized.includes('important')
  ) {
    return 'premium';
  }

  if (
    normalized.includes('historical') ||
    normalized.includes('inactive') ||
    normalized.includes('cancelled') ||
    normalized.includes('checked out') ||
    normalized.includes('checked-out')
  ) {
    return 'muted';
  }

  return 'muted';
}

export function StayOSStatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: StayOSStatusTone;
}) {
  const label = typeof children === 'string' ? children : '';
  const tokens = getStatusTokens(tone ?? toneForStatus(label));

  return (
    <Badge
      radius={radius.full}
      variant="light"
      styles={{
        root: {
          background: tokens.background,
          color: tokens.color,
          fontWeight: typography.weights.semibold,
          minHeight: 24,
          textTransform: 'none',
        },
      }}
    >
      {children}
    </Badge>
  );
}

export function StayOSOperationsCard({
  title,
  value,
  detail,
  icon,
  tone = 'muted',
  href,
}: {
  title: string;
  value: ReactNode;
  detail?: string;
  icon: ReactNode;
  tone?: StayOSStatusTone;
  href?: string;
}) {
  const tokens = getStatusTokens(tone);
  const cardProps = {
    p: spacing[4],
    radius: radius.lg,
    shadow: 'xs',
    style: {
      background: tokens.background,
      border: 'none',
      borderTop: `4px solid ${tokens.color}`,
      boxShadow: shadows.xs,
      color: 'inherit',
      cursor: href ? 'pointer' : 'default',
      minHeight: 124,
      textDecoration: 'none',
      transition: 'transform 160ms ease, box-shadow 160ms ease',
    },
  };
  const content = (
    <>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text c={colors.text.body} style={typography.styles.label}>
            {title}
          </Text>
          <Text c={tokens.color} mt={spacing[3]} style={typography.styles.h1}>
            {value}
          </Text>
        </Box>
        <ThemeIcon color="stayosBrand" variant="light" radius={radius.md}>
          {icon}
        </ThemeIcon>
      </Group>
      {detail ? (
        <Text c={colors.text.muted} mt={spacing[2]} style={typography.styles.caption}>
          {detail}
        </Text>
      ) : null}
    </>
  );

  if (href?.startsWith('/')) {
    return (
      <Card component={Link} href={href} {...cardProps}>
        {content}
      </Card>
    );
  }

  if (href) {
    return (
      <Card component="a" href={href} {...cardProps}>
        {content}
      </Card>
    );
  }

  return (
    <Card {...cardProps}>
      {content}
    </Card>
  );
}
