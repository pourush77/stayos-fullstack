'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Burger,
  Button,
  Divider,
  Drawer,
  Group,
  Menu,
  Paper,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BedDouble,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  KeyRound,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { animations, colors, radius, shadows, spacing, typography, zIndex } from '@stayos/theme';
import { OperationalTaskCard } from '../components/operational-task-card';
import { getTasksForPath } from '../operations/task-engine';
import { SearchInput } from '../components/search-input';
import { mobileNavigation, primaryNavigation } from './navigation';
import { ShellContent } from './shell-content';

type StayOSAppShellProps = {
  children: ReactNode;
  isPublicRoute?: boolean;
  navigationItems?: typeof primaryNavigation;
  onLockSession?: () => void;
  onSignOut?: () => void;
  propertyName?: string;
  user?: ShellUser;
};

export type ShellUser = {
  email: string;
  initials?: string;
  name: string;
  propertyName?: string;
  roleLabel: string;
};

type PropertyStatus = {
  label: 'Ready' | 'Cleaning' | 'Dirty' | 'Out of Order' | 'Occupied';
  value: string;
  tone: string;
};

type LiveOperation = {
  action: string;
  detail: string;
  time: string;
  title: string;
};

type NextEvent = {
  action: string;
  detail: string;
  href: string;
  time: string;
  title: string;
  tone: string;
};

type FrontDeskUtilityState = {
  error?: string;
  isLoading: boolean;
  liveOperations: LiveOperation[];
  nextEvent?: NextEvent;
  propertyStatus: PropertyStatus[];
  roomTotal: number;
};

const fallbackPropertyName = 'The Oberoi Grand';
const fallbackUser: ShellUser = {
  email: 'frontdesk@stayos.local',
  initials: 'FD',
  name: 'Front Desk',
  roleLabel: 'Front Desk',
};

type ActiveProperty = {
  city?: string;
  name: string;
  roomCount?: number;
};
const commandSuggestions = [
  { label: 'Check in Rahul Sharma', href: '/check-in' },
  { label: 'Assign Room 305', href: '/rooms/305' },
  { label: 'Collect Rs 8,400', href: '/requests' },
  { label: 'Booking ST2145', href: '/reservations' },
];

const emptyPropertyStatus: PropertyStatus[] = [
  { label: 'Ready', value: '0', tone: '#12b76a' },
  { label: 'Cleaning', value: '0', tone: '#f79009' },
  { label: 'Dirty', value: '0', tone: '#f97316' },
  { label: 'Out of Order', value: '0', tone: '#ef4444' },
  { label: 'Occupied', value: '0', tone: '#2563eb' },
];

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

function apiBaseUrl() {
  const env = (globalThis as unknown as { process?: { env?: { NEXT_PUBLIC_API_URL?: string } } })
    .process?.env;
  return env?.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';
}

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }

  return response as T;
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  const payload = (await response.json().catch(() => undefined)) as
    ApiResponse<T> | { message?: unknown } | undefined;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Front Desk utility request failed: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return unwrapResponse<T>(payload as ApiResponse<T>);
}

function stringValue(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function booleanValue(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return false;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1', 'vip'].includes(value.toLowerCase());
  }
  return false;
}

function recordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function recordId(record: Record<string, unknown> | undefined) {
  return stringValue(record, ['id', '_id', 'uuid']);
}

function normalizedStatus(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, '_');
}

