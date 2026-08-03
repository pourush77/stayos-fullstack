import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioPaymentMethod } from '../../billing/domain/folio-payment-method.enum';
import { GroupBookingStatus } from '../domain/group-booking-status.enum';
import {
  AddGroupRoomingListItemDto,
  AssignGroupRoomDto,
  CreateGroupHoldDto,
  GroupCheckInPreviewDto,
  GroupCheckInResultDto,
  GroupHoldDto,
  GroupHoldRoomBlockDto,
  GroupMasterFolioDetailDto,
  InHouseGroupDto,
  PostGroupMasterFolioChargeDto,
  PostGroupMasterFolioPaymentDto,
  UpdateGroupHoldDto,
} from '../dto/operations.dto';
import { GroupBookingRoomAssignmentEntity } from '../infrastructure/group-booking-room-assignment.entity';
import { GroupBookingRoomBlockEntity } from '../infrastructure/group-booking-room-block.entity';
import { GroupBookingRoomingListEntity } from '../infrastructure/group-booking-rooming-list.entity';
import { GroupBookingEntity } from '../infrastructure/group-booking.entity';
import { GroupMasterFolioEntity } from '../infrastructure/group-master-folio.entity';
import { GroupStayEntity } from '../infrastructure/group-stay.entity';
import { GroupRoomMixService } from './group-room-mix.service';
import { activeReservationStatuses, overlapsDateRange } from './operations-query.helpers';

