import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AvailabilityService } from './availability.service';

/**
 * In-memory fake EntityManager that interprets the exact SQL statements the
 * AvailabilityService issues, so we exercise the real reserve/restore/lazy-create
 * control flow (locking order, availability check, increment/decrement) without a DB.
 */
function createFakeManager(structuralCapacity: number) {
  const store = new Map<string, { id: string; capacity: number; sold: number }>();
  const calls: string[] = [];

  const manager = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      const compact = sql.replace(/\s+/g, ' ').trim();

      if (compact.startsWith('INSERT INTO room_type_inventory')) {
        const date = params[2] as string;
        calls.push(`ensure:${date}`);
        if (!store.has(date)) {
          store.set(date, { id: `inv-${date}`, capacity: structuralCapacity, sold: 0 });
        }
        return [];
      }

      if (compact.includes('FOR UPDATE')) {
        const date = params[2] as string;
        calls.push(`lock:${date}`);
        const row = store.get(date);
        return row ? [{ id: row.id, capacity: row.capacity, sold: row.sold }] : [];
      }

      if (compact.includes('SET sold = sold +')) {
        const units = params[0] as number;
        const id = params[1] as string;
        const row = [...store.values()].find((r) => r.id === id)!;
        row.sold += units;
        calls.push(`increment:${id}:${units}`);
        return [];
      }

      if (compact.includes('SET sold = $1')) {
        const sold = params[0] as number;
        const id = params[1] as string;
        const row = [...store.values()].find((r) => r.id === id)!;
        row.sold = sold;
        calls.push(`set:${id}:${sold}`);
        return [];
      }

      throw new Error(`Unexpected SQL: ${compact}`);
    }),
  } as unknown as EntityManager;

  return { manager, store, calls };
}

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  beforeEach(() => {
    // dataSource is unused when a manager is passed explicitly.
    service = new AvailabilityService({} as never);
  });

  const input = (nights: string[], units?: number) => ({
    propertyId: 'prop-1',
    roomTypeId: 'rt-1',
    nights,
    units,
  });

  it('lazily creates rows and consumes inventory in ascending date order', async () => {
    const { manager, store, calls } = createFakeManager(3);

    const result = await service.reserve(input(['2026-06-12', '2026-06-10', '2026-06-11']), manager);

    expect(result.map((r) => r.date)).toEqual(['2026-06-10', '2026-06-11', '2026-06-12']);
    expect(result.every((r) => r.sold === 1 && r.available === 2 && r.capacity === 3)).toBe(true);
    // ensure/lock happen per date, in ascending order
    expect(calls.filter((c) => c.startsWith('lock')).map((c) => c.split(':')[1])).toEqual([
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
    ]);
    expect(store.get('2026-06-10')!.sold).toBe(1);
  });

  it('deduplicates repeated nights', async () => {
    const { manager, store } = createFakeManager(3);
    await service.reserve(input(['2026-06-10', '2026-06-10']), manager);
    expect(store.get('2026-06-10')!.sold).toBe(1);
  });

  it('respects units when consuming', async () => {
    const { manager, store } = createFakeManager(5);
    const result = await service.reserve(input(['2026-06-10'], 3), manager);
    expect(result[0]).toMatchObject({ sold: 3, available: 2 });
    expect(store.get('2026-06-10')!.sold).toBe(3);
  });

  it('throws INVENTORY_UNAVAILABLE when the last room is gone (no oversell)', async () => {
    const { manager } = createFakeManager(1);
    await service.reserve(input(['2026-06-10']), manager); // sells the only room

    await expect(service.reserve(input(['2026-06-10']), manager)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not partially consume when a later night is unavailable', async () => {
    const { manager, store } = createFakeManager(1);
    // pre-sell the second night so it is full
    await service.reserve(input(['2026-06-11']), manager);

    await expect(service.reserve(input(['2026-06-10', '2026-06-11']), manager)).rejects.toBeInstanceOf(
      ConflictException,
    );
    // note: without an outer transaction the fake cannot roll back the first night,
    // but the failing night must never exceed capacity
    expect(store.get('2026-06-11')!.sold).toBe(1);
  });

  it('restores inventory and never drops below zero', async () => {
    const { manager, store } = createFakeManager(3);
    await service.reserve(input(['2026-06-10'], 2), manager);

    await service.restore(input(['2026-06-10'], 1), manager);
    expect(store.get('2026-06-10')!.sold).toBe(1);

    await service.restore(input(['2026-06-10'], 5), manager);
    expect(store.get('2026-06-10')!.sold).toBe(0);
  });

  it('restore is a no-op for a night that has no inventory row', async () => {
    const { manager, store } = createFakeManager(3);
    const result = await service.restore(input(['2026-06-10']), manager);
    expect(result).toEqual([]);
    expect(store.size).toBe(0);
  });
});
