import { Test, TestingModule } from '@nestjs/testing';
import { PropertyStatus } from './domain/property-status.enum';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyEntity } from './infrastructure/property.entity';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

const propertyEntity: PropertyEntity = {
  id: '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  code: 'STAYOS-BLR-001',
  name: 'StayOS Bengaluru Central',
  legalName: 'StayOS Hospitality Private Limited',
  gstNumber: '29ABCDE1234F1Z5',
  panNumber: null,
  cinNumber: null,
  logoUrl: null,
  email: 'frontdesk.blr@stayos.com',
  phone: '+918012345678',
  website: null,
  addressLine1: '12 Residency Road',
  addressLine2: null,
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
  status: PropertyStatus.ACTIVE,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

const createPropertyDto: CreatePropertyDto = {
  code: propertyEntity.code,
  name: propertyEntity.name,
  legalName: propertyEntity.legalName,
  gstNumber: propertyEntity.gstNumber,
  email: propertyEntity.email,
  phone: propertyEntity.phone,
  addressLine1: propertyEntity.addressLine1,
  city: propertyEntity.city,
  state: propertyEntity.state,
  stateCode: propertyEntity.stateCode,
  country: propertyEntity.country,
  postalCode: propertyEntity.postalCode,
  timezone: propertyEntity.timezone,
  currency: propertyEntity.currency,
  checkInTime: propertyEntity.checkInTime,
  checkOutTime: propertyEntity.checkOutTime,
  totalFloors: propertyEntity.totalFloors,
  totalRooms: propertyEntity.totalRooms,
};

describe('PropertiesController', () => {
  let controller: PropertiesController;
  const propertiesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        {
          provide: PropertiesService,
          useValue: propertiesService,
        },
      ],
    }).compile();

    controller = module.get(PropertiesController);
  });

  it('returns mapped property responses', async () => {
    propertiesService.findAll.mockResolvedValue({
      data: [propertyEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(controller.findAll({ page: 1, limit: 20, sortOrder: 'ASC' })).resolves.toEqual({
      success: true,
      message: 'Records fetched successfully.',
      data: [propertyEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('delegates create requests to the service', async () => {
    propertiesService.create.mockResolvedValue(propertyEntity);

    await expect(controller.create(createPropertyDto)).resolves.toEqual(propertyEntity);
    expect(propertiesService.create).toHaveBeenCalledWith(createPropertyDto);
  });

  it('delegates update requests to the service', async () => {
    propertiesService.update.mockResolvedValue(propertyEntity);

    await expect(
      controller.update(propertyEntity.id, { status: PropertyStatus.INACTIVE }),
    ).resolves.toEqual(propertyEntity);
    expect(propertiesService.update).toHaveBeenCalledWith(propertyEntity.id, {
      status: PropertyStatus.INACTIVE,
    });
  });
});
