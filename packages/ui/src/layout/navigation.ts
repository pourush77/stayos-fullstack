import {
  BarChart3,
  BedDouble,
  CalendarDays,
  CreditCard,
  Hotel,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ShellNavigationItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
};

export const primaryNavigation: ShellNavigationItem[] = [
  { label: 'Front Desk', icon: Hotel, href: '/', active: true },
  { label: 'Reservations', icon: CalendarDays, href: '/reservations' },
  { label: 'Rooms', icon: BedDouble, href: '/rooms' },
  { label: 'Guests', icon: Users, href: '/guests' },
  { label: 'Requests', icon: MessageSquare, href: '/requests' },
  { label: 'Housekeeping', icon: Sparkles, href: '/housekeeping' },
  { label: 'Billing', icon: CreditCard, href: '/billing' },
  { label: 'Reports', icon: BarChart3, href: '/reports' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export const mobileNavigation: ShellNavigationItem[] = [
  { label: 'Front Desk', icon: Hotel, href: '/', active: true },
  { label: 'Reservations', icon: CalendarDays, href: '/reservations' },
  { label: 'Rooms', icon: BedDouble, href: '/rooms' },
  { label: 'Guests', icon: Users, href: '/guests' },
  { label: 'Requests', icon: MessageSquare, href: '/requests' },
];
