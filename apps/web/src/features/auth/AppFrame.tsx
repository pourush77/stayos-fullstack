'use client';

import { Modal, PasswordInput, Stack, Text, Button, Box, Title } from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { StayOSAppShell, type ShellUser } from '@stayos/ui';
import { primaryNavigation } from '@stayos/ui';
import { useAuth } from './auth-context';

const roleLabels: Record<string, string> = {
  ACCOUNTS: 'Accounts',
  ADMIN: 'Admin',
  FRONT_DESK: 'Front Desk',
  HOUSEKEEPING: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
  MANAGER: 'Operations Manager',
  OWNER: 'StayOS Admin',
  READ_ONLY: 'Read Only',
};

const roleNavigation: Record<string, string[]> = {
  ACCOUNTS: ['/rooms', '/billing', '/reports'],
  ADMIN: ['*'],
  FRONT_DESK: ['/', '/reservations', '/rooms', '/guests', '/housekeeping'],
  HOUSEKEEPING: ['/housekeeping'],
  MAINTENANCE: ['/rooms', '/housekeeping'],
  MANAGER: ['/', '/reservations', '/rooms', '/guests', '/housekeeping', '/reports', '/settings/employees'],
  OWNER: ['*'],
  READ_ONLY: ['/', '/rooms'],
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function navigationForRole(role: string, permissions: string[] | undefined) {
  const allowed = roleNavigation[role] ?? roleNavigation.FRONT_DESK;
  const base = allowed.includes('*')
    ? primaryNavigation
    : primaryNavigation.filter((item) => allowed.includes(item.href));
  return base.filter((item) => {
    if (item.href === '/settings/employees') return hasPermission(permissions, 'employees.view');
    return true;
  });
}

function BrandedLoader() {
  return (
    <Box
      style={{
        alignItems: 'center',
        background: '#fbfcff',
        display: 'flex',
        minHeight: '100vh',
        justifyContent: 'center',
      }}
    >
      <Stack align="center" gap={14}>
        <Box
          aria-hidden
          style={{
            alignItems: 'center',
            background: 'linear-gradient(135deg, #6d5dfc 0%, #4f46e5 100%)',
            borderRadius: 14,
            boxShadow: '0 18px 40px rgba(79, 70, 229, 0.22)',
            display: 'flex',
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}
        >
          <Box
            aria-hidden
            style={{
              border: '2px solid rgba(255, 255, 255, 0.9)',
              borderRadius: 999,
              height: 18,
              width: 18,
            }}
          />
        </Box>
        <Title order={1} style={{ color: '#101828', fontSize: 24, lineHeight: '30px' }}>
          StayOS
        </Title>
        <Text c="#667085" size="sm">
          Checking session...
        </Text>
      </Stack>
    </Box>
  );
}

function UnlockDialog() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal opened={auth.isLocked} onClose={() => undefined} centered withCloseButton={false} title="Session Locked">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!password) {
            setError('Password is required.');
            return;
          }
          setSubmitting(true);
          setError(undefined);
          try {
            await auth.unlock(password);
            setPassword('');
          } catch (unlockError) {
            setError(unlockError instanceof Error ? unlockError.message : 'Unable to unlock session.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Stack gap="md">
          <Text c="#667085" size="sm">
            Your session has been locked due to inactivity.
          </Text>
          <PasswordInput
            autoFocus
            error={error}
            label="Password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            placeholder="Enter your password"
            value={password}
          />
          <Button type="submit" loading={submitting}>
            Unlock Session
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/housekeeping/staff/') ||
    pathname.startsWith('/check-in-capture/');
  const role = String(auth.user?.role ?? 'FRONT_DESK').toUpperCase();
  const shellUser: ShellUser | undefined = auth.user
    ? {
        email: auth.user.email,
        initials: initials(auth.user.name),
        name: auth.user.name,
        propertyId: auth.user.propertyId,
        propertyName: auth.user.propertyName,
        roleLabel: roleLabels[role] ?? role,
      }
    : undefined;

  useEffect(() => {
    if (auth.isBootstrapping || isPublicRoute || role !== 'HOUSEKEEPING') return;
    if (pathname === '/rooms' || pathname.startsWith('/rooms/')) router.replace('/housekeeping');
  }, [auth.isBootstrapping, isPublicRoute, pathname, role, router]);

  useEffect(() => {
    if (auth.isBootstrapping || isPublicRoute || auth.isAuthenticated) return;
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [auth.isAuthenticated, auth.isBootstrapping, isPublicRoute, pathname, router]);

  if (auth.isBootstrapping && !isPublicRoute) return <BrandedLoader />;
  if (!isPublicRoute && !auth.isAuthenticated) return <BrandedLoader />;

  return (
    <>
      <StayOSAppShell
        isPublicRoute={isPublicRoute}
        navigationItems={navigationForRole(role, auth.user?.permissions)}
        onLockSession={auth.lockSession}
        onSignOut={auth.logout}
        propertyId={auth.user?.propertyId}
        propertyName={auth.user?.propertyName}
        user={shellUser}
      >
        {children}
      </StayOSAppShell>
      <UnlockDialog />
    </>
  );
}
