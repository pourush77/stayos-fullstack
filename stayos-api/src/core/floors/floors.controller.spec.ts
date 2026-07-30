import { Test, TestingModule } from '@nestjs/testing';
import { FloorStatus } from './domain/floor-status.enum';
import { FloorEntity } from './infrastructure/floor.entity';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';

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

describe('FloorsController', () => {
  let controller: FloorsController;
  const floorsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FloorsController],
      providers: [{ provide: FloorsService, useValue: floorsService }],
    }).compile();

    controller = module.get(FloorsController);
  });

  it('returns a standard paginated list payload', async () => {
    floorsService.findAll.mockResolvedValue({
      data: [floorEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(
      controller.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      success: true,
      message: 'Records fetched successfully.',
      data: [floorEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('delegates create requests to the service', async () => {
    floorsService.create.mockResolvedValue(floorEntity);

    await expect(
      controller.create(propertyId, {
        code: 'FLOOR-01',
        name: 'First Floor',
        floorNumber: 1,
      }),
    ).resolves.toEqual(floorEntity);
    expect(floorsService.create).toHaveBeenCalledWith(propertyId, {
      code: 'FLOOR-01',
      name: 'First Floor',
      floorNumber: 1,
    });
  });
});
