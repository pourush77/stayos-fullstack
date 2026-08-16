import { DataSource } from 'typeorm';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

function serviceWithRows(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const dataSource = { query } as unknown as DataSource;
  return { service: new InventoryReconciliationService(dataSource), query };
}

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  property_id: 'prop-1',
  room_type_id: 'rt-1',
  date: '2026-06-10',
  expected_sold: 1,
  stored_sold: 1,
  expected_capacity: 3,
  stored_capacity: 3,
  ...over,
});

describe('InventoryReconciliationService', () => {
  it('reports consistent when stored matches expected', async () => {
    const { service } = serviceWithRows([row()]);
    const result = await service.reconcile();
    expect(result.consistent).toBe(true);
    expect(result.discrepancies).toEqual([]);
    expect(result.countsByType).toEqual({
      MISSING_ROW: 0,
      ORPHAN_SOLD: 0,
      SOLD_MISMATCH: 0,
      CAPACITY_MISMATCH: 0,
      OVERSELL: 0,
    });
  });

  it('passes the property filter into the query when provided', async () => {
    const { service, query } = serviceWithRows([]);
    await service.reconcile('prop-9');
    expect(query.mock.calls[0][1]).toEqual(['prop-9']);
  });

  it('flags a missing row when a reservation exists but no inventory row does', async () => {
    const { service } = serviceWithRows([
      row({ stored_sold: null, stored_capacity: null, expected_sold: 2 }),
    ]);
    const result = await service.reconcile();
    expect(result.consistent).toBe(false);
    expect(result.discrepancies).toEqual([expect.objectContaining({ type: 'MISSING_ROW' })]);
  });

  it('flags an orphan when stored sold exists but no reservation backs it', async () => {
    const { service } = serviceWithRows([row({ expected_sold: 0, stored_sold: 2 })]);
    const result = await service.reconcile();
    expect(result.discrepancies).toEqual([expect.objectContaining({ type: 'ORPHAN_SOLD' })]);
  });

  it('flags a sold mismatch', async () => {
    const { service } = serviceWithRows([row({ expected_sold: 2, stored_sold: 1 })]);
    const result = await service.reconcile();
    expect(result.discrepancies).toEqual([expect.objectContaining({ type: 'SOLD_MISMATCH' })]);
  });

  it('flags a capacity mismatch', async () => {
    const { service } = serviceWithRows([row({ expected_capacity: 4, stored_capacity: 3 })]);
    const result = await service.reconcile();
    expect(result.discrepancies).toEqual([expect.objectContaining({ type: 'CAPACITY_MISMATCH' })]);
  });

  it('surfaces oversell explicitly (never clamps)', async () => {
    const { service } = serviceWithRows([
      row({ expected_sold: 5, stored_sold: 5, expected_capacity: 3, stored_capacity: 3 }),
    ]);
    const result = await service.reconcile();
    const types = result.discrepancies.map((d) => d.type);
    expect(types).toContain('OVERSELL');
    expect(result.consistent).toBe(false);
  });
});
