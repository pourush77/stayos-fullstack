'use client';

import { notifications } from '@mantine/notifications';
import type { NotificationData } from '@mantine/notifications';

export type ToastOptions = NotificationData;

export function showToast(options: ToastOptions) {
  notifications.show(options);
}
