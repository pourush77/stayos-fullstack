import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';

const MS_PER_DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDate(value: string, field: string): number {
  if (!DATE_RE.test(value)) {
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_ERROR,
      message: `${field} must be an ISO date (YYYY-MM-DD)`,
    });
  }
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) {
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_ERROR,
      message: `${field} is not a valid date`,
    });
  }
  return ms;
}

/**
 * Expand a stay into the list of consumed night dates.
 * Arrival is inclusive, departure is exclusive (a 10th->12th stay = [10th, 11th]).
 * Returns ascending-sorted 'YYYY-MM-DD' strings.
 */
export function expandStayNights(arrivalDate: string, departureDate: string): string[] {
  const start = parseUtcDate(arrivalDate, 'arrivalDate');
  const end = parseUtcDate(departureDate, 'departureDate');

  if (end <= start) {
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'departureDate must be after arrivalDate',
    });
  }

  const nights: string[] = [];
  for (let t = start; t < end; t += MS_PER_DAY) {
    nights.push(new Date(t).toISOString().slice(0, 10));
  }
  return nights;
}

export function computeAvailable(capacity: number, sold: number): number {
  return capacity - sold;
}

/**
 * A single unit of room-type inventory on a specific date. The atomic key of
 * the inventory ledger (property is implied by the operation scope).
 */
export interface InventoryKey {
  roomTypeId: string;
  date: string;
}
