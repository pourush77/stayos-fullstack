import { Test, TestingModule } from '@nestjs/testing';
import { RoomOperationalStatus } from './domain/room-operational-status.enum';
import { RoomStatus } from './domain/room-status.enum';
import { RoomEntity } from './infrastructure/room.entity';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

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
const roomResponse = {
  id: roomEntity.id,
  propertyId: roomEntity.propertyId,
  floorId: roomEntity.floorId,
  roomTypeId: roomEntity.roomTypeId,
  roomNumber: roomEntity.roomNumber,
  displayName: roomEntity.displayName,
  description: roomEntity.description,
  status: roomEntity.status,
  operationalStatus: roomEntity.operationalStatus,
  operationalStatusReason: roomEntity.operationalStatusReason,
  operationalStatusNote: roomEntity.operationalStatusNote,
  amenities: [],
  createdAt: roomEntity.createdAt,
  updatedAt: roomEntity.updatedAt,
};

describe('RoomsController', () => {
  let controller: RoomsController;
  const roomsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    markReady: jest.fn(),
    markCleaning: jest.fn(),
    markInspection: jest.fn(),
    block: jest.fn(),
    markOutOfService: jest.fn(),
    markOutOfOrder: jest.fn(),
    markMaintenance: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [{ provide: RoomsService, useValue: roomsService }],
    }).compile();

    controller = module.get(RoomsController);
  });

  it('returns a standard paginated list payload', async () => {
    roomsService.findAll.mockResolvedValue({
      data: [roomEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(
      controller.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      success: true,
      message: 'Records fetched successfully.',
      data: [roomResponse],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('delegates create requests to the service', async () => {
    roomsService.create.mockResolvedValue(roomEntity);
    const payload = { floorId, roomTypeId, roomNumber: '101' };

    await expect(controller.create(propertyId, payload)).resolves.toEqual(roomResponse);
    expect(roomsService.create).toHaveBeenCalledWith(propertyId, payload);
  });

  it('delegates mark-ready requests to the service', async () => {
    roomsService.markReady.mockResolvedValue({
      ...roomEntity,
      operationalStatus: RoomOperationalStatus.READY,
    });

    await expect(controller.markReady(propertyId, roomEntity.id)).resolves.toEqual(roomResponse);
    expect(roomsService.markReady).toHaveBeenCalledWith(propertyId, roomEntity.id);
  });

  it('delegates out-of-order requests with reason and note to the service', async () => {
    const payload = {
      reason: 'Plumbing',
      note: 'Bathroom leak reported by front desk',
    };
    const updatedRoom = {
      ...roomEntity,
      operationalStatus: RoomOperationalStatus.OUT_OF_ORDER,
      operationalStatusReason: payload.reason,
      operationalStatusNote: payload.note,
    };
    const updatedRoomResponse = {
      ...roomResponse,
      operationalStatus: RoomOperationalStatus.OUT_OF_ORDER,
      operationalStatusReason: payload.reason,
      operationalStatusNote: payload.note,
    };
    roomsService.markOutOfOrder.mockResolvedValue(updatedRoom);

    await expect(controller.markOutOfOrder(propertyId, roomEntity.id, payload)).resolves.toEqual(
      updatedRoomResponse,
    );
    expect(roomsService.markOutOfOrder).toHaveBeenCalledWith(propertyId, roomEntity.id, payload);
  });
});
