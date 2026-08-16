import { Injectable } from '@nestjs/common';

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

/**
 * Computes a property's operational "business date" from a real instant, the
 * property timezone and a configurable end-of-day cut-off. The business date is
 * deliberately derived (never read from the server/browser clock directly) so
 * that a later Night Audit can own rollover without changing this contract.
 */
@Injectable()
export class BusinessDateService {
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

  resolveForProperty(
    property: { timezone: string; businessDayCutOffTime: string },
    instant: Date = new Date(),
  ): string {
    return this.resolveBusinessDate(instant, property.timezone, property.businessDayCutOffTime);
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
