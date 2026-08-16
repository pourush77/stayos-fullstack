import { BadRequestException } from '@nestjs/common';
import { computeAvailable, expandStayNights } from './inventory-nights';

describe('inventory-nights', () => {
  describe('expandStayNights', () => {
    it('expands a multi-night stay (arrival inclusive, departure exclusive)', () => {
      expect(expandStayNights('2026-06-10', '2026-06-13')).toEqual([
        '2026-06-10',
        '2026-06-11',
        '2026-06-12',
      ]);
    });

    it('returns a single night for a one-night stay', () => {
      expect(expandStayNights('2026-06-10', '2026-06-11')).toEqual(['2026-06-10']);
    });

    it('crosses month boundaries correctly', () => {
      expect(expandStayNights('2026-06-30', '2026-07-02')).toEqual(['2026-06-30', '2026-07-01']);
    });

    it('rejects departure on or before arrival', () => {
      expect(() => expandStayNights('2026-06-10', '2026-06-10')).toThrow(BadRequestException);
      expect(() => expandStayNights('2026-06-10', '2026-06-09')).toThrow(BadRequestException);
    });

    it('rejects malformed dates', () => {
      expect(() => expandStayNights('10-06-2026', '2026-06-12')).toThrow(BadRequestException);
      expect(() => expandStayNights('2026-06-10', 'not-a-date')).toThrow(BadRequestException);
    });
  });

  describe('computeAvailable', () => {
    it('is capacity minus sold', () => {
      expect(computeAvailable(5, 2)).toBe(3);
      expect(computeAvailable(5, 5)).toBe(0);
    });
  });
});
