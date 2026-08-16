import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { RoomStatus } from '../rooms/domain/room-status.enum';
import { computeAvailable, InventoryKey } from './domain/inventory-nights';

export interface AvailabilityDay {
  propertyId: string;
  roomTypeId: string;
  date: string;
  capacity: number;
  sold: number;
  available: number;
}

export interface InventoryMutationInput {
  propertyId: string;
  roomTypeId: string;
  nights: string[];
  units?: number;
}

/**
 * A combined release+reserve applied atomically. Used for date/roomType
 * mutations where an entitlement moves between (roomType, date) keys.
 */
export interface InventoryDeltaInput {
  propertyId: string;
  toRelease: InventoryKey[];
  toReserve: InventoryKey[];
  units?: number;
}

/**
 * Standalone availability engine — the authoritative, transactional source of
 * truth for date/room-type availability.
 *
 * IMPORTANT: This service is intentionally NOT wired into the reservation
 * lifecycle in this slice. `reserve`/`restore` are safe building blocks for a
 * later phase; they use deterministic ascending-by-date `SELECT ... FOR UPDATE`
 * locking to avoid deadlocks and are concurrency-safe on lazy row creation.
 */
@Injectable()
export class AvailabilityService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Read availability across a half-open window [startDate, endDate).
   * Rows that do not yet exist are reported at full structural capacity with
   * sold = 0 (never persisted here — reads never mutate).
   */
  async read(
    propertyId: string,
    roomTypeId: string,
    startDate: string,
    endDate: string,
  ): Promise<AvailabilityDay[]> {
    const rows: Array<{ date: string; capacity: number; sold: number }> = await this.dataSource.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, capacity, sold
       FROM room_type_inventory
       WHERE property_id = $1 AND room_type_id = $2 AND date >= $3::date AND date < $4::date
       ORDER BY date ASC`,
      [propertyId, roomTypeId, startDate, endDate],
    );

    const stored = new Map(rows.map((r) => [r.date, r]));
    const capacityFallback = await this.structuralCapacity(this.dataSource.manager, propertyId, roomTypeId);

    const result: AvailabilityDay[] = [];
    const start = Date.parse(`${startDate}T00:00:00.000Z`);
    const end = Date.parse(`${endDate}T00:00:00.000Z`);
    for (let t = start; t < end; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      const row = stored.get(date);
      const capacity = row ? Number(row.capacity) : capacityFallback;
      const sold = row ? Number(row.sold) : 0;
      result.push({ propertyId, roomTypeId, date, capacity, sold, available: computeAvailable(capacity, sold) });
    }
    return result;
  }

  /**
   * Consume `units` of inventory for each night. Runs in the supplied manager's
   * transaction, or opens its own if none is given.
   */
  async reserve(input: InventoryMutationInput, manager?: EntityManager): Promise<AvailabilityDay[]> {
    return this.inTransaction(manager, (em) => this.reserveWithin(em, input));
  }

  /**
   * Release `units` of inventory for each night. Clamps at 0 (never negative).
   */
  async restore(input: InventoryMutationInput, manager?: EntityManager): Promise<AvailabilityDay[]> {
    return this.inTransaction(manager, (em) => this.restoreWithin(em, input));
  }

  /**
   * Apply an atomic release+reserve delta (date / roomType mutation).
   *
   * Locks EVERY affected (roomType, date) key — release and reserve alike — in
   * one deterministic global order (roomType asc, then date asc) BEFORE mutating
   * anything, so concurrent mutations can never deadlock. After all locks are
   * held it validates that every reserve key has capacity; if any is short it
   * throws INVENTORY_UNAVAILABLE and the caller's transaction rolls back both
   * the reservation change and all inventory changes — the original entitlement
   * survives intact. Only then are releases decremented and reserves incremented.
   */
  async applyDelta(input: InventoryDeltaInput, manager?: EntityManager): Promise<void> {
    return this.inTransaction(manager, (em) => this.applyDeltaWithin(em, input));
  }

  private async applyDeltaWithin(em: EntityManager, input: InventoryDeltaInput): Promise<void> {
    const units = input.units ?? 1;
    const reserveKeySet = new Set(input.toReserve.map((k) => `${k.roomTypeId}|${k.date}`));

    // Deterministic global lock order across property + roomType + date.
    const allKeys = [...input.toRelease, ...input.toReserve].sort((a, b) =>
      a.roomTypeId === b.roomTypeId
        ? a.date.localeCompare(b.date)
        : a.roomTypeId.localeCompare(b.roomTypeId),
    );

    const locked = new Map<string, { id: string; capacity: number; sold: number }>();
    for (const key of allKeys) {
      const mapKey = `${key.roomTypeId}|${key.date}`;
      if (locked.has(mapKey)) continue;
      if (reserveKeySet.has(mapKey)) {
        await this.ensureRow(em, input.propertyId, key.roomTypeId, key.date);
      }
      const row = await this.lockRow(em, input.propertyId, key.roomTypeId, key.date);
      if (row) locked.set(mapKey, row);
    }

    // Validate ALL reserve keys before mutating anything.
    for (const key of input.toReserve) {
      const row = locked.get(`${key.roomTypeId}|${key.date}`);
      const available = row ? computeAvailable(row.capacity, row.sold) : 0;
      if (available < units) {
        throw new ConflictException({
          code: ApiErrorCode.INVENTORY_UNAVAILABLE,
          message: `Insufficient inventory for room type ${key.roomTypeId} on ${key.date}: requested ${units}, available ${available}`,
        });
      }
    }

    for (const key of input.toRelease) {
      const row = locked.get(`${key.roomTypeId}|${key.date}`);
      if (!row) continue;
      const sold = Math.max(0, row.sold - units);
      await em.query(`UPDATE room_type_inventory SET sold = $1, updated_at = now() WHERE id = $2`, [
        sold,
        row.id,
      ]);
    }

    for (const key of input.toReserve) {
      const row = locked.get(`${key.roomTypeId}|${key.date}`)!;
      await em.query(
        `UPDATE room_type_inventory SET sold = sold + $1, updated_at = now() WHERE id = $2`,
        [units, row.id],
      );
    }
  }

  private async reserveWithin(em: EntityManager, input: InventoryMutationInput): Promise<AvailabilityDay[]> {
    const units = input.units ?? 1;
    const nights = this.orderedNights(input.nights);
    const result: AvailabilityDay[] = [];

    for (const date of nights) {
      await this.ensureRow(em, input.propertyId, input.roomTypeId, date);
      const row = await this.lockRow(em, input.propertyId, input.roomTypeId, date);
      if (!row) {
        throw new ConflictException({
          code: ApiErrorCode.INVENTORY_UNAVAILABLE,
          message: `Inventory row for room type ${input.roomTypeId} on ${date} could not be acquired`,
        });
      }
      const available = computeAvailable(row.capacity, row.sold);
      if (available < units) {
        throw new ConflictException({
          code: ApiErrorCode.INVENTORY_UNAVAILABLE,
          message: `Insufficient inventory for room type ${input.roomTypeId} on ${date}: requested ${units}, available ${available}`,
        });
      }
      await em.query(
        `UPDATE room_type_inventory SET sold = sold + $1, updated_at = now() WHERE id = $2`,
        [units, row.id],
      );
      const sold = row.sold + units;
      result.push({
        propertyId: input.propertyId,
        roomTypeId: input.roomTypeId,
        date,
        capacity: row.capacity,
        sold,
        available: computeAvailable(row.capacity, sold),
      });
    }
    return result;
  }

  private async restoreWithin(em: EntityManager, input: InventoryMutationInput): Promise<AvailabilityDay[]> {
    const units = input.units ?? 1;
    const nights = this.orderedNights(input.nights);
    const result: AvailabilityDay[] = [];

    for (const date of nights) {
      const row = await this.lockRow(em, input.propertyId, input.roomTypeId, date);
      if (!row) continue;
      const sold = Math.max(0, row.sold - units);
      await em.query(
        `UPDATE room_type_inventory SET sold = $1, updated_at = now() WHERE id = $2`,
        [sold, row.id],
      );
      result.push({
        propertyId: input.propertyId,
        roomTypeId: input.roomTypeId,
        date,
        capacity: row.capacity,
        sold,
        available: computeAvailable(row.capacity, sold),
      });
    }
    return result;
  }

  /**
   * Concurrency-safe lazy creation. Two simultaneous callers racing to create
   * the same (property, roomType, date) row are serialized by the unique index:
   * ON CONFLICT DO NOTHING makes exactly one win, and the subsequent
   * SELECT ... FOR UPDATE always observes the winning row (blocking until it
   * commits) — a duplicate-key error never surfaces to the caller.
   */
  private async ensureRow(
    em: EntityManager,
    propertyId: string,
    roomTypeId: string,
    date: string,
  ): Promise<void> {
    await em.query(
      `INSERT INTO room_type_inventory (property_id, room_type_id, date, capacity, sold)
       SELECT $1, $2, $3::date,
              (SELECT COUNT(*)::int FROM rooms WHERE property_id = $1 AND room_type_id = $2 AND status = $4),
              0
       ON CONFLICT (property_id, room_type_id, date) DO NOTHING`,
      [propertyId, roomTypeId, date, RoomStatus.ACTIVE],
    );
  }

  private async lockRow(
    em: EntityManager,
    propertyId: string,
    roomTypeId: string,
    date: string,
  ): Promise<{ id: string; capacity: number; sold: number } | null> {
    const rows: Array<{ id: string; capacity: number; sold: number }> = await em.query(
      `SELECT id, capacity, sold FROM room_type_inventory
       WHERE property_id = $1 AND room_type_id = $2 AND date = $3::date
       FOR UPDATE`,
      [propertyId, roomTypeId, date],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, capacity: Number(row.capacity), sold: Number(row.sold) };
  }

  private async structuralCapacity(
    em: EntityManager,
    propertyId: string,
    roomTypeId: string,
  ): Promise<number> {
    const rows: Array<{ capacity: number }> = await em.query(
      `SELECT COUNT(*)::int AS capacity FROM rooms
       WHERE property_id = $1 AND room_type_id = $2 AND status = $3`,
      [propertyId, roomTypeId, RoomStatus.ACTIVE],
    );
    return Number(rows[0]?.capacity ?? 0);
  }

  private orderedNights(nights: string[]): string[] {
    return [...new Set(nights)].sort();
  }

  private inTransaction<T>(
    manager: EntityManager | undefined,
    fn: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (manager) return fn(manager);
    return this.dataSource.transaction((em) => fn(em));
  }
}
