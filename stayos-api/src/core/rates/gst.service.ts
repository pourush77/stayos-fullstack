import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { TaxRuleEntity } from './infrastructure/tax-rule.entity';
import { CreateTaxRuleDto, UpdateTaxRuleDto } from './dto/tax-rule.dto';
import {
  GstComponent,
  GstComputation,
  PlaceOfSupply,
} from './domain/gst.types';

export interface GstComputeInput {
  propertyId: string;
  chargeType: string;
  taxableAmountCents: number;
  /** Per-unit basis (rupees) used to match a tariff slab (e.g. per-night room rate). */
  slabBasisAmount?: number | null;
  placeOfSupply: PlaceOfSupply;
  chargeDate: Date;
  hsnSacOverride?: string | null;
}

/**
 * Indian GST engine (Phase 1D-c). Property-configured, effective-dated tax
 * rules with optional tariff slabs; no statutory rates hardcoded. Produces a
 * cents-safe, frozen TaxSnapshot per charge with CGST/SGST (intra-state) or
 * IGST (inter-state) split. When no rule matches (engine shipped empty), GST is
 * simply zero — never fabricated.
 */
@Injectable()
export class GstService {
  private static readonly PERCENTAGE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

  constructor(
    @InjectRepository(TaxRuleEntity)
    private readonly taxRulesRepository: Repository<TaxRuleEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async listTaxRules(propertyId: string): Promise<TaxRuleEntity[]> {
    await this.propertiesService.findOne(propertyId);
    return this.taxRulesRepository.find({
      where: { propertyId },
      order: { chargeType: 'ASC', effectiveFrom: 'DESC', createdAt: 'DESC' },
    });
  }

  async createTaxRule(
    propertyId: string,
    dto: CreateTaxRuleDto,
    actorUserId?: string | null,
  ): Promise<TaxRuleEntity> {
    await this.propertiesService.findOne(propertyId);
    this.validate(dto.taxPercentage, dto.slabMinAmount, dto.slabMaxAmount);
    const rule = this.taxRulesRepository.create({
      propertyId,
      name: dto.name.trim(),
      chargeType: dto.chargeType,
      hsnSac: dto.hsnSac?.trim() || null,
      taxPercentage: Number(dto.taxPercentage).toFixed(2),
      slabMinAmount: dto.slabMinAmount != null ? Number(dto.slabMinAmount).toFixed(2) : null,
      slabMaxAmount: dto.slabMaxAmount != null ? Number(dto.slabMaxAmount).toFixed(2) : null,
      effectiveFrom: dto.effectiveFrom,
      isActive: dto.isActive ?? true,
      createdByUserId: actorUserId ?? null,
    });
    return this.taxRulesRepository.save(rule);
  }

  async updateTaxRule(
    propertyId: string,
    id: string,
    dto: UpdateTaxRuleDto,
  ): Promise<TaxRuleEntity> {
    const rule = await this.getTaxRule(propertyId, id);
    const nextPercentage = dto.taxPercentage ?? rule.taxPercentage;
    const nextMin = dto.slabMinAmount !== undefined ? dto.slabMinAmount : rule.slabMinAmount;
    const nextMax = dto.slabMaxAmount !== undefined ? dto.slabMaxAmount : rule.slabMaxAmount;
    this.validate(String(nextPercentage), nextMin, nextMax);

    if (dto.name !== undefined) rule.name = dto.name.trim();
    if (dto.chargeType !== undefined) rule.chargeType = dto.chargeType;
    if (dto.hsnSac !== undefined) rule.hsnSac = dto.hsnSac?.trim() || null;
    if (dto.taxPercentage !== undefined) rule.taxPercentage = Number(dto.taxPercentage).toFixed(2);
    if (dto.slabMinAmount !== undefined)
      rule.slabMinAmount = dto.slabMinAmount != null ? Number(dto.slabMinAmount).toFixed(2) : null;
    if (dto.slabMaxAmount !== undefined)
      rule.slabMaxAmount = dto.slabMaxAmount != null ? Number(dto.slabMaxAmount).toFixed(2) : null;
    if (dto.effectiveFrom !== undefined) rule.effectiveFrom = dto.effectiveFrom;
    if (dto.isActive !== undefined) rule.isActive = dto.isActive;

    return this.taxRulesRepository.save(rule);
  }

  async deleteTaxRule(propertyId: string, id: string): Promise<void> {
    const rule = await this.getTaxRule(propertyId, id);
    await this.taxRulesRepository.remove(rule);
  }

  async getTaxRule(propertyId: string, id: string): Promise<TaxRuleEntity> {
    const rule = await this.taxRulesRepository.findOne({ where: { id, propertyId } });
    if (!rule) throw new NotFoundException(`Tax rule ${id} was not found`);
    return rule;
  }

  /**
   * Place of supply for a non-accommodation line: INTER_STATE when the
   * counterparty is registered in a different state than the property, else
   * INTRA_STATE. Accommodation (ROOM) always resolves INTRA_STATE upstream.
   */
  resolvePlaceOfSupply(
    propertyState?: string | null,
    propertyStateCode?: string | null,
    counterpartyState?: string | null,
  ): PlaceOfSupply {
    const cp = (counterpartyState ?? '').trim().toUpperCase();
    if (!cp) return PlaceOfSupply.INTRA_STATE;
    const ps = (propertyState ?? '').trim().toUpperCase();
    const psc = (propertyStateCode ?? '').trim().toUpperCase();
    return cp === ps || cp === psc ? PlaceOfSupply.INTRA_STATE : PlaceOfSupply.INTER_STATE;
  }

  /**
   * Resolves the applicable rule and computes a cents-safe GST breakdown. No
   * matching rule (or zero taxable) => applied:false with zero tax. Component
   * amounts are summed (never an independently-rounded total) so the folio
   * scalar tax always equals the sum of CGST/SGST/IGST.
   */
  async computeTax(input: GstComputeInput, manager?: EntityManager): Promise<GstComputation> {
    const repo = manager ? manager.getRepository(TaxRuleEntity) : this.taxRulesRepository;
    const taxableCents = Math.max(0, Math.round(input.taxableAmountCents));
    const rule = await this.resolveRule(repo, input);

    if (!rule || taxableCents === 0) {
      return {
        applied: false,
        hsnSac: input.hsnSacOverride ?? rule?.hsnSac ?? null,
        taxableValue: this.fromCents(taxableCents),
        placeOfSupply: input.placeOfSupply,
        totalRate: rule ? Number(rule.taxPercentage).toFixed(2) : '0.00',
        totalTax: '0.00',
        totalTaxCents: 0,
        components: [],
        taxRuleId: rule?.id ?? null,
        ruleEffectiveFrom: rule?.effectiveFrom ?? null,
      };
    }

    const totalRatePct = Number(rule.taxPercentage);
    const totalRateBps = Math.round(totalRatePct * 100);
    // Compute the total GST at the configured rate FIRST, then split, so the
    // combined GST always equals rate% of the taxable value (no paisa
    // under-collection from independently rounding each half) while components
    // still sum exactly to the total (cents-safe).
    const totalTaxCents = Math.round((taxableCents * totalRateBps) / 10_000);
    const components: GstComponent[] = [];

    if (input.placeOfSupply === PlaceOfSupply.INTER_STATE) {
      components.push({ name: 'IGST', rate: totalRatePct.toFixed(2), amount: this.fromCents(totalTaxCents) });
    } else {
      const half = totalRatePct / 2;
      const cgstCents = Math.round(totalTaxCents / 2);
      const sgstCents = totalTaxCents - cgstCents;
      components.push({ name: 'CGST', rate: half.toFixed(2), amount: this.fromCents(cgstCents) });
      components.push({ name: 'SGST', rate: half.toFixed(2), amount: this.fromCents(sgstCents) });
    }

    return {
      applied: true,
      hsnSac: input.hsnSacOverride ?? rule.hsnSac ?? null,
      taxableValue: this.fromCents(taxableCents),
      placeOfSupply: input.placeOfSupply,
      totalRate: totalRatePct.toFixed(2),
      totalTax: this.fromCents(totalTaxCents),
      totalTaxCents,
      components,
      taxRuleId: rule.id,
      ruleEffectiveFrom: rule.effectiveFrom,
    };
  }

  private async resolveRule(
    repo: Repository<TaxRuleEntity>,
    input: GstComputeInput,
  ): Promise<TaxRuleEntity | null> {
    const candidates = await repo.find({
      where: { propertyId: input.propertyId, chargeType: input.chargeType, isActive: true },
    });
    const chargeDate = input.chargeDate.toISOString().slice(0, 10);
    const basis = input.slabBasisAmount ?? null;

    const eligible = candidates.filter((r) => {
      if (r.effectiveFrom > chargeDate) return false;
      if (r.slabMinAmount != null) {
        if (basis == null || basis < Number(r.slabMinAmount)) return false;
      }
      if (r.slabMaxAmount != null) {
        if (basis == null || basis > Number(r.slabMaxAmount)) return false;
      }
      return true;
    });

    eligible.sort((a, b) => {
      if (a.effectiveFrom !== b.effectiveFrom) return a.effectiveFrom < b.effectiveFrom ? 1 : -1;
      const aSpecific = a.slabMinAmount != null || a.slabMaxAmount != null ? 1 : 0;
      const bSpecific = b.slabMinAmount != null || b.slabMaxAmount != null ? 1 : 0;
      if (aSpecific !== bSpecific) return bSpecific - aSpecific;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return eligible[0] ?? null;
  }

  private validate(percentage: string, min?: string | null, max?: string | null): void {
    if (!GstService.PERCENTAGE_PATTERN.test(percentage)) {
      throw new BadRequestException('taxPercentage must be a decimal string between 0 and 100');
    }
    const pct = Number(percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new BadRequestException('taxPercentage must be between 0 and 100');
    }
    if (min != null && max != null && Number(min) > Number(max)) {
      throw new BadRequestException('slabMinAmount must be <= slabMaxAmount');
    }
  }

  private fromCents(cents: number): string {
    return (Math.round(cents) / 100).toFixed(2);
  }
}
