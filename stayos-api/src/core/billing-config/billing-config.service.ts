import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { UpsertPropertyBillingConfigDto } from './dto/upsert-property-billing-config.dto';
import { PropertyBillingConfigEntity } from './infrastructure/property-billing-config.entity';

const DEFAULTS = {
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1,
  resetSequenceYearly: true,
  financialYearStartMonth: 4,
};

@Injectable()
export class BillingConfigService {
  constructor(
    @InjectRepository(PropertyBillingConfigEntity)
    private readonly billingConfigsRepository: Repository<PropertyBillingConfigEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async get(propertyId: string): Promise<PropertyBillingConfigEntity> {
    await this.propertiesService.findOne(propertyId);

    const existing = await this.billingConfigsRepository.findOne({ where: { propertyId } });
    if (existing) return existing;

    return this.billingConfigsRepository.create({
      propertyId,
      ...DEFAULTS,
      defaultHsnSac: null,
    });
  }

  async upsert(
    propertyId: string,
    dto: UpsertPropertyBillingConfigDto,
  ): Promise<PropertyBillingConfigEntity> {
    await this.propertiesService.findOne(propertyId);

    const existing = await this.billingConfigsRepository.findOne({ where: { propertyId } });
    const config = existing ?? this.billingConfigsRepository.create({ propertyId });

    config.invoicePrefix = dto.invoicePrefix;
    config.nextInvoiceNumber = dto.nextInvoiceNumber;
    config.resetSequenceYearly = dto.resetSequenceYearly;
    config.financialYearStartMonth = dto.financialYearStartMonth;
    config.defaultHsnSac = dto.defaultHsnSac?.trim() ? dto.defaultHsnSac.trim() : null;

    return this.billingConfigsRepository.save(config);
  }
}
