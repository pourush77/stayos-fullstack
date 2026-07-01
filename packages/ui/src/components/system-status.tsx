'use client';

import { Button, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { AlertCircle, BedDouble, RefreshCw, Server, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';

type SystemStateProps = {
  actionLabel?: string;
  checkLabel?: string;
  detail?: string;
  onAction?: () => void;
  onCheckStatus?: () => void;
  title?: string;
};

function SystemStateCard({
  actionLabel,
  checkLabel = 'Check Server Status',
  detail,
  icon,
  onAction,
  onCheckStatus,
  title,
}: SystemStateProps & { icon: ReactNode }) {
  return (
    <Card p={spacing[8]} radius={radius.lg} shadow="xs" style={{ border: 'none', textAlign: 'center' }}>
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={52} mx="auto">
        {icon}
      </ThemeIcon>
      <Title order={2} c={colors.text.strong} mt={spacing[4]} style={typography.styles.h2}>
        {title}
      </Title>
      <Text c={colors.text.body} mt={spacing[2]} maw={560} mx="auto" style={typography.styles.body}>
        {detail}
      </Text>
      {(onAction || onCheckStatus) ? (
        <Group justify="center" mt={spacing[5]} gap={spacing[3]}>
          {onAction ? (
            <Button color="stayosBrand" leftSection={<RefreshCw size={16} />} onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {onCheckStatus ? (
            <Button color="gray" leftSection={<Server size={16} />} onClick={onCheckStatus} variant="light">
              {checkLabel}
            </Button>
          ) : null}
        </Group>
      ) : null}
    </Card>
  );
}

export function BackendUnavailable({
  actionLabel = 'Retry',
  detail = 'StayOS cannot reach the hotel server right now. Live room, guest, and reservation information will return automatically when the connection is back.',
  onAction,
  onCheckStatus,
  title = 'Hotel server is unavailable',
}: SystemStateProps) {
  return (
    <SystemStateCard
      actionLabel={actionLabel}
      detail={detail}
      icon={<WifiOff size={24} />}
      onAction={onAction}
      onCheckStatus={onCheckStatus}
      title={title}
    />
  );
}

export function ServerStarting({
  actionLabel = 'Retry',
  detail = 'The StayOS server is getting ready. This usually clears in a moment, and the page will reconnect automatically.',
  onAction,
  onCheckStatus,
  title = 'Server is starting',
}: SystemStateProps) {
  return (
    <SystemStateCard
      actionLabel={actionLabel}
      detail={detail}
      icon={<Server size={24} />}
      onAction={onAction}
      onCheckStatus={onCheckStatus}
      title={title}
    />
  );
}

export function EmptyData({
  detail = 'There is no live data to show yet. Once the hotel team adds records, they will appear here.',
  title = 'No records yet',
}: SystemStateProps) {
  return <SystemStateCard detail={detail} icon={<BedDouble size={24} />} title={title} />;
}

export function GenericError({
  actionLabel = 'Try Again',
  detail = 'Something interrupted this view. Please try again, or check server status if the issue continues.',
  onAction,
  onCheckStatus,
  title = 'We could not load this view',
}: SystemStateProps) {
  return (
    <SystemStateCard
      actionLabel={actionLabel}
      detail={detail}
      icon={<AlertCircle size={24} />}
      onAction={onAction}
      onCheckStatus={onCheckStatus}
      title={title}
    />
  );
}

export function InlineSystemNote({ children }: { children: ReactNode }) {
  return (
    <Stack gap={spacing[1]}>
      <Text c={colors.text.body} style={typography.styles.small}>
        {children}
      </Text>
    </Stack>
  );
}
