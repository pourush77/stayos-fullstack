import { advanceCalendarDay, BusinessDateService } from './business-date.service';

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

  describe('Authoritative business date (Concept A)', () => {
    it('returns persisted currentBusinessDate regardless of current wall-clock instant', () => {
      const property = {
        currentBusinessDate: '2026-06-15',
        timezone: 'Asia/Kolkata',
        businessDayCutOffTime: '03:00:00',
      };
      // Even if wall-clock instant would calculate to 2026-06-16, persisted date is authoritative
      const instant = new Date('2026-06-16T12:00:00Z');
      expect(service.getAuthoritativeDate(property, instant)).toBe('2026-06-15');
      expect(service.getCurrentBusinessDate(property, instant)).toBe('2026-06-15');
    });

    it('falls back to calculated date when currentBusinessDate is absent or null', () => {
      const property = {
        currentBusinessDate: null,
        timezone: 'Asia/Kolkata',
        businessDayCutOffTime: '03:00:00',
      };
      // 2026-06-15T20:00:00Z is 01:30 IST on the 16th, before 03:00 cut-off -> 2026-06-15
      const instant = new Date('2026-06-15T20:00:00Z');
      expect(service.getAuthoritativeDate(property, instant)).toBe('2026-06-15');
    });

    it('works with minimal property object that only contains currentBusinessDate', () => {
      const property = { currentBusinessDate: '2026-07-04' };
      expect(service.getAuthoritativeDate(property)).toBe('2026-07-04');
    });

    it('throws when property has neither currentBusinessDate nor timezone/cutoff', () => {
      expect(() => service.getAuthoritativeDate({} as any)).toThrow(
        /Unable to resolve authoritative business date/,
      );
    });

    it('keeps resolveForProperty strictly calculated and backward-compatible (Concept B)', () => {
      const property = {
        currentBusinessDate: '2026-06-15',
        timezone: 'Asia/Kolkata',
        businessDayCutOffTime: '03:00:00',
      };
      // 2026-06-15T22:00:00Z is 03:30 IST on the 16th, at/after cut-off -> calculates 2026-06-16
      // Even though currentBusinessDate is 2026-06-15, resolveForProperty returns calculated date
      const instant = new Date('2026-06-15T22:00:00Z');
      expect(service.resolveForProperty(property, instant)).toBe('2026-06-16');
    });
  });

  describe('advanceCalendarDay & advanceBusinessDate (NA-3B calendar math)', () => {
    it('advances a standard date by exactly one day: 2026-09-04 -> 2026-09-05', () => {
      expect(advanceCalendarDay('2026-09-04')).toBe('2026-09-05');
      expect(service.advanceBusinessDate('2026-09-04')).toBe('2026-09-05');
    });

    it('J: handles month transition correctly: 2026-09-30 -> 2026-10-01', () => {
      expect(advanceCalendarDay('2026-09-30')).toBe('2026-10-01');
      expect(service.advanceBusinessDate('2026-09-30')).toBe('2026-10-01');
    });

    it('K: handles year transition correctly: 2026-12-31 -> 2027-01-01', () => {
      expect(advanceCalendarDay('2026-12-31')).toBe('2027-01-01');
      expect(service.advanceBusinessDate('2026-12-31')).toBe('2027-01-01');
    });

    it('L: handles leap year transitions correctly: 2028-02-28 -> 2028-02-29 and 2028-02-29 -> 2028-03-01', () => {
      expect(advanceCalendarDay('2028-02-28')).toBe('2028-02-29');
      expect(service.advanceBusinessDate('2028-02-28')).toBe('2028-02-29');

      expect(advanceCalendarDay('2028-02-29')).toBe('2028-03-01');
      expect(service.advanceBusinessDate('2028-02-29')).toBe('2028-03-01');
    });

    it('handles non-leap year February transition: 2026-02-28 -> 2026-03-01', () => {
      expect(advanceCalendarDay('2026-02-28')).toBe('2026-03-01');
      expect(service.advanceBusinessDate('2026-02-28')).toBe('2026-03-01');
    });

    it('rejects invalid date format or invalid date values', () => {
      expect(() => advanceCalendarDay('invalid-date')).toThrow(/Invalid calendar date format/);
      expect(() => advanceCalendarDay('2026-09-4')).toThrow(/Invalid calendar date format/);
      expect(() => advanceCalendarDay('2026-02-30')).toThrow(/Invalid calendar date values/);
    });
  });
});