function normalizedDate(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
      parsed.getDate(),
    ).padStart(2, '0')}`;
  }
  return value.slice(0, 10);
}

function displayDate(value: string) {
  if (!value) return 'Today';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function activePropertyId(properties: Record<string, unknown>[]) {
  const active = properties.find(
    (property) => stringValue(property, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE',
  );
  return recordId(active);
}

function isReadyRoom(status: string) {
  return ['READY', 'AVAILABLE', 'CLEAN', 'VACANT_READY', 'ACTIVE'].includes(status);
}

function isCleaningRoom(status: string) {
  return ['CLEANING', 'INSPECTION', 'PENDING_INSPECTION'].includes(status);
}

function isDirtyRoom(status: string) {
  return ['DIRTY', 'NEEDS_CLEANING', 'CHECKOUT_DIRTY', 'WAITING_GUEST'].includes(status);
}

function isOutOfOrderRoom(status: string) {
  return ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED', 'REPAIR'].includes(status);
}

function isOccupiedRoom(status: string) {
  return ['OCCUPIED', 'IN_HOUSE', 'GUEST_STAYING'].includes(status);
}

function roomStatusFromRecord(room: Record<string, unknown>) {
  return normalizedStatus(
    stringValue(room, ['operationalStatus', 'operational_status', 'status'], 'READY'),
  );
}

function roomNumberFromRecord(room: Record<string, unknown>) {
  return stringValue(room, ['roomNumber', 'number', 'displayName'], 'Room');
}

function guestNameFromReservation(reservation: Record<string, unknown>) {
  const guest = recordValue(reservation, ['guest', 'guestProfile']);
  return (
    stringValue(guest, ['name', 'fullName', 'displayName', 'guestName']) ||
    [stringValue(guest, ['firstName']), stringValue(guest, ['lastName'])]
      .filter(Boolean)
      .join(' ') ||
    stringValue(reservation, ['guestName', 'name'], 'Guest')
  );
}

function reservationCode(record: Record<string, unknown>) {
  return stringValue(record, ['reservationCode', 'code', 'bookingCode', 'id', '_id'], 'Booking');
}

function getPropertyName(record: unknown) {
  if (!record || typeof record !== 'object') return '';
  const value = (record as Record<string, unknown>).name;
  return typeof value === 'string' ? value : '';
}

function getPropertyStatus(record: unknown) {
  if (!record || typeof record !== 'object') return '';
  const value = (record as Record<string, unknown>).status;
  return typeof value === 'string' ? value : '';
}

function getPropertyList(response: unknown) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const data = (response as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }

  return [];
}

function useActiveProperty(enabled = true) {
  const [property, setProperty] = useState<ActiveProperty>({
    name: fallbackPropertyName,
    roomCount: 62,
    city: 'New Delhi',
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const env = (globalThis as unknown as { process?: { env?: { NEXT_PUBLIC_API_URL?: string } } })
      .process?.env;
    const apiBaseUrl = env?.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

    fetch(`${apiBaseUrl}/properties`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load active property.');
        return response.json() as Promise<unknown>;
      })
      .then((response) => {
        const activeProperty = getPropertyList(response).find(
          (property) => getPropertyStatus(property) === 'ACTIVE',
        ) as Record<string, unknown> | undefined;
        const name = getPropertyName(activeProperty);
        if (name) {
          const city = stringValue(activeProperty, ['city']);
          const roomCount = Number(stringValue(activeProperty, ['totalRooms', 'rooms']));
          setProperty({
            city: city || undefined,
            name,
            roomCount: Number.isFinite(roomCount) && roomCount > 0 ? roomCount : undefined,
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      });

    return () => controller.abort();
  }, [enabled]);

  return property;
}

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Group gap={spacing[3]} wrap="nowrap">
      <Box
        aria-hidden
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #6d5dfc 0%, #4f46e5 100%)',
          borderRadius: 10,
          boxShadow: '0 10px 24px rgba(79, 70, 229, 0.22)',
          display: 'flex',
          flex: '0 0 34px',
          height: 34,
          justifyContent: 'center',
          width: 34,
        }}
      >
        <Box
          aria-hidden
          style={{
            border: '2px solid rgba(255, 255, 255, 0.88)',
            borderRadius: 999,
            height: 13,
            width: 13,
          }}
        />
      </Box>
      {!collapsed ? (
        <Box style={{ overflow: 'hidden' }}>
          <Title
            order={2}
            c="#101828"
            style={{ ...typography.styles.h3, fontSize: 19, lineHeight: '24px' }}
          >
            StayOS
          </Title>
        </Box>
      ) : null}
    </Group>
  );
}

function PropertySelector({
  collapsed = false,
  propertyMeta,
  propertyName,
}: {
  collapsed?: boolean;
  propertyMeta?: ActiveProperty;
  propertyName: string;
}) {
  if (collapsed) {
    return (
      <Tooltip label={propertyName} position="right">
        <ActionIcon variant="light" color="stayosBrand" size={38} aria-label="Current property">
          <Building2 size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Menu width={260} position="bottom-start" shadow="sm">
      <Menu.Target>
        <UnstyledButton
          aria-label="Select property"
          style={{
            width: '100%',
            border: '1px solid #e8ebf1',
            borderRadius: 18,
            padding: '12px 14px',
            background: '#f8fafc',
            textAlign: 'left',
          }}
        >
          <Group justify="space-between" wrap="nowrap" align="center">
            <Group gap={12} wrap="nowrap" align="center">
              <Box
                aria-hidden
                style={{
                  alignItems: 'center',
                  background: '#eef2ff',
                  borderRadius: 12,
                  color: '#5b21b6',
                  display: 'flex',
                  height: 34,
                  justifyContent: 'center',
                  width: 34,
                }}
              >
                <Building2 size={16} />
              </Box>
              <Box style={{ minWidth: 0 }}>
                <Text
                  c="#101828"
                  lineClamp={1}
                  style={{ fontSize: 14, fontWeight: 700, lineHeight: '18px' }}
                >
                  {propertyName}
                </Text>
                <Text
                  c="#667085"
                  lineClamp={1}
                  style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}
                >
                  {[
                    propertyMeta?.city,
                    propertyMeta?.roomCount ? `${propertyMeta.roomCount} Rooms` : undefined,
                  ]
                    .filter(Boolean)
                    .join(' - ') || 'Active property'}
                </Text>
              </Box>
            </Group>
            <ChevronDown size={16} color={colors.text.muted} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Properties</Menu.Label>
        <Menu.Item leftSection={<Building2 size={14} />}>{propertyName}</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function NavigationList({
  collapsed = false,
  navigationItems = primaryNavigation,
}: {
  collapsed?: boolean;
  navigationItems?: typeof primaryNavigation;
}) {
  const pathname = usePathname();
  const primaryItems = navigationItems.slice(0, 6);
  const secondaryItems = navigationItems.slice(6);

  const renderNavItem = (item: {
    label: string;
    href: string;
    icon: LucideIcon;
    badge?: string;
  }) => {
    const isActive =
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <UnstyledButton
        key={item.label}
        component={Link}
        href={item.href}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: 44,
          borderRadius: 14,
          padding: collapsed ? '0' : '0 14px',
          margin: 0,
          overflow: 'hidden',
          color: isActive ? '#312e81' : '#475569',
          backgroundColor: isActive ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
          boxShadow: isActive ? '0 10px 24px rgba(109, 93, 252, 0.08)' : 'none',
          transition: 'all 200ms ease',
        }}
        onMouseEnter={(event) => {
          const target = event.currentTarget;
          target.style.transform = 'translateX(1px)';
          target.style.backgroundColor = isActive
            ? 'rgba(124, 58, 237, 0.12)'
            : 'rgba(109, 93, 252, 0.04)';
        }}
        onMouseLeave={(event) => {
          const target = event.currentTarget;
          target.style.transform = 'translateX(0)';
          target.style.backgroundColor = isActive ? 'rgba(124, 58, 237, 0.08)' : 'transparent';
        }}
      >
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            left: 0,
            width: 4,
            borderRadius: '0 999px 999px 0',
            backgroundColor: isActive ? '#7c3aed' : 'transparent',
          }}
        />
        <Group
          align="center"
          style={{
            gap: collapsed ? 0 : 12,
            width: '100%',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          <Group align="center" style={{ gap: collapsed ? 0 : 12, minWidth: 0 }}>
            <item.icon size={20} style={{ color: isActive ? '#7c3aed' : '#6b7280' }} />
            {!collapsed ? (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? '#312e81' : '#475569',
                }}
              >
                {item.label}
              </Text>
            ) : null}
          </Group>
          {!collapsed && item.badge ? (
            <Badge
              radius="xl"
              style={{ background: '#eef2ff', color: '#4338ca', fontWeight: 600, fontSize: 11 }}
            >
              {item.badge}
            </Badge>
          ) : null}
        </Group>
      </UnstyledButton>
    );
  };

  return (
    <Stack gap={10}>
      <Stack gap={8}>{primaryItems.map(renderNavItem)}</Stack>
      <Box style={{ height: 1, background: '#e9ecef', margin: '10px 0' }} />
      <Stack gap={8}>{secondaryItems.map(renderNavItem)}</Stack>
    </Stack>
  );
}

function UserProfile({
  collapsed = false,
  onLockSession,
  onSignOut,
  user = fallbackUser,
}: {
  collapsed?: boolean;
  onLockSession?: () => void;
  onSignOut?: () => void;
  user?: ShellUser;
}) {
  const [menuOpened, setMenuOpened] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const rowActive = menuOpened || isHovered;

  return (
    <Box
      style={{
        flex: '0 0 auto',
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        paddingTop: collapsed ? 2 : 4,
        background: '#fbfcff',
      }}
    >
      <Menu
        width={collapsed ? 164 : 190}
        position="top-start"
        offset={8}
        opened={menuOpened}
        onChange={setMenuOpened}
        shadow="xs"
        withinPortal
      >
        <Menu.Target>
          <UnstyledButton
            type="button"
            aria-label={`Open profile menu for ${user.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpened}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              minHeight: collapsed ? 46 : 52,
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? 6 : '8px 42px 8px 12px',
              border: '1px solid transparent',
              borderRadius: 14,
              background: rowActive ? '#f3f6fb' : 'transparent',
              boxShadow: isFocused ? '0 0 0 3px rgba(124, 58, 237, 0.16)' : 'none',
              cursor: 'pointer',
              outline: 'none',
              textAlign: 'left',
              transition:
                'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
            }}
          >
            <Avatar color="stayosBrand" radius="xl" size={34}>
              {user.initials ?? user.name.slice(0, 2).toUpperCase()}
            </Avatar>
            {!collapsed ? (
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Text
                  c="#101828"
                  lineClamp={1}
                  style={{ fontSize: 13, fontWeight: 700, lineHeight: '18px' }}
                >
                  {user.name}
                </Text>
                <Text
                  c="#667085"
                  lineClamp={1}
                  style={{ marginTop: 1, fontSize: 12, fontWeight: 500, lineHeight: '16px' }}
                >
                  {user.email}
                </Text>
              </Box>
            ) : null}
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown
          aria-label="Profile actions"
          style={{
            borderColor: '#e6eaf2',
            borderRadius: 12,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
          }}
        >
          <Menu.Label>
            <Text c="#101828" fw={700} size="sm">
              {user.name}
            </Text>
            <Text c="#667085" size="xs">
              {user.email}
            </Text>
          </Menu.Label>
          <Menu.Item leftSection={<UserRound size={16} />}>Profile</Menu.Item>
          <Menu.Item disabled>{user.roleLabel}</Menu.Item>
          <Menu.Item leftSection={<KeyRound size={16} />} onClick={onLockSession}>
            Lock Session
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<LogOut size={16} />} onClick={onSignOut}>
            Sign Out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {onSignOut ? (
        <Tooltip label="Sign out" position="right">
          <ActionIcon
            aria-label="Sign out"
            color="red"
            onClick={onSignOut}
            size={collapsed ? 34 : 30}
            style={{
              position: collapsed ? 'static' : 'absolute',
              right: collapsed ? undefined : 10,
              top: collapsed ? undefined : 15,
              zIndex: 3,
            }}
            variant="subtle"
          >
            <LogOut size={16} />
          </ActionIcon>
        </Tooltip>
      ) : null}
    </Box>
  );
}

