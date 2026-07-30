'use client';

import Link from 'next/link';
import {
  Alert,
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
  Building2,
  ChevronRight,
  ContactRound,
  KeyRound,
  ListChecks,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { useAuth } from '../../features/auth/auth-context';

type SettingsTile = {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  permission?: string;
  disabled?: boolean;
  disabledLabel?: string;
};

function hasPermission(permissions: string[] | undefined, permission: string | undefined) {
  if (!permission) return true;
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
  cursor: 'pointer',
  transition: 'transform 160ms ease, box-shadow 160ms ease',
} as const;

const disabledCardStyle = {
  ...cardStyle,
  background: '#f8fafc',
  cursor: 'not-allowed',
  opacity: 0.7,
} as const;

function SettingsTileCard({ tile }: { tile: SettingsTile }) {
  const content = (
    <Card
      data-testid={`settings-tile-${tile.key}`}
      radius={radius.lg}
      p={20}
      style={tile.disabled ? disabledCardStyle : cardStyle}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group align="flex-start" gap={12} wrap="nowrap">
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44}>
            {tile.icon}
          </ThemeIcon>
          <Box>
            <Text c="#101828" fw={800} size="md">
              {tile.title}
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              {tile.description}
            </Text>
            {tile.disabled && tile.disabledLabel ? (
              <Text c="#94a3b8" size="xs" mt={6} fw={700}>
                {tile.disabledLabel}
              </Text>
            ) : null}
          </Box>
        </Group>
        {!tile.disabled ? <ChevronRight size={18} color="#94a3b8" /> : null}
      </Group>
    </Card>
  );

  if (tile.disabled) return content;
  return (
    <Link href={tile.href} style={{ textDecoration: 'none' }}>
      {content}
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
      description: 'Assign standard amenities to room categories.',
      icon: <ListChecks size={22} />,
      href: '/settings/room-types',
      permission: 'rooms.manage',
    },
    {
      key: 'property',
      title: 'Property',
      description: 'Property profile, address, tax details and check-in policies.',
      icon: <Building2 size={22} />,
      href: '/settings/property',
      disabled: true,
      disabledLabel: 'Coming soon',
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
    <Stack gap={spacing[3]} data-testid="settings-home">
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
          Settings
        </Title>
        <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
          Configure your StayOS workspace, staff access and integrations.
        </Text>
      </Box>

      {visibleTiles.length === 0 ? (
        <Alert color="yellow" title="Nothing here yet">
          Your role does not have access to any settings sections. Contact your administrator.
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={spacing[3]}>
          {visibleTiles.map((tile) => (
            <SettingsTileCard key={tile.key} tile={tile} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
