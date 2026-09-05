import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertyStatus } from './domain/property-status.enum';
import { GroupBookingDepositPolicyType } from './domain/group-booking-deposit-policy-type.enum';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyEntity } from './infrastructure/property.entity';
import { PropertiesService } from './properties.service';
import { PoliciesService } from '../policies/policies.service';
import { BusinessDateService } from './services/business-date.service';

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
  businessDayCutOffTime: '00:00:00',
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
  businessDayCutOffTime: '00:00:00',
  currentBusinessDate: '2026-06-30',
  status: PropertyStatus.ACTIVE,
  emailNotificationsEnabled: false,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: MockRepository<PropertyEntity>;
  const policiesService = { upsert: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    repository = createRepositoryMock();
    policiesService.upsert.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getRepositoryToken(PropertyEntity),
          useValue: repository,
        },
        {
          provide: PoliciesService,
          useValue: policiesService,
        },
        BusinessDateService,
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

  it('creates a property with nullable optional fields and initialized currentBusinessDate', async () => {
    repository.create?.mockReturnValue(propertyEntity);
    repository.save?.mockResolvedValue(propertyEntity);

    await expect(service.create(propertyPayload)).resolves.toEqual(propertyEntity);
    expect(repository.create).toHaveBeenCalledWith({
      ...propertyPayload,
      businessDayCutOffTime: '00:00:00',
      currentBusinessDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      panNumber: null,
      cinNumber: null,
      logoUrl: null,
      website: null,
      addressLine2: null,
    });
  });

  it('initializes currentBusinessDate respecting property timezone and cutoff semantics', async () => {
    const mockBusinessDateService = {
      resolveBusinessDate: jest.fn().mockReturnValue('2026-06-15'),
    };
    const customService = new PropertiesService(
      repository as any,
      policiesService as any,
      mockBusinessDateService as any,
    );

    repository.create?.mockImplementation((dto) => ({ ...propertyEntity, ...dto }));
    repository.save?.mockImplementation(async (entity) => entity);

    const created = await customService.create({
      ...propertyPayload,
      timezone: 'Asia/Kolkata',
      businessDayCutOffTime: '03:00',
    });

    expect(mockBusinessDateService.resolveBusinessDate).toHaveBeenCalledWith(
      expect.any(Date),
      'Asia/Kolkata',
      '03:00',
    );
    expect(created.currentBusinessDate).toBe('2026-06-15');
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
    const { propertyRepo } = setupTransaction();
    propertyRepo.save.mockResolvedValue(updatedProperty);

    await expect(service.update(propertyEntity.id, { name: 'Updated Property' })).resolves.toEqual(
      updatedProperty,
    );
    expect(propertyRepo.merge).toHaveBeenCalledWith(propertyEntity, {
      name: 'Updated Property',
    });
  });

  function setupTransaction(): {
    propertyRepo: { merge: jest.Mock; save: jest.Mock };
    manager: { getRepository: jest.Mock };
  } {
    const propertyRepo = {
      merge: jest.fn((entity: PropertyEntity, updates: Partial<PropertyEntity>) => ({
        ...entity,
        ...updates,
      })),
      save: jest.fn((entity: PropertyEntity) => Promise.resolve(entity)),
    };
    const manager = { getRepository: jest.fn(() => propertyRepo) };
    (repository as unknown as { manager: unknown }).manager = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    };
    return { propertyRepo, manager };
  }

  it('commits both base fields and the group deposit policy in one transaction', async () => {
    repository.findOne?.mockResolvedValue(propertyEntity);
    const { propertyRepo } = setupTransaction();

    await service.update(propertyEntity.id, {
      name: 'Renamed',
      groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
      groupBookingDepositPolicyValue: 5000,
    });

    // deposit upsert runs inside the SAME transaction manager
    expect(policiesService.upsert).toHaveBeenCalledWith(
      propertyEntity.id,
      'GROUP_DEPOSIT',
      { depositMode: GroupBookingDepositPolicyType.FIXED_AMOUNT, depositValue: 5000 },
      expect.anything(),
    );
    // legacy deposit columns are no longer written on the property row
    expect(propertyRepo.merge).toHaveBeenCalledWith(propertyEntity, { name: 'Renamed' });
    expect(propertyRepo.save).toHaveBeenCalledTimes(1);
  });

  it('does not touch the policies service when no deposit fields are provided', async () => {
    repository.findOne?.mockResolvedValue(propertyEntity);
    setupTransaction();

    await service.update(propertyEntity.id, { name: 'Renamed' });

    expect(policiesService.upsert).not.toHaveBeenCalled();
  });

  it('rolls back the base update when the deposit policy save fails', async () => {
    repository.findOne?.mockResolvedValue(propertyEntity);
    const { propertyRepo } = setupTransaction();
    policiesService.upsert.mockRejectedValueOnce(new Error('policy save failed'));

    await expect(
      service.update(propertyEntity.id, {
        name: 'Renamed',
        groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
        groupBookingDepositPolicyValue: 5000,
      }),
    ).rejects.toThrow('policy save failed');

    // deposit runs first; the base property row was never saved -> no partial state
    expect(propertyRepo.save).not.toHaveBeenCalled();
  });

  it('rolls back the deposit policy when the base property save fails', async () => {
    repository.findOne?.mockResolvedValue(propertyEntity);
    const { propertyRepo } = setupTransaction();
    propertyRepo.save.mockRejectedValueOnce(new Error('property save failed'));

    await expect(
      service.update(propertyEntity.id, {
        name: 'Renamed',
        groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
        groupBookingDepositPolicyValue: 5000,
      }),
    ).rejects.toThrow('property save failed');

    // both ran inside one transaction that rejected -> nothing commits
    expect(policiesService.upsert).toHaveBeenCalled();
  });
});
