import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { expandStayNights } from '../inventory/domain/inventory-nights';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RateRestrictionEntity } from './infrastructure/rate-restriction.entity';
import { ListRestrictionsQueryDto, UpsertRestrictionsDto } from './dto/restriction.dto';

export enum RestrictionViolationType {
  STOP_SELL = 'STOP_SELL',
  CTA = 'CTA',
  CTD = 'CTD',
  MIN_STAY = 'MIN_STAY',
  MAX_STAY = 'MAX_STAY',
}

export interface RestrictionViolation {
  type: RestrictionViolationType;
  date?: string;
  requiredMinStay?: number;
  allowedMaxStay?: number;
  message: string;
}

export interface StayRestrictionQuery {
  propertyId: string;
  roomTypeId: string;
  ratePlanId?: string | null;
  arrivalDate: string;
  departureDate: string;
}

interface EffectiveRestriction {
  stopSell: boolean;
  cta: boolean;
  ctd: boolean;
  minStay: number | null;
  maxStay: number | null;
}

/**
 * Centralized, READ-ONLY restrictions engine. The single source of truth for
 * whether a stay is sellable under ARI rules — reused by (future) reservation
 * lifecycle, rate quotes, group and channel bookings. Never mutates inventory,
 * pricing or snapshots.
 *
 * Precedence (approved): specificity override with NULL = inherit. roomType-level
 * (rate_plan_id NULL) is the baseline; a rate-plan row overrides per-field, where
 * an explicit `false` reopens a rule for that plan and NULL inherits the baseline.
 *
 * Multi-night semantics: nights = [arrival .. departure-1] (occupied). stopSell
 * blocks any occupied night; CTA is evaluated only on the arrival date; CTD only
 * on the departure date; minStay/maxStay are arrival-anchored length-of-stay
 * (LOS = departure - arrival nights).
 */
@Injectable()
export class RestrictionService {
  constructor(
    @InjectRepository(RateRestrictionEntity)
    private readonly restrictionsRepository: Repository<RateRestrictionEntity>,
    @InjectRepository(RatePlanEntity)
    private readonly ratePlansRepository: Repository<RatePlanEntity>,
  ) {}

  async evaluateStay(query: StayRestrictionQuery): Promise<{ sellable: boolean; violations: RestrictionViolation[] }> {
    const nights = expandStayNights(query.arrivalDate, query.departureDate); // [arrival .. departure-1]
    const los = nights.length;

    // Window [arrival .. departure] inclusive (departure date needed for CTD).
    const rows = await this.restrictionsRepository.find({
      where: {
        propertyId: query.propertyId,
        roomTypeId: query.roomTypeId,
        date: Between(query.arrivalDate, query.departureDate),
      },
    });

    const byDate = this.effectiveByDate(rows, query.ratePlanId ?? null);
    const violations: RestrictionViolation[] = [];

    // stopSell — any occupied night closed
    for (const date of nights) {
      if (byDate.get(date)?.stopSell) {
        violations.push({ type: RestrictionViolationType.STOP_SELL, date, message: `Sales are closed for ${date}` });
      }
    }

    const arrival = byDate.get(query.arrivalDate);
    const departure = byDate.get(query.departureDate);

    if (arrival?.cta) {
      violations.push({ type: RestrictionViolationType.CTA, date: query.arrivalDate, message: `Arrival is closed on ${query.arrivalDate}` });
    }
    if (departure?.ctd) {
      violations.push({ type: RestrictionViolationType.CTD, date: query.departureDate, message: `Departure is closed on ${query.departureDate}` });
    }
    if (arrival?.minStay != null && los < arrival.minStay) {
      violations.push({
        type: RestrictionViolationType.MIN_STAY,
        date: query.arrivalDate,
        requiredMinStay: arrival.minStay,
        message: `Minimum stay of ${arrival.minStay} night(s) required for arrival ${query.arrivalDate} (requested ${los})`,
      });
    }
    if (arrival?.maxStay != null && los > arrival.maxStay) {
      violations.push({
        type: RestrictionViolationType.MAX_STAY,
        date: query.arrivalDate,
        allowedMaxStay: arrival.maxStay,
        message: `Maximum stay of ${arrival.maxStay} night(s) allowed for arrival ${query.arrivalDate} (requested ${los})`,
      });
    }

    return { sellable: violations.length === 0, violations };
  }