function GlobalSearch() {
  const [opened, setOpened] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpened(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = [
    {
      title: 'Ananya Rao',
      detail: 'Guest profile - returning VIP',
      href: '/guests/ananya-rao',
      icon: UserRound,
    },
    {
      title: 'Suite 402',
      detail: 'Occupied - Ananya Rao',
      href: '/rooms/402',
      icon: BedDouble,
    },
    {
      title: 'Booking ST1842',
      detail: 'Checked in - view current stay',
      href: '/guest-stay/ST1842',
      icon: Search,
    },
  ];

  return (
    <Popover opened={opened} onChange={setOpened} width={460} position="bottom" shadow="md">
      <Popover.Target>
        <SearchInput
          ref={searchInputRef}
          visibleFrom="md"
          w="100%"
          leftSection={<Search size={15} />}
          rightSection={
            <Group gap={4} wrap="nowrap">
              <Box
                style={{
                  border: '1px solid #d9e1ef',
                  borderRadius: 6,
                  color: '#52627a',
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: '16px',
                  minWidth: 24,
                  textAlign: 'center',
                }}
              >
                Ctrl
              </Box>
              <Box
                style={{
                  border: '1px solid #d9e1ef',
                  borderRadius: 6,
                  color: '#52627a',
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: '16px',
                  minWidth: 20,
                  textAlign: 'center',
                }}
              >
                K
              </Box>
            </Group>
          }
          rightSectionWidth={64}
          placeholder="Search guests, rooms, bookings or ask StayOS..."
          aria-label="Global search"
          onFocus={() => setOpened(true)}
          onBlur={() => window.setTimeout(() => setOpened(false), 150)}
          styles={{
            input: {
              borderColor: '#d9e1ef',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
              height: 42,
            },
          }}
        />
      </Popover.Target>
      <Popover.Dropdown p={spacing[2]}>
        <Text
          c={colors.text.muted}
          px={spacing[2]}
          py={spacing[1]}
          style={typography.styles.caption}
        >
          Quick commands
        </Text>
        <Stack gap={spacing[1]}>
          {results.map((result) => (
            <UnstyledButton
              key={result.title}
              component={Link}
              href={result.href}
              style={{
                borderRadius: radius.md,
                padding: spacing[3],
                width: '100%',
              }}
            >
              <Group gap={spacing[3]} wrap="nowrap">
                <Box
                  aria-hidden
                  style={{
                    alignItems: 'center',
                    background: colors.brand[50],
                    borderRadius: radius.md,
                    color: colors.brand[500],
                    display: 'flex',
                    height: 32,
                    justifyContent: 'center',
                    width: 32,
                  }}
                >
                  <result.icon size={16} />
                </Box>
                <Box>
                  <Text c={colors.text.strong} style={typography.styles.label}>
                    {result.title}
                  </Text>
                  <Text c={colors.text.muted} mt={2} style={typography.styles.caption}>
                    {result.detail}
                  </Text>
                </Box>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function Sidebar({
  collapsed,
  navigationItems,
  onLockSession,
  onSignOut,
  onToggleCollapse,
  propertyMeta,
  propertyName,
  user,
}: {
  collapsed: boolean;
  navigationItems?: typeof primaryNavigation;
  onLockSession?: () => void;
  onSignOut?: () => void;
  onToggleCollapse: () => void;
  propertyMeta?: ActiveProperty;
  propertyName: string;
  user?: ShellUser;
}) {
  return (
    <Box style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <Stack
        h="100%"
        gap={collapsed ? spacing[4] : 18}
        p={collapsed ? '12px 12px 8px' : '18px 16px 10px'}
        style={{ minHeight: 0 }}
      >
        <Group justify={collapsed ? 'center' : 'space-between'} align="center" wrap="nowrap">
          <BrandMark collapsed={collapsed} />
          {!collapsed ? null : null}
        </Group>

        <PropertySelector
          collapsed={collapsed}
          propertyMeta={propertyMeta}
          propertyName={propertyName}
        />

        <ScrollArea flex={1} type="hover" scrollbarSize={5} style={{ minHeight: 0 }}>
          <NavigationList collapsed={collapsed} navigationItems={navigationItems} />
        </ScrollArea>

        <UserProfile
          collapsed={collapsed}
          onLockSession={onLockSession}
          onSignOut={onSignOut}
          user={user}
        />
      </Stack>

      <ActionIcon
        variant="filled"
        color="gray"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        size={36}
        style={{
          position: 'absolute',
          top: 20,
          right: -18,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
          zIndex: 1,
        }}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </ActionIcon>
    </Box>
  );
}

function TopHeader({
  workspaceTitle,
  onOpenMobileMenu,
  utilityPanelOpen,
  utilityPanelAvailable,
  onToggleUtilityPanel,
}: {
  workspaceTitle: string;
  onOpenMobileMenu: () => void;
  utilityPanelOpen: boolean;
  utilityPanelAvailable: boolean;
  onToggleUtilityPanel: () => void;
}) {
  const currentTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
      }).format(new Date()),
    [],
  );
  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        year: 'numeric',
        day: '2-digit',
        month: 'short',
      }).format(new Date()),
    [],
  );

  return (
    <Stack gap={6} px={{ base: spacing[4], md: spacing[5] }} py={8} justify="center">
      <Group justify="space-between" wrap="nowrap" align="center">
        <Group gap={spacing[3]} wrap="nowrap" style={{ minWidth: 160 }}>
          <Burger
            hiddenFrom="md"
            opened={false}
            onClick={onOpenMobileMenu}
            size="sm"
            aria-label="Open menu"
          />
          <Title
            order={1}
            c="#101828"
            style={{ fontSize: 20, fontWeight: 700, lineHeight: '28px' }}
          >
            {workspaceTitle}
          </Title>
        </Group>

        <Stack gap={6} visibleFrom="md" style={{ flex: 1, maxWidth: 760 }}>
          <GlobalSearch />
          <Group gap={6} style={{ color: '#8a97ad', fontSize: 12, fontWeight: 500 }}>
            <Text inherit>Try:</Text>
            {commandSuggestions.map((suggestion) => (
              <Button
                key={suggestion.label}
                component={Link}
                href={suggestion.href}
                variant="subtle"
                size="compact-xs"
                color="gray"
                radius={radius.full}
                styles={{
                  root: {
                    border: '1px solid #e6eaf2',
                    color: '#52627a',
                    fontWeight: 600,
                    height: 24,
                    paddingInline: 10,
                  },
                }}
              >
                {suggestion.label}
              </Button>
            ))}
          </Group>
        </Stack>

        <Group gap={spacing[2]} wrap="nowrap">
          <Tooltip label="Messages">
            <ActionIcon
              visibleFrom="sm"
              variant="subtle"
              color="gray"
              aria-label="Messages"
              size={32}
            >
              <MessageSquare size={18} />
            </ActionIcon>
          </Tooltip>
          <Box
            visibleFrom="md"
            style={{ borderLeft: '1px solid #eef1f6', marginInline: 8, paddingLeft: 12 }}
          >
            <Text
              c="#101828"
              ta="right"
              style={{ fontSize: 15, fontWeight: 700, lineHeight: '20px' }}
            >
              {currentTime}
            </Text>
            <Text
              c="#667085"
              ta="right"
              style={{ fontSize: 10, fontWeight: 500, lineHeight: '14px' }}
            >
              {currentDate}
            </Text>
          </Box>
          <ActionIcon
            visibleFrom="md"
            variant="subtle"
            color="orange"
            aria-label="Theme status"
            size={32}
          >
            <Sun size={18} />
          </ActionIcon>
          {utilityPanelAvailable ? (
            <Tooltip label={utilityPanelOpen ? 'Hide utility panel' : 'Show utility panel'}>
              <ActionIcon
                visibleFrom="lg"
                variant={utilityPanelOpen ? 'light' : 'subtle'}
                color="stayosBrand"
                onClick={onToggleUtilityPanel}
                aria-label="Toggle utility panel"
                size={32}
              >
                {utilityPanelOpen ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </Group>
    </Stack>
  );
}

function UtilityPanel() {
  const pathname = usePathname();

  if (pathname === '/') {
    return <FrontDeskUtilityPanel />;
  }

  const tasks = getTasksForPath(pathname);
  const topTask = tasks[0];

  return (
    <Stack h="100%" gap={spacing[5]} p={spacing[5]}>
      <Box>
        <Text c={colors.text.strong} style={typography.styles.label}>
          Task Engine
        </Text>
        <Text c={colors.text.muted} style={typography.styles.caption}>
          Contextual tasks generated from StayOS operations.
        </Text>
      </Box>

      <Paper
        radius={radius.md}
        p={spacing[4]}
        bg={colors.surface.base}
        bd={`1px solid ${colors.border.subtle}`}
      >
        <Stack gap={spacing[3]}>
          <Text c={colors.text.strong} style={typography.styles.label}>
            Next best focus
          </Text>
          <Text c={colors.text.body} style={typography.styles.small}>
            {topTask
              ? `${topTask.title}. ${topTask.primaryAction} is the next action.`
              : 'No urgent operational tasks right now.'}
          </Text>
        </Stack>
      </Paper>

      <Stack gap={spacing[3]}>
        {tasks.map((task) => (
          <OperationalTaskCard key={task.id} task={task} compact />
        ))}
      </Stack>
    </Stack>
  );
}

function buildPropertyStatus(rooms: Record<string, unknown>[]): PropertyStatus[] {
  const statuses = rooms.map(roomStatusFromRecord);

  return [
    { label: 'Ready', value: String(statuses.filter(isReadyRoom).length), tone: '#12b76a' },
    { label: 'Cleaning', value: String(statuses.filter(isCleaningRoom).length), tone: '#f79009' },
    { label: 'Dirty', value: String(statuses.filter(isDirtyRoom).length), tone: '#f97316' },
    {
      label: 'Out of Order',
      value: String(statuses.filter(isOutOfOrderRoom).length),
      tone: '#ef4444',
    },
    { label: 'Occupied', value: String(statuses.filter(isOccupiedRoom).length), tone: '#2563eb' },
  ];
}

function buildNextEvent(reservations: Record<string, unknown>[]): NextEvent | undefined {
  const today = normalizedDate(new Date().toISOString());
  const upcoming = reservations
    .map((reservation) => {
      const arrivalDate = normalizedDate(
        stringValue(reservation, ['arrivalDate', 'checkInDate', 'startDate']),
      );
      const departureDate = normalizedDate(
        stringValue(reservation, ['departureDate', 'checkOutDate', 'endDate']),
      );
      const status = normalizedStatus(stringValue(reservation, ['status'], 'CONFIRMED'));
      const isVip = booleanValue(reservation, ['isVip', 'vip']);
      const isGroup =
        booleanValue(reservation, ['isGroup', 'group']) ||
        stringValue(reservation, ['companyName', 'groupName']);
      const eventDate = arrivalDate || departureDate;

      return {
        eventDate,
        reservation,
        score:
          eventDate >= today && !['CANCELLED', 'CANCELED', 'NO_SHOW'].includes(status)
            ? isVip
              ? 0
              : isGroup
                ? 1
                : 2
            : 99,
        status,
      };
    })
    .filter((item) => item.eventDate && item.score < 99)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.score - b.score);

  const next = upcoming[0];
  if (!next) return undefined;

  const guestName = guestNameFromReservation(next.reservation);
  const code = reservationCode(next.reservation);
  const isVip = booleanValue(next.reservation, ['isVip', 'vip']);
  const groupName = stringValue(next.reservation, ['companyName', 'groupName']);
  const title = groupName ? 'Corporate Group Arrival' : isVip ? 'VIP Arrival' : 'Expected Check-in';

  return {
    action: 'View Booking',
    detail: `${groupName || guestName} - ${code}`,
    href: '/reservations',
    time: next.eventDate === today ? 'Today' : displayDate(next.eventDate),
    title,
    tone: isVip ? '#7c3aed' : groupName ? '#f97316' : '#2563eb',
  };
}

function buildLiveOperations(
  reservations: Record<string, unknown>[],
  rooms: Record<string, unknown>[],
): LiveOperation[] {
  const roomEvents = rooms.slice(0, 8).flatMap((room): LiveOperation[] => {
    const status = roomStatusFromRecord(room);
    const roomNumber = roomNumberFromRecord(room);

    if (isReadyRoom(status)) {
      return [
        {
          title: `Room ${roomNumber} ready`,
          detail: 'Housekeeping completed',
          action: 'Assign Guest',
          time: 'Now',
        },
      ];
    }

    if (isDirtyRoom(status)) {
      return [
        {
          title: `Room ${roomNumber} marked dirty`,
          detail: 'Housekeeping required',
          action: 'Open Room',
          time: 'Now',
        },
      ];
    }

    if (isOutOfOrderRoom(status)) {
      return [
        {
          title: `Room ${roomNumber} unavailable`,
          detail: 'Maintenance or block active',
          action: 'View Room',
          time: 'Now',
        },
      ];
    }

    return [];
  });

  const reservationEvents = reservations.slice(0, 8).flatMap((reservation): LiveOperation[] => {
    const status = normalizedStatus(stringValue(reservation, ['status'], ''));
    const paymentStatus = normalizedStatus(
      stringValue(reservation, ['paymentStatus', 'paymentState'], ''),
    );
    const guestName = guestNameFromReservation(reservation);

    if (status === 'CHECKED_IN') {
      return [
        {
          title: `${guestName} checked in`,
          detail: reservationCode(reservation),
          action: 'Open Stay',
          time: 'Recent',
        },
      ];
    }

    if (status === 'CHECKED_OUT') {
      return [
        {
          title: `${guestName} checked out`,
          detail: reservationCode(reservation),
          action: 'View Folio',
          time: 'Recent',
        },
      ];
    }

    if (paymentStatus === 'PAID') {
      return [
        {
          title: 'Payment received',
          detail: `${guestName} - ${reservationCode(reservation)}`,
          action: 'View Invoice',
          time: 'Recent',
        },
      ];
    }

    return [];
  });

  return [...roomEvents, ...reservationEvents].slice(0, 20);
}

function useFrontDeskUtilityData(): FrontDeskUtilityState {
  const [state, setState] = useState<FrontDeskUtilityState>({
    isLoading: true,
    liveOperations: [],
    propertyStatus: emptyPropertyStatus,
    roomTotal: 0,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadUtilityData() {
      setState((current) => ({ ...current, error: undefined, isLoading: current.roomTotal === 0 }));

      try {
        const properties = await apiGet<Record<string, unknown>[]>(
          '/properties',
          controller.signal,
        );
        const propertyId = activePropertyId(properties);
        if (!propertyId) throw new Error('No active property returned from properties API.');

        const [reservations, rooms] = await Promise.all([
          apiGet<Record<string, unknown>[]>(
            `/properties/${propertyId}/reservations`,
            controller.signal,
          ),
          apiGet<Record<string, unknown>[]>(`/properties/${propertyId}/rooms`, controller.signal),
        ]);

        setState({
          isLoading: false,
          liveOperations: buildLiveOperations(reservations, rooms),
          nextEvent: buildNextEvent(reservations),
          propertyStatus: buildPropertyStatus(rooms),
          roomTotal: rooms.length,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Front Desk utility panel API failed', error);
        setState((current) => ({
          ...current,
          error:
            error instanceof Error ? error.message : 'Live operations are temporarily unavailable.',
          isLoading: false,
        }));
      }
    }

    void loadUtilityData();

    return () => controller.abort();
  }, []);

  return state;
}

function FrontDeskUtilityPanel() {
  const utility = useFrontDeskUtilityData();
  const nextEvent = utility.nextEvent;
  const propertyStatus = utility.propertyStatus;
  const liveOperations = utility.liveOperations;

  return (
    <Box h="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
      <Stack h="100%" gap={12} p={14} style={{ minHeight: 0 }}>
        <Paper
          radius={12}
          p={16}
          bg="#ffffff"
          bd="1px solid #e6eaf2"
          shadow="xs"
          style={{ flex: '0 0 auto' }}
        >
          <Stack gap={12}>
            <Group justify="space-between" wrap="nowrap">
              <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
                Next Event
              </Text>
              <Text c="#8a97ad" style={{ fontSize: 11, fontWeight: 500 }}>
                {utility.isLoading ? 'Loading' : (nextEvent?.time ?? 'Clear')}
              </Text>
            </Group>
            {nextEvent ? (
              <>
                <Group gap={12} align="flex-start" wrap="nowrap">
                  <Box
                    aria-hidden
                    style={{
                      background: nextEvent.tone,
                      borderRadius: 999,
                      height: 9,
                      marginTop: 5,
                      width: 9,
                    }}
                  />
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Text
                      c="#182230"
                      lineClamp={1}
                      style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}
                    >
                      {nextEvent.title}
                    </Text>
                    <Text
                      c="#61708c"
                      lineClamp={1}
                      style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}
                    >
                      {nextEvent.detail}
                    </Text>
                  </Box>
                </Group>
                <Button
                  component={Link}
                  href={nextEvent.href}
                  variant="light"
                  color="stayosBrand"
                  size="compact-sm"
                  fw={600}
                >
                  {nextEvent.action}
                </Button>
              </>
            ) : (
              <Text c="#667085" style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
                {utility.error ??
                  (utility.isLoading
                    ? 'Loading upcoming events...'
                    : 'No upcoming front desk events.')}
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper
          radius={12}
          p={16}
          bg="#ffffff"
          bd="1px solid #e6eaf2"
          shadow="xs"
          style={{ flex: '0 0 auto' }}
        >
          <Stack gap={12}>
            <Group justify="space-between" wrap="nowrap">
              <Box>
                <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
                  Property Status
                </Text>
                <Text c="#667085" style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
                  Live room availability
                </Text>
              </Box>
              <Text c="#52627a" style={{ fontSize: 11, fontWeight: 500 }}>
                {utility.isLoading ? 'Loading' : `${utility.roomTotal} Rooms`}
              </Text>
            </Group>

            <Stack gap={8}>
              {propertyStatus.map((item) => (
                <Group
                  key={item.label}
                  justify="space-between"
                  wrap="nowrap"
                  style={{
                    minHeight: 44,
                    border: '1px solid #e6eaf2',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: '#ffffff',
                  }}
                >
                  <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Box
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: item.tone,
                        flex: '0 0 auto',
                      }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Text
                        c="#182230"
                        lineClamp={1}
                        style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        c="#667085"
                        lineClamp={1}
                        style={{ fontSize: 11, fontWeight: 500, lineHeight: '14px' }}
                      >
                        Live status
                      </Text>
                    </Box>
                  </Group>

                  <Text
                    style={{
                      color: item.tone,
                      fontSize: 16,
                      fontWeight: 700,
                      lineHeight: '20px',
                      flex: '0 0 auto',
                    }}
                  >
                    {item.value}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          radius={12}
          p={16}
          bg="#ffffff"
          bd="1px solid #e6eaf2"
          shadow="xs"
          style={{
            display: 'flex',
            flex: '1 1 auto',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Stack gap={12} h="100%" style={{ minHeight: 0 }}>
            <Group justify="space-between" wrap="nowrap">
              <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
                Live Operations
              </Text>
              <Text c="#8a97ad" style={{ fontSize: 11, fontWeight: 500 }}>
                Newest first
              </Text>
            </Group>
            <ScrollArea
              type="hover"
              scrollbarSize={6}
              offsetScrollbars
              style={{ flex: '1 1 auto', maxHeight: 'clamp(240px, 32vh, 420px)', minHeight: 0 }}
              styles={{
                viewport: {
                  overscrollBehavior: 'contain',
                  scrollBehavior: 'smooth',
                },
                thumb: {
                  background: '#cbd5e1',
                },
              }}
            >
              <Stack gap={12} pr={4} pb={8}>
                {liveOperations.length > 0 ? (
                  liveOperations.map((item, index) => (
                    <Group
                      key={`${item.title}-${item.detail}-${item.time}-${index}`}
                      gap={10}
                      align="flex-start"
                      wrap="nowrap"
                    >
                      <CheckCircle2
                        size={16}
                        color="#12b76a"
                        style={{ flex: '0 0 auto', marginTop: 2 }}
                      />
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text
                          c="#182230"
                          lineClamp={1}
                          style={{ fontSize: 12, fontWeight: 600, lineHeight: '17px' }}
                        >
                          {item.title}
                        </Text>
                        {item.detail ? (
                          <Text
                            c="#667085"
                            lineClamp={1}
                            style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}
                          >
                            {item.detail}
                          </Text>
                        ) : null}
                        <Button
                          component="a"
                          href="#"
                          variant="subtle"
                          color="stayosBrand"
                          size="compact-xs"
                          px={0}
                          fw={600}
                        >
                          {item.action}
                        </Button>
                      </Box>
                      <Text
                        c="#8a97ad"
                        style={{
                          flex: '0 0 auto',
                          fontSize: 11,
                          fontWeight: 500,
                          lineHeight: '15px',
                        }}
                      >
                        {item.time}
                      </Text>
                    </Group>
                  ))
                ) : (
                  <Text c="#667085" style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
                    {utility.error ??
                      (utility.isLoading ? 'Loading live operations...' : 'No recent activity')}
                  </Text>
                )}
              </Stack>
            </ScrollArea>
            <Divider color="#eef1f6" />
            <Button variant="subtle" color="stayosBrand" fullWidth fw={600}>
              View Live Operations
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

function MobileDrawer({
  navigationItems,
  onLockSession,
  opened,
  onClose,
  onSignOut,
  propertyMeta,
  propertyName,
  user,
}: {
  navigationItems?: typeof primaryNavigation;
  onLockSession?: () => void;
  opened: boolean;
  onClose: () => void;
  onSignOut?: () => void;
  propertyMeta?: ActiveProperty;
  propertyName: string;
  user?: ShellUser;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<BrandMark />}
      size="min(90vw, 340px)"
      zIndex={zIndex.drawer}
    >
      <Sidebar
        collapsed={false}
        navigationItems={navigationItems}
        onLockSession={onLockSession}
        onSignOut={onSignOut}
        onToggleCollapse={onClose}
        propertyMeta={propertyMeta}
        propertyName={propertyName}
        user={user}
      />
    </Drawer>
  );
}

function MobileBottomNav({
  navigationItems,
  onOpen,
}: {
  navigationItems?: typeof primaryNavigation;
  onOpen: () => void;
}) {
  const pathname = usePathname();
  const items = navigationItems
    ? mobileNavigation.filter((item) => navigationItems.some((nav) => nav.href === item.href))
    : mobileNavigation;

  return (
    <Group
      hiddenFrom="md"
      justify="space-around"
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      h={64}
      bg={colors.surface.base}
      bd={`1px solid ${colors.border.subtle}`}
      style={{ zIndex: zIndex.sticky, boxShadow: shadows.sm }}
    >
      {items.map((item) => (
        <ActionIcon
          component={Link}
          href={item.href}
          key={item.label}
          aria-label={item.label}
          variant={pathname === item.href ? 'light' : 'subtle'}
          color="stayosBrand"
          size="lg"
        >
          <item.icon size={18} />
        </ActionIcon>
      ))}
      <ActionIcon
        aria-label="Open menu"
        variant="subtle"
        color="stayosBrand"
        size="lg"
        onClick={onOpen}
      >
        <MenuIcon size={18} />
      </ActionIcon>
    </Group>
  );
}

function ProtectedStayOSAppShell({
  children,
  navigationItems,
  onLockSession,
  onSignOut,
  propertyName: propertyNameProp,
  user,
}: Omit<StayOSAppShellProps, 'isPublicRoute'>) {
  const [mobileMenuOpened, { open: openMobileMenu, close: closeMobileMenu }] = useDisclosure(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [utilityPanelOpen, setUtilityPanelOpen] = useState(false);
  const pathname = usePathname();
  const activeProperty = useActiveProperty(!propertyNameProp && !user?.propertyName);
  const propertyName = propertyNameProp ?? user?.propertyName ?? activeProperty.name;
  const propertyMeta =
    propertyNameProp || user?.propertyName ? { name: propertyName } : activeProperty;
  const sidebarWidth = sidebarCollapsed ? 78 : 264;
  const utilityPanelAvailable = !pathname.startsWith('/rooms');
  const workspaceTitle = workspaceTitleForPath(pathname);
  const pageOwnsScroll = pathname.startsWith('/housekeeping');

  return (
    <>
      <Box
        bg="#f6f7fb"
        style={{
          display: 'flex',
          height: '100vh',
          minHeight: '100vh',
        }}
      >
        <Box
          visibleFrom="md"
          bg="#fbfcff"
          style={{
            borderRight: '1px solid #e6eaf2',
            flex: `0 0 ${sidebarWidth}px`,
            height: '100vh',
            position: 'relative',
            transition: `width ${animations.duration.slow} ${animations.easing.standard}`,
            width: sidebarWidth,
          }}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            navigationItems={navigationItems}
            onLockSession={onLockSession}
            onSignOut={onSignOut}
            onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
            propertyMeta={propertyMeta}
            propertyName={propertyName}
            user={user}
          />
        </Box>

        <Box
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            minHeight: '100vh',
            minWidth: 0,
          }}
        >
          <Box
            style={{
              background: '#ffffff',
              borderBottom: '1px solid #e6eaf2',
              flex: '0 0 auto',
            }}
          >
            <TopHeader
              workspaceTitle={workspaceTitle}
              onOpenMobileMenu={openMobileMenu}
              utilityPanelOpen={utilityPanelOpen}
              utilityPanelAvailable={utilityPanelAvailable}
              onToggleUtilityPanel={() => setUtilityPanelOpen((value) => !value)}
            />
          </Box>

          <Box
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflowX: 'hidden',
                overflowY: pageOwnsScroll ? 'hidden' : 'auto',
              }}
            >
              <ShellContent>{children}</ShellContent>
            </Box>

            {utilityPanelAvailable && utilityPanelOpen ? (
              <Box
                visibleFrom="lg"
                bg="#fbfcff"
                style={{
                  borderLeft: '1px solid #e6eaf2',
                  flex: '0 0 340px',
                  minHeight: 0,
                }}
              >
                <UtilityPanel />
              </Box>
            ) : null}
          </Box>
        </Box>
      </Box>

      <MobileDrawer
        navigationItems={navigationItems}
        onLockSession={onLockSession}
        opened={mobileMenuOpened}
        onClose={closeMobileMenu}
        onSignOut={onSignOut}
        propertyMeta={propertyMeta}
        propertyName={propertyName}
        user={user}
      />
      <MobileBottomNav navigationItems={navigationItems} onOpen={openMobileMenu} />
    </>
  );
}

function workspaceTitleForPath(pathname: string) {
  if (pathname.startsWith('/housekeeping')) return 'Housekeeping';
  if (pathname.startsWith('/maintenance')) return 'Maintenance';
  if (pathname.startsWith('/billing')) return 'Billing';
  if (pathname.startsWith('/reports')) return 'Manager Dashboard';
  return 'Front Desk';
}

export function StayOSAppShell({
  children,
  isPublicRoute = false,
  navigationItems,
  onLockSession,
  onSignOut,
  propertyName,
  user,
}: StayOSAppShellProps) {
  if (isPublicRoute) return <>{children}</>;

  return (
    <ProtectedStayOSAppShell
      navigationItems={navigationItems}
      onLockSession={onLockSession}
      onSignOut={onSignOut}
      propertyName={propertyName}
      user={user}
    >
      {children}
    </ProtectedStayOSAppShell>
  );
}
