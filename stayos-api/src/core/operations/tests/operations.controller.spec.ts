import { Test, TestingModule } from '@nestjs/testing';
import { OperationsController } from '../controllers/operations.controller';
import { ActivityFeedService } from '../services/activity-feed.service';
import { AssignableReservationsService } from '../services/assignable-reservations.service';
import { GroupBookingService } from '../services/group-booking.service';
import { GroupRoomMixService } from '../services/group-room-mix.service';
import { NeedsAttentionService } from '../services/needs-attention.service';
import { RoomAvailabilityService } from '../services/room-availability.service';
import { RoomBoardService } from '../services/room-board.service';
import { RoomDetailsService } from '../services/room-details.service';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';

describe('OperationsController', () => {
  let controller: OperationsController;
  const roomBoardService = { getRoomBoard: jest.fn() };
  const roomDetailsService = { getRoomDetails: jest.fn() };
  const roomAvailabilityService = { getAvailableRooms: jest.fn() };
  const groupBookingService = {
    cancelHold: jest.fn(),
    createHold: jest.fn(),
    getHold: jest.fn(),
    listHolds: jest.fn(),
    listInHouseGroups: jest.fn(),
    releaseHold: jest.fn(),
    updateHold: jest.fn(),
  };
  const groupRoomMixService = { suggestRoomMix: jest.fn() };
  const needsAttentionService = { getNeedsAttention: jest.fn() };
  const activityFeedService = { getActivityFeed: jest.fn() };
  const assignableReservationsService = { getAssignableReservations: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [
        { provide: RoomBoardService, useValue: roomBoardService },
        { provide: RoomDetailsService, useValue: roomDetailsService },
        { provide: RoomAvailabilityService, useValue: roomAvailabilityService },
        { provide: GroupBookingService, useValue: groupBookingService },
        { provide: GroupRoomMixService, useValue: groupRoomMixService },
        { provide: NeedsAttentionService, useValue: needsAttentionService },
        { provide: ActivityFeedService, useValue: activityFeedService },
        { provide: AssignableReservationsService, useValue: assignableReservationsService },
      ],
    }).compile();

    controller = module.get(OperationsController);
  });

  it('delegates room board requests', async () => {
    roomBoardService.getRoomBoard.mockResolvedValue([]);

    await expect(controller.getRoomBoard(propertyId)).resolves.toEqual([]);
    expect(roomBoardService.getRoomBoard).toHaveBeenCalledWith(propertyId);
  });

  it('delegates room drawer requests', async () => {
    roomDetailsService.getRoomDetails.mockResolvedValue({ roomSummary: {} });

    await expect(controller.getRoomDetails(propertyId, roomId)).resolves.toEqual({
      roomSummary: {},
    });
    expect(roomDetailsService.getRoomDetails).toHaveBeenCalledWith(propertyId, roomId);
  });

  it('delegates available room requests with query filters', async () => {
    const query = { arrivalDate: '2026-07-15', departureDate: '2026-07-17' };
    roomAvailabilityService.getAvailableRooms.mockResolvedValue([]);

    await expect(controller.getAvailableRooms(propertyId, query)).resolves.toEqual([]);
    expect(roomAvailabilityService.getAvailableRooms).toHaveBeenCalledWith(propertyId, query);
  });

  it('delegates assignable reservation requests with room filters', async () => {
    const query = { roomId };
    const response = [{ reservationId: 'reservation-id' }];
    assignableReservationsService.getAssignableReservations.mockResolvedValue(response);

    await expect(controller.getAssignableReservations(propertyId, query)).resolves.toEqual(
      response,
    );
    expect(assignableReservationsService.getAssignableReservations).toHaveBeenCalledWith(
      propertyId,
      query,
    );
  });

  it('delegates group room mix suggestion requests', async () => {
    const query = {
      adults: 10,
      arrivalDate: '2026-08-03',
      children: 6,
      departureDate: '2026-08-05',
    };
    groupRoomMixService.suggestRoomMix.mockResolvedValue({ options: [] });

    await expect(controller.suggestGroupRoomMix(propertyId, query)).resolves.toEqual({
      options: [],
    });
    expect(groupRoomMixService.suggestRoomMix).toHaveBeenCalledWith(propertyId, query);
  });

  it('delegates group hold creation requests', async () => {
    const dto = {
      adults: 10,
      arrivalDate: '2026-08-03',
      children: 6,
      departureDate: '2026-08-05',
      groupName: 'Sharma Family',
      leadName: 'Rajat Sharma',
      leadPhone: '9876543210',
      roomBlocks: [{ adultsPerRoom: 2, childrenPerRoom: 1, roomTypeId: 'room-type-id', rooms: 4 }],
      source: 'PHONE',
    } as never;
    groupBookingService.createHold.mockResolvedValue({ groupCode: 'GRP-00001' });

    await expect(controller.createGroupHold(propertyId, dto)).resolves.toEqual({
      groupCode: 'GRP-00001',
    });
    expect(groupBookingService.createHold).toHaveBeenCalledWith(propertyId, dto);
  });

  it('delegates group hold list requests', async () => {
    groupBookingService.listHolds.mockResolvedValue([]);

    await expect(controller.getGroupHolds(propertyId)).resolves.toEqual([]);
    expect(groupBookingService.listHolds).toHaveBeenCalledWith(propertyId);
  });

  it('delegates group hold detail and management requests', async () => {
    const groupHoldId = 'c175c8fa-f36e-4f40-a3ef-2e9dbb1f0679';
    groupBookingService.getHold.mockResolvedValue({ id: groupHoldId });
    groupBookingService.updateHold.mockResolvedValue({ id: groupHoldId, leadName: 'Updated' });
    groupBookingService.releaseHold.mockResolvedValue({ id: groupHoldId, status: 'RELEASED' });
    groupBookingService.cancelHold.mockResolvedValue({ id: groupHoldId, status: 'CANCELLED' });

    await expect(controller.getGroupHold(propertyId, groupHoldId)).resolves.toEqual({
      id: groupHoldId,
    });
    await expect(
      controller.updateGroupHold(propertyId, groupHoldId, { leadName: 'Updated' }),
    ).resolves.toEqual({ id: groupHoldId, leadName: 'Updated' });
    await expect(controller.releaseGroupHold(propertyId, groupHoldId)).resolves.toEqual({
      id: groupHoldId,
      status: 'RELEASED',
    });
    await expect(controller.cancelGroupHold(propertyId, groupHoldId)).resolves.toEqual({
      id: groupHoldId,
      status: 'CANCELLED',
    });
  });

  it('delegates in-house group visibility requests', async () => {
    const inHouseGroups = [{ groupCode: 'GRP-00007', groupName: 'Hillston Visit' }];
    groupBookingService.listInHouseGroups.mockResolvedValue(inHouseGroups as never);

    await expect(controller.getInHouseGroups(propertyId)).resolves.toEqual(inHouseGroups);
    expect(groupBookingService.listInHouseGroups).toHaveBeenCalledWith(propertyId);
  });

  it('delegates activity feed requests', async () => {
    activityFeedService.getActivityFeed.mockResolvedValue([]);

    await expect(controller.getActivityFeed(propertyId, { limit: 10 })).resolves.toEqual([]);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith(propertyId, { limit: 10 });
  });
});
