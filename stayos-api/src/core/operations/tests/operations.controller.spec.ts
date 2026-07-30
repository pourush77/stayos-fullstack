import { Test, TestingModule } from '@nestjs/testing';
import { OperationsController } from '../controllers/operations.controller';
import { ActivityFeedService } from '../services/activity-feed.service';
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
  const needsAttentionService = { getNeedsAttention: jest.fn() };
  const activityFeedService = { getActivityFeed: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [
        { provide: RoomBoardService, useValue: roomBoardService },
        { provide: RoomDetailsService, useValue: roomDetailsService },
        { provide: RoomAvailabilityService, useValue: roomAvailabilityService },
        { provide: NeedsAttentionService, useValue: needsAttentionService },
        { provide: ActivityFeedService, useValue: activityFeedService },
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

  it('delegates activity feed requests', async () => {
    activityFeedService.getActivityFeed.mockResolvedValue([]);

    await expect(controller.getActivityFeed(propertyId, { limit: 10 })).resolves.toEqual([]);
    expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith(propertyId, { limit: 10 });
  });
});
