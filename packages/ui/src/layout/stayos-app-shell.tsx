'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ActionIcon,
  AppShell as MantineAppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Divider,
  Drawer,
  Group,
  Menu,
  NavLink,
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
  Bell,
  BedDouble,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Menu as MenuIcon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { animations, brandPalettes, colors, radius, shadows, spacing, typography, zIndex } from '@stayos/theme';
import { OperationalTaskCard } from '../components/operational-task-card';
import { useBackendStatus, type BackendConnectionStatus } from '../connectivity/backend-connectivity';
import { getTasksForPath } from '../operations/task-engine';
import { SearchInput } from '../components/search-input';
import { mobileNavigation, primaryNavigation } from './navigation';
import { ShellContent } from './shell-content';

type StayOSAppShellProps = {
  children: ReactNode;
};

const fallbackPropertyName = 'Hillston Resort & Club';
const userName = 'Aarav Mehta';

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

function useActivePropertyName() {
  const [propertyName, setPropertyName] = useState(fallbackPropertyName);

  useEffect(() => {
    const controller = new AbortController();
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

    fetch(`${apiBaseUrl}/properties`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load active property.');
        return response.json() as Promise<unknown>;
      })
      .then((response) => {
        const activeProperty = getPropertyList(response).find((property) => getPropertyStatus(property) === 'ACTIVE');
        const name = getPropertyName(activeProperty);
        if (name) setPropertyName(name);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      });

    return () => controller.abort();
  }, []);

  return propertyName;
}

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Group gap={spacing[3]} wrap="nowrap">
      <Box
        aria-hidden
        style={{
          width: 34,
          height: 34,
          flex: '0 0 34px',
          borderRadius: radius.md,
          background: colors.brand[500],
          boxShadow: shadows.xs,
        }}
      />
      {!collapsed ? (
        <Box style={{ overflow: 'hidden' }}>
          <Title order={2} c={colors.text.strong} style={typography.styles.h3}>
            StayOS
          </Title>
          <Text c={colors.text.muted} lineClamp={1} style={typography.styles.caption}>
            Hospitality Operating System
          </Text>
        </Box>
      ) : null}
    </Group>
  );
}