@Injectable()
export class GroupBookingService {
  constructor(
    @InjectRepository(GroupBookingEntity)
    private readonly groupBookingsRepository: Repository<GroupBookingEntity>,
    @InjectRepository(GroupBookingRoomBlockEntity)
    private readonly roomBlocksRepository: Repository<GroupBookingRoomBlockEntity>,
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypesRepository: Repository<RoomTypeEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GroupBookingRoomingListEntity)
    private readonly roomingListRepository: Repository<GroupBookingRoomingListEntity>,
    @InjectRepository(GroupBookingRoomAssignmentEntity)
    private readonly roomAssignmentsRepository: Repository<GroupBookingRoomAssignmentEntity>,
    @InjectRepository(GroupStayEntity)
    private readonly groupStaysRepository: Repository<GroupStayEntity>,
    @InjectRepository(GroupMasterFolioEntity)
    private readonly groupMasterFoliosRepository: Repository<GroupMasterFolioEntity>,
    private readonly dataSource: DataSource,
    private readonly propertiesService: PropertiesService,
    private readonly groupRoomMixService: GroupRoomMixService,
  ) {}

  async createHold(propertyId: string, dto: CreateGroupHoldDto): Promise<GroupHoldDto> {
    await this.propertiesService.findOne(propertyId);
    this.validateDateRange(dto.arrivalDate, dto.departureDate);

    const availability = await this.groupRoomMixService.getAvailability(
      propertyId,
      dto.arrivalDate,
      dto.departureDate,
    );
    const availabilityByRoomType = new Map(
      availability.map((item) => [item.roomTypeId, item.availableRooms]),
    );

    dto.roomBlocks.forEach((block) => {
      const availableRooms = availabilityByRoomType.get(block.roomTypeId) ?? 0;
      if (block.rooms > availableRooms) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_ERROR,
          message: `Only ${availableRooms} rooms are available for selected room type.`,
        });
      }
    });

    const roomTypes = await this.roomTypesRepository.find({
      where: {
        id: In(dto.roomBlocks.map((block) => block.roomTypeId)),
        propertyId,
      },
    });
    if (roomTypes.length !== new Set(dto.roomBlocks.map((block) => block.roomTypeId)).size) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'One or more room types do not belong to this property.',
      });
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const groupRepository = manager.getRepository(GroupBookingEntity);
      const blockRepository = manager.getRepository(GroupBookingRoomBlockEntity);
      const groupCode = await this.nextGroupCode(propertyId);
      const estimatedTotal =
        dto.estimatedTotal ??
        dto.roomBlocks.reduce((sum, block) => sum + (block.estimatedTotal ?? 0), 0);

      const group = await groupRepository.save(
        groupRepository.create({
          adults: dto.adults,
          arrivalDate: dto.arrivalDate,
          children: dto.children,
          departureDate: dto.departureDate,
          depositRequired: String(dto.depositRequired ?? 0),
          estimatedTotal: String(estimatedTotal),
          externalChannelId: null,
          groupCode,
          groupName: dto.groupName.trim(),
          leadEmail: dto.leadEmail?.trim() || null,
          leadName: dto.leadName.trim(),
          leadPhone: dto.leadPhone.trim(),
          notes: dto.notes?.trim() || null,
          propertyId,
          releaseAt: dto.releaseAt ? new Date(dto.releaseAt) : null,
          source: dto.source,
          status: GroupBookingStatus.ON_HOLD,
          syncStatus: 'PMS_ONLY',
        }),
      );

      const blocks = await blockRepository.save(
        dto.roomBlocks.map((block) =>
          blockRepository.create({
            adultsPerRoom: block.adultsPerRoom,
            baseRate: String(block.baseRate ?? 0),
            childrenPerRoom: block.childrenPerRoom,
            estimatedTotal: String(block.estimatedTotal ?? 0),
            groupBookingId: group.id,
            roomTypeId: block.roomTypeId,
            rooms: block.rooms,
          }),
        ),
      );

      return { blocks, group };
    });

    const roomTypeById = new Map(roomTypes.map((roomType) => [roomType.id, roomType]));
    return this.toGroupHoldDto(saved.group, saved.blocks, roomTypeById);
  }

  async listHolds(propertyId: string): Promise<GroupHoldDto[]> {
    await this.propertiesService.findOne(propertyId);
    const groups = await this.groupBookingsRepository.find({
      where: { propertyId },
      order: { arrivalDate: 'ASC', createdAt: 'DESC' },
    });
    const blocks = groups.length
      ? await this.roomBlocksRepository.find({
          where: { groupBookingId: In(groups.map((group) => group.id)) },
          relations: { roomType: true },
        })
      : [];
    const blocksByGroup = new Map<string, GroupBookingRoomBlockEntity[]>();
    blocks.forEach((block) => {
      blocksByGroup.set(block.groupBookingId, [
        ...(blocksByGroup.get(block.groupBookingId) ?? []),
        block,
      ]);
    });

    return groups.map((group) =>
      this.toGroupHoldDto(group, blocksByGroup.get(group.id) ?? [], new Map()),
    );
  }

  async getHold(propertyId: string, id: string): Promise<GroupHoldDto> {
    await this.propertiesService.findOne(propertyId);
    const group = await this.findGroup(propertyId, id);
    const blocks = await this.roomBlocksRepository.find({
      where: { groupBookingId: group.id },
      relations: { roomType: true },
    });
    return this.toGroupHoldDto(
      group,
      blocks,
      new Map(),
      await this.loadRoomingList(group.id),
      await this.loadAssignments(group.id),
    );
  }

  async updateHold(propertyId: string, id: string, dto: UpdateGroupHoldDto): Promise<GroupHoldDto> {
    await this.propertiesService.findOne(propertyId);
    const group = await this.findGroup(propertyId, id);
    this.ensureEditable(group);

    if (dto.groupName !== undefined) group.groupName = dto.groupName.trim();
    if (dto.leadName !== undefined) group.leadName = dto.leadName.trim();
    if (dto.leadPhone !== undefined) group.leadPhone = dto.leadPhone.trim();
    if (dto.leadEmail !== undefined) group.leadEmail = dto.leadEmail.trim() || null;
    if (dto.releaseAt !== undefined)
      group.releaseAt = dto.releaseAt ? new Date(dto.releaseAt) : null;
    if (dto.depositRequired !== undefined) group.depositRequired = String(dto.depositRequired);
    if (dto.notes !== undefined) group.notes = dto.notes.trim() || null;

    const saved = await this.groupBookingsRepository.save(group);
    const blocks = await this.roomBlocksRepository.find({
      where: { groupBookingId: saved.id },
      relations: { roomType: true },
    });
    return this.toGroupHoldDto(
      saved,
      blocks,
      new Map(),
      await this.loadRoomingList(saved.id),
      await this.loadAssignments(saved.id),
    );
  }

  async addRoomingListItem(
    propertyId: string,
    id: string,
    dto: AddGroupRoomingListItemDto,
  ): Promise<GroupHoldDto> {
    await this.propertiesService.findOne(propertyId);
    const group = await this.findGroup(propertyId, id);
    this.ensureEditable(group);
    await this.roomingListRepository.save(
      this.roomingListRepository.create({
        adults: dto.adults,
        assignedRoomId: null,
        children: dto.children,
        groupBookingId: group.id,
        guestName: dto.guestName.trim(),
        notes: dto.notes?.trim() || null,
        phone: dto.phone?.trim() || null,
      }),
    );
    return this.getHold(propertyId, id);
  }

  async assignRoom(propertyId: string, id: string, dto: AssignGroupRoomDto): Promise<GroupHoldDto> {
    await this.propertiesService.findOne(propertyId);
    const group = await this.findGroup(propertyId, id);
    this.ensureEditable(group);
    const room = await this.roomsRepository.findOne({
      where: { id: dto.roomId, propertyId },
      relations: { roomType: true },
    });
    if (!room)
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Room not found.' });

    const blocks = await this.roomBlocksRepository.find({ where: { groupBookingId: group.id } });
    const heldCount = blocks
      .filter((block) => block.roomTypeId === room.roomTypeId)
      .reduce((sum, block) => sum + block.rooms, 0);
    const assignedCount = await this.roomAssignmentsRepository.count({
      where: { groupBookingId: group.id, roomTypeId: room.roomTypeId },
    });
    if (assignedCount >= heldCount) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'All held rooms for this room type are already assigned.',
      });
    }

    const reservationConflict = await this.reservationsRepository.findOne({
      where: {
        propertyId,
        roomId: room.id,
        status: In(activeReservationStatuses),
        ...overlapsDateRange(group.arrivalDate, group.departureDate),
      },
    });
    if (reservationConflict) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Room has a reservation conflict for the group dates.',
      });
    }

    const groupConflict = await this.roomAssignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoin('assignment.groupBooking', 'groupBooking')
      .where('assignment.roomId = :roomId', { roomId: room.id })
      .andWhere('assignment.groupBookingId != :groupBookingId', { groupBookingId: group.id })
      .andWhere('groupBooking.status IN (:...statuses)', {
        statuses: [GroupBookingStatus.ON_HOLD, GroupBookingStatus.CONFIRMED],
      })
      .andWhere('groupBooking.arrivalDate < :departureDate', { departureDate: group.departureDate })
      .andWhere('groupBooking.departureDate > :arrivalDate', { arrivalDate: group.arrivalDate })
      .getOne();
    if (groupConflict) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Room is already assigned to another active group hold.',
      });
    }

    await this.roomAssignmentsRepository.save(
      this.roomAssignmentsRepository.create({
        groupBookingId: group.id,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
      }),
    );
    return this.getHold(propertyId, id);
  }

  async releaseHold(propertyId: string, id: string): Promise<GroupHoldDto> {
    return this.transitionHold(propertyId, id, GroupBookingStatus.RELEASED);
  }

  async cancelHold(propertyId: string, id: string): Promise<GroupHoldDto> {
    return this.transitionHold(propertyId, id, GroupBookingStatus.CANCELLED);
  }

  async confirmHold(propertyId: string, id: string): Promise<GroupHoldDto> {
    await this.propertiesService.findOne(propertyId);
    const group = await this.findGroup(propertyId, id);
    if (group.status !== GroupBookingStatus.ON_HOLD) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Only on-hold groups can be confirmed.',
      });
    }
    group.status = GroupBookingStatus.CONFIRMED;
    const saved = await this.groupBookingsRepository.save(group);
    const blocks = await this.roomBlocksRepository.find({
      where: { groupBookingId: saved.id },
      relations: { roomType: true },
    });
    return this.toGroupHoldDto(
      saved,
      blocks,
      new Map(),
      await this.loadRoomingList(saved.id),
      await this.loadAssignments(saved.id),
    );
  }

  async getCheckInPreview(propertyId: string, id: string): Promise<GroupCheckInPreviewDto> {
    const group = await this.getHold(propertyId, id);
    const blockers: string[] = [];
    const warnings: string[] = [];
    const totalHeldRooms = group.roomBlocks.reduce((sum, block) => sum + block.rooms, 0);

    if (group.status !== GroupBookingStatus.CONFIRMED)
      blockers.push('Group hold must be confirmed before check-in.');
    if (!group.readiness.contactComplete) blockers.push('Lead contact is incomplete.');
    if (!group.roomingList.length) blockers.push('Rooming list is missing.');
    if (!group.roomAssignments.length) blockers.push('No rooms are assigned.');
    if (group.roomAssignments.length < totalHeldRooms)
      warnings.push(
        `${totalHeldRooms - group.roomAssignments.length} held room(s) are still unassigned.`,
      );

    const assignedRooms = group.roomAssignments.length
      ? await this.roomsRepository.find({
          where: {
            id: In(group.roomAssignments.map((assignment) => assignment.roomId)),
            propertyId,
          },
          relations: { roomType: true },
        })
      : [];
    const rooms = assignedRooms.map((room) => ({
      operationalStatus: room.operationalStatus,
      ready: room.operationalStatus === RoomOperationalStatus.READY,
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomTypeName: room.roomType?.name ?? 'Room type',
    }));
    const notReady = rooms.filter((room) => !room.ready);
    if (notReady.length) blockers.push(`${notReady.length} assigned room(s) are not ready.`);

    return {
      blockers,
      canCheckIn: blockers.length === 0,
      folioMode: 'MASTER_FOLIO_ONLY',
      group,
      rooms,
      warnings,
    };
  }

  async checkInGroup(propertyId: string, id: string): Promise<GroupCheckInResultDto> {
    const preview = await this.getCheckInPreview(propertyId, id);
    if (!preview.canCheckIn) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: `Cannot check in group: ${preview.blockers.join(' ')}`,
      });
    }
    const existingStay = await this.groupStaysRepository.findOne({
      where: { groupBookingId: id, propertyId },
    });
    if (existingStay) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Group is already checked in.',
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const groupRepository = manager.getRepository(GroupBookingEntity);
      const stayRepository = manager.getRepository(GroupStayEntity);
      const folioRepository = manager.getRepository(GroupMasterFolioEntity);
      const roomRepository = manager.getRepository(RoomEntity);

      const group = await groupRepository.findOneByOrFail({ id, propertyId });
      group.status = GroupBookingStatus.CHECKED_IN;
      await groupRepository.save(group);

      const stay = await stayRepository.save(
        stayRepository.create({
          checkedInAt: new Date(),
          groupBookingId: id,
          propertyId,
          status: 'IN_HOUSE',
        }),
      );
      const folio = await folioRepository.save(
        folioRepository.create({
          currency: 'INR',
          estimatedTotal: String(preview.group.estimatedTotal),
          folioNumber: await this.nextGroupFolioNumber(propertyId),
          groupBookingId: id,
          groupStayId: stay.id,
          propertyId,
          status: 'OPEN',
        }),
      );

      await roomRepository.update(
        { id: In(preview.rooms.map((room) => room.roomId)), propertyId },
        { operationalStatus: RoomOperationalStatus.OCCUPIED },
      );

      return { folio, stay };
    });

    return {
      group: await this.getHold(propertyId, id),
      groupStayId: result.stay.id,
      masterFolioId: result.folio.id,
      masterFolioNumber: result.folio.folioNumber,
      occupiedRooms: preview.rooms.map((room) => room.roomNumber),
    };
  }

  async getGroupMasterFolioDetail(
    propertyId: string,
    groupBookingId: string,
  ): Promise<GroupMasterFolioDetailDto> {
    await this.propertiesService.findOne(propertyId);

    const group = await this.groupBookingsRepository.findOne({
      where: { id: groupBookingId, propertyId },
    });
    if (!group) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group booking not found.',
      });
    }

    const folio = await this.groupMasterFoliosRepository.findOne({
      where: { propertyId, groupBookingId },
    });
    if (!folio) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group master folio not found.',
      });
    }

    return this.buildGroupMasterFolioDetail(group, folio, groupBookingId);
  }

  async postGroupMasterFolioCharge(
    propertyId: string,
    groupBookingId: string,
    dto: PostGroupMasterFolioChargeDto,
  ): Promise<GroupMasterFolioDetailDto> {
    await this.propertiesService.findOne(propertyId);

    const group = await this.groupBookingsRepository.findOne({
      where: { id: groupBookingId, propertyId },
    });
    if (!group) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group booking not found.',
      });
    }

    const folio = await this.groupMasterFoliosRepository.findOne({
      where: { propertyId, groupBookingId },
    });
    if (!folio) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group master folio not found.',
      });
    }

    const charge = {
      amount: Number(dto.amount || 0),
      currency: folio.currency,
      id: `charge-${Date.now()}`,
      label: dto.label,
      quantity: dto.quantity ?? 1,
      type: dto.type || FolioChargeType.MISC,
    };
    const charges = [
      ...((folio as GroupMasterFolioEntity & { charges?: (typeof charge)[] }).charges ?? []),
      charge,
    ];
    const payments =
      (
        folio as GroupMasterFolioEntity & {
          payments?: Array<{ id: string; method: string; amount: number; receivedAt: string }>;
        }
      ).payments ?? [];
    const savedFolio = await this.groupMasterFoliosRepository.save({
      ...folio,
      charges,
      payments,
    } as GroupMasterFolioEntity);

    return this.buildGroupMasterFolioDetail(group, savedFolio, groupBookingId);
  }

  async postGroupMasterFolioPayment(
    propertyId: string,
    groupBookingId: string,
    dto: PostGroupMasterFolioPaymentDto,
  ): Promise<GroupMasterFolioDetailDto> {
    await this.propertiesService.findOne(propertyId);

    const group = await this.groupBookingsRepository.findOne({
      where: { id: groupBookingId, propertyId },
    });
    if (!group) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group booking not found.',
      });
    }

    const folio = await this.groupMasterFoliosRepository.findOne({
      where: { propertyId, groupBookingId },
    });
    if (!folio) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group master folio not found.',
      });
    }

    const payment = {
      amount: Number(dto.amount || 0),
      id: `payment-${Date.now()}`,
      method: dto.method || FolioPaymentMethod.CASH,
      receivedAt: new Date().toISOString(),
      reference: dto.reference,
    };
    const payments = [
      ...((folio as GroupMasterFolioEntity & { payments?: (typeof payment)[] }).payments ?? []),
      payment,
    ];
    const charges =
      (
        folio as GroupMasterFolioEntity & {
          charges?: Array<{
            id: string;
            label: string;
            type: string;
            amount: number;
            quantity: number;
            currency: string;
          }>;
        }
      ).charges ?? [];
    const savedFolio = await this.groupMasterFoliosRepository.save({
      ...folio,
      charges,
      payments,
    } as GroupMasterFolioEntity);

    return this.buildGroupMasterFolioDetail(group, savedFolio, groupBookingId);
  }

  async completeGroupCheckout(
    propertyId: string,
    groupBookingId: string,
  ): Promise<GroupMasterFolioDetailDto> {
    await this.propertiesService.findOne(propertyId);

    const group = await this.groupBookingsRepository.findOne({
      where: { id: groupBookingId, propertyId },
    });
    if (!group) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group booking not found.',
      });
    }

    const folio = await this.groupMasterFoliosRepository.findOne({
      where: { propertyId, groupBookingId },
    });
    if (!folio) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group master folio not found.',
      });
    }

    const detail = await this.buildGroupMasterFolioDetail(group, folio, groupBookingId);
    if (!detail.checkoutSummary.checkoutEligible) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: `Cannot complete checkout: ${detail.checkoutSummary.checkoutBlockers.join(' ')}`,
      });
    }
    if (detail.checkoutSummary.balanceDue > 0.01) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Cannot complete checkout while the folio still has a balance due.',
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const groupRepository = manager.getRepository(GroupBookingEntity);
      const stayRepository = manager.getRepository(GroupStayEntity);
      const folioRepository = manager.getRepository(GroupMasterFolioEntity);
      const roomRepository = manager.getRepository(RoomEntity);

      const latestGroup = await groupRepository.findOne({
        where: { id: groupBookingId, propertyId },
      });
      if (!latestGroup) {
        throw new NotFoundException({
          code: ApiErrorCode.NOT_FOUND,
          message: 'Group booking not found.',
        });
      }
      latestGroup.status = GroupBookingStatus.CHECKED_OUT;
      await groupRepository.save(latestGroup);

      const stay = await stayRepository.findOne({ where: { groupBookingId, propertyId } });
      if (!stay) {
        throw new NotFoundException({
          code: ApiErrorCode.NOT_FOUND,
          message: 'Group stay not found.',
        });
      }
      stay.status = 'CHECKED_OUT';
      await stayRepository.save(stay);

      const roomIds = detail.rooms.map((room) => room.roomId);
      if (roomIds.length) {
        await roomRepository.update(
          { id: In(roomIds), propertyId },
          { operationalStatus: RoomOperationalStatus.READY },
        );
      }

      const settledFolio = await folioRepository.save({
        ...folio,
        status: 'SETTLED',
      } as GroupMasterFolioEntity);

      return settledFolio;
    });

    return this.buildGroupMasterFolioDetail(group, result, groupBookingId);
  }

  async listInHouseGroups(propertyId: string): Promise<InHouseGroupDto[]> {
    await this.propertiesService.findOne(propertyId);
    const stays = await this.groupStaysRepository.find({
      where: { propertyId, status: 'IN_HOUSE' },
      relations: { groupBooking: true },
      order: { checkedInAt: 'DESC' },
    });
    if (!stays.length) return [];

    const groupIds = stays.map((stay) => stay.groupBookingId);
    const [folios, assignments] = await Promise.all([
      this.groupMasterFoliosRepository.find({
        where: { propertyId, groupBookingId: In(groupIds) },
      }),
      this.roomAssignmentsRepository.find({
        where: { groupBookingId: In(groupIds) },
        relations: { room: true },
      }),
    ]);
    const folioByGroup = new Map(folios.map((folio) => [folio.groupBookingId, folio]));
    const assignmentsByGroup = new Map<string, GroupBookingRoomAssignmentEntity[]>();
    assignments.forEach((assignment) => {
      assignmentsByGroup.set(assignment.groupBookingId, [
        ...(assignmentsByGroup.get(assignment.groupBookingId) ?? []),
        assignment,
      ]);
    });

    return stays.map((stay) => {
      const group = stay.groupBooking;
      const folio = folioByGroup.get(stay.groupBookingId);
      const groupAssignments = assignmentsByGroup.get(stay.groupBookingId) ?? [];
      return {
        arrivalDate: group.arrivalDate,
        departureDate: group.departureDate,
        groupBookingId: group.id,
        groupCode: group.groupCode,
        groupName: group.groupName,
        leadName: group.leadName,
        masterFolioId: folio?.id ?? '',
        masterFolioNumber: folio?.folioNumber ?? 'Master folio pending',
        occupiedRooms: groupAssignments.map((assignment) => assignment.room?.roomNumber ?? 'Room'),
        roomCount: groupAssignments.length,
      };
    });
  }

  private async buildGroupMasterFolioDetail(
    group: GroupBookingEntity,
    folio: GroupMasterFolioEntity,
    groupBookingId: string,
  ): Promise<GroupMasterFolioDetailDto> {
    const [blocks, assignments] = await Promise.all([
      this.roomBlocksRepository.find({ where: { groupBookingId }, relations: { roomType: true } }),
      this.roomAssignmentsRepository.find({
        where: { groupBookingId },
        relations: { room: { roomType: true } },
      }),
    ]);

    const baseCharges = blocks.map((block) => ({
      amount: Number(block.estimatedTotal || 0),
      currency: folio.currency,
      id: block.id,
      label: `${block.roomType?.name ?? 'Room'} x${block.rooms}`,
      quantity: block.rooms,
      type: 'ROOM',
    }));
    const existingCharges =
      (
        folio as GroupMasterFolioEntity & {
          charges?: Array<{
            id: string;
            label: string;
            type: string;
            amount: number;
            quantity: number;
            currency: string;
          }>;
        }
      ).charges ?? [];
    const existingPayments =
      (
        folio as GroupMasterFolioEntity & {
          payments?: Array<{ id: string; method: string; amount: number; receivedAt: string }>;
        }
      ).payments ?? [];
    const charges = [...baseCharges, ...existingCharges];
    const estimatedTotal = Number(folio.estimatedTotal || group.estimatedTotal || 0);
    const depositRequired = Number(group.depositRequired || 0);
    const paidAmount = existingPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
    const balanceDue = Math.max(
      estimatedTotal +
        existingCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0) -
        depositRequired -
        paidAmount,
      0,
    );
    const checkoutBlockers: string[] = [];
    if (!assignments.length) checkoutBlockers.push('No rooms assigned for checkout.');
    if (
      group.status === GroupBookingStatus.RELEASED ||
      group.status === GroupBookingStatus.CANCELLED
    ) {
      checkoutBlockers.push('Group is no longer active.');
    }

    return {
      arrivalDate: group.arrivalDate,
      charges,
      checkoutSummary: {
        balanceDue,
        checkoutBlockers,
        checkoutEligible: checkoutBlockers.length === 0,
        occupiedRoomCount: assignments.length,
      },
      currency: folio.currency,
      departureDate: group.departureDate,
      estimatedTotal:
        estimatedTotal +
        existingCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
      folioNumber: folio.folioNumber,
      groupBookingId: group.id,
      groupCode: group.groupCode,
      groupName: group.groupName,
      id: folio.id,
      payments: existingPayments.map((payment) => ({
        amount: Number(payment.amount || 0),
        id: payment.id,
        method: payment.method,
        receivedAt: payment.receivedAt,
      })),
      rooms: assignments.map((assignment) => ({
        roomId: assignment.roomId,
        roomNumber: assignment.room?.roomNumber ?? 'Room',
        roomTypeId: assignment.roomTypeId,
        roomTypeName: assignment.room?.roomType?.name ?? 'Room type',
      })),
      status: folio.status,
    };
  }

  private validateDateRange(arrivalDate: string, departureDate: string) {
    if (departureDate <= arrivalDate) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'departureDate must be after arrivalDate',
      });
    }
  }

  private async nextGroupCode(propertyId: string) {
    const count = await this.groupBookingsRepository.count({ where: { propertyId } });
    return `GRP-${String(count + 1).padStart(5, '0')}`;
  }

  private async nextGroupFolioNumber(propertyId: string) {
    const count = await this.groupMasterFoliosRepository.count({ where: { propertyId } });
    return `GFO-${String(count + 1).padStart(5, '0')}`;
  }

  private async findGroup(propertyId: string, id: string) {
    const group = await this.groupBookingsRepository.findOne({ where: { id, propertyId } });
    if (!group) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Group hold not found.',
      });
    }
    return group;
  }

  private ensureEditable(group: GroupBookingEntity) {
    if (![GroupBookingStatus.ON_HOLD, GroupBookingStatus.CONFIRMED].includes(group.status)) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: `Cannot edit a ${group.status.toLowerCase().replace('_', ' ')} group hold.`,
      });
    }
  }

  private loadRoomingList(groupBookingId: string) {
    return this.roomingListRepository.find({
      where: { groupBookingId },
      order: { createdAt: 'ASC' },
    });
  }

  private loadAssignments(groupBookingId: string) {
    return this.roomAssignmentsRepository.find({
      where: { groupBookingId },
      relations: { room: { roomType: true } },
      order: { createdAt: 'ASC' },
    });
  }

  private async transitionHold(
    propertyId: string,
    id: string,
    status: GroupBookingStatus.RELEASED | GroupBookingStatus.CANCELLED,
  ) {
    await this.propertiesService.findOne(propertyId);
    const group = await this.findGroup(propertyId, id);
    this.ensureEditable(group);
    group.status = status;
    const saved = await this.groupBookingsRepository.save(group);
    const blocks = await this.roomBlocksRepository.find({
      where: { groupBookingId: saved.id },
      relations: { roomType: true },
    });
    return this.toGroupHoldDto(
      saved,
      blocks,
      new Map(),
      await this.loadRoomingList(saved.id),
      await this.loadAssignments(saved.id),
    );
  }

  private toGroupHoldDto(
    group: GroupBookingEntity,
    blocks: GroupBookingRoomBlockEntity[],
    roomTypeById: Map<string, RoomTypeEntity>,
    roomingList: GroupBookingRoomingListEntity[] = [],
    roomAssignments: GroupBookingRoomAssignmentEntity[] = [],
  ): GroupHoldDto {
    return {
      adults: group.adults,
      arrivalDate: group.arrivalDate,
      children: group.children,
      departureDate: group.departureDate,
      depositRequired: Number(group.depositRequired),
      estimatedTotal: Number(group.estimatedTotal),
      groupCode: group.groupCode,
      groupName: group.groupName,
      id: group.id,
      leadEmail: group.leadEmail,
      leadName: group.leadName,
      leadPhone: group.leadPhone,
      releaseAt: group.releaseAt,
      roomBlocks: blocks.map((block): GroupHoldRoomBlockDto => {
        const roomType = block.roomType ?? roomTypeById.get(block.roomTypeId);
        return {
          adultsPerRoom: block.adultsPerRoom,
          baseRate: Number(block.baseRate),
          childrenPerRoom: block.childrenPerRoom,
          estimatedTotal: Number(block.estimatedTotal),
          id: block.id,
          roomTypeId: block.roomTypeId,
          roomTypeName: roomType?.name ?? 'Room type',
          rooms: block.rooms,
        };
      }),
      roomAssignments: roomAssignments.map((assignment) => ({
        id: assignment.id,
        roomId: assignment.roomId,
        roomNumber: assignment.room?.roomNumber ?? 'Room',
        roomTypeId: assignment.roomTypeId,
        roomTypeName: assignment.room?.roomType?.name ?? 'Room type',
      })),
      roomingList: roomingList.map((item) => ({
        adults: item.adults,
        assignedRoomId: item.assignedRoomId,
        children: item.children,
        guestName: item.guestName,
        id: item.id,
        notes: item.notes,
        phone: item.phone,
      })),
      readiness: {
        canConfirm:
          group.status === GroupBookingStatus.ON_HOLD &&
          Boolean(group.leadName && group.leadPhone) &&
          roomingList.length > 0,
        contactComplete: Boolean(group.leadName && group.leadPhone),
        depositRequired: Number(group.depositRequired) > 0,
        fullyAssigned:
          roomAssignments.length >= blocks.reduce((sum, block) => sum + block.rooms, 0),
        releaseDateSet: Boolean(group.releaseAt),
        roomingListStarted: roomingList.length > 0,
      },
      source: group.source,
      status: group.status,
      syncStatus: group.syncStatus,
    };
  }
}
