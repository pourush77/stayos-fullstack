import type { RoomStatus, RoomTone } from '../types';

export function statusLabel(status: RoomStatus) {
  const labels: Record<RoomStatus, string> = {
    cleaning: 'Cleaning',
    dirty: 'Cleaning',
    inspection: 'Inspection',
    maintenance: 'Maintenance',
    occupied: 'Occupied',
    'out-of-order': 'Out Of Order',
    'out-of-service': 'Out Of Service',
    ready: 'Ready',
    reserved: 'Reserved',
    vacant: 'Vacant',
  };

  return labels[status];
}

export function statusTone(status: RoomStatus): RoomTone {
  if (status === 'ready') return { color: '#16a34a', background: '#f0fdf4', border: '#bbf7d0' };
  if (status === 'occupied') return { color: '#1d4ed8', background: '#dbeafe', border: '#bfdbfe' };
  if (status === 'cleaning' || status === 'dirty')
    return { color: '#d97706', background: '#fffbeb', border: '#fde68a' };
  if (status === 'inspection')
    return { color: '#ea580c', background: '#fff7ed', border: '#fed7aa' };
  if (status === 'maintenance' || status === 'out-of-order' || status === 'out-of-service')
    return { color: '#dc2626', background: '#fef2f2', border: '#fecaca' };
  if (status === 'reserved') return { color: '#6d5dfc', background: '#f5f3ff', border: '#ddd6fe' };
  return { color: '#64748b', background: '#f8fafc', border: '#e2e8f0' };
}

export function statusGroup(status: RoomStatus) {
  if (status === 'ready') return 'ready';
  if (status === 'occupied') return 'occupied';
  if (status === 'cleaning' || status === 'dirty' || status === 'inspection')
    return 'needs-cleaning';
  if (status === 'maintenance' || status === 'out-of-order' || status === 'out-of-service')
    return 'unavailable';
  if (status === 'vacant' || status === 'reserved') return 'vacant';
  return 'vacant';
}

export function mapStatus(value: string | undefined, fallback: RoomStatus = 'vacant'): RoomStatus {
  if (!value) return fallback;

  const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  if (['active', 'available', 'clean', 'vacant-ready', 'ready'].includes(normalized))
    return 'ready';
  if (['occupied', 'in-house', 'guest-staying', 'checked-in', 'checked-in-today'].includes(normalized))
    return 'occupied';
  if (['cleaning', 'waiting-guest'].includes(normalized)) return 'cleaning';
  if (['dirty', 'needs-cleaning', 'checkout-dirty', 'checked-out'].includes(normalized))
    return 'dirty';
  if (['inspection', 'inspect', 'pending-inspection'].includes(normalized)) return 'inspection';
  if (['maintenance', 'under-maintenance', 'repair'].includes(normalized)) return 'maintenance';
  if (['out-of-order', 'ooo'].includes(normalized)) return 'out-of-order';
  if (['out-of-service', 'oos', 'blocked'].includes(normalized)) return 'out-of-service';
  if (['reserved', 'held', 'vip-arrival', 'vip'].includes(normalized)) return 'reserved';
  return fallback;
}

export function mapOperationsStatus(
  value: string | undefined,
  fallback: RoomStatus = 'ready',
): RoomStatus {
  if (value === 'READY') return 'ready';
  if (value === 'OCCUPIED') return 'occupied';
  if (value === 'CHECKED_IN') return 'occupied';
  if (value === 'CHECKED_OUT') return 'dirty';
  if (value === 'CLEANING') return 'cleaning';
  if (value === 'MAINTENANCE') return 'maintenance';
  if (value === 'UNAVAILABLE') return 'out-of-service';

  return mapStatus(value, fallback);
}
