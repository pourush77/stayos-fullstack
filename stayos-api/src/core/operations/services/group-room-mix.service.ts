import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { GroupBookingStatus } from '../domain/group-booking-status.enum';
import {
  GroupRoomMixAvailabilityDto,
  GroupRoomMixBlockDto,
  GroupRoomMixOptionDto,
  GroupRoomMixOptionType,
  GroupRoomMixPreference,
  GroupRoomMixSuggestionDto,
  GroupRoomMixSuggestionQueryDto,
} from '../dto/operations.dto';
import { GroupBookingRoomBlockEntity } from '../infrastructure/group-booking-room-block.entity';
import {
  activeReservationStatuses,
  findRoomsWithInventory,
  overlapsDateRange,
} from './operations-query.helpers';

type RoomTypeAvailability = GroupRoomMixAvailabilityDto;

type Candidate = {
  blocks: GroupRoomMixBlockDto[];
  adultCapacity: number;
  childCapacity: number;
  estimatedTotal: number;
  spareCapacity: number;
  totalCapacity: number;
  totalRooms: number;
};

@Injectable()
export class GroupRoomMixService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GroupBookingRoomBlockEntity)
    private readonly groupBookingRoomBlocksRepository: Repository<GroupBookingRoomBlockEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async suggestRoomMix(
    propertyId: string,
    query: GroupRoomMixSuggestionQueryDto,
  ): Promise<GroupRoomMixSuggestionDto> {
    await this.propertiesService.findOne(propertyId);
    this.validateQuery(query);

    const nights = this.calculateNights(query.arrivalDate, query.departureDate);
    const availability = await this.getAvailability(propertyId, query.arrivalDate, query.departureDate);
    const candidates = this.buildCandidates(availability, query.adults, query.children, nights);
    const options = this.selectOptions(candidates, query.preference ?? GroupRoomMixPreference.BEST_FIT);
    const warnings = this.buildWarnings(availability, candidates, query.adults, query.children);

    return {
      adults: query.adults,
      arrivalDate: query.arrivalDate,
      availability,
      channelManagerSyncReady: true,
      children: query.children,
      departureDate: query.departureDate,
      nights,
      options,
      warnings,
    };
  }

  private validateQuery(query: GroupRoomMixSuggestionQueryDto) {
    if (query.departureDate <= query.arrivalDate) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'departureDate must be after arrivalDate',
      });
    }
  }

  private calculateNights(arrivalDate: string, departureDate: string) {
    const start = new Date(`${arrivalDate}T00:00:00.000Z`);
    const end = new Date(`${departureDate}T00:00:00.000Z`);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  }

  async getAvailability(
    propertyId: string,
    arrivalDate: string,
    departureDate: string,
  ): Promise<RoomTypeAvailability[]> {
    const rooms = await findRoomsWithInventory(this.roomsRepository, propertyId);
    const readyRooms = rooms.filter((room) => room.operationalStatus === RoomOperationalStatus.READY);
    const conflictingReservations = readyRooms.length
      ? await this.reservationsRepository.find({
          where: {
            propertyId,
            roomId: In(readyRooms.map((room) => room.id)),
            status: In(activeReservationStatuses),
            ...overlapsDateRange(arrivalDate, departureDate),
          },
        })
      : [];
    const conflictedRoomIds = new Set(
      conflictingReservations
        .filter((reservation) => reservation.roomId)
        .map((reservation) => reservation.roomId as string),
    );
    const availableRooms = readyRooms.filter((room) => !conflictedRoomIds.has(room.id));
    const byRoomType = new Map<string, RoomTypeAvailability>();

    availableRooms.forEach((room) => {
      const roomType = room.roomType;
      if (!roomType) return;
      const existing = byRoomType.get(room.roomTypeId);
      if (existing) {
        existing.availableRooms += 1;
        return;
      }

      byRoomType.set(room.roomTypeId, {
        availableRooms: 1,
        baseRate: this.estimateBaseRate(roomType.name),
        maxAdults: roomType.maxAdults,
        maxChildren: roomType.maxChildren,
        maxOccupancy: roomType.maxOccupancy,
        roomTypeCode: roomType.code,
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
      });
    });

    const heldBlocks = await this.groupBookingRoomBlocksRepository
      .createQueryBuilder('block')
      .innerJoin('block.groupBooking', 'groupBooking')
      .where('groupBooking.propertyId = :propertyId', { propertyId })
      .andWhere('groupBooking.status IN (:...statuses)', {
        statuses: [GroupBookingStatus.ON_HOLD, GroupBookingStatus.CONFIRMED],
      })
      .andWhere('groupBooking.arrivalDate < :departureDate', { departureDate })
      .andWhere('groupBooking.departureDate > :arrivalDate', { arrivalDate })
      .getMany();

    heldBlocks.forEach((block) => {
      const roomType = byRoomType.get(block.roomTypeId);
      if (!roomType) return;
      roomType.availableRooms = Math.max(0, roomType.availableRooms - block.rooms);
    });

    return [...byRoomType.values()].sort((a, b) => {
      if (a.baseRate !== b.baseRate) return a.baseRate - b.baseRate;
      return a.roomTypeName.localeCompare(b.roomTypeName);
    });
  }

  private estimateBaseRate(roomTypeName: string) {
    const normalized = roomTypeName.toLowerCase();
    if (normalized.includes('suite')) return 6500;
    if (normalized.includes('deluxe')) return 3500;
    return 2800;
  }

  private buildCandidates(
    availability: RoomTypeAvailability[],
    adults: number,
    children: number,
    nights: number,
  ): Candidate[] {
    const candidates: Candidate[] = [];
    const counts = Array(availability.length).fill(0) as number[];

    const visit = (index: number) => {
      if (index === availability.length) {
        const candidate = this.toCandidate(availability, counts, nights);
        if (
          candidate.totalRooms > 0 &&
          candidate.adultCapacity >= adults &&
          candidate.childCapacity >= children &&
          candidate.totalCapacity >= adults + children
        ) {
          candidate.spareCapacity = candidate.totalCapacity - adults - children;
          candidates.push(candidate);
        }
        return;
      }

      for (let count = 0; count <= availability[index].availableRooms; count += 1) {
        counts[index] = count;
        visit(index + 1);
      }
    };

    visit(0);
    return candidates;
  }

  private toCandidate(
    availability: RoomTypeAvailability[],
    counts: number[],
    nights: number,
  ): Candidate {
    const blocks = availability
      .map((roomType, index) => ({ roomType, rooms: counts[index] }))
      .filter((item) => item.rooms > 0)
      .map(({ roomType, rooms }) => this.toBlock(roomType, rooms, nights));
    const adultCapacity = blocks.reduce((sum, block) => sum + block.maxAdults * block.rooms, 0);
    const childCapacity = blocks.reduce((sum, block) => sum + block.maxChildren * block.rooms, 0);
    const totalCapacity = blocks.reduce((sum, block) => sum + block.maxOccupancy * block.rooms, 0);
    const totalRooms = blocks.reduce((sum, block) => sum + block.rooms, 0);
    const estimatedTotal = blocks.reduce((sum, block) => sum + block.estimatedTotal, 0);

    return {
      adultCapacity,
      blocks,
      childCapacity,
      estimatedTotal,
      spareCapacity: 0,
      totalCapacity,
      totalRooms,
    };
  }

  private toBlock(
    roomType: RoomTypeAvailability,
    rooms: number,
    nights: number,
  ): GroupRoomMixBlockDto {
    return {
      adultsPerRoom: roomType.maxAdults,
      baseRate: roomType.baseRate,
      childrenPerRoom: roomType.maxChildren,
      estimatedTotal: roomType.baseRate * rooms * nights,
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
      maxOccupancy: roomType.maxOccupancy,
      rooms,
      roomTypeCode: roomType.roomTypeCode,
      roomTypeId: roomType.roomTypeId,
      roomTypeName: roomType.roomTypeName,
    };
  }

  private selectOptions(
    candidates: Candidate[],
    preference: GroupRoomMixPreference,
  ): GroupRoomMixOptionDto[] {
    if (!candidates.length) return [];

    const selectors: Array<{
      label: string;
      reason: string;
      sort: (candidate: Candidate) => Array<number | string>;
      type: GroupRoomMixOptionType;
    }> = [
      {
        label: 'Best Fit',
        reason: 'Lowest room count with the least unused capacity.',
        sort: (candidate) => [candidate.totalRooms, candidate.spareCapacity, candidate.estimatedTotal],
        type: GroupRoomMixOptionType.BEST_FIT,
      },
      {
        label: 'Comfort Fit',
        reason: 'More space for families while keeping the room count practical.',
        sort: (candidate) => [
          candidate.totalRooms,
          -this.premiumRoomCount(candidate),
          candidate.spareCapacity,
          candidate.estimatedTotal,
        ],
        type: GroupRoomMixOptionType.COMFORT,
      },
      {
        label: 'Budget Fit',
        reason: 'Lowest estimated room revenue option that still fits the group.',
        sort: (candidate) => [candidate.estimatedTotal, candidate.totalRooms, candidate.spareCapacity],
        type: GroupRoomMixOptionType.BUDGET,
      },
    ];
    const orderedSelectors =
      preference === GroupRoomMixPreference.COMFORT
        ? [selectors[1], selectors[0], selectors[2]]
        : preference === GroupRoomMixPreference.BUDGET
          ? [selectors[2], selectors[0], selectors[1]]
          : selectors;
    const options: GroupRoomMixOptionDto[] = [];
    const seen = new Set<string>();

    orderedSelectors.forEach((selector) => {
      const candidate = [...candidates].sort((a, b) => this.compareTuple(selector.sort(a), selector.sort(b)))[0];
      const key = this.candidateKey(candidate);
      if (seen.has(key)) return;
      seen.add(key);
      options.push(this.toOption(candidate, selector.type, selector.label, selector.reason));
    });

    return options.slice(0, 3);
  }

  private premiumRoomCount(candidate: Candidate) {
    return candidate.blocks
      .filter((block) => block.baseRate >= 6000 || block.roomTypeName.toLowerCase().includes('suite'))
      .reduce((sum, block) => sum + block.rooms, 0);
  }

  private compareTuple(left: Array<number | string>, right: Array<number | string>) {
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] < right[index]) return -1;
      if (left[index] > right[index]) return 1;
    }
    return 0;
  }

  private candidateKey(candidate: Candidate) {
    return candidate.blocks
      .map((block) => `${block.roomTypeId}:${block.rooms}`)
      .sort()
      .join('|');
  }

  private toOption(
    candidate: Candidate,
    type: GroupRoomMixOptionType,
    label: string,
    reason: string,
  ): GroupRoomMixOptionDto {
    return {
      adultCapacity: candidate.adultCapacity,
      canCreateHold: true,
      canCreateWalkInGroup: true,
      childCapacity: candidate.childCapacity,
      estimatedTotal: candidate.estimatedTotal,
      label,
      reason,
      roomBlocks: candidate.blocks,
      spareCapacity: candidate.spareCapacity,
      totalCapacity: candidate.totalCapacity,
      totalRooms: candidate.totalRooms,
      type,
    };
  }

  private buildWarnings(
    availability: RoomTypeAvailability[],
    candidates: Candidate[],
    adults: number,
    children: number,
  ) {
    const warnings: string[] = [];
    if (!availability.length) {
      warnings.push('No ready rooms are available for the selected dates.');
    }
    if (!candidates.length) {
      warnings.push('No feasible room mix can fit this group with current room capacity rules.');
    }
    const adultCapacity = availability.reduce((sum, roomType) => sum + roomType.availableRooms * roomType.maxAdults, 0);
    const childCapacity = availability.reduce((sum, roomType) => sum + roomType.availableRooms * roomType.maxChildren, 0);
    if (adultCapacity < adults) warnings.push('Adult capacity is lower than requested adults.');
    if (childCapacity < children) warnings.push('Child capacity is lower than requested children.');
    return warnings;
  }
}
