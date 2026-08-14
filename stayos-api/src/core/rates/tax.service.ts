import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { UpsertPropertyTaxConfigInput } from './dto/upsert-property-tax-config.input';
import { PropertyTaxConfigEntity } from './infrastructure/property-tax-config.entity';

export type TaxCalculation = {
  taxableSubtotal: string;
  taxAmount: string;
  total: string;
  taxName: string | null;
  taxPercentage: string;
  taxEnabled: boolean;
};

const DEFAULT_TAX_NAME = 'GST';
const DEFAULT_TAX_PERCENTAGE = '12.00';

@Injectable()
export class TaxService {
  private static readonly PERCENTAGE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

  constructor(
    @InjectRepository(PropertyTaxConfigEntity)
    private readonly taxConfigsRepository: Repository<PropertyTaxConfigEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getPropertyTaxConfig(propertyId: string): Promise<PropertyTaxConfigEntity> {
    await this.propertiesService.findOne(propertyId);

    const existing = await this.taxConfigsRepository.findOne({ where: { propertyId } });
    if (existing) return existing;

    return this.taxConfigsRepository.create({
      propertyId,
      name: DEFAULT_TAX_NAME,
      percentage: DEFAULT_TAX_PERCENTAGE,
      isActive: true,
    });
  }

  async upsertPropertyTaxConfig(
    propertyId: string,
    input: UpsertPropertyTaxConfigInput,
  ): Promise<PropertyTaxConfigEntity> {
    await this.propertiesService.findOne(propertyId);
    this.validateConfig(input);

    const existing = await this.taxConfigsRepository.findOne({ where: { propertyId } });
    const config = existing ?? this.taxConfigsRepository.create({ propertyId });
    config.isActive = input.isActive;
    config.name = input.name.trim();
    config.percentage = this.normalizePercentage(input.percentage);

    return this.taxConfigsRepository.save(config);
  }

  async calculateForProperty(propertyId: string, taxableAmount: number): Promise<TaxCalculation> {
    const config = await this.getPropertyTaxConfig(propertyId);
    return this.calculateTax(taxableAmount, config);
  }

  calculateTax(taxableAmount: number, config: Pick<PropertyTaxConfigEntity, 'isActive' | 'name' | 'percentage'>): TaxCalculation {
    const taxableCents = this.moneyToCents(taxableAmount);
    const percentage = Number(config.percentage);
    const taxCents =
      config.isActive && percentage > 0
        ? Math.round((taxableCents * Math.round(percentage * 100)) / 10_000)
        : 0;

    return {
      taxableSubtotal: this.centsToMoney(taxableCents),
      taxAmount: this.centsToMoney(taxCents),
      total: this.centsToMoney(taxableCents + taxCents),
      taxName: config.isActive ? config.name : null,
      taxPercentage: this.normalizePercentage(config.percentage),
      taxEnabled: config.isActive,
    };
  }

  private validateConfig(input: UpsertPropertyTaxConfigInput): void {
    if (input.isActive && !input.name.trim()) {
      throw new BadRequestException('Tax name is required when tax is enabled');
    }

    if (!TaxService.PERCENTAGE_PATTERN.test(input.percentage)) {
      throw new BadRequestException('percentage must be a decimal string between 0 and 100');
    }

    const percentage = Number(input.percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new BadRequestException('percentage must be between 0 and 100');
    }
  }

  private normalizePercentage(value: string): string {
    return Number(value).toFixed(2);
  }

  private moneyToCents(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }

  private centsToMoney(value: number): string {
    return (value / 100).toFixed(2);
  }
}
