import { useMemo } from 'react';
import type { FiltersState, Room } from '../types';
import { groupRoomsByFloor, roomMatches, sortRoomLabels } from '../utils';

export function useRoomFilters(rooms: Room[], filters: FiltersState) {
  const floors = useMemo(
    () => sortRoomLabels(Array.from(new Set(rooms.map((room) => room.floor)))),
    [rooms],
  );
  const roomTypes = useMemo(
    () => sortRoomLabels(Array.from(new Set(rooms.map((room) => room.roomType)))),
    [rooms],
  );
  const filteredRooms = useMemo(
    () => rooms.filter((room) => roomMatches(room, filters)),
    [rooms, filters],
  );
  const groupedRooms = useMemo(
    () => groupRoomsByFloor(filteredRooms, filters.floor === 'all' ? floors : [filters.floor]),
    [filteredRooms, filters.floor, floors],
  );
  const selectedRoomAttributes = useMemo(
    () =>
      [
        filters.vip ? 'vip' : undefined,
        filters.accessible ? 'accessible' : undefined,
        filters.connecting ? 'connecting' : undefined,
      ].filter(Boolean) as string[],
    [filters.accessible, filters.connecting, filters.vip],
  );

  return {
    filteredRooms,
    floors,
    groupedRooms,
    isDatasetFiltered: filteredRooms.length !== rooms.length,
    roomTypes,
    selectedRoomAttributes,
  };
}