  /**
   * Throws 422 RESTRICTION_VIOLATION with ALL applicable violations when a stay
   * is not sellable. Provided for the (later, 1C-c2/c3) reservation write paths;
   * NOT wired into the reservation lifecycle in this slice.
   */
  async assertStaySellable(query: StayRestrictionQuery): Promise<void> {
    const { sellable, violations } = await this.evaluateStay(query);
    if (!sellable) this.raise(violations);
  }

  /**
   * Change-aware amendment evaluation (grandfathering). Validates ONLY newly
   * introduced / re-scoped entitlement, never unchanged historical nights:
   * - roomType or ratePlan change => full resulting stay under the new scope;
   * - same scope, date change => added occupied nights (stopSell), CTA only if
   *   arrival changed, CTD only if departure changed, and LOS min/maxStay.
   */
  async evaluateAmendment(
    current: StayRestrictionQuery,
    next: StayRestrictionQuery,
  ): Promise<{ sellable: boolean; violations: RestrictionViolation[] }> {
    const scopeChanged =
      current.roomTypeId !== next.roomTypeId ||
      (current.ratePlanId ?? null) !== (next.ratePlanId ?? null);
    if (scopeChanged) {
      return this.evaluateStay(next);
    }

    const nextNights = expandStayNights(next.arrivalDate, next.departureDate);
    const currentNights = new Set(expandStayNights(current.arrivalDate, current.departureDate));
    const addedNights = nextNights.filter((n) => !currentNights.has(n));
    const los = nextNights.length;

    const rows = await this.restrictionsRepository.find({
      where: { propertyId: next.propertyId, roomTypeId: next.roomTypeId, date: Between(next.arrivalDate, next.departureDate) },
    });
    const byDate = this.effectiveByDate(rows, next.ratePlanId ?? null);
    const violations: RestrictionViolation[] = [];

    for (const date of addedNights) {
      if (byDate.get(date)?.stopSell) {
        violations.push({ type: RestrictionViolationType.STOP_SELL, date, message: `Sales are closed for ${date}` });
      }
    }
    if (current.arrivalDate !== next.arrivalDate && byDate.get(next.arrivalDate)?.cta) {
      violations.push({ type: RestrictionViolationType.CTA, date: next.arrivalDate, message: `Arrival is closed on ${next.arrivalDate}` });
    }
    if (current.departureDate !== next.departureDate && byDate.get(next.departureDate)?.ctd) {
      violations.push({ type: RestrictionViolationType.CTD, date: next.departureDate, message: `Departure is closed on ${next.departureDate}` });
    }
    const arrival = byDate.get(next.arrivalDate);
    if (arrival?.minStay != null && los < arrival.minStay) {
      violations.push({ type: RestrictionViolationType.MIN_STAY, date: next.arrivalDate, requiredMinStay: arrival.minStay, message: `Minimum stay of ${arrival.minStay} night(s) required for arrival ${next.arrivalDate} (requested ${los})` });
    }
    if (arrival?.maxStay != null && los > arrival.maxStay) {
      violations.push({ type: RestrictionViolationType.MAX_STAY, date: next.arrivalDate, allowedMaxStay: arrival.maxStay, message: `Maximum stay of ${arrival.maxStay} night(s) allowed for arrival ${next.arrivalDate} (requested ${los})` });
    }

    return { sellable: violations.length === 0, violations };
  }

  async assertAmendmentSellable(current: StayRestrictionQuery, next: StayRestrictionQuery): Promise<void> {
    const { sellable, violations } = await this.evaluateAmendment(current, next);
    if (!sellable) this.raise(violations);
  }

