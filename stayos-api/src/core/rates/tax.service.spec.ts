import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { PropertyTaxConfigEntity } from './infrastructure/property-tax-config.entity';
import { TaxService } from './tax.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';

describe('TaxService', () => {
  let service: TaxService;
  let repository: MockRepository<PropertyTaxConfigEntity>;
  const propertiesService = { findOne: jest.fn() };

  beforeEach(async () => {
    repository = {
      create: jest.fn((input) => input),
      findOne: jest.fn(),
      save: jest.fn(async (input) => ({ id: 'tax-1', createdAt: new Date(), updatedAt: new Date(), ...input })),
    };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: getRepositoryToken(PropertyTaxConfigEntity), useValue: repository },
        { provide: PropertiesService, useValue: propertiesService },
      ],
    }).compile();

    service = module.get(TaxService);
  });

  it('returns default 12% tax when no config exists', async () => {
    repository.findOne?.mockResolvedValue(null);

    await expect(service.getPropertyTaxConfig(propertyId)).resolves.toMatchObject({
      propertyId,
      name: 'GST',
      percentage: '12.00',
      isActive: true,
    });
  });

  it('calculates tax disabled', () => {
    expect(service.calculateTax(4350, { isActive: false, name: 'GST', percentage: '12.00' })).toEqual({
      taxableSubtotal: '4350.00',
      taxAmount: '0.00',
      total: '4350.00',
      taxName: null,
      taxPercentage: '12.00',
      taxEnabled: false,
    });
  });

  it('calculates 0% tax', () => {
    expect(service.calculateTax(4350, { isActive: true, name: 'GST', percentage: '0.00' }).taxAmount).toBe('0.00');
  });

  it('calculates 12% tax for room plus child surcharge', () => {
    expect(service.calculateTax(4350, { isActive: true, name: 'GST', percentage: '12.00' })).toMatchObject({
      taxableSubtotal: '4350.00',
      taxAmount: '522.00',
      total: '4872.00',
    });
  });

  it('calculates 18% tax', () => {
    expect(service.calculateTax(4350, { isActive: true, name: 'GST', percentage: '18.00' }).taxAmount).toBe('783.00');
  });

  it('calculates room charge only', () => {
    expect(service.calculateTax(3500, { isActive: true, name: 'GST', percentage: '12.00' }).total).toBe('3920.00');
  });

  it('rejects invalid negative percentage', async () => {
    await expect(
      service.upsertPropertyTaxConfig(propertyId, { isActive: true, name: 'GST', percentage: '-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects percentage above 100', async () => {
    await expect(
      service.upsertPropertyTaxConfig(propertyId, { isActive: true, name: 'GST', percentage: '101' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires name when active', async () => {
    await expect(
      service.upsertPropertyTaxConfig(propertyId, { isActive: true, name: ' ', percentage: '12' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces property isolation through property lookup and scoped repository query', async () => {
    repository.findOne?.mockResolvedValue(null);

    await service.upsertPropertyTaxConfig(propertyId, { isActive: true, name: 'GST', percentage: '12' });

    expect(propertiesService.findOne).toHaveBeenCalledWith(propertyId);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { propertyId } });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ propertyId }));
  });
});
