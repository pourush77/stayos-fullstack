import {
  markRoomCleaning,
  markRoomInspection,
  markRoomMaintenance,
  markRoomOutOfOrder,
  markRoomOutOfService,
  markRoomReady,
} from '../../../lib/inventory-api';
import type { Room, RoomAction } from '../types';
import { hasAssignedBooking } from './room-helpers';

export function primaryAction(room: Room) {
  if (room.status === 'occupied') return 'Open Stay';

  if (room.status === 'reserved' || hasAssignedBooking(room)) return 'Check In';

  if (room.status === 'ready' || room.status === 'vacant') return 'Assign Guest';

  return 'View Details';
}

export function actionForPrimary(room: Room): RoomAction | undefined {
  if (room.status === 'occupied') return undefined;
  if (room.status === 'ready' || room.status === 'vacant' || room.status === 'reserved')
    return undefined;

  return undefined;
}

export function runRoomStatusAction(action: RoomAction, propertyId: string, roomId: string) {
  if (action === 'mark-ready') return markRoomReady(propertyId, roomId);
  if (action === 'start-cleaning') return markRoomCleaning(propertyId, roomId);
  if (action === 'inspection') return markRoomInspection(propertyId, roomId);
  if (action === 'maintenance') return markRoomMaintenance(propertyId, roomId);
  if (action === 'out-of-order') return markRoomOutOfOrder(propertyId, roomId);
  return markRoomOutOfService(propertyId, roomId);
}

export function roomActionKey(room: Room, action: RoomAction) {
  return `${room.number}-${action}`;
}
