import {
  assertHillstonGuestCounts,
  createHillstonGuestSimulationState,
  expectedHillstonGuests,
  hillstonGuestBootstrapData,
  simulateHillstonGuestBootstrap,
} from './bootstrap-guests';

describe('Hillston guest bootstrap plan', () => {
  it('has the expected guest seed data', () => {
    expect(hillstonGuestBootstrapData).toHaveLength(5);
    expect(hillstonGuestBootstrapData.filter((guest) => guest.vipStatus)).toHaveLength(2);
    expect(new Set(hillstonGuestBootstrapData.map((guest) => guest.phone)).size).toBe(5);
  });

  it('is idempotent when applied twice', () => {
    const state = createHillstonGuestSimulationState();
    const firstRun = simulateHillstonGuestBootstrap(state);
    const secondRun = simulateHillstonGuestBootstrap(state);

    expect(firstRun).toEqual(expectedHillstonGuests);
    expect(secondRun).toEqual(expectedHillstonGuests);
    expect(state.guests).toHaveLength(5);
  });

  it('rejects incorrect guest counts', () => {
    expect(() => assertHillstonGuestCounts({ ...expectedHillstonGuests, totalGuests: 6 })).toThrow(
      /Expected totalGuests to be 5/,
    );
  });
});
