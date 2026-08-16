import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type InventoryDiscrepancyType =
  | 'MISSING_ROW'
  | 'ORPHAN_SOLD'
  | 'SOLD_MISMATCH'
  | 'CAPACITY_MISMATCH'
  | 'OVERSELL';

export interface InventoryDiscrepancy {
  propertyId: string;
  roomTypeId: string;
  date: string;
  type: InventoryDiscrepancyType;
  expectedSold: number;
  storedSold: number | null;
  expectedCapacity: number;
  storedCapacity: number | null;
}

export interface ReconciliationResult {
  consistent: boolean;
  discrepancies: InventoryDiscrepancy[];
  countsByType: Record<InventoryDiscrepancyType, number>;
}

interface ReconciliationRow {
  property_id: string;
  room_type_id: string;
  date: string;
  expected_sold: number;
  stored_sold: number | null;
  expected_capacity: number;
  stored_capacity: number | null;
}

/**
 * Recomputes the expected inventory ledger from inventory-consuming
 * reservations (PENDING/CONFIRMED/CHECKED_IN) + structural room counts and
 * compares it to the persisted `room_type_inventory` rows.
 *
 * It never mutates data — it only reports drift so operators can decide.
 * OVERSELL rows (expected_sold > structural capacity) are surfaced explicitly
 * rather than being clamped or silently corrected.
 */
@Injectable()
export class InventoryReconciliationService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async reconcile(propertyId?: string): Promise<ReconciliationResult> {
    const filter = propertyId ? 'AND property_id = $1' : '';
    const params = propertyId ? [propertyId] : [];

    const rows: ReconciliationRow[] = await this.dataSource.query(
      `
      WITH consuming AS (
        SELECT property_id, room_type_id, arrival_date, departure_date
        FROM reservations
        WHERE status IN ('PENDING','CONFIRMED','CHECKED_IN') ${filter}
      ),
      nights AS (
        SELECT property_id, room_type_id,
               generate_series(arrival_date::date, departure_date::date - INTERVAL '1 day', INTERVAL '1 day')::date AS date
        FROM consuming
      ),
      expected AS (
        SELECT property_id, room_type_id, date, COUNT(*)::int AS expected_sold
        FROM nights GROUP BY property_id, room_type_id, date
      ),
      capacity AS (
        SELECT property_id, room_type_id, COUNT(*)::int AS capacity
        FROM rooms WHERE status = 'ACTIVE' ${filter}
        GROUP BY property_id, room_type_id
      ),
      stored AS (
        SELECT property_id, room_type_id, date, capacity AS stored_capacity, sold AS stored_sold
        FROM room_type_inventory WHERE 1=1 ${filter}
      )
      SELECT
        COALESCE(e.property_id, s.property_id) AS property_id,
        COALESCE(e.room_type_id, s.room_type_id) AS room_type_id,
        to_char(COALESCE(e.date, s.date), 'YYYY-MM-DD') AS date,
        COALESCE(e.expected_sold, 0) AS expected_sold,
        s.stored_sold,
        s.stored_capacity,
        COALESCE(c.capacity, 0) AS expected_capacity
      FROM expected e
      FULL OUTER JOIN stored s
        ON e.property_id = s.property_id AND e.room_type_id = s.room_type_id AND e.date = s.date
      LEFT JOIN capacity c
        ON c.property_id = COALESCE(e.property_id, s.property_id)
       AND c.room_type_id = COALESCE(e.room_type_id, s.room_type_id)
      `,
      params,
    );

    const discrepancies: InventoryDiscrepancy[] = [];

    for (const row of rows) {
      const expectedSold = Number(row.expected_sold);
      const expectedCapacity = Number(row.expected_capacity);
      const storedSold = row.stored_sold === null ? null : Number(row.stored_sold);
      const storedCapacity = row.stored_capacity === null ? null : Number(row.stored_capacity);

      const base = {
        propertyId: row.property_id,
        roomTypeId: row.room_type_id,
        date: row.date,
        expectedSold,
        storedSold,
        expectedCapacity,
        storedCapacity,
      };

      if (expectedSold > expectedCapacity) {
        discrepancies.push({ ...base, type: 'OVERSELL' });
      }

      if (storedSold === null) {
        if (expectedSold > 0) discrepancies.push({ ...base, type: 'MISSING_ROW' });
        continue;
      }

      if (expectedSold === 0 && storedSold > 0) {
        discrepancies.push({ ...base, type: 'ORPHAN_SOLD' });
      } else if (storedSold !== expectedSold) {
        discrepancies.push({ ...base, type: 'SOLD_MISMATCH' });
      }

      if (storedCapacity !== null && storedCapacity !== expectedCapacity) {
        discrepancies.push({ ...base, type: 'CAPACITY_MISMATCH' });
      }
    }

    const countsByType: Record<InventoryDiscrepancyType, number> = {
      MISSING_ROW: 0,
      ORPHAN_SOLD: 0,
      SOLD_MISMATCH: 0,
      CAPACITY_MISMATCH: 0,
      OVERSELL: 0,
    };
    for (const d of discrepancies) countsByType[d.type] += 1;

    return { consistent: discrepancies.length === 0, discrepancies, countsByType };
  }
}
