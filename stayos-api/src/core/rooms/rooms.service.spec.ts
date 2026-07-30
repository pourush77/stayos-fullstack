import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { FloorStatus } from '../floors/domain/floor-status.enum';
import { FloorEntity } from '../floors/infrastructure/floor.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypeStatus } from '../room-types/domain/room-type-status.enum';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from './domain/room-operational-status.enum';
import { RoomStatus } from './domain/room-status.enum';
import { RoomEntity } from './infrastructure/room.entity';
import { RoomsService } from './rooms.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const floorId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const roomTypeId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomEntity: RoomEntity = {
  id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673',
  propertyId,
  property: undefined as never,
  floorId,
  floor: undefined as never,
  roomTypeId,
  roomType: undefined as never,
  roomNumber: '101',
  displayName: 'Room 101',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: RoomOperationalStatus.READY,
  operationalStatusReason: null,
  operationalStatusNote: null,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};
const floorEntity: Partial<FloorEntity> = {
  id: floorId,
  propertyId,
  status: FloorStatus.ACTIVE,
};
const roomTypeEntity: Partial<RoomTypeEntity> = {
  id: roomTypeId,
  propertyId,
  status: RoomTypeStatus.ACTIVE,
};

describe('RoomsService', () => {
  let service: RoomsService;
  let roomsRepository: MockRepository<RoomEntity>;
  let floorsRepository: MockRepository<FloorEntity>;
  let roomTypesRepository: MockRepository<RoomTypeEntity>;
  const propertiesService = { findOne: jest.fn() };

  beforeEach(async () => {
    roomsRepository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn(),
      save: jest.fn(),
    };
    floorsRepository = { findOne: jest.fn().mockResolvedValue(floorEntity) };
    roomTypesRepository = {
      findOne: jest.fn().mockResolvedValue(roomTypeEntity),
    };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: getRepositoryToken(RoomEntity), useValue: roomsRepository },
        { provide: getRepositoryToken(FloorEntity), useValue: floorsRepository },
        {
          provide: getRepositoryToken(RoomTypeEntity),
          useValue: roomTypesRepository,
        },
        { provide: PropertiesService, useValue: propertiesService },
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  it('creates a room when floor and room type belong to the property', async () => {
    roomsRepository.create?.mockReturnValue(roomEntity);
    roomsRepository.save?.mockResolvedValue(roomEntity);

    await expect(
      service.create(propertyId, {
        floorId,
        roomTypeId,
        roomNumber: '101',
      }),
    ).resolves.toEqual(roomEntity);
  });

  it('rejects room references from another property', async () => {
    floorsRepository.findOne?.mockResolvedValue({ ...floorEntity, propertyId: 'other' });

    await expect(
      service.create(propertyId, {
        floorId,
        roomTypeId,
        roomNumber: '101',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists rooms with pagination', async () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[roomEntity], 1]),
    };
    roomsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(
      service.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      data: [roomEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('room.roomNumber', 'ASC');
  });

  it('returns all rooms when page and limit are omitted', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([roomEntity]),
    };
    roomsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(service.findAll(propertyId, { sortOrder: 'ASC' } as any)).resolves.toEqual({
      data: [roomEntity],
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('room.roomNumber', 'ASC');
    expect(queryBuilder.getMany).toHaveBeenCalled();
  });

  it('maps duplicate room numbers to conflicts', async () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    roomsRepository.create?.mockReturnValue(roomEntity);
    roomsRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(
      service.create(propertyId, {
        floorId,
        roomTypeId,
        roomNumber: '101',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks a room ready without changing lifecycle status', async () => {
    roomsRepository.findOne?.mockResolvedValue({
      ...roomEntity,
      operationalStatus: RoomOperationalStatus.NEEDS_CLEANING,
      operationalStatusReason: 'Checkout',
      operationalStatusNote: 'Guest departed',
    });
    roomsRepository.merge?.mockImplementation((room, update) => ({ ...room, ...update }));
    roomsRepository.save?.mockImplementation(async (room) => room);

    await expect(service.markReady(propertyId, roomEntity.id)).resolves.toEqual({
      ...roomEntity,
      status: RoomStatus.ACTIVE,
      operationalStatus: RoomOperationalStatus.READY,
      operationalStatusReason: null,
      operationalStatusNote: null,
    });
    expect(roomsRepository.findOne).toHaveBeenCalledWith({
      relations: ['roomType', 'roomType.amenities'],
      where: { id: roomEntity.id, propertyId },
    });
  });

  it('stores reason and note when marking room out of order', async () => {
    roomsRepository.findOne?.mockResolvedValue(roomEntity);
    roomsRepository.merge?.mockImplementation((room, update) => ({ ...room, ...update }));
    roomsRepository.save?.mockImplementation(async (room) => room);

    await expect(
      service.markOutOfOrder(propertyId, roomEntity.id, {
        reason: 'Plumbing',
        note: 'Bathroom leak reported by front desk',
      }),
    ).resolves.toEqual({
      ...roomEntity,
      operationalStatus: RoomOperationalStatus.OUT_OF_ORDER,
      operationalStatusReason: 'Plumbing',
      operationalStatusNote: 'Bathroom leak reported by front desk',
    });
  });

  it('blocks a room as out of service with optional note fields', async () => {
    roomsRepository.findOne?.mockResolvedValue(roomEntity);
    roomsRepository.merge?.mockImplementation((room, update) => ({ ...room, ...update }));
    roomsRepository.save?.mockImplementation(async (room) => room);

    await expect(
      service.block(propertyId, roomEntity.id, {
        reason: 'Owner hold',
      }),
    ).resolves.toEqual({
      ...roomEntity,
      operationalStatus: RoomOperationalStatus.OUT_OF_SERVICE,
      operationalStatusReason: 'Owner hold',
      operationalStatusNote: null,
    });
  });
});
