import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypeStatus } from './domain/room-type-status.enum';
import { RoomTypeEntity } from './infrastructure/room-type.entity';
import { RoomTypesService } from './room-types.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const roomTypeEntity: RoomTypeEntity = {
  id: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
  propertyId,
  property: undefined as never,
  code: 'DLX',
  name: 'Deluxe Room',
  description: null,
  baseOccupancy: 2,
  maxOccupancy: 3,
  maxAdults: 2,
  maxChildren: 1,
  bedType: 'King',
  sizeSqFt: 320,
  status: RoomTypeStatus.ACTIVE,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

describe('RoomTypesService', () => {
  let service: RoomTypesService;
  let repository: MockRepository<RoomTypeEntity>;
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
        RoomTypesService,
        { provide: getRepositoryToken(RoomTypeEntity), useValue: repository },
        { provide: PropertiesService, useValue: propertiesService },
      ],
    }).compile();

    service = module.get(RoomTypesService);
  });

  it('lists room types with pagination', async () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[roomTypeEntity], 1]),
    };
    repository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(
      service.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      data: [roomTypeEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('returns all room types when page and limit are omitted', async () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([roomTypeEntity]),
    };
    repository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(service.findAll(propertyId, { sortOrder: 'ASC' } as any)).resolves.toEqual({
      data: [roomTypeEntity],
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('roomType.name', 'ASC');
    expect(queryBuilder.getMany).toHaveBeenCalled();
  });

  it('creates a room type under a property', async () => {
    repository.create?.mockReturnValue(roomTypeEntity);
    repository.save?.mockResolvedValue(roomTypeEntity);

    await expect(
      service.create(propertyId, {
        code: 'DLX',
        name: 'Deluxe Room',
        baseOccupancy: 2,
        maxOccupancy: 3,
        maxAdults: 2,
        maxChildren: 1,
      }),
    ).resolves.toEqual(roomTypeEntity);
  });

  it('rejects invalid occupancy rules', async () => {
    await expect(
      service.create(propertyId, {
        code: 'DLX',
        name: 'Deluxe Room',
        baseOccupancy: 4,
        maxOccupancy: 3,
        maxAdults: 2,
        maxChildren: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate room type codes to conflicts', async () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    repository.create?.mockReturnValue(roomTypeEntity);
    repository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(
      service.create(propertyId, {
        code: 'DLX',
        name: 'Deluxe Room',
        baseOccupancy: 2,
        maxOccupancy: 3,
        maxAdults: 2,
        maxChildren: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