function PropertySelector({ collapsed = false, propertyName }: { collapsed?: boolean; propertyName: string }) {
  if (collapsed) {
    return (
      <Tooltip label={propertyName} position="right">
        <ActionIcon variant="light" color="stayosBrand" size="lg" aria-label="Current property">
          <Building2 size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Menu width={240} position="bottom-start" shadow="sm">
      <Menu.Target>
        <UnstyledButton
          aria-label="Select property"
          style={{
            width: '100%',
            border: `1px solid ${colors.border.subtle}`,
            borderRadius: radius.md,
            padding: spacing[3],
            background: colors.surface.base,
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap={spacing[3]} wrap="nowrap">
              <Avatar radius={radius.md} color="stayosBrand" variant="light" size={34}>
                <Building2 size={16} />
              </Avatar>
              <Box style={{ minWidth: 0 }}>
                <Text c={colors.text.strong} lineClamp={1} style={typography.styles.label}>
                  {propertyName}
                </Text>
                <Text c={colors.text.muted} lineClamp={1} style={typography.styles.caption}>
                  Active property
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

function NavigationList({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <Stack gap={spacing[1]}>
      {primaryNavigation.map((item) => {
        const isActive =
          item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Tooltip key={item.label} label={item.label} position="right" disabled={!collapsed}>
            <NavLink
              aria-label={item.label}
              component={Link}
              href={item.href}
              label={collapsed ? null : item.label}
              leftSection={<item.icon size={18} />}
              active={isActive}
              color="stayosBrand"
              styles={{
                root: {
                  position: 'relative',
                  minHeight: 42,
                  borderRadius: radius.md,
                  color: colors.text.body,
                  fontWeight: typography.weights.medium,
                  transition: `background ${animations.duration.fast} ${animations.easing.standard}, color ${animations.duration.fast} ${animations.easing.standard}, transform ${animations.duration.fast} ${animations.easing.standard}`,
                },
                section: {
                  marginInlineEnd: collapsed ? 0 : spacing[3],
                },
                body: {
                  display: collapsed ? 'none' : undefined,
                },
              }}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}

function UserProfile({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Group justify={collapsed ? 'center' : 'space-between'} wrap="nowrap">
      <Group gap={spacing[3]} wrap="nowrap">
        <Avatar color="stayosBrand" radius="xl" size={34}>
          AM
        </Avatar>
        {!collapsed ? (
          <Box style={{ minWidth: 0 }}>
            <Text c={colors.text.strong} lineClamp={1} style={typography.styles.label}>
              {userName}
            </Text>
            <Text c={colors.text.muted} lineClamp={1} style={typography.styles.caption}>
              Front office
            </Text>
          </Box>
        ) : null}
      </Group>
      {!collapsed ? (
        <ActionIcon variant="subtle" color="gray" aria-label="User menu">
          <ChevronDown size={16} />
        </ActionIcon>
      ) : null}
    </Group>
  );
}

function GlobalSearch() {
  const [opened, setOpened] = useState(false);

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
    <Popover opened={opened} onChange={setOpened} width={440} position="bottom" shadow="md">
      <Popover.Target>
        <SearchInput
          visibleFrom="md"
          w={{ md: 360, lg: 440 }}
          leftSection={<Search size={16} />}
          placeholder="Search reservations, guests, rooms"
          aria-label="Global search"
          onFocus={() => setOpened(true)}
          onBlur={() => window.setTimeout(() => setOpened(false), 150)}
        />
      </Popover.Target>
      <Popover.Dropdown p={spacing[2]}>
        <Text c={colors.text.muted} px={spacing[2]} py={spacing[1]} style={typography.styles.caption}>
          Dummy results
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
  onToggleCollapse,
  propertyName,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  propertyName: string;
}) {
  return (
    <Stack h="100%" gap={spacing[5]} p={collapsed ? spacing[3] : spacing[5]}>
      <Group justify={collapsed ? 'center' : 'space-between'} wrap="nowrap">
        <BrandMark collapsed={collapsed} />
        {!collapsed ? (
          <Tooltip label="Collapse sidebar">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft size={18} />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </Group>

      {collapsed ? (
        <Tooltip label="Expand sidebar" position="right">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
          >
            <ChevronsRight size={18} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      <PropertySelector collapsed={collapsed} propertyName={propertyName} />
      {!collapsed ? (
        <SearchInput aria-label="Search navigation" placeholder="Search StayOS" />
      ) : null}
      <Divider color={colors.border.subtle} />

      <ScrollArea flex={1} type="auto">
        <NavigationList collapsed={collapsed} />
      </ScrollArea>

      <Divider color={colors.border.subtle} />
      <UserProfile collapsed={collapsed} />
    </Stack>
  );
}

function TopHeader({
  onOpenMobileMenu,
  propertyName,
  utilityPanelOpen,
  onToggleUtilityPanel,
}: {
  onOpenMobileMenu: () => void;
  propertyName: string;
  utilityPanelOpen: boolean;
  onToggleUtilityPanel: () => void;
}) {
  const { status } = useBackendStatus();
  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }).format(new Date()),
    [],
  );

  return (
    <Group h="100%" px={{ base: spacing[4], md: spacing[6] }} justify="space-between" wrap="nowrap">
      <Group gap={spacing[3]} wrap="nowrap" style={{ minWidth: 0 }}>
        <Burger
          hiddenFrom="md"
          opened={false}
          onClick={onOpenMobileMenu}
          size="sm"
          aria-label="Open menu"
        />
        <Box visibleFrom="sm">
          <Text c={colors.text.strong} style={typography.styles.label}>
            {propertyName}
          </Text>
          <Text c={colors.text.muted} style={typography.styles.caption}>
            {currentDate}
          </Text>
        </Box>
      </Group>

      <GlobalSearch />

      <Group gap={spacing[2]} wrap="nowrap">
        <ConnectionIndicator status={status} />
        <Button
          visibleFrom="sm"
          leftSection={<Plus size={16} />}
          color="stayosBrand"
          variant="filled"
        >
          Quick action
        </Button>
        <Tooltip label="Notifications">
          <ActionIcon variant="subtle" color="gray" aria-label="Notifications">
            <Bell size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={utilityPanelOpen ? 'Hide utility panel' : 'Show utility panel'}>
          <ActionIcon
            visibleFrom="lg"
            variant={utilityPanelOpen ? 'light' : 'subtle'}
            color="stayosBrand"
            onClick={onToggleUtilityPanel}
            aria-label="Toggle utility panel"
          >
            {utilityPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </ActionIcon>
        </Tooltip>
        <Avatar visibleFrom="sm" color="stayosBrand" radius="xl" size={34}>
          AM
        </Avatar>
      </Group>
    </Group>
  );
}

function connectionIndicatorMeta(status: BackendConnectionStatus) {
  if (status === 'ONLINE') {
    return { background: colors.brand[50], color: colors.semantic.success, label: 'StayOS Connected' };
  }

  if (status === 'CONNECTING') {
    return { background: brandPalettes.gold[50], color: colors.semantic.warning, label: 'Connecting...' };
  }

  if (status === 'SERVER_STARTING') {
    return { background: colors.surface.subtle, color: colors.text.muted, label: 'Server Starting' };
  }

  return {
    background: `color-mix(in srgb, ${colors.semantic.danger} 9%, ${colors.surface.base})`,
    color: colors.semantic.danger,
    label: 'StayOS Offline',
  };
}

function ConnectionIndicator({ status }: { status: BackendConnectionStatus }) {
  const meta = connectionIndicatorMeta(status);

  return (
    <Group
      visibleFrom="sm"
      gap={spacing[2]}
      px={spacing[3]}
      h={34}
      style={{
        background: meta.background,
        border: `1px solid ${colors.border.subtle}`,
        borderRadius: radius.full,
      }}
      wrap="nowrap"
    >
      <Box
        aria-hidden
        style={{
          background: meta.color,
          borderRadius: radius.full,
          height: 9,
          width: 9,
        }}
      />
      <Text c={colors.text.strong} style={typography.styles.caption}>
        {meta.label}
      </Text>
    </Group>
  );
}

function UtilityPanel() {
  const pathname = usePathname();

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

function MobileDrawer({ opened, onClose, propertyName }: { opened: boolean; onClose: () => void; propertyName: string }) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<BrandMark />}
      size="min(90vw, 340px)"
      zIndex={zIndex.drawer}
    >
      <Sidebar collapsed={false} onToggleCollapse={onClose} propertyName={propertyName} />
    </Drawer>
  );
}

function MobileBottomNav({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname();

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
      {mobileNavigation.map((item) => (
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

export function StayOSAppShell({ children }: StayOSAppShellProps) {
  const [mobileMenuOpened, { open: openMobileMenu, close: closeMobileMenu }] = useDisclosure(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [utilityPanelOpen, setUtilityPanelOpen] = useState(true);
  const propertyName = useActivePropertyName();
  const sidebarWidth = sidebarCollapsed ? 84 : 292;

  return (
    <>
      <MantineAppShell
        header={{ height: 68 }}
        navbar={{
          width: sidebarWidth,
          breakpoint: 'md',
          collapsed: { mobile: true },
        }}
        aside={{
          width: 320,
          breakpoint: 'lg',
          collapsed: { desktop: !utilityPanelOpen, mobile: true },
        }}
        padding={0}
        bg={colors.surface.app}
      >
        <MantineAppShell.Header bg={colors.surface.base} bd={`1px solid ${colors.border.subtle}`}>
          <TopHeader
            onOpenMobileMenu={openMobileMenu}
            propertyName={propertyName}
            utilityPanelOpen={utilityPanelOpen}
            onToggleUtilityPanel={() => setUtilityPanelOpen((value) => !value)}
          />
        </MantineAppShell.Header>

        <MantineAppShell.Navbar
          visibleFrom="md"
          bg={colors.surface.base}
          bd={`1px solid ${colors.border.subtle}`}
          style={{
            transition: `width ${animations.duration.slow} ${animations.easing.standard}`,
          }}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
            propertyName={propertyName}
          />
        </MantineAppShell.Navbar>

        <MantineAppShell.Main>
          <ScrollArea h="calc(100vh - 68px)" type="auto">
            <ShellContent>{children}</ShellContent>
          </ScrollArea>
        </MantineAppShell.Main>

        <MantineAppShell.Aside
          visibleFrom="lg"
          bg={colors.surface.base}
          bd={`1px solid ${colors.border.subtle}`}
        >
          <UtilityPanel />
        </MantineAppShell.Aside>
      </MantineAppShell>

      <MobileDrawer opened={mobileMenuOpened} onClose={closeMobileMenu} propertyName={propertyName} />
      <MobileBottomNav onOpen={openMobileMenu} />
    </>
  );
}
