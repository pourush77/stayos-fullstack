import type { CardStyle, FiltersState, InventoryState } from '../types';

export const cardStyle: CardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

export const emptyInventory: InventoryState = {
  floors: [],
  isFallback: false,
  isLoading: true,
  rooms: [],
};

export const defaultRoomFilters: FiltersState = {
  accessible: false,
  connecting: false,
  floor: 'all',
  housekeeping: 'all',
  maintenance: 'all',
  query: '',
  roomType: 'all',
  status: 'all',
  vip: false,
};