  private raise(violations: RestrictionViolation[]): never {
    const details = violations.map((v) => ({
      field: v.type,
      message: v.message,
      rejectedValue: { date: v.date, requiredMinStay: v.requiredMinStay, allowedMaxStay: v.allowedMaxStay },
    }));
    throw new HttpException(
      { code: ApiErrorCode.RESTRICTION_VIOLATION, message: 'Stay violates one or more sale restrictions', details, violations },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private effectiveByDate(rows: RateRestrictionEntity[], ratePlanId: string | null): Map<string, EffectiveRestriction> {
    const baseline = new Map<string, RateRestrictionEntity>();
    const planLevel = new Map<string, RateRestrictionEntity>();
    for (const row of rows) {
      if (row.ratePlanId == null) baseline.set(row.date, row);
      else if (ratePlanId != null && row.ratePlanId === ratePlanId) planLevel.set(row.date, row);
    }

    const dates = new Set<string>([...baseline.keys(), ...planLevel.keys()]);
    const result = new Map<string, EffectiveRestriction>();
    for (const date of dates) {
      const base = baseline.get(date);
      const plan = planLevel.get(date);
      const pick = <T>(field: (r: RateRestrictionEntity) => T | null | undefined): T | null =>
        (plan ? field(plan) : undefined) ?? (base ? field(base) : undefined) ?? null;
      result.set(date, {
        stopSell: pick((r) => r.stopSell) ?? false,
        cta: pick((r) => r.cta) ?? false,
        ctd: pick((r) => r.ctd) ?? false,
        minStay: pick((r) => r.minStay),
        maxStay: pick((r) => r.maxStay),
      });
    }
    return result;
  }

  // ---- CRUD ----

  async upsertRestrictions(propertyId: string, dto: UpsertRestrictionsDto) {
    if (dto.dateTo < dto.dateFrom) {
      throw new BadRequestException('dateTo must not be before dateFrom');
    }
    if (dto.minStay != null && dto.maxStay != null && dto.maxStay < dto.minStay) {
      throw new BadRequestException('maxStay must be greater than or equal to minStay');
    }
    if (dto.ratePlanId) {
      const plan = await this.ratePlansRepository.findOne({ where: { id: dto.ratePlanId, propertyId } });
      if (!plan) throw new NotFoundException('Rate plan not found for this property');
    }

    const dates = this.inclusiveDateRange(dto.dateFrom, dto.dateTo);
    const saved: RateRestrictionEntity[] = [];
    for (const date of dates) {
      const existing = await this.restrictionsRepository.findOne({
        where: { propertyId, roomTypeId: dto.roomTypeId, ratePlanId: dto.ratePlanId ?? IsNull(), date },
      });
      const row = existing ?? this.restrictionsRepository.create({
        propertyId, roomTypeId: dto.roomTypeId, ratePlanId: dto.ratePlanId ?? null, date,
        stopSell: null, cta: null, ctd: null, minStay: null, maxStay: null,
      });
      // Only overwrite fields explicitly provided (undefined = leave unchanged).
      if (dto.stopSell !== undefined) row.stopSell = dto.stopSell;
      if (dto.cta !== undefined) row.cta = dto.cta;
      if (dto.ctd !== undefined) row.ctd = dto.ctd;
      if (dto.minStay !== undefined) row.minStay = dto.minStay;
      if (dto.maxStay !== undefined) row.maxStay = dto.maxStay;
      saved.push(await this.restrictionsRepository.save(row));
    }
    return { affectedDates: saved.length, restrictions: saved };
  }

  async listRestrictions(propertyId: string, query: ListRestrictionsQueryDto) {
    const where: Record<string, unknown> = { propertyId };
    if (query.roomTypeId) where.roomTypeId = query.roomTypeId;
    if (query.ratePlanId) where.ratePlanId = query.ratePlanId;
    if (query.from && query.to) where.date = Between(query.from, query.to);
    return this.restrictionsRepository.find({ where, order: { date: 'ASC' } });
  }

  async deleteRestriction(propertyId: string, id: string) {
    const row = await this.restrictionsRepository.findOne({ where: { id, propertyId } });
    if (!row) throw new NotFoundException('Restriction not found');
    await this.restrictionsRepository.remove(row);
    return { deleted: true };
  }

  private inclusiveDateRange(from: string, to: string): string[] {
    const dates: string[] = [];
    let t = Date.parse(`${from}T00:00:00.000Z`);
    const end = Date.parse(`${to}T00:00:00.000Z`);
    while (t <= end) {
      dates.push(new Date(t).toISOString().slice(0, 10));
      t += 86_400_000;
    }
    return dates;
  }
}
