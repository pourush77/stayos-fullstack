import type { RoomTypeOption } from '../types/booking.types';

export function roomCapacityMessage(
  roomType: RoomTypeOption,
  adults: number,
  children: number,
) {
  if (adults > roomType.maxAdults) {
    return `${roomType.label} allows up to ${roomType.maxAdults} adult${roomType.maxAdults === 1 ? '' : 's'}.`;
  }

  if (children > roomType.maxChildren) {
    return `${roomType.label} allows up to ${roomType.maxChildren} child${roomType.maxChildren === 1 ? '' : 'ren'}.`;
  }

  if (adults + children > roomType.maxOccupancy) {
    return `${roomType.label} accommodates up to ${roomType.maxOccupancy} guest${roomType.maxOccupancy === 1 ? '' : 's'}. Reduce the number of guests or choose another room type.`;
  }

  return undefined;
}

export function roomCapacityLabel(roomType: RoomTypeOption) {
  return `Max ${roomType.maxAdults}A / ${roomType.maxChildren}C`;
}
