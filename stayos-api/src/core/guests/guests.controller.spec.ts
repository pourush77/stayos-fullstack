import { Test, TestingModule } from '@nestjs/testing';
import { GuestStatus } from './domain/guest-status.enum';
import { GuestEntity } from './infrastructure/guest.entity';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
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

describe('GuestsController', () => {
  let controller: GuestsController;
  const guestsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GuestsController],
      providers: [{ provide: GuestsService, useValue: guestsService }],
    }).compile();

    controller = module.get(GuestsController);
  });

  it('returns a standard paginated list payload', async () => {
    guestsService.findAll.mockResolvedValue({
      data: [guestEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(
      controller.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      success: true,
      message: 'Records fetched successfully.',
      data: [guestEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('delegates create requests to the service', async () => {
    guestsService.create.mockResolvedValue(guestEntity);
    const payload = { firstName: 'Aarav', phone: '+919876543210' };

    await expect(controller.create(propertyId, payload)).resolves.toEqual(guestEntity);
    expect(guestsService.create).toHaveBeenCalledWith(propertyId, payload);
  });

  it('delegates get-by-id requests to the service', async () => {
    guestsService.findOne.mockResolvedValue(guestEntity);

    await expect(controller.findOne(propertyId, guestId)).resolves.toEqual(guestEntity);
    expect(guestsService.findOne).toHaveBeenCalledWith(propertyId, guestId);
  });

  it('delegates update requests to the service', async () => {
    guestsService.update.mockResolvedValue({ ...guestEntity, vipStatus: true });

    await expect(controller.update(propertyId, guestId, { vipStatus: true })).resolves.toEqual({
      ...guestEntity,
      vipStatus: true,
    });
    expect(guestsService.update).toHaveBeenCalledWith(propertyId, guestId, { vipStatus: true });
  });
});
