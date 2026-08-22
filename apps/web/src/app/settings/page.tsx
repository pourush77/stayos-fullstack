'use client';

import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  BadgeIndianRupee,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ContactRound,
  KeyRound,
  ListChecks,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { radius } from '@stayos/theme';
import { useAuth } from '../../features/auth/auth-context';

type SettingsTile = {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  category?: 'access' | 'config' | 'system';
  permission?: string;
  disabled?: boolean;
  disabledLabel?: string;
};

function hasPermission(permissions: string[] | undefined, permission: string | undefined) {
  if (!permission) return true;

  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function SettingsTileCard({ tile }: { tile: SettingsTile }) {
  const isEnabled = !tile.disabled;

  const cardContent = (
    <Card
      data-testid={`settings-tile-${tile.key}`}
      radius={radius.lg}
      p="lg"
      style={{
        position: 'relative',
        background: tile.disabled ? 'rgba(248, 250, 252, 0.7)' : '#ffffff',
        border: tile.disabled ? '1px dashed #cbd5e1' : '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: tile.disabled ? 'none' : '0 4px 12px rgba(15, 23, 42, 0.02)',
        cursor: isEnabled ? 'pointer' : 'not-allowed',
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
      className={isEnabled ? 'settings-tile-hover' : undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group align="flex-start" gap="md" wrap="nowrap">
          <ThemeIcon
            color={tile.disabled ? 'gray' : 'stayosBrand'}
            variant={tile.disabled ? 'subtle' : 'light'}
            radius="md"
            size={46}
            style={{
              transition: 'transform 200ms ease, background-color 200ms ease',
            }}
            className="tile-icon"
          >
            {tile.icon}
          </ThemeIcon>

          <Box style={{ flex: 1 }}>
            <Group gap="xs" align="center">
              <Text c="#101828" fw={700} size="md" style={{ lineHeight: 1.3 }}>
                {tile.title}
              </Text>
              {tile.disabled && (
                <Badge variant="light" color="gray" size="xs">
                  {tile.disabledLabel || 'Soon'}
                </Badge>
              )}
            </Group>

            <Text c="#64748b" size="sm" mt={4} style={{ lineHeight: 1.4 }}>
              {tile.description}
            </Text>
          </Box>
        </Group>

        {isEnabled && (
          <ThemeIcon
            variant="subtle"
            color="gray"
            size="sm"
            className="arrow-icon"
            style={{ transition: 'transform 200ms ease, color 200ms ease' }}
          >
            <ChevronRight size={18} color="#94a3b8" />
          </ThemeIcon>
        )}
      </Group>
    </Card>
  );

  if (tile.disabled) return cardContent;

  return (
    <Link href={tile.href} style={{ textDecoration: 'none' }}>
      {cardContent}
    </Link>
  );
}

export default function SettingsHomePage() {
  const auth = useAuth();
  const permissions = auth.user?.permissions;

  const tiles: SettingsTile[] = [
    {
      key: 'users',
      title: 'Users',
      description: 'Create login accounts, change roles, and reset passwords.',
      icon: <Users size={22} />,
      href: '/settings/users',
      permission: 'users.view',
    },
    {
      key: 'employees',
      title: 'Employees',
      description: 'Manage operational staff (housekeeping, front desk, maintenance).',
      icon: <ContactRound size={22} />,
      href: '/settings/employees',
      permission: 'employees.view',
    },
    {
      key: 'room-types',
      title: 'Room Types',
      description: 'Assign standard amenities and capacity to room categories.',
      icon: <ListChecks size={22} />,
      href: '/settings/room-types',
      permission: 'rooms.manage',
    },
    {
      key: 'rates',
      title: 'Rates & Guest Pricing',
      description: 'Configure room pricing, occupancy, and child age-based rules.',
      icon: <BadgeIndianRupee size={22} />,
      href: '/settings/rates',
      permission: 'settings.view',
    },
    {
      key: 'taxes',
      title: 'Taxes & Charges',
      description: 'Set GST rules for room charges and other hotel services.',
      icon: <ReceiptText size={22} />,
      href: '/settings/taxes',
      permission: 'settings.view',
    },
    {
      key: 'policies',
      title: 'Stay Policies',
      description: 'Set deposits, cancellation, no-show, early check-in and late checkout rules.',
      icon: <ClipboardCheck size={22} />,
      href: '/settings/policies',
      permission: 'settings.view',
    },
    {
      key: 'property',
      title: 'Property',
      description: 'Hotel profile, address, standard check-in and check-out timings.',
      icon: <Building2 size={22} />,
      href: '/settings/property',
      permission: 'settings.view',
    },
    {
      key: 'security',
      title: 'Security & Sessions',
      description: 'Active sessions, IP restrictions, audit trail.',
      icon: <ShieldCheck size={22} />,
      href: '/settings/security',
      disabled: true,
      disabledLabel: 'Coming soon',
    },
    {
      key: 'preferences',
      title: 'Preferences',
      description: 'Localization, currency, number formats, timezone.',
      icon: <Settings2 size={22} />,
      href: '/settings/preferences',
      disabled: true,
      disabledLabel: 'Coming soon',
    },
    {
      key: 'api-keys',
      title: 'API Keys',
      description: 'Manage integration tokens for channel managers and partners.',
      icon: <KeyRound size={22} />,
      href: '/settings/api-keys',
      disabled: true,
      disabledLabel: 'Coming soon',
    },
  ];

  const visibleTiles = tiles.filter((tile) => hasPermission(permissions, tile.permission));

  return (
    <>
      {/* Micro Interactive Hover CSS */}
      <style jsx global>{`
        .settings-tile-hover:hover {
          transform: translateY(-3px);
          border-color: var(--mantine-color-stayosBrand-light-hover) !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08) !important;
        }

        .settings-tile-hover:hover .tile-icon {
          transform: scale(1.05);
          background-color: var(--mantine-color-stayosBrand-light);
        }

        .settings-tile-hover:hover .arrow-icon {
          transform: translateX(4px);
          color: var(--mantine-color-stayosBrand-filled);
        }
      `}</style>

      <Stack gap="lg" data-testid="settings-home" style={{ maxWidth: 1280 }}>
        <Box>
          <Group gap="xs" align="center">
            <Title order={1} c="#101828" style={{ fontSize: 28, fontWeight: 800 }}>
              Settings
            </Title>
          </Group>

          <Text c="#64748b" mt={4} size="sm">
            Configure how your property works, manage staff access levels, and set operational rules
            for StayOS.
          </Text>
        </Box>

        {visibleTiles.length === 0 ? (
          <Alert color="yellow" title="Access Restricted" radius="md">
            Your current user role does not have permission to view settings. Contact your system
            administrator.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {visibleTiles.map((tile) => (
              <SettingsTileCard key={tile.key} tile={tile} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </>
  );
}
