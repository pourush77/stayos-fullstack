import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { FloorStatus } from './domain/floor-status.enum';
import { FloorEntity } from './infrastructure/floor.entity';
import { FloorsService } from './floors.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const floorEntity: FloorEntity = {
  id: '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671',
  propertyId,
  property: undefined as never,
  code: 'FLOOR-01',
  name: 'First Floor',
  floorNumber: 1,
  displayOrder: 1,
  description: null,
  status: FloorStatus.ACTIVE,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

describe('FloorsService', () => {
  let service: FloorsService;
  let repository: MockRepository<FloorEntity>;
  const propertiesService = { findOne: jest.fn() };

  beforeEach(async () => {
    repository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn(),
      save: jest.fn(),
    };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FloorsService,
        { provide: getRepositoryToken(FloorEntity), useValue: repository },
        { provide: PropertiesService, useValue: propertiesService },
      ],
    }).compile();

    service = module.get(FloorsService);
  });

  it('lists floors with pagination', async () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[floorEntity], 1]),
    };
    repository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(
      service.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      data: [floorEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('returns all floors when page and limit are omitted', async () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([floorEntity]),
    };
    repository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(service.findAll(propertyId, { sortOrder: 'ASC' } as any)).resolves.toEqual({
      data: [floorEntity],
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('floor.displayOrder', 'ASC');
    expect(queryBuilder.getMany).toHaveBeenCalled();
  });

  it('creates a floor under a property', async () => {
    repository.create?.mockReturnValue(floorEntity);
    repository.save?.mockResolvedValue(floorEntity);

    await expect(
      service.create(propertyId, {
        code: 'FLOOR-01',
        name: 'First Floor',
        floorNumber: 1,
      }),
    ).resolves.toEqual(floorEntity);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId, displayOrder: 0 }),
    );
  });

  it('maps duplicate floor numbers to conflicts', async () => {
    const driverError = Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'UQ_floors_property_floor_number',
    });
    repository.create?.mockReturnValue(floorEntity);
    repository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(
      service.create(propertyId, {
        code: 'FLOOR-01',
        name: 'First Floor',
        floorNumber: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unsupported sort fields', async () => {
    await expect(
      service.findAll(propertyId, {
        page: 1,
        limit: 20,
        sortOrder: 'ASC',
        sortBy: 'unsafe',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
