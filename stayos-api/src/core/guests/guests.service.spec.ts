import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { PropertiesService } from '../properties/properties.service';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { GuestStatus } from './domain/guest-status.enum';
import { GuestEntity } from './infrastructure/guest.entity';
import { GuestsService } from './guests.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const guestEntity: GuestEntity = {
  id: guestId,
  propertyId,
  property: undefined as never,
  firstName: 'Aarav',
  lastName: 'Mehta',
  displayName: 'Aarav Mehta',
  phone: '+919876543210',
  alternatePhone: null,
  email: 'aarav.mehta@example.com',
  gender: null,
  dateOfBirth: null,
  anniversaryDate: null,
  nationality: 'Indian',
  preferredLanguage: 'English',
  companyName: null,
  gstNumber: null,
  vipStatus: false,
  blacklistStatus: false,
  notes: null,
  status: GuestStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('GuestsService', () => {
  let service: GuestsService;
  let guestsRepository: MockRepository<GuestEntity>;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let foliosRepository: MockRepository<FolioEntity>;
  const propertiesService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    guestsRepository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn(),
      save: jest.fn(),
    };
    reservationsRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    foliosRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestsService,
        { provide: getRepositoryToken(GuestEntity), useValue: guestsRepository },
        { provide: getRepositoryToken(ReservationEntity), useValue: reservationsRepository },
        { provide: getRepositoryToken(FolioEntity), useValue: foliosRepository },
        { provide: PropertiesService, useValue: propertiesService },
      ],
    }).compile();

    service = module.get(GuestsService);
  });

  it('creates a guest scoped to the property', async () => {
    guestsRepository.findOne?.mockResolvedValue(null);
    guestsRepository.create?.mockReturnValue(guestEntity);
    guestsRepository.save?.mockResolvedValue(guestEntity);

    await expect(
      service.create(propertyId, {
        firstName: 'Aarav',
        lastName: 'Mehta',
        phone: '+919876543210',
      }),
    ).resolves.toEqual(guestEntity);
    expect(guestsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId,
        firstName: 'Aarav',
        displayName: 'Aarav Mehta',
        phone: '+919876543210',
      }),
    );
  });

  it('rejects duplicate phone within the same property', async () => {
    guestsRepository.findOne?.mockResolvedValue(guestEntity);

    await expect(
      service.create(propertyId, {
        firstName: 'Aarav',
        phone: '+919876543210',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps database duplicate phone errors to conflicts', async () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    guestsRepository.findOne?.mockResolvedValue(null);
    guestsRepository.create?.mockReturnValue(guestEntity);
    guestsRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(
      service.create(propertyId, {
        firstName: 'Aarav',
        phone: '+919876543210',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists guests with pagination and default display name sort', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[guestEntity], 1]),
    };
    guestsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(
      service.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      data: [guestEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('guest.displayName', 'ASC');
  });

  it('returns all guests when page and limit are omitted', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([guestEntity]),
    };
    guestsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(service.findAll(propertyId, { sortOrder: 'ASC' })).resolves.toEqual({
      data: [guestEntity],
    });
  });

  it('searches guests across identity, contact, and company fields', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([guestEntity]),
    };
    guestsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await service.findAll(propertyId, { search: 'aarav', sortOrder: 'ASC' });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('guest.email'), {
      search: '%aarav%',
    });
  });

  it('rejects unsupported sort fields', async () => {
    await expect(
      service.findAll(propertyId, { sortBy: 'unsupported', sortOrder: 'ASC' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a guest and recalculates display name when names change', async () => {
    guestsRepository.findOne?.mockResolvedValue(guestEntity);
    guestsRepository.merge?.mockImplementation((guest, update) => ({ ...guest, ...update }));
    guestsRepository.save?.mockImplementation(async (guest) => guest);

    await expect(service.update(propertyId, guestId, { lastName: 'Sharma' })).resolves.toEqual({
      ...guestEntity,
      lastName: 'Sharma',
      displayName: 'Aarav Sharma',
      reservations: [],
    });
  });

  it('updates guest preference fields', async () => {
    guestsRepository.findOne?.mockResolvedValue(guestEntity);
    guestsRepository.merge?.mockImplementation((guest, update) => ({ ...guest, ...update }));
    guestsRepository.save?.mockImplementation(async (guest) => guest);

    await expect(
      service.update(propertyId, guestId, {
        bedPreference: 'King',
        dietaryNotes: 'Vegetarian',
        floorPreference: 'High floor',
        roomPreference: 'Quiet room',
        smokingPreference: 'Non-smoking',
      }),
    ).resolves.toEqual({
      ...guestEntity,
      bedPreference: 'King',
      dietaryNotes: 'Vegetarian',
      floorPreference: 'High floor',
      reservations: [],
      roomPreference: 'Quiet room',
      smokingPreference: 'Non-smoking',
    });
  });

  it('gets a guest by id within the property', async () => {
    guestsRepository.findOne?.mockResolvedValue(guestEntity);

    await expect(service.findOne(propertyId, guestId)).resolves.toEqual({
      ...guestEntity,
      reservations: [],
    });
    expect(guestsRepository.findOne).toHaveBeenCalledWith({
      where: { id: guestId, propertyId },
    });
    expect(reservationsRepository.find).toHaveBeenCalledWith({
      where: { guestId, propertyId },
      order: { arrivalDate: 'DESC' },
      relations: { room: true, roomType: true },
    });
  });

  it('rejects guests that do not belong to the property', async () => {
    guestsRepository.findOne?.mockResolvedValue(null);

    await expect(service.findOne(otherPropertyId, guestId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(guestsRepository.findOne).toHaveBeenCalledWith({
      where: { id: guestId, propertyId: otherPropertyId },
    });
  });
});
