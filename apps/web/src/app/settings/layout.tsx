'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Alert, Stack } from '@mantine/core';
import { useAuth } from '../../features/auth/auth-context';

const ALLOWED_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const role = String(auth.user?.role ?? '').toUpperCase();
  const isAllowed = ALLOWED_ROLES.has(role);

  useEffect(() => {
    if (!auth.isBootstrapping && auth.user && !isAllowed) {
      router.replace('/front-desk');
    }
  }, [auth.isBootstrapping, auth.user, isAllowed, router]);

  if (!auth.user) return <>{children}</>;
  if (!isAllowed) {
    return (
      <Stack gap="md" data-testid="settings-access-denied">
        <Alert color="red" title="Access denied">
          You do not have permission to view Settings. Redirecting...
        </Alert>
      </Stack>
    );
  }
  return <>{children}</>;
}
