import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { AmenitiesService } from './amenities.service';
import { AmenityCategory } from './domain/amenity-category.enum';
import { AmenityEntity } from './infrastructure/amenity.entity';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const asRepository = <T extends object>(repository: MockRepository<T>): Repository<T> =>
  repository as unknown as Repository<T>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const amenityId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';

const amenityEntity = (overrides: Partial<AmenityEntity> = {}): AmenityEntity => ({
  id: amenityId,
  propertyId,
  code: 'WIFI',
  label: 'WiFi',
  category: AmenityCategory.CONNECTIVITY,
  isActive: true,
  roomTypes: [],
  createdAt: new Date('2026-07-30T09:00:00.000Z'),
  updatedAt: new Date('2026-07-30T09:00:00.000Z'),
  ...overrides,
});

describe('AmenitiesService', () => {
  let service: AmenitiesService;
  let repository: MockRepository<AmenityEntity>;
  const propertiesService = { findOne: jest.fn() };

  beforeEach(() => {
    repository = {
      create: jest.fn((entity) => entity),
      find: jest.fn().mockResolvedValue([amenityEntity()]),
      findOne: jest.fn().mockResolvedValue(amenityEntity()),
      merge: jest.fn((entity, update) => ({ ...entity, ...update })),
      remove: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (entity) => ({ ...amenityEntity(), ...entity })),
    };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });
    service = new AmenitiesService(asRepository(repository), propertiesService as unknown as PropertiesService);
  });

  it('creates amenities with normalized property-scoped code', async () => {
    await service.create(propertyId, { code: 'mini fridge', label: 'Mini-Fridge', category: AmenityCategory.COMFORT });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      propertyId,
      code: 'MINI-FRIDGE',
      label: 'Mini-Fridge',
      isActive: true,
    }));
  });

  it('maps duplicate amenity codes to conflicts', async () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    repository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));
    await expect(service.create(propertyId, { code: 'WIFI', label: 'WiFi', category: AmenityCategory.CONNECTIVITY })).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates active state and metadata', async () => {
    await expect(service.update(propertyId, amenityId, { label: 'Wireless Internet', isActive: false })).resolves.toMatchObject({
      label: 'Wireless Internet',
      isActive: false,
    });
  });

  it('rejects room type assignment with inactive or cross-property amenities', async () => {
    repository.find?.mockResolvedValue([amenityEntity()]);
    await expect(service.findActiveByIds(propertyId, [amenityId, '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673'])).rejects.toBeInstanceOf(BadRequestException);
  });
});
