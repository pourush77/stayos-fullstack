import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  createPaginationMeta,
  PaginationMeta,
  PaginationQueryDto,
  paginateQuery,
} from '../../common/dto/pagination.dto';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationEntity } from './infrastructure/reservation.entity';

export interface PaginatedReservations {
  data: ReservationEntity[];
  pagination?: PaginationMeta;
}

const reservationSortColumns: Record<string, string> = {
  reservationCode: 'reservation.reservationCode',
  arrivalDate: 'reservation.arrivalDate',
  departureDate: 'reservation.departureDate',
  status: 'reservation.status',
  paymentStatus: 'reservation.paymentStatus',
  source: 'reservation.source',
  createdAt: 'reservation.createdAt',
  updatedAt: 'reservation.updatedAt',
};

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypesRepository: Repository<RoomTypeEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string, query: PaginationQueryDto): Promise<PaginatedReservations> {
    await this.propertiesService.findOne(propertyId);

    const sortColumn = this.resolveSortColumn(query.sortBy);
    const sortOrder = query.sortOrder ?? 'ASC';
    const pagination = paginateQuery(query.page, query.limit);

    const qb = this.reservationsRepository
      .createQueryBuilder('reservation')
      .leftJoin('reservation.guest', 'guest')
      .where('reservation.propertyId = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere(
        `(${[
          'reservation.reservationCode ILIKE :search',
          'guest.firstName ILIKE :search',
          'guest.lastName ILIKE :search',
          'guest.displayName ILIKE :search',
          'guest.phone ILIKE :search',
        ].join(' OR ')})`,
        { search: `%${query.search}%` },
      );
    }

    if (!pagination) {
      const data = await qb.orderBy(sortColumn, sortOrder).getMany();
      return { data };
    }

    const [data, total] = await qb
      .orderBy(sortColumn, sortOrder)
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();

    return {
      data,
      pagination: createPaginationMeta(pagination.page, pagination.limit, total),
    };
  }

  async findOne(propertyId: string, id: string): Promise<ReservationEntity> {
    await this.propertiesService.findOne(propertyId);

    const reservation = await this.reservationsRepository.findOne({
      where: { id, propertyId },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} was not found`);
    }

    return reservation;
  }

  async create(
    propertyId: string,
    createReservationDto: CreateReservationDto,
  ): Promise<ReservationEntity> {
    await this.propertiesService.findOne(propertyId);

    await this.validateDateRange(
      createReservationDto.arrivalDate,
      createReservationDto.departureDate,
    );

    await this.validateReferences(propertyId, createReservationDto);

    try {
      const reservation = this.reservationsRepository.create({
        ...this.toCreatePersistenceFields(createReservationDto),
        propertyId,
        reservationCode: await this.generateReservationCode(propertyId),
      });

      return await this.reservationsRepository.save(reservation);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    propertyId: string,
    id: string,
    updateReservationDto: UpdateReservationDto,
  ): Promise<ReservationEntity> {
    const reservation = await this.findOne(propertyId, id);

    const arrivalDate = updateReservationDto.arrivalDate ?? reservation.arrivalDate;
    const departureDate = updateReservationDto.departureDate ?? reservation.departureDate;

    await this.validateDateRange(arrivalDate, departureDate);

    await this.validateReferences(propertyId, {
      guestId: updateReservationDto.guestId ?? reservation.guestId,
      roomTypeId: updateReservationDto.roomTypeId ?? reservation.roomTypeId,
      roomId:
        updateReservationDto.roomId === undefined
          ? (reservation.roomId ?? undefined)
          : updateReservationDto.roomId,
    });

    try {
      const updatedReservation = this.reservationsRepository.merge(reservation, {
        ...this.toUpdatePersistenceFields(updateReservationDto),
      });

      return await this.reservationsRepository.save(updatedReservation);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  private async generateReservationCode(propertyId: string): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const dateCode = `${yy}${mm}${dd}`;
    const existingReservationCount = await this.reservationsRepository.count({
      where: { propertyId },
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const sequence = String(existingReservationCount + attempt + 1).padStart(5, '0');
      const code = `HS${dateCode}-${sequence}`;

      const existing = await this.reservationsRepository.findOne({
        where: { propertyId, reservationCode: code },
      });

      if (!existing) return code;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const fallbackSequence = String(Date.now() + attempt).slice(-5);
      const code = `HS${dateCode}-${fallbackSequence}`;

      const existing = await this.reservationsRepository.findOne({
        where: { propertyId, reservationCode: code },
      });

      if (!existing) return code;
    }

    throw new ConflictException('Unable to generate a unique reservation code');
  }

  private async validateReferences(
    propertyId: string,
    references: { guestId: string; roomTypeId: string; roomId?: string | null },
  ): Promise<void> {
    const [guest, roomType, room] = await Promise.all([
      this.guestsRepository.findOne({ where: { id: references.guestId } }),
      this.roomTypesRepository.findOne({ where: { id: references.roomTypeId } }),
      references.roomId
        ? this.roomsRepository.findOne({ where: { id: references.roomId } })
        : Promise.resolve(null),
    ]);

    if (!guest) {
      throw new NotFoundException(`Guest ${references.guestId} was not found`);
    }

    if (!roomType) {
      throw new NotFoundException(`Room type ${references.roomTypeId} was not found`);
    }

    if (references.roomId && !room) {
      throw new NotFoundException(`Room ${references.roomId} was not found`);
    }

    if (
      guest.propertyId !== propertyId ||
      roomType.propertyId !== propertyId ||
      (room && room.propertyId !== propertyId)
    ) {
      throw new BadRequestException(
        'Reservation guest, room type, and room must belong to the same property',
      );
    }
  }

  private async validateDateRange(arrivalDate: string, departureDate: string): Promise<void> {
    if (departureDate <= arrivalDate) {
      throw new BadRequestException('Departure date must be after arrival date');
    }
  }

  private resolveSortColumn(sortBy = 'arrivalDate'): string {
    const sortColumn = reservationSortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported reservation sort field: ${sortBy}`);
    }

    return sortColumn;
  }

  private toCreatePersistenceFields(dto: CreateReservationDto): Partial<ReservationEntity> {
    const fields = { ...dto } as CreateReservationDto & {
      reservationCode?: string;
    };
    delete fields.reservationCode;

    return {
      ...fields,
      children: dto.children ?? 0,
      roomId: dto.roomId ?? null,
      notes: dto.notes ?? null,
      specialRequests: dto.specialRequests?.trim() || 'None',
    };
  }

  private toUpdatePersistenceFields(dto: UpdateReservationDto): Partial<ReservationEntity> {
    const fields = { ...dto } as UpdateReservationDto & {
      reservationCode?: string;
    };
    delete fields.reservationCode;

    const persistenceFields: Partial<ReservationEntity> = { ...fields };

    for (const field of ['roomId', 'notes', 'specialRequests'] as const) {
      if (field in dto) {
        persistenceFields[field] = dto[field] ?? null;
      }
    }

    return persistenceFields;
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('Reservation code already exists for property');
      }
    }

    throw error;
  }
}
