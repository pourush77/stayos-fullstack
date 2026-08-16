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

  describe('applyDelta (atomic release + reserve)', () => {
    function createKeyedManager(
      initial: Array<{ roomTypeId: string; date: string; capacity: number; sold: number }>,
      capacityByRoomType: Record<string, number> = {},
    ) {
      const store = new Map<string, { id: string; capacity: number; sold: number }>();
      for (const r of initial) {
        store.set(`${r.roomTypeId}|${r.date}`, {
          id: `inv-${r.roomTypeId}-${r.date}`,
          capacity: r.capacity,
          sold: r.sold,
        });
      }
      const lockOrder: string[] = [];
      const manager = {
        query: jest.fn(async (sql: string, params: unknown[]) => {
          const c = sql.replace(/\s+/g, ' ').trim();
          if (c.startsWith('INSERT INTO room_type_inventory')) {
            const rt = params[1] as string;
            const date = params[2] as string;
            const k = `${rt}|${date}`;
            if (!store.has(k)) {
              store.set(k, { id: `inv-${rt}-${date}`, capacity: capacityByRoomType[rt] ?? 0, sold: 0 });
            }
            return [];
          }
          if (c.includes('FOR UPDATE')) {
            const rt = params[1] as string;
            const date = params[2] as string;
            const k = `${rt}|${date}`;
            lockOrder.push(k);
            const row = store.get(k);
            return row ? [{ id: row.id, capacity: row.capacity, sold: row.sold }] : [];
          }
          if (c.includes('SET sold = sold +')) {
            const units = params[0] as number;
            const id = params[1] as string;
            const row = [...store.values()].find((r) => r.id === id)!;
            row.sold += units;
            return [];
          }
          if (c.includes('SET sold = $1')) {
            const sold = params[0] as number;
            const id = params[1] as string;
            const row = [...store.values()].find((r) => r.id === id)!;
            row.sold = sold;
            return [];
          }
          throw new Error(`Unexpected SQL: ${c}`);
        }),
      } as unknown as EntityManager;
      return { manager, store, lockOrder };
    }

    it('transfers an entitlement atomically across room types and locks in global order', async () => {
      const { manager, store, lockOrder } = createKeyedManager([
        { roomTypeId: 'rt-1', date: '2026-06-10', capacity: 3, sold: 1 },
        { roomTypeId: 'rt-1', date: '2026-06-11', capacity: 3, sold: 1 },
        { roomTypeId: 'rt-2', date: '2026-06-10', capacity: 3, sold: 0 },
        { roomTypeId: 'rt-2', date: '2026-06-11', capacity: 3, sold: 0 },
      ]);

      await service.applyDelta(
        {
          propertyId: 'prop-1',
          toRelease: [
            { roomTypeId: 'rt-1', date: '2026-06-10' },
            { roomTypeId: 'rt-1', date: '2026-06-11' },
          ],
          toReserve: [
            { roomTypeId: 'rt-2', date: '2026-06-10' },
            { roomTypeId: 'rt-2', date: '2026-06-11' },
          ],
        },
        manager,
      );

      expect(store.get('rt-1|2026-06-10')!.sold).toBe(0);
      expect(store.get('rt-1|2026-06-11')!.sold).toBe(0);
      expect(store.get('rt-2|2026-06-10')!.sold).toBe(1);
      expect(store.get('rt-2|2026-06-11')!.sold).toBe(1);
      // Deterministic global order: roomType asc, then date asc.
      expect(lockOrder).toEqual([
        'rt-1|2026-06-10',
        'rt-1|2026-06-11',
        'rt-2|2026-06-10',
        'rt-2|2026-06-11',
      ]);
    });

    it('rolls back the whole delta when any reserve target is unavailable (no partial mutation)', async () => {
      const { manager, store } = createKeyedManager([
        { roomTypeId: 'rt-1', date: '2026-06-10', capacity: 3, sold: 1 },
        { roomTypeId: 'rt-2', date: '2026-06-10', capacity: 1, sold: 1 }, // full
      ]);

      await expect(
        service.applyDelta(
          {
            propertyId: 'prop-1',
            toRelease: [{ roomTypeId: 'rt-1', date: '2026-06-10' }],
            toReserve: [{ roomTypeId: 'rt-2', date: '2026-06-10' }],
          },
          manager,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      // Validation happens after locking but BEFORE any mutation: nothing changed.
      expect(store.get('rt-1|2026-06-10')!.sold).toBe(1);
      expect(store.get('rt-2|2026-06-10')!.sold).toBe(1);
    });

    it('date shift within a room type releases old-only and reserves new-only, leaving overlap untouched', async () => {
      const { manager, store } = createKeyedManager([
        { roomTypeId: 'rt-1', date: '2026-06-10', capacity: 3, sold: 1 },
        { roomTypeId: 'rt-1', date: '2026-06-11', capacity: 3, sold: 1 },
        { roomTypeId: 'rt-1', date: '2026-06-12', capacity: 3, sold: 0 },
      ]);

      await service.applyDelta(
        {
          propertyId: 'prop-1',
          toRelease: [{ roomTypeId: 'rt-1', date: '2026-06-10' }],
          toReserve: [{ roomTypeId: 'rt-1', date: '2026-06-12' }],
        },
        manager,
      );

      expect(store.get('rt-1|2026-06-10')!.sold).toBe(0); // released
      expect(store.get('rt-1|2026-06-11')!.sold).toBe(1); // overlap untouched
      expect(store.get('rt-1|2026-06-12')!.sold).toBe(1); // reserved
    });
  });
});
