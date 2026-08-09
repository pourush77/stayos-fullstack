'use client';

declare const process: {
  env: {
    NEXT_PUBLIC_API_BASE_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
  };
};

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
  AlertTriangle,
  Bell,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Clock3,
  KeyRound,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animations, colors, radius, shadows, spacing, typography, zIndex } from '@stayos/theme';
import { OperationalTaskCard } from '../components/operational-task-card';
import { getTasksForPath } from '../operations/task-engine';
import { GlobalSearch } from './global-search';
import { mobileNavigation, primaryNavigation } from './navigation';
import { ShellContent } from './shell-content';

type StayOSAppShellProps = {
  children: ReactNode;
  isPublicRoute?: boolean;
  navigationItems?: typeof primaryNavigation;
  onLockSession?: () => void;
  onSignOut?: () => void;
  propertyId?: string;
  propertyName?: string;
  user?: ShellUser;
};

export type ShellUser = {
  email: string;
  initials?: string;
  name: string;
  propertyId?: string;
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

type GuestRequestAttentionState =
  'UPCOMING' | 'DUE_SOON' | 'UNACKNOWLEDGED' | 'OVERDUE' | 'SLA_BREACHED' | 'ESCALATED';

type GuestRequestAttentionSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

type GuestRequestAttentionItem = {
  requestId: string;
  reservationId?: string | null;
  requestType?: string | null;
  title: string;
  department: string;
  status: string;
  priority: string;
  guestDisplayName?: string | null;
  roomNumber?: string | null;
  assignedEmployeeName?: string | null;
  dueAt?: string | null;
  attentionState: GuestRequestAttentionState;
  severity: GuestRequestAttentionSeverity;
  message: string;
  minutesUntilDue: number | null;
  minutesOverdue: number | null;
};

type AttentionCenterState = {
  error?: string;
  isLoading: boolean;
  items: GuestRequestAttentionItem[];
};

type AttentionPopupItem = GuestRequestAttentionItem & {
  popupKey: string;
};

type AttentionBacklogPopup = {
  popupKey: string;
  count: number;
  oldest?: GuestRequestAttentionItem;
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
const emptyPropertyStatus: PropertyStatus[] = [
  { label: 'Ready', value: '0', tone: '#12b76a' },
  { label: 'Cleaning', value: '0', tone: '#f79009' },
  { label: 'Dirty', value: '0', tone: '#f97316' },
  { label: 'Out of Order', value: '0', tone: '#ef4444' },
  { label: 'Occupied', value: '0', tone: '#2563eb' },
];

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
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
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error('API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL.');
  }

  const headers = new Headers({ Accept: 'application/json' });

  if (typeof window !== 'undefined') {
    const token =
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken');

    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers,
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

    const baseUrl = apiBaseUrl();
    if (!baseUrl) return () => undefined;

    const controller = new AbortController();
    const headers = new Headers({ Accept: 'application/json' });
    const token =
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken');

    if (token) headers.set('Authorization', `Bearer ${token}`);

    fetch(`${baseUrl}/properties`, {
      headers,
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
        data-testid={`sidebar-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
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

function attentionHref(item: GuestRequestAttentionItem) {
  if (item.reservationId) {
    return `/guest-stay/${item.reservationId}?focus=requests&requestId=${encodeURIComponent(item.requestId)}`;
  }

  if (item.department === 'HOUSEKEEPING') return '/housekeeping';
  if (item.department === 'MAINTENANCE') return '/maintenance';
  return '/';
}

function attentionLabel(state: GuestRequestAttentionState) {
  if (state === 'DUE_SOON') return 'Due soon';
  if (state === 'UNACKNOWLEDGED') return 'Needs attention';
  if (state === 'SLA_BREACHED') return 'SLA breached';
  if (state === 'ESCALATED') return 'Critical';
  if (state === 'OVERDUE') return 'Overdue';
  return 'Upcoming';
}

function attentionTone(severity: GuestRequestAttentionSeverity) {
  if (severity === 'CRITICAL') {
    return { accent: '#dc2626', background: '#fef2f2', border: '#fecaca', badge: 'red' };
  }

  if (severity === 'WARNING') {
    return { accent: '#b45309', background: '#fffbeb', border: '#fde68a', badge: 'yellow' };
  }

  return { accent: '#2563eb', background: '#eff6ff', border: '#bfdbfe', badge: 'blue' };
}

function wakeUpScheduleLabel(dueAt?: string | null) {
  if (!dueAt) return null;

  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const time = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  if (sameDay(date, now)) return `Today · ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow · ${time}`;

  const day = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);

  return `${day} · ${time}`;
}

function useAttentionCenter(propertyId?: string) {
  const [state, setState] = useState<AttentionCenterState>({
    isLoading: false,
    items: [],
  });
  const inFlightRef = useRef(false);

  const load = useCallback(
    async (showLoading = false) => {
      if (!propertyId || inFlightRef.current) return;

      inFlightRef.current = true;
      if (showLoading) {
        setState((current) => ({
          ...current,
          error: undefined,
          isLoading: current.items.length === 0,
        }));
      }

      try {
        const items = await apiGet<GuestRequestAttentionItem[]>(
          `/properties/${propertyId}/guest-requests/attention`,
        );
        setState({ isLoading: false, items });
      } catch (error) {
        setState((current) => ({
          ...current,
          error:
            error instanceof Error ? error.message : 'Attention items are temporarily unavailable.',
          isLoading: false,
        }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [propertyId],
  );

  useEffect(() => {
    if (!propertyId) {
      setState({ isLoading: false, items: [] });
      return undefined;
    }

    void load(true);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [load, propertyId]);

  const removeRequest = useCallback((requestId: string) => {
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.requestId !== requestId),
    }));
  }, []);

  return {
    ...state,
    count: state.items.length,
    criticalCount: state.items.filter((item) => item.severity === 'CRITICAL').length,
    refresh: load,
    removeRequest,
  };
}

function AttentionCenter({ propertyId }: { propertyId?: string }) {
  const attention = useAttentionCenter(propertyId);
  const [opened, setOpened] = useState(false);
  const [activePopup, setActivePopup] = useState<AttentionPopupItem | AttentionBacklogPopup | null>(
    null,
  );
  const popupQueueRef = useRef<Array<AttentionPopupItem | AttentionBacklogPopup>>([]);
  const initializedRef = useRef(false);
  const lastStateByRequestRef = useRef<Record<string, GuestRequestAttentionState>>({});
  const popupTimerRef = useRef<number | null>(null);

  const sortedItems = useMemo(
    () =>
      [...attention.items].sort((left, right) => {
        const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
        const rank = severityRank[left.severity] - severityRank[right.severity];
        if (rank !== 0) return rank;
        return (
          (left.minutesUntilDue ?? Number.MAX_SAFE_INTEGER) -
          (right.minutesUntilDue ?? Number.MAX_SAFE_INTEGER)
        );
      }),
    [attention.items],
  );

  const clearPopupTimer = useCallback(() => {
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, []);

  const showNextQueuedPopup = useCallback(() => {
    clearPopupTimer();

    const next = popupQueueRef.current.shift() ?? null;
    setActivePopup(next);

    if (next && 'severity' in next && next.severity !== 'CRITICAL') {
      popupTimerRef.current = window.setTimeout(
        () => {
          setActivePopup(null);
          window.setTimeout(showNextQueuedPopup, 120);
        },
        next.severity === 'WARNING' ? 10_000 : 7_000,
      );
    }

    if (next && !('severity' in next)) {
      popupTimerRef.current = window.setTimeout(() => {
        setActivePopup(null);
        window.setTimeout(showNextQueuedPopup, 120);
      }, 8_000);
    }
  }, [clearPopupTimer]);

  const dismissActivePopup = useCallback(() => {
    clearPopupTimer();
    setActivePopup(null);
    window.setTimeout(showNextQueuedPopup, 120);
  }, [clearPopupTimer, showNextQueuedPopup]);

  const enqueuePopup = useCallback(
    (popup: AttentionPopupItem | AttentionBacklogPopup) => {
      const key = popup.popupKey;
      if (activePopup?.popupKey === key) return;
      if (popupQueueRef.current.some((queued) => queued.popupKey === key)) return;

      popupQueueRef.current.push(popup);

      if (!activePopup) {
        window.setTimeout(showNextQueuedPopup, 0);
      }
    },
    [activePopup, showNextQueuedPopup],
  );

  useEffect(() => {
    initializedRef.current = false;
    lastStateByRequestRef.current = {};
    popupQueueRef.current = [];
    clearPopupTimer();
    setActivePopup(null);
  }, [clearPopupTimer, propertyId]);

  useEffect(() => {
    const handleGuestRequestChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          propertyId?: string;
          requestId?: string;
          action?: 'create' | 'accept' | 'start' | 'complete' | 'cancel';
        }>
      ).detail;

      if (!detail?.requestId) return;
      if (detail.propertyId && propertyId && detail.propertyId !== propertyId) return;

      const isResolved = detail.action === 'complete' || detail.action === 'cancel';

      if (isResolved) {
        // Make the bell, popover and popup react instantly instead of waiting for polling.
        attention.removeRequest(detail.requestId);
        delete lastStateByRequestRef.current[detail.requestId];

        popupQueueRef.current = popupQueueRef.current.filter(
          (queued) =>
            !('requestId' in queued && queued.requestId === detail.requestId) &&
            'severity' in queued,
        );

        setActivePopup((current) => {
          if (!current) return current;
          if (!('severity' in current)) return null;
          return current.requestId === detail.requestId ? null : current;
        });
      }

      // Reconcile optimistic UI with the backend immediately for every transition.
      window.setTimeout(() => {
        void attention.refresh();
      }, 60);
    };

    window.addEventListener('stayos:guest-request-changed', handleGuestRequestChanged);

    return () => {
      window.removeEventListener('stayos:guest-request-changed', handleGuestRequestChanged);
    };
  }, [attention.refresh, attention.removeRequest, propertyId]);

  useEffect(() => {
    if (attention.isLoading) return;

    const activeIds = new Set(attention.items.map((item) => item.requestId));
    Object.keys(lastStateByRequestRef.current).forEach((requestId) => {
      if (!activeIds.has(requestId)) {
        delete lastStateByRequestRef.current[requestId];
      }
    });

    if (!initializedRef.current) {
      initializedRef.current = true;

      attention.items.forEach((item) => {
        lastStateByRequestRef.current[item.requestId] = item.attentionState;
      });

      if (attention.items.length > 1) {
        enqueuePopup({
          popupKey: `backlog:${propertyId ?? 'unknown'}`,
          count: attention.items.length,
          oldest: sortedItems[0],
        });
      } else if (attention.items.length === 1 && attention.items[0].severity === 'CRITICAL') {
        enqueuePopup({
          ...attention.items[0],
          popupKey: `${attention.items[0].requestId}:${attention.items[0].attentionState}`,
        });
      }

      return;
    }

    attention.items.forEach((item) => {
      const previousState = lastStateByRequestRef.current[item.requestId];

      if (!previousState || previousState !== item.attentionState) {
        enqueuePopup({
          ...item,
          popupKey: `${item.requestId}:${item.attentionState}`,
        });
      }

      lastStateByRequestRef.current[item.requestId] = item.attentionState;
    });
  }, [attention.isLoading, attention.items, enqueuePopup, propertyId, sortedItems]);

  useEffect(
    () => () => {
      clearPopupTimer();
      popupQueueRef.current = [];
    },
    [clearPopupTimer],
  );

  return (
    <>
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-end"
        width={390}
        shadow="md"
        withinPortal
      >
        <Popover.Target>
          <Box pos="relative">
            <Tooltip label="Attention Center">
              <ActionIcon
                visibleFrom="sm"
                variant={opened || attention.count > 0 ? 'light' : 'subtle'}
                color={
                  attention.criticalCount > 0 ? 'red' : attention.count > 0 ? 'yellow' : 'gray'
                }
                aria-label={`Attention Center${attention.count > 0 ? `, ${attention.count} items` : ''}`}
                size={34}
                onClick={() => setOpened((value) => !value)}
              >
                <Bell size={18} />
              </ActionIcon>
            </Tooltip>

            {attention.count > 0 ? (
              <Badge
                circle
                color={attention.criticalCount > 0 ? 'red' : 'stayosBrand'}
                size="xs"
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  right: -4,
                  top: -5,
                  zIndex: 2,
                }}
              >
                {attention.count > 9 ? '9+' : attention.count}
              </Badge>
            ) : null}
          </Box>
        </Popover.Target>

        <Popover.Dropdown p={0} style={{ borderRadius: 16, overflow: 'hidden' }}>
          <Group
            justify="space-between"
            p={14}
            style={{ borderBottom: '1px solid #eef1f6', background: '#fbfcff' }}
          >
            <Box>
              <Text c="#101828" fw={800} style={{ fontSize: 15 }}>
                Attention
              </Text>
              <Text c="#667085" mt={2} style={{ fontSize: 11.5 }}>
                StayOS is watching your time-sensitive guest services.
              </Text>
            </Box>
            {attention.count > 0 ? (
              <Badge color={attention.criticalCount > 0 ? 'red' : 'stayosBrand'} variant="light">
                {attention.count} active
              </Badge>
            ) : null}
          </Group>

          <ScrollArea.Autosize mah={440} type="hover" scrollbarSize={5}>
            <Stack gap={8} p={10}>
              {attention.isLoading ? (
                <Paper p={14} radius={12} bg="#f8fafc">
                  <Text c="#667085" size="sm">
                    Checking what needs attention...
                  </Text>
                </Paper>
              ) : attention.error && sortedItems.length === 0 ? (
                <Paper p={14} radius={12} bg="#fff7ed" bd="1px solid #fed7aa">
                  <Text c="#9a3412" size="sm" fw={700}>
                    Attention Center unavailable
                  </Text>
                  <Text c="#9a3412" mt={3} size="xs">
                    {attention.error}
                  </Text>
                  <Button
                    mt={10}
                    size="compact-xs"
                    variant="light"
                    color="orange"
                    onClick={() => void attention.refresh()}
                  >
                    Retry
                  </Button>
                </Paper>
              ) : sortedItems.length === 0 ? (
                <Paper p={18} radius={12} bg="#f0fdf4" bd="1px solid #bbf7d0">
                  <Group gap={10} wrap="nowrap">
                    <CheckCircle2 size={18} color="#16a34a" />
                    <Box>
                      <Text c="#166534" fw={800} size="sm">
                        Everything is under control
                      </Text>
                      <Text c="#4b7a59" mt={2} size="xs">
                        No guest-service reminders need attention right now.
                      </Text>
                    </Box>
                  </Group>
                </Paper>
              ) : (
                sortedItems.map((item) => {
                  const tone = attentionTone(item.severity);
                  const isTimeSensitive =
                    item.attentionState === 'DUE_SOON' || item.attentionState === 'OVERDUE';

                  return (
                    <UnstyledButton
                      key={item.requestId}
                      component={Link}
                      href={attentionHref(item)}
                      onClick={() => setOpened(false)}
                      style={{
                        background: tone.background,
                        border: `1px solid ${tone.border}`,
                        borderRadius: 13,
                        display: 'block',
                        padding: 12,
                        textAlign: 'left',
                        transition: 'transform 150ms ease, box-shadow 150ms ease',
                        width: '100%',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.transform = 'translateY(-1px)';
                        event.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.06)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.transform = 'translateY(0)';
                        event.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <Group justify="space-between" align="flex-start" gap={10} wrap="nowrap">
                        <Group gap={10} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Box
                            aria-hidden
                            style={{
                              alignItems: 'center',
                              background: '#ffffffaa',
                              borderRadius: 10,
                              color: tone.accent,
                              display: 'flex',
                              flex: '0 0 32px',
                              height: 32,
                              justifyContent: 'center',
                              width: 32,
                            }}
                          >
                            {isTimeSensitive ? <Clock3 size={16} /> : <AlertTriangle size={16} />}
                          </Box>

                          <Box style={{ minWidth: 0 }}>
                            <Group gap={6} wrap="wrap">
                              <Text c="#101828" fw={800} size="sm">
                                {item.title}
                              </Text>
                              {item.roomNumber ? (
                                <Text c="#475467" fw={700} size="xs">
                                  · Room {item.roomNumber}
                                </Text>
                              ) : null}
                            </Group>
                            <Text c="#667085" mt={3} size="xs" lineClamp={2}>
                              {item.message}
                            </Text>
                            <Text c="#667085" mt={5} size="xs" fw={600}>
                              {[item.guestDisplayName, item.assignedEmployeeName]
                                .filter(Boolean)
                                .join(' · ') || item.department}
                            </Text>
                          </Box>
                        </Group>

                        <Badge
                          color={tone.badge}
                          variant="light"
                          size="xs"
                          style={{ flex: '0 0 auto' }}
                        >
                          {attentionLabel(item.attentionState)}
                        </Badge>
                      </Group>
                    </UnstyledButton>
                  );
                })
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Popover.Dropdown>
      </Popover>

      {activePopup ? (
        <Box
          aria-live="polite"
          style={{
            bottom: 22,
            maxWidth: 'calc(100vw - 32px)',
            position: 'fixed',
            right: 22,
            width: 372,
            zIndex: 5000,
          }}
        >
          {'severity' in activePopup ? (
            (() => {
              const item = activePopup;
              const tone = attentionTone(item.severity);
              const isWakeUp = item.requestType === 'WAKE_UP_CALL';
              const isCritical = item.severity === 'CRITICAL';
              const scheduleLabel = isWakeUp ? wakeUpScheduleLabel(item.dueAt) : null;
              const headline = isWakeUp
                ? `Wake-up call${scheduleLabel ? ` · ${scheduleLabel}` : ''}`
                : item.attentionState === 'OVERDUE' && item.minutesOverdue !== null
                  ? `${item.title} overdue`
                  : item.attentionState === 'UNACKNOWLEDGED'
                    ? 'Guest is waiting'
                    : item.attentionState === 'SLA_BREACHED'
                      ? 'Service is delayed'
                      : item.attentionState === 'ESCALATED'
                        ? 'Needs attention now'
                        : item.title;

              const context = [
                item.roomNumber ? `Room ${item.roomNumber}` : null,
                item.guestDisplayName,
              ]
                .filter(Boolean)
                .join(' · ');

              const timing =
                item.minutesOverdue !== null
                  ? `${item.minutesOverdue} min overdue`
                  : item.minutesUntilDue !== null
                    ? item.minutesUntilDue <= 1
                      ? 'Due now'
                      : `Due in ${item.minutesUntilDue} min`
                    : attentionLabel(item.attentionState);

              return (
                <Paper
                  radius={18}
                  p={0}
                  shadow="lg"
                  style={{
                    animation: 'stayosAttentionEnter 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                    background: '#ffffff',
                    border: `1px solid ${isCritical ? tone.border : '#e8ecf3'}`,
                    boxShadow: isCritical
                      ? '0 18px 45px rgba(185, 28, 28, 0.18)'
                      : '0 18px 45px rgba(15, 23, 42, 0.13)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    style={{
                      background: isCritical ? tone.background : '#ffffff',
                      borderLeft: `4px solid ${tone.accent}`,
                      padding: '14px 14px 13px 15px',
                    }}
                  >
                    <Group align="flex-start" justify="space-between" gap={12} wrap="nowrap">
                      <Group align="flex-start" gap={11} wrap="nowrap" style={{ minWidth: 0 }}>
                        <Box
                          aria-hidden
                          style={{
                            alignItems: 'center',
                            background: tone.background,
                            border: `1px solid ${tone.border}`,
                            borderRadius: 12,
                            color: tone.accent,
                            display: 'flex',
                            flex: '0 0 38px',
                            height: 38,
                            justifyContent: 'center',
                            width: 38,
                          }}
                        >
                          {isWakeUp ||
                          ['DUE_SOON', 'OVERDUE', 'UPCOMING'].includes(item.attentionState) ? (
                            <Clock3 size={18} />
                          ) : (
                            <AlertTriangle size={18} />
                          )}
                        </Box>

                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={7} wrap="nowrap">
                            <Text
                              c="#101828"
                              lineClamp={1}
                              style={{
                                fontSize: 14.5,
                                fontWeight: 800,
                                letterSpacing: '-0.01em',
                                lineHeight: '19px',
                              }}
                            >
                              {headline}
                            </Text>
                            {isCritical ? (
                              <Badge
                                color="red"
                                size="xs"
                                variant="light"
                                style={{ flex: '0 0 auto' }}
                              >
                                Critical
                              </Badge>
                            ) : null}
                          </Group>

                          {context ? (
                            <Text
                              c="#344054"
                              lineClamp={1}
                              mt={4}
                              style={{ fontSize: 13, fontWeight: 700, lineHeight: '17px' }}
                            >
                              {context}
                            </Text>
                          ) : null}

                          <Group gap={7} mt={5} wrap="nowrap">
                            <Text
                              c={isCritical ? '#b42318' : '#667085'}
                              lineClamp={1}
                              style={{ fontSize: 11.5, fontWeight: 700, lineHeight: '15px' }}
                            >
                              {timing}
                            </Text>
                            <Text c="#98a2b3" style={{ fontSize: 11 }}>
                              ·
                            </Text>
                            <Text
                              c="#667085"
                              lineClamp={1}
                              style={{ fontSize: 11.5, fontWeight: 500, lineHeight: '15px' }}
                            >
                              {item.department.replaceAll('_', ' ')}
                            </Text>
                          </Group>
                        </Box>
                      </Group>

                      <ActionIcon
                        aria-label="Dismiss notification"
                        color="gray"
                        size={28}
                        variant="subtle"
                        onClick={dismissActivePopup}
                        style={{ flex: '0 0 auto' }}
                      >
                        <X size={15} />
                      </ActionIcon>
                    </Group>

                    <Group justify="space-between" align="center" mt={11}>
                      <Text
                        c="#98a2b3"
                        style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.01em' }}
                      >
                        StayOS · Guest Services
                      </Text>

                      <Button
                        component={Link}
                        href={attentionHref(item)}
                        color={isCritical ? 'red' : 'stayosBrand'}
                        variant={isCritical ? 'light' : 'subtle'}
                        size="compact-sm"
                        fw={700}
                        onClick={dismissActivePopup}
                      >
                        Open
                      </Button>
                    </Group>
                  </Box>
                </Paper>
              );
            })()
          ) : (
            <Paper
              radius={18}
              p={0}
              shadow="lg"
              style={{
                animation: 'stayosAttentionEnter 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                background: '#ffffff',
                border: '1px solid #e8ecf3',
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.13)',
                overflow: 'hidden',
              }}
            >
              <Box style={{ borderLeft: '4px solid #7c3aed', padding: '14px 14px 13px 15px' }}>
                <Group align="flex-start" justify="space-between" gap={12} wrap="nowrap">
                  <Group align="flex-start" gap={11} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Box
                      aria-hidden
                      style={{
                        alignItems: 'center',
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        borderRadius: 12,
                        color: '#7c3aed',
                        display: 'flex',
                        flex: '0 0 38px',
                        height: 38,
                        justifyContent: 'center',
                        width: 38,
                      }}
                    >
                      <Bell size={18} />
                    </Box>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        c="#101828"
                        lineClamp={1}
                        style={{ fontSize: 14.5, fontWeight: 800, lineHeight: '19px' }}
                      >
                        {activePopup.count} guest requests need attention
                      </Text>
                      <Text
                        c="#667085"
                        mt={4}
                        lineClamp={1}
                        style={{ fontSize: 12, fontWeight: 600, lineHeight: '16px' }}
                      >
                        {activePopup.oldest
                          ? `${activePopup.oldest.title}${activePopup.oldest.roomNumber ? ` · Room ${activePopup.oldest.roomNumber}` : ''}`
                          : 'Review your active guest-service reminders'}
                      </Text>
                      <Text
                        c="#98a2b3"
                        mt={4}
                        style={{ fontSize: 11.5, fontWeight: 500, lineHeight: '15px' }}
                      >
                        Open the Attention Center to review the backlog.
                      </Text>
                    </Box>
                  </Group>

                  <ActionIcon
                    aria-label="Dismiss notification"
                    color="gray"
                    size={28}
                    variant="subtle"
                    onClick={dismissActivePopup}
                  >
                    <X size={15} />
                  </ActionIcon>
                </Group>

                <Group justify="space-between" align="center" mt={11}>
                  <Text c="#98a2b3" style={{ fontSize: 10.5, fontWeight: 600 }}>
                    StayOS · Guest Services
                  </Text>
                  <Button
                    color="stayosBrand"
                    variant="subtle"
                    size="compact-sm"
                    fw={700}
                    onClick={() => {
                      dismissActivePopup();
                      setOpened(true);
                    }}
                  >
                    Review attention
                  </Button>
                </Group>
              </Box>
            </Paper>
          )}
        </Box>
      ) : null}

      <style>{`
        @keyframes stayosAttentionEnter {
          from {
            opacity: 0;
            transform: translate3d(18px, 8px, 0) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [aria-live='polite'] {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}

function TopHeader({
  workspaceTitle,
  propertyId,
  onOpenMobileMenu,
  utilityPanelOpen,
  utilityPanelAvailable,
  onToggleUtilityPanel,
}: {
  workspaceTitle: string;
  propertyId?: string;
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
          <GlobalSearch apiBaseUrl={apiBaseUrl()} propertyId={propertyId} />
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
          <AttentionCenter propertyId={propertyId} />
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

function UtilityPanel({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  if (pathname === '/') {
    return <FrontDeskUtilityPanel enabled={enabled} />;
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

function useFrontDeskUtilityData(enabled: boolean): FrontDeskUtilityState {
  const [state, setState] = useState<FrontDeskUtilityState>({
    isLoading: false,
    liveOperations: [],
    propertyStatus: emptyPropertyStatus,
    roomTotal: 0,
  });

  useEffect(() => {
    if (!enabled) return undefined;

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
  }, [enabled]);

  return state;
}

function FrontDeskUtilityPanel({ enabled }: { enabled: boolean }) {
  const utility = useFrontDeskUtilityData(enabled);
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
  propertyId,
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
  const utilityPanelAvailable =
    !pathname.startsWith('/rooms') && !pathname.startsWith('/housekeeping');
  const workspaceTitle = workspaceTitleForPath(pathname);

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
              propertyId={propertyId ?? user?.propertyId}
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
                overflowY: 'auto',
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
                <UtilityPanel enabled={utilityPanelAvailable && utilityPanelOpen} />
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
  propertyId,
  propertyName,
  user,
}: StayOSAppShellProps) {
  if (isPublicRoute) return <>{children}</>;

  return (
    <ProtectedStayOSAppShell
      navigationItems={navigationItems}
      onLockSession={onLockSession}
      onSignOut={onSignOut}
      propertyId={propertyId}
      propertyName={propertyName}
      user={user}
    >
      {children}
    </ProtectedStayOSAppShell>
  );
}
