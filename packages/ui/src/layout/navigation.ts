import {
  BarChart3,
  BedDouble,
  CalendarDays,
  Home,
  Activity,
  ReceiptText,
  ShoppingBag,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ShellNavigationItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
  badge?: string;
};

export const primaryNavigation: ShellNavigationItem[] = [
  { label: 'Front Desk', icon: Home, href: '/', active: true },
  { label: 'Bookings', icon: CalendarDays, href: '/reservations' },
  { label: 'Rooms', icon: BedDouble, href: '/rooms' },
  { label: 'Guests', icon: Users, href: '/guests' },
  { label: 'Housekeeping', icon: Activity, href: '/housekeeping', badge: '4' },
  { label: 'Billing', icon: ReceiptText, href: '/billing', badge: '2' },
  { label: 'Reports', icon: BarChart3, href: '/reports' },
  { label: 'Marketplace', icon: ShoppingBag, href: '/marketplace' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export const mobileNavigation: ShellNavigationItem[] = [
  { label: 'Front Desk', icon: Home, href: '/', active: true },
  { label: 'Reservations', icon: CalendarDays, href: '/reservations' },
  { label: 'Rooms', icon: BedDouble, href: '/rooms' },
  { label: 'Guests', icon: Users, href: '/guests' },
  { label: 'Housekeeping', icon: Activity, href: '/housekeeping' },
];
