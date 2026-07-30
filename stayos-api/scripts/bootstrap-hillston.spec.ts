import {
  assertInventoryCounts,
  createHillstonSimulationState,
  expectedHillstonInventory,
  hillstonBootstrapData,
  simulateHillstonBootstrap,
} from './bootstrap-hillston';

describe('Hillston bootstrap plan', () => {
  it('has the expected inventory counts', () => {
    expect(hillstonBootstrapData.floors).toHaveLength(2);
    expect(hillstonBootstrapData.roomTypes).toHaveLength(2);
    expect(hillstonBootstrapData.rooms).toHaveLength(24);
    expect(hillstonBootstrapData.rooms.filter((room) => room.roomTypeCode === 'DLX')).toHaveLength(
      20,
    );
    expect(hillstonBootstrapData.rooms.filter((room) => room.roomTypeCode === 'STE')).toHaveLength(
      4,
    );
  });

  it('is idempotent when applied twice', () => {
    const state = createHillstonSimulationState();
    const firstRun = simulateHillstonBootstrap(state);
    const secondRun = simulateHillstonBootstrap(state);

    expect(firstRun).toEqual(expectedHillstonInventory);
    expect(secondRun).toEqual(expectedHillstonInventory);
    expect(state.properties).toHaveLength(1);
    expect(state.floors).toHaveLength(2);
    expect(state.roomTypes).toHaveLength(2);
    expect(state.rooms).toHaveLength(24);
  });

  it('rejects incorrect inventory counts', () => {
    expect(() => assertInventoryCounts({ ...expectedHillstonInventory, rooms: 23 })).toThrow(
      /Expected rooms to be 24/,
    );
  });
});
