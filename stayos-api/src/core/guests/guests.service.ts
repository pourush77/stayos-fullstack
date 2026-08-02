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
import { PropertiesService } from '../properties/properties.service';
import { calculateTotals } from '../billing/billing.mapper';
import { FolioStatus } from '../billing/domain/folio-status.enum';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { ReservationPaymentStatus } from '../reservations/domain/reservation-payment-status.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestEntity } from './infrastructure/guest.entity';

export interface PaginatedGuests {
  data: GuestEntity[];
  pagination?: PaginationMeta;
}

const guestSortColumns: Record<string, string> = {
  firstName: 'guest.firstName',
  lastName: 'guest.lastName',
  displayName: 'guest.displayName',
  phone: 'guest.phone',
  email: 'guest.email',
  companyName: 'guest.companyName',
  status: 'guest.status',
  createdAt: 'guest.createdAt',
  updatedAt: 'guest.updatedAt',
};

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(FolioEntity)
    private readonly foliosRepository: Repository<FolioEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string, query: PaginationQueryDto): Promise<PaginatedGuests> {
    await this.propertiesService.findOne(propertyId);
    const sortColumn = this.resolveSortColumn(query.sortBy);
    const sortOrder = query.sortOrder ?? 'ASC';
    const pagination = paginateQuery(query.page, query.limit);
    const qb = this.guestsRepository
      .createQueryBuilder('guest')
      .where('guest.propertyId = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere(
        `(${[
          'guest.firstName ILIKE :search',
          'guest.lastName ILIKE :search',
          'guest.displayName ILIKE :search',
          'guest.phone ILIKE :search',
          'guest.email ILIKE :search',
          'guest.companyName ILIKE :search',
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

  async findOne(propertyId: string, id: string): Promise<GuestEntity> {
    await this.propertiesService.findOne(propertyId);
    const guest = await this.guestsRepository.findOne({
      where: { id, propertyId },
    });

    if (!guest) {
      throw new NotFoundException(`Guest ${id} was not found`);
    }

    const reservations = await this.reservationsRepository.find({
      where: { guestId: guest.id, propertyId },
      order: { arrivalDate: 'DESC' },
      relations: { room: true, roomType: true },
    });
    const folios = await this.foliosRepository.find({
      where: { guestId: guest.id, propertyId },
      relations: { charges: true, payments: true },
    });
    const foliosByReservationId = new Map(folios.map((folio) => [folio.reservationId, folio]));
    const reservationsWithFolioPaymentStatus = reservations.map((reservation) => {
      const folio = foliosByReservationId.get(reservation.id);
      if (!folio) return reservation;

      const totals = calculateTotals(folio.charges ?? [], folio.payments ?? []);
      const balance = Number(totals.balance);
      const paid = Number(totals.paid);
      const paymentStatus =
        folio.status === FolioStatus.SETTLED || (balance <= 0.01 && paid > 0)
          ? ReservationPaymentStatus.PAID
          : paid > 0
            ? ReservationPaymentStatus.PARTIALLY_PAID
            : ReservationPaymentStatus.PAYMENT_DUE;

      return Object.assign(reservation, {
        folioId: folio.id,
        folioNumber: folio.folioNumber,
        folioStatus: folio.status,
        paymentStatus,
      });
    });

    return Object.assign(guest, { reservations: reservationsWithFolioPaymentStatus });
  }

  async create(propertyId: string, createGuestDto: CreateGuestDto): Promise<GuestEntity> {
    await this.propertiesService.findOne(propertyId);
    await this.ensurePhoneIsAvailable(propertyId, createGuestDto.phone);

    try {
      const guest = this.guestsRepository.create({
        ...this.toCreatePersistenceFields(createGuestDto),
        propertyId,
        displayName: this.resolveDisplayName(createGuestDto),
      });

      return await this.guestsRepository.save(guest);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    propertyId: string,
    id: string,
    updateGuestDto: UpdateGuestDto,
  ): Promise<GuestEntity> {
    const guest = await this.findOne(propertyId, id);

    if (updateGuestDto.phone && updateGuestDto.phone !== guest.phone) {
      await this.ensurePhoneIsAvailable(propertyId, updateGuestDto.phone, id);
    }

    try {
      const updatedGuest = this.guestsRepository.merge(guest, {
        ...this.toUpdatePersistenceFields(updateGuestDto),
        displayName: this.resolveUpdatedDisplayName(guest, updateGuestDto),
      });

      return await this.guestsRepository.save(updatedGuest);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  private async ensurePhoneIsAvailable(
    propertyId: string,
    phone: string,
    currentGuestId?: string,
  ): Promise<void> {
    const existingGuest = await this.guestsRepository.findOne({
      where: { propertyId, phone },
    });

    if (existingGuest && existingGuest.id !== currentGuestId) {
      throw new ConflictException('Guest phone already exists for property');
    }
  }

  private resolveSortColumn(sortBy = 'displayName'): string {
    const sortColumn = guestSortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported guest sort field: ${sortBy}`);
    }

    return sortColumn;
  }

  private resolveDisplayName(dto: CreateGuestDto): string {
    return dto.displayName ?? [dto.firstName, dto.lastName].filter(Boolean).join(' ');
  }

  private resolveUpdatedDisplayName(guest: GuestEntity, dto: UpdateGuestDto): string {
    if (dto.displayName) {
      return dto.displayName;
    }

    if (dto.firstName || dto.lastName !== undefined) {
      return [dto.firstName ?? guest.firstName, dto.lastName ?? guest.lastName]
        .filter(Boolean)
        .join(' ');
    }

    return guest.displayName;
  }

  private toCreatePersistenceFields(dto: CreateGuestDto): Partial<GuestEntity> {
    return {
      ...dto,
      lastName: dto.lastName ?? null,
      alternatePhone: dto.alternatePhone ?? null,
      email: dto.email ?? null,
      gender: dto.gender ?? null,
      dateOfBirth: dto.dateOfBirth ?? null,
      anniversaryDate: dto.anniversaryDate ?? null,
      nationality: dto.nationality ?? null,
      preferredLanguage: dto.preferredLanguage ?? null,
      roomPreference: dto.roomPreference ?? null,
      bedPreference: dto.bedPreference ?? null,
      smokingPreference: dto.smokingPreference ?? null,
      floorPreference: dto.floorPreference ?? null,
      dietaryNotes: dto.dietaryNotes ?? null,
      companyName: dto.companyName ?? null,
      gstNumber: dto.gstNumber ?? null,
      notes: dto.notes ?? null,
    };
  }

  private toUpdatePersistenceFields(dto: UpdateGuestDto): Partial<GuestEntity> {
    const fields: Partial<GuestEntity> = { ...dto };

    for (const field of [
      'lastName',
      'alternatePhone',
      'email',
      'gender',
      'dateOfBirth',
      'anniversaryDate',
      'nationality',
      'preferredLanguage',
      'roomPreference',
      'bedPreference',
      'smokingPreference',
      'floorPreference',
      'dietaryNotes',
      'companyName',
      'gstNumber',
      'notes',
    ] as const) {
      if (field in dto) {
        fields[field] = dto[field] ?? null;
      }
    }

    return fields;
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('Guest phone already exists for property');
      }
    }

    throw error;
  }
}
