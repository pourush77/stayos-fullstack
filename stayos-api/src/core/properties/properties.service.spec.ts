import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertyStatus } from './domain/property-status.enum';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyEntity } from './infrastructure/property.entity';
import { PropertiesService } from './properties.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = (): MockRepository<PropertyEntity> => ({
  createQueryBuilder: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  save: jest.fn(),
});

const propertyPayload: CreatePropertyDto = {
  code: 'STAYOS-BLR-001',
  name: 'StayOS Bengaluru Central',
  legalName: 'StayOS Hospitality Private Limited',
  gstNumber: '29ABCDE1234F1Z5',
  email: 'frontdesk.blr@stayos.com',
  phone: '+918012345678',
  addressLine1: '12 Residency Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  stateCode: '29',
  country: 'India',
  postalCode: '560001',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  totalFloors: 6,
  totalRooms: 120,
};

const propertyEntity: PropertyEntity = {
  id: '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  ...propertyPayload,
  panNumber: null,
  cinNumber: null,
  logoUrl: null,
  website: null,
  addressLine2: null,
  status: PropertyStatus.ACTIVE,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: MockRepository<PropertyEntity>;

  beforeEach(async () => {
    repository = createRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getRepositoryToken(PropertyEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(PropertiesService);
  });

  it('lists properties ordered by name', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[propertyEntity], 1]),
    };
    repository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(service.findAll({ page: 1, limit: 20, sortOrder: 'ASC' })).resolves.toEqual({
      data: [propertyEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('property.name', 'ASC');
  });

  it('returns the full property list when page and limit are omitted', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([propertyEntity]),
    };
    repository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(service.findAll({ sortOrder: 'ASC' } as any)).resolves.toEqual({
      data: [propertyEntity],
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('property.name', 'ASC');
    expect(queryBuilder.getMany).toHaveBeenCalled();
  });

  it('returns a property by id', async () => {
    repository.findOne?.mockResolvedValue(propertyEntity);

    await expect(service.findOne(propertyEntity.id)).resolves.toEqual(propertyEntity);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: propertyEntity.id },
    });
  });

  it('throws when a property is missing', async () => {
    repository.findOne?.mockResolvedValue(null);

    await expect(service.findOne(propertyEntity.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a property with nullable optional fields', async () => {
    repository.create?.mockReturnValue(propertyEntity);
    repository.save?.mockResolvedValue(propertyEntity);

    await expect(service.create(propertyPayload)).resolves.toEqual(propertyEntity);
    expect(repository.create).toHaveBeenCalledWith({
      ...propertyPayload,
      panNumber: null,
      cinNumber: null,
      logoUrl: null,
      website: null,
      addressLine2: null,
    });
  });

  it('maps unique code violations to conflict errors', async () => {
    const driverError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    const queryError = new QueryFailedError('', [], driverError);
    repository.create?.mockReturnValue(propertyEntity);
    repository.save?.mockRejectedValue(queryError);

    await expect(service.create(propertyPayload)).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates an existing property', async () => {
    const updatedProperty = { ...propertyEntity, name: 'Updated Property' };
    repository.findOne?.mockResolvedValue(propertyEntity);
    repository.merge?.mockReturnValue(updatedProperty);
    repository.save?.mockResolvedValue(updatedProperty);

    await expect(service.update(propertyEntity.id, { name: 'Updated Property' })).resolves.toEqual(
      updatedProperty,
    );
    expect(repository.merge).toHaveBeenCalledWith(propertyEntity, {
      name: 'Updated Property',
    });
  });
});
