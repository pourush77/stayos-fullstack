import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import { PropertiesService } from '../../properties/properties.service';
import { RatePlanStatus } from '../../rates/domain/rate-plan-status.enum';
import { RatePlanEntity } from '../../rates/infrastructure/rate-plan.entity';
import { RoomTypeDailyRateEntity } from '../../rates/infrastructure/room-type-daily-rate.entity';
import { TaxService } from '../../rates/tax.service';
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
import { calculateGroupBookingDeposit } from './group-booking-deposit-policy';

type RoomTypeAvailability = GroupRoomMixAvailabilityDto & {
  nightlyRates?: number[];
};

type Candidate = {
  blocks: GroupRoomMixBlockDto[];
  adultCapacity: number;
  childCapacity: number;
  estimatedTotal: number;
  spareCapacity: number;
  totalCapacity: number;
  totalRooms: number;
};

type CandidateSelector = {
  label: string;
  reason: string;
  sort: (candidate: Candidate) => Array<number | string>;
  type: GroupRoomMixOptionType;
};

type SearchRoomType = RoomTypeAvailability & {
  nightlyRates: number[];
  usefulRooms: number;
};

const GROUP_ROOM_MIX_SEARCH_STATE_LIMIT = 200_000;

@Injectable()
export class GroupRoomMixService {
  private lastSearchStateCount = 0;

  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GroupBookingRoomBlockEntity)
    private readonly groupBookingRoomBlocksRepository: Repository<GroupBookingRoomBlockEntity>,
    @InjectRepository(RatePlanEntity)
    private readonly ratePlansRepository: Repository<RatePlanEntity>,
    @InjectRepository(RoomTypeDailyRateEntity)
    private readonly dailyRatesRepository: Repository<RoomTypeDailyRateEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly taxService: TaxService,
  ) {}

  async suggestRoomMix(
    propertyId: string,
    query: GroupRoomMixSuggestionQueryDto,
  ): Promise<GroupRoomMixSuggestionDto> {
    const property = await this.propertiesService.findOne(propertyId);
    this.validateQuery(query);

    const nights = this.calculateNights(query.arrivalDate, query.departureDate);
    const availability = await this.getAvailability(
      propertyId,
      query.arrivalDate,
      query.departureDate,
    );
    const candidates = this.buildCandidates(availability, query.adults, query.children, nights);
    const options = await this.selectOptions(
      propertyId,
      candidates,
      query.preference ?? GroupRoomMixPreference.BEST_FIT,
    );
    const warnings = this.buildWarnings(availability, candidates, query.adults, query.children);

    return {
      adults: query.adults,
      arrivalDate: query.arrivalDate,
      availability,
      channelManagerSyncReady: true,
      children: query.children,
      departureDate: query.departureDate,
      nights,
      options: options.map((option) => ({
        ...option,
        deposit: calculateGroupBookingDeposit(
          {
            type: property.groupBookingDepositPolicyType,
            value: Number(property.groupBookingDepositPolicyValue || 0),
          },
          option.pricing?.grandTotal ?? option.estimatedTotal,
        ),
      })),
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
    const readyRooms = rooms.filter(
      (room) => room.operationalStatus === RoomOperationalStatus.READY,
    );
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

    const availability = [...byRoomType.values()];
    await this.applyConfiguredRates(propertyId, arrivalDate, departureDate, availability);

    return availability.sort((a, b) => {
      if (a.baseRate !== b.baseRate) return a.baseRate - b.baseRate;
      return a.roomTypeName.localeCompare(b.roomTypeName);
    });
  }

  private async applyConfiguredRates(
    propertyId: string,
    arrivalDate: string,
    departureDate: string,
    availability: RoomTypeAvailability[],
  ) {
    if (!availability.length) return;

    const defaultRatePlan = await this.ratePlansRepository.findOne({
      where: { propertyId, isDefault: true, status: RatePlanStatus.ACTIVE },
    });
    if (!defaultRatePlan) return;

    const stayDates = this.getStayDates(arrivalDate, departureDate);
    if (!stayDates.length) return;

    const dailyRates = await this.dailyRatesRepository.find({
      where: {
        propertyId,
        ratePlanId: defaultRatePlan.id,
        roomTypeId: In(availability.map((item) => item.roomTypeId)),
        stayDate: In(stayDates),
      },
    });
    const ratesByRoomType = new Map<string, number[]>();
    dailyRates.forEach((rate) => {
      const rates = ratesByRoomType.get(rate.roomTypeId) ?? [];
      rates[stayDates.indexOf(rate.stayDate)] = Number(rate.amount);
      ratesByRoomType.set(rate.roomTypeId, rates);
    });

    availability.forEach((item) => {
      const configuredRates = ratesByRoomType.get(item.roomTypeId);
      if (!configuredRates?.length) return;
      const nightlyRates = this.getStayDates(arrivalDate, departureDate).map(
        (_date, index) => configuredRates[index] ?? item.baseRate,
      );
      item.nightlyRates = nightlyRates;
      item.baseRate = nightlyRates.reduce((sum, rate) => sum + rate, 0) / nightlyRates.length;
    });
  }

  private getStayDates(arrivalDate: string, departureDate: string) {
    const dates: string[] = [];
    const cursor = new Date(`${arrivalDate}T00:00:00.000Z`);
    const end = new Date(`${departureDate}T00:00:00.000Z`);
    while (cursor < end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
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
    this.lastSearchStateCount = 0;
    const guests = adults + children;
    if (guests <= 0 || !availability.length) return [];

    const searchAvailability = availability
      .map((roomType) => ({
        ...roomType,
        nightlyRates: roomType.nightlyRates ?? (Array(nights).fill(roomType.baseRate) as number[]),
        usefulRooms: Math.min(roomType.availableRooms, guests),
      }))
      .filter((roomType) => roomType.usefulRooms > 0)
      .sort((a, b) => {
        if (a.baseRate !== b.baseRate) return a.baseRate - b.baseRate;
        return a.roomTypeName.localeCompare(b.roomTypeName);
      });
    const suffixAdultCapacity = this.buildSuffixCapacity(searchAvailability, 'maxAdults');
    const suffixChildCapacity = this.buildSuffixCapacity(searchAvailability, 'maxChildren');
    const suffixTotalCapacity = this.buildSuffixCapacity(searchAvailability, 'maxOccupancy');
    const counts = Array(searchAvailability.length).fill(0) as number[];
    const selectors = this.optionSelectors();
    const bestByType = new Map<GroupRoomMixOptionType, Candidate>();
    const bestSeenByState = new Map<string, number>();

    const updateBest = (candidate: Candidate) => {
      selectors.forEach((selector) => {
        const current = bestByType.get(selector.type);
        if (
          !current ||
          this.compareTuple(selector.sort(candidate), selector.sort(current)) < 0 ||
          (this.compareTuple(selector.sort(candidate), selector.sort(current)) === 0 &&
            this.candidateKey(candidate) < this.candidateKey(current))
        ) {
          bestByType.set(selector.type, candidate);
        }
      });
    };

    const visit = (
      index: number,
      adultCapacity: number,
      childCapacity: number,
      totalCapacity: number,
      totalRooms: number,
      estimatedTotal: number,
    ) => {
      if (this.lastSearchStateCount >= GROUP_ROOM_MIX_SEARCH_STATE_LIMIT) return;
      this.lastSearchStateCount += 1;

      if (
        adultCapacity + suffixAdultCapacity[index] < adults ||
        childCapacity + suffixChildCapacity[index] < children ||
        totalCapacity + suffixTotalCapacity[index] < guests
      ) {
        return;
      }

      if (
        totalRooms > 0 &&
        adultCapacity >= adults &&
        childCapacity >= children &&
        totalCapacity >= guests
      ) {
        const candidate = this.toCandidate(searchAvailability, counts, nights, {
          adultCapacity,
          childCapacity,
          estimatedTotal,
          totalCapacity,
          totalRooms,
        });
        candidate.spareCapacity = candidate.totalCapacity - guests;
        updateBest(candidate);
      }

      if (index === searchAvailability.length || totalRooms >= guests) return;

      const stateKey = [
        index,
        Math.min(adultCapacity, adults),
        Math.min(childCapacity, children),
        Math.min(totalCapacity, guests),
        totalRooms,
      ].join(':');
      const bestPriceAtState = bestSeenByState.get(stateKey);
      if (bestPriceAtState !== undefined && bestPriceAtState <= estimatedTotal) return;
      bestSeenByState.set(stateKey, estimatedTotal);

      const roomType = searchAvailability[index];
      const maxRoomsForType = Math.min(roomType.usefulRooms, guests - totalRooms);

      for (let count = 0; count <= maxRoomsForType; count += 1) {
        counts[index] = count;
        visit(
          index + 1,
          adultCapacity + roomType.maxAdults * count,
          childCapacity + roomType.maxChildren * count,
          totalCapacity + roomType.maxOccupancy * count,
          totalRooms + count,
          estimatedTotal + this.roomTypeStayTotal(roomType, count, nights),
        );
      }
      counts[index] = 0;
    };

    visit(0, 0, 0, 0, 0, 0);

    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    selectors.forEach((selector) => {
      const candidate = bestByType.get(selector.type);
      if (!candidate) return;
      const key = this.candidateKey(candidate);
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(candidate);
    });

    return candidates;
  }

  private buildSuffixCapacity(
    availability: SearchRoomType[],
    capacityKey: 'maxAdults' | 'maxChildren' | 'maxOccupancy',
  ) {
    const suffix = Array(availability.length + 1).fill(0) as number[];
    for (let index = availability.length - 1; index >= 0; index -= 1) {
      suffix[index] =
        suffix[index + 1] + availability[index][capacityKey] * availability[index].usefulRooms;
    }
    return suffix;
  }

  private toCandidate(
    availability: RoomTypeAvailability[],
    counts: number[],
    nights: number,
    totals?: Omit<Candidate, 'blocks' | 'spareCapacity'>,
  ): Candidate {
    const blocks = availability
      .map((roomType, index) => ({ roomType, rooms: counts[index] }))
      .filter((item) => item.rooms > 0)
      .map(({ roomType, rooms }) => this.toBlock(roomType, rooms, nights));
    const adultCapacity =
      totals?.adultCapacity ??
      blocks.reduce((sum, block) => sum + block.maxAdults * block.rooms, 0);
    const childCapacity =
      totals?.childCapacity ??
      blocks.reduce((sum, block) => sum + block.maxChildren * block.rooms, 0);
    const totalCapacity =
      totals?.totalCapacity ??
      blocks.reduce((sum, block) => sum + block.maxOccupancy * block.rooms, 0);
    const totalRooms = totals?.totalRooms ?? blocks.reduce((sum, block) => sum + block.rooms, 0);
    const estimatedTotal =
      totals?.estimatedTotal ?? blocks.reduce((sum, block) => sum + block.estimatedTotal, 0);

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
    roomType: RoomTypeAvailability | SearchRoomType,
    rooms: number,
    nights: number,
  ): GroupRoomMixBlockDto {
    return {
      adultsPerRoom: roomType.maxAdults,
      baseRate: roomType.baseRate,
      childrenPerRoom: roomType.maxChildren,
      estimatedTotal: this.roomTypeStayTotal(roomType, rooms, nights),
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
    propertyId: string,
    candidates: Candidate[],
    preference: GroupRoomMixPreference,
  ): Promise<GroupRoomMixOptionDto[]> {
    if (!candidates.length) return Promise.resolve([]);

    const selectors = this.optionSelectors();
    const orderedSelectors =
      preference === GroupRoomMixPreference.COMFORT
        ? [selectors[1], selectors[0], selectors[2]]
        : preference === GroupRoomMixPreference.BUDGET
          ? [selectors[2], selectors[0], selectors[1]]
          : selectors;
    const options: GroupRoomMixOptionDto[] = [];
    const seen = new Set<string>();

    orderedSelectors.forEach((selector) => {
      const candidate = [...candidates].sort((a, b) =>
        this.compareTuple(selector.sort(a), selector.sort(b)),
      )[0];
      const key = this.candidateKey(candidate);
      if (seen.has(key)) return;
      seen.add(key);
      options.push(this.toOption(candidate, selector.type, selector.label, selector.reason));
    });

    return Promise.all(options.slice(0, 3).map((option) => this.withPricing(propertyId, option)));
  }

  private roomTypeStayTotal(
    roomType: RoomTypeAvailability | SearchRoomType,
    rooms: number,
    nights: number,
  ) {
    const configuredNightlyRates = 'nightlyRates' in roomType ? roomType.nightlyRates : undefined;
    const nightlyRates = configuredNightlyRates?.length
      ? configuredNightlyRates
      : Array(nights).fill(roomType.baseRate);
    return nightlyRates.reduce((sum, rate) => sum + rate * rooms, 0);
  }

  private async withPricing(
    propertyId: string,
    option: GroupRoomMixOptionDto,
  ): Promise<GroupRoomMixOptionDto> {
    const roomSubtotal = option.roomBlocks.reduce((sum, block) => sum + block.estimatedTotal, 0);
    const tax = await this.taxService.calculateForProperty(propertyId, roomSubtotal);
    const pricing = {
      grandTotal: Number(tax.total),
      otherCharges: 0,
      roomSubtotal: Number(tax.taxableSubtotal),
      taxAmount: Number(tax.taxAmount),
      taxEnabled: tax.taxEnabled,
      taxName: tax.taxName,
      taxPercentage: tax.taxPercentage,
    };

    return {
      ...option,
      deposit: calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.NONE, value: 0 },
        pricing.grandTotal,
      ),
      estimatedTotal: pricing.grandTotal,
      pricing,
    };
  }

  private optionSelectors(): CandidateSelector[] {
    return [
      {
        label: 'Best Fit',
        reason: 'Lowest room count with the least unused capacity.',
        sort: (candidate) => [
          candidate.totalRooms,
          candidate.spareCapacity,
          candidate.estimatedTotal,
        ],
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
        sort: (candidate) => [
          candidate.estimatedTotal,
          candidate.totalRooms,
          candidate.spareCapacity,
        ],
        type: GroupRoomMixOptionType.BUDGET,
      },
    ];
  }

  private premiumRoomCount(candidate: Candidate) {
    return candidate.blocks
      .filter(
        (block) => block.baseRate >= 6000 || block.roomTypeName.toLowerCase().includes('suite'),
      )
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
      deposit: calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.NONE, value: 0 },
        candidate.estimatedTotal,
      ),
      estimatedTotal: candidate.estimatedTotal,
      label,
      pricing: {
        grandTotal: candidate.estimatedTotal,
        otherCharges: 0,
        roomSubtotal: candidate.estimatedTotal,
        taxAmount: 0,
        taxEnabled: false,
        taxName: null,
        taxPercentage: '0.00',
      },
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
    const adultCapacity = availability.reduce(
      (sum, roomType) => sum + roomType.availableRooms * roomType.maxAdults,
      0,
    );
    const childCapacity = availability.reduce(
      (sum, roomType) => sum + roomType.availableRooms * roomType.maxChildren,
      0,
    );
    if (adultCapacity < adults) warnings.push('Adult capacity is lower than requested adults.');
    if (childCapacity < children) warnings.push('Child capacity is lower than requested children.');
    return warnings;
  }

  getLastSearchStateCountForTesting() {
    return this.lastSearchStateCount;
  }
}
