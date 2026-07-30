import { Test, TestingModule } from '@nestjs/testing';
import { RoomTypeStatus } from './domain/room-type-status.enum';
import { RoomTypeEntity } from './infrastructure/room-type.entity';
import { RoomTypesController } from './room-types.controller';
import { RoomTypesService } from './room-types.service';

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

describe('RoomTypesController', () => {
  let controller: RoomTypesController;
  const roomTypesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomTypesController],
      providers: [{ provide: RoomTypesService, useValue: roomTypesService }],
    }).compile();

    controller = module.get(RoomTypesController);
  });

  it('returns a standard paginated list payload', async () => {
    roomTypesService.findAll.mockResolvedValue({
      data: [roomTypeEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(
      controller.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      success: true,
      message: 'Records fetched successfully.',
      data: [roomTypeEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('delegates create requests to the service', async () => {
    roomTypesService.create.mockResolvedValue(roomTypeEntity);
    const payload = {
      code: 'DLX',
      name: 'Deluxe Room',
      baseOccupancy: 2,
      maxOccupancy: 3,
      maxAdults: 2,
      maxChildren: 1,
    };

    await expect(controller.create(propertyId, payload)).resolves.toEqual(roomTypeEntity);
    expect(roomTypesService.create).toHaveBeenCalledWith(propertyId, payload);
  });
});
