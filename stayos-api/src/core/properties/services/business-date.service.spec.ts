import { BusinessDateService } from './business-date.service';

describe('BusinessDateService', () => {
  const service = new BusinessDateService();

  it('rolls back to the previous day before the cut-off (Asia/Kolkata)', () => {
    // 2026-06-15T20:00:00Z == 2026-06-16 01:30 IST, before a 03:00 cut-off
    const instant = new Date('2026-06-15T20:00:00Z');
    expect(service.resolveBusinessDate(instant, 'Asia/Kolkata', '03:00')).toBe('2026-06-15');
  });

  it('uses the current local day at/after the cut-off (Asia/Kolkata)', () => {
    // 2026-06-15T22:00:00Z == 2026-06-16 03:30 IST, at/after a 03:00 cut-off
    const instant = new Date('2026-06-15T22:00:00Z');
    expect(service.resolveBusinessDate(instant, 'Asia/Kolkata', '03:00')).toBe('2026-06-16');
  });

  it('treats a midnight cut-off as the local calendar date', () => {
    const instant = new Date('2026-06-15T20:00:00Z'); // 01:30 IST on the 16th
    expect(service.resolveBusinessDate(instant, 'Asia/Kolkata', '00:00')).toBe('2026-06-16');
  });

  it('handles month/year boundaries when rolling back', () => {
    // 2026-01-01T00:30:00Z == 2026-01-01 06:00 IST is after 03:00 -> same day;
    // 2025-12-31T20:00:00Z == 2026-01-01 01:30 IST is before 03:00 -> 2025-12-31
    const instant = new Date('2025-12-31T20:00:00Z');
    expect(service.resolveBusinessDate(instant, 'Asia/Kolkata', '03:00')).toBe('2025-12-31');
  });

  it('resolves for a property using its timezone and cut-off', () => {
    const instant = new Date('2026-06-15T20:00:00Z');
    expect(
      service.resolveForProperty(
        { timezone: 'Asia/Kolkata', businessDayCutOffTime: '03:00:00' },
        instant,
      ),
    ).toBe('2026-06-15');
  });
});
