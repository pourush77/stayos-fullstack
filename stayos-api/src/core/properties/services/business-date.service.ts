import { Injectable } from '@nestjs/common';

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

/**
 * Computes a property's operational "business date" from a real instant, the
 * property timezone and a configurable end-of-day cut-off, or returns the
 * persisted authoritative business date owned by Night Audit.
 *
 * Supports two concepts:
 * 1. Concept A (Authoritative business date):
 *    Persisted on the property row (`currentBusinessDate`) and advances only
 *    when the business day is explicitly closed by Night Audit.
 * 2. Concept B (Calculated/fallback business date):
 *    Dynamically resolved from real instant, timezone, and cutoff time.
 *    Preserved for backward-compatibility with existing flows and for initial bootstrap.
 */
@Injectable()
export class BusinessDateService {
  /**
   * Concept A: Authoritative business date.
   * Returns the persisted `currentBusinessDate` when present on the property.
   * If not present, falls back safely to calculating the operational business
   * date based on property timezone and cut-off time (Concept B).
   */
  getAuthoritativeDate(
    property: {
      currentBusinessDate?: string | null;
      timezone?: string;
      businessDayCutOffTime?: string;
    },
    instant: Date = new Date(),
  ): string {
    if (property.currentBusinessDate) {
      return property.currentBusinessDate;
    }

    if (property.timezone && property.businessDayCutOffTime) {
      return this.resolveForProperty(
        { timezone: property.timezone, businessDayCutOffTime: property.businessDayCutOffTime },
        instant,
      );
    }

    throw new Error(
      'Unable to resolve authoritative business date: property has neither currentBusinessDate nor timezone/businessDayCutOffTime.',
    );
  }

  /**
   * Alias for getAuthoritativeDate to obtain the current persisted business date.
   */
  getCurrentBusinessDate(
    property: {
      currentBusinessDate?: string | null;
      timezone?: string;
      businessDayCutOffTime?: string;
    },
    instant: Date = new Date(),
  ): string {
    return this.getAuthoritativeDate(property, instant);
  }

  resolveBusinessDate(instant: Date, timeZone: string, cutOffTime: string): string {
    const parts = this.getZonedParts(instant, timeZone);
    const { hour: cutHour, minute: cutMinute } = this.parseTime(cutOffTime);

    const minutesOfDay = parts.hour * 60 + parts.minute;
    const cutOffMinutes = cutHour * 60 + cutMinute;

    let { year, month, day } = parts;
    if (minutesOfDay < cutOffMinutes) {
      ({ year, month, day } = this.previousDay(year, month, day));
    }

    return `${year}-${this.pad(month)}-${this.pad(day)}`;
  }

  /**
   * Concept B: Dynamic calculated/fallback date for a property.
   * Kept strictly backward-compatible for existing callers.
   */
  resolveForProperty(
    property: { timezone: string; businessDayCutOffTime: string; currentBusinessDate?: string | null },
    instant: Date = new Date(),
  ): string {
    return this.resolveBusinessDate(instant, property.timezone, property.businessDayCutOffTime);
  }

  /**
   * Advances a business date string (YYYY-MM-DD) by exactly one calendar day.
   */
  advanceBusinessDate(businessDate: string): string {
    return advanceCalendarDay(businessDate);
  }

  private getZonedParts(instant: Date, timeZone: string): ZonedParts {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const lookup: Record<string, string> = {};
    for (const part of formatter.formatToParts(instant)) {
      if (part.type !== 'literal') {
        lookup[part.type] = part.value;
      }
    }

    return {
      year: Number(lookup.year),
      month: Number(lookup.month),
      day: Number(lookup.day),
      hour: Number(lookup.hour),
      minute: Number(lookup.minute),
    };
  }

  private parseTime(value: string): { hour: number; minute: number } {
    const [hour = '0', minute = '0'] = value.split(':');
    return { hour: Number(hour), minute: Number(minute) };
  }

  private previousDay(year: number, month: number, day: number): ZonedParts {
    const previous = new Date(Date.UTC(year, month - 1, day) - 86_400_000);
    return {
      year: previous.getUTCFullYear(),
      month: previous.getUTCMonth() + 1,
      day: previous.getUTCDate(),
      hour: 0,
      minute: 0,
    };
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}

/**
 * Safely advances a calendar date (YYYY-MM-DD) by exactly one calendar day.
 * Pure date-only arithmetic using UTC calendar parts; does not rely on wall clock,
 * timezone offsets, or adding 24-hour millisecond spans.
 *
 * Correctly handles month transitions, year rollovers, and leap year days:
 * - 2026-09-30 -> 2026-10-01
 * - 2026-12-31 -> 2027-01-01
 * - 2028-02-28 -> 2028-02-29 (leap year)
 * - 2028-02-29 -> 2028-03-01
 */
export function advanceCalendarDay(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    throw new Error(`Invalid calendar date format: "${dateString}". Expected YYYY-MM-DD.`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  const inputDate = new Date(Date.UTC(year, month - 1, day));
  if (
    inputDate.getUTCFullYear() !== year ||
    inputDate.getUTCMonth() + 1 !== month ||
    inputDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date values: "${dateString}".`);
  }

  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(nextDate.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

