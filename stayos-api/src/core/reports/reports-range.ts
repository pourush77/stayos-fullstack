import { BadRequestException } from '@nestjs/common';

export type ReportRange = {
  from: Date;
  fromKey: string;
  to: Date;
  toKey: string;
  days: number;
};

export function parseReportRange(from?: string, to?: string): ReportRange {
  const now = new Date();
  const fallbackTo = now.toISOString().slice(0, 10);
  const fallbackFromDate = new Date(now);
  fallbackFromDate.setDate(fallbackFromDate.getDate() - 29);
  const fromKey = from || fallbackFromDate.toISOString().slice(0, 10);
  const toKey = to || fallbackTo;
  const start = new Date(`${fromKey}T00:00:00.000Z`);
  const end = new Date(`${toKey}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new BadRequestException({ code: 'INVALID_RANGE', message: 'Report from date must be on or before to date' });
  }

  const days = Math.ceil((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86_400_000) + 1;
  if (days > 365) {
    throw new BadRequestException({ code: 'RANGE_TOO_LARGE', message: 'Reports range cannot exceed 365 days' });
  }

  return { from: start, fromKey, to: end, toKey, days };
}

export function round(value: number, precision = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function overlapNights(arrivalDate: string, departureDate: string, range: ReportRange): number {
  const arrival = new Date(`${arrivalDate}T00:00:00.000Z`);
  const departure = new Date(`${departureDate}T00:00:00.000Z`);
  const rangeStart = new Date(`${range.fromKey}T00:00:00.000Z`);
  const rangeEndExclusive = new Date(`${range.toKey}T00:00:00.000Z`);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);
  const start = Math.max(arrival.getTime(), rangeStart.getTime());
  const end = Math.min(departure.getTime(), rangeEndExclusive.getTime());
  return Math.max(0, Math.ceil((end - start) / 86_400_000));
}
