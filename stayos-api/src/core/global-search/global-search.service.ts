import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesService } from '../properties/properties.service';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import {
  GlobalSearchResponseDto,
  GlobalSearchResultDto,
  GlobalSearchResultType,
} from './dto/global-search-response.dto';

@Injectable()
export class GlobalSearchService {
  constructor(
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,

    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,

    @InjectRepository(FolioEntity)
    private readonly foliosRepository: Repository<FolioEntity>,

    private readonly propertiesService: PropertiesService,
  ) {}

  async search(propertyId: string, query: GlobalSearchQueryDto): Promise<GlobalSearchResponseDto> {
    await this.propertiesService.findOne(propertyId);

    const term = query.q.trim();
    const likeTerm = `%${term}%`;
    const startsWithTerm = `${term}%`;
    const normalizedDigits = term.replace(/\D/g, '');
    const limit = query.limit ?? 5;

    const [stays, reservations, guests, rooms, folios] = await Promise.all([
      this.searchStays(propertyId, term, likeTerm, startsWithTerm, normalizedDigits, limit),
      this.searchReservations(propertyId, term, likeTerm, startsWithTerm, normalizedDigits, limit),
      this.searchGuests(propertyId, term, likeTerm, startsWithTerm, normalizedDigits, limit),
      this.searchRooms(propertyId, term, likeTerm, startsWithTerm, limit),
      this.searchFolios(propertyId, term, likeTerm, startsWithTerm, normalizedDigits, limit),
    ]);

    return {
      query: term,
      total: stays.length + reservations.length + guests.length + rooms.length + folios.length,
      results: {
        stays,
        reservations,
        guests,
        rooms,
        folios,
      },
    };
  }

  private async searchGuests(
    propertyId: string,
    term: string,
    likeTerm: string,
    startsWithTerm: string,
    normalizedDigits: string,
    limit: number,
  ): Promise<GlobalSearchResultDto[]> {
    const queryBuilder = this.guestsRepository
      .createQueryBuilder('guest')
      .where('guest.propertyId = :propertyId', { propertyId })
      .andWhere(
        `(
          guest.displayName ILIKE :likeTerm
          OR guest.email ILIKE :likeTerm
          OR guest.phone ILIKE :likeTerm
          OR guest.alternatePhone ILIKE :likeTerm
          OR guest.companyName ILIKE :likeTerm
          ${
            normalizedDigits
              ? `OR regexp_replace(
                  COALESCE(guest.phone, ''),
                  '[^0-9]',
                  '',
                  'g'
                ) LIKE :digits`
              : ''
          }
          ${
            normalizedDigits
              ? `OR regexp_replace(
                  COALESCE(guest.alternatePhone, ''),
                  '[^0-9]',
                  '',
                  'g'
                ) LIKE :digits`
              : ''
          }
        )`,
        {
          likeTerm,
          ...(normalizedDigits ? { digits: `%${normalizedDigits}%` } : {}),
        },
      )
      .addSelect(
        `CASE
          WHEN lower(guest.displayName) = lower(:term) THEN 1
          WHEN lower(guest.displayName) LIKE lower(:startsWithTerm) THEN 2
          WHEN guest.phone = :term THEN 3
          ELSE 4
        END`,
        'search_rank',
      )
      .orderBy('search_rank', 'ASC')
      .addOrderBy('guest.updatedAt', 'DESC')
      .setParameters({
        term,
        startsWithTerm,
      })
      .take(limit);

    const guests = await queryBuilder.getMany();

    return guests.map((guest) => ({
      id: guest.id,
      type: GlobalSearchResultType.GUEST,
      title: guest.displayName,
      subtitle: [guest.phone, guest.email].filter(Boolean).join(' · '),
      description: guest.companyName ?? undefined,
      badge: guest.vipStatus ? 'VIP' : 'GUEST',
      route: `/guests/${guest.id}`,
      priority: this.calculatePriority(term, guest.displayName, guest.phone ?? '', 60),
    }));
  }

  private async searchReservations(
    propertyId: string,
    term: string,
    likeTerm: string,
    startsWithTerm: string,
    normalizedDigits: string,
    limit: number,
  ): Promise<GlobalSearchResultDto[]> {
    const queryBuilder = this.reservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.guest', 'guest')
      .leftJoinAndSelect('reservation.room', 'room')
      .leftJoinAndSelect('reservation.roomType', 'roomType')
      .where('reservation.propertyId = :propertyId', {
        propertyId,
      })
      .andWhere('reservation.status != :checkedInStatus', {
        checkedInStatus: ReservationStatus.CHECKED_IN,
      })
      .andWhere(
        `(
          reservation.reservationCode ILIKE :likeTerm
          OR guest.displayName ILIKE :likeTerm
          OR guest.phone ILIKE :likeTerm
          OR guest.email ILIKE :likeTerm
          OR room.roomNumber ILIKE :likeTerm
          ${
            normalizedDigits
              ? `OR regexp_replace(
                  COALESCE(guest.phone, ''),
                  '[^0-9]',
                  '',
                  'g'
                ) LIKE :digits`
              : ''
          }
        )`,
        {
          likeTerm,
          ...(normalizedDigits ? { digits: `%${normalizedDigits}%` } : {}),
        },
      )
      .addSelect(
        `CASE
          WHEN lower(reservation.reservationCode) = lower(:term) THEN 1
          WHEN lower(guest.displayName) = lower(:term) THEN 2
          WHEN lower(guest.displayName) LIKE lower(:startsWithTerm) THEN 3
          ELSE 4
        END`,
        'search_rank',
      )
      .orderBy('search_rank', 'ASC')
      .addOrderBy('reservation.arrivalDate', 'ASC')
      .setParameters({
        term,
        startsWithTerm,
      })
      .take(limit);

    const reservations = await queryBuilder.getMany();

    return reservations.map((reservation) => ({
      id: reservation.id,
      type: GlobalSearchResultType.RESERVATION,
      title: reservation.guest.displayName,
      subtitle:
        `${reservation.reservationCode} · ` +
        `${reservation.arrivalDate} → ${reservation.departureDate}`,
      description: reservation.room
        ? `Room ${reservation.room.roomNumber} · ${reservation.roomType.name}`
        : reservation.roomType.name,
      badge: reservation.status,
      route: `/reservations/${reservation.id}`,
      priority: this.calculatePriority(
        term,
        reservation.reservationCode,
        reservation.guest.displayName,
        80,
      ),
    }));
  }

  private async searchStays(
    propertyId: string,
    term: string,
    likeTerm: string,
    startsWithTerm: string,
    normalizedDigits: string,
    limit: number,
  ): Promise<GlobalSearchResultDto[]> {
    const queryBuilder = this.reservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.guest', 'guest')
      .leftJoinAndSelect('reservation.room', 'room')
      .leftJoinAndSelect('reservation.roomType', 'roomType')
      .where('reservation.propertyId = :propertyId', {
        propertyId,
      })
      .andWhere('reservation.status = :checkedInStatus', {
        checkedInStatus: ReservationStatus.CHECKED_IN,
      })
      .andWhere(
        `(
          reservation.reservationCode ILIKE :likeTerm
          OR guest.displayName ILIKE :likeTerm
          OR guest.phone ILIKE :likeTerm
          OR guest.email ILIKE :likeTerm
          OR room.roomNumber ILIKE :likeTerm
          ${
            normalizedDigits
              ? `OR regexp_replace(
                  COALESCE(guest.phone, ''),
                  '[^0-9]',
                  '',
                  'g'
                ) LIKE :digits`
              : ''
          }
        )`,
        {
          likeTerm,
          ...(normalizedDigits ? { digits: `%${normalizedDigits}%` } : {}),
        },
      )
      .addSelect(
        `CASE
          WHEN room.roomNumber = :term THEN 1
          WHEN lower(reservation.reservationCode) = lower(:term) THEN 2
          WHEN lower(guest.displayName) = lower(:term) THEN 3
          WHEN lower(guest.displayName) LIKE lower(:startsWithTerm) THEN 4
          ELSE 5
        END`,
        'search_rank',
      )
      .orderBy('search_rank', 'ASC')
      .addOrderBy('reservation.departureDate', 'ASC')
      .setParameters({
        term,
        startsWithTerm,
      })
      .take(limit);

    const stays = await queryBuilder.getMany();

    return stays.map((stay) => ({
      id: stay.id,
      type: GlobalSearchResultType.STAY,
      title: stay.guest.displayName,
      subtitle: `${
        stay.room ? `Room ${stay.room.roomNumber}` : stay.roomType.name
      } · Due out ${stay.departureDate}`,
      description: `${stay.reservationCode} · ${stay.guest.phone ?? ''}`,
      badge: 'IN HOUSE',
      route: `/guest-stay/${stay.id}`,
      priority: this.calculatePriority(
        term,
        stay.room?.roomNumber ?? '',
        stay.guest.displayName,
        100,
      ),
    }));
  }

  private async searchRooms(
    propertyId: string,
    term: string,
    likeTerm: string,
    startsWithTerm: string,
    limit: number,
  ): Promise<GlobalSearchResultDto[]> {
    const rooms = await this.roomsRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('room.floor', 'floor')
      .where('room.propertyId = :propertyId', {
        propertyId,
      })
      .andWhere(
        `(
          room.roomNumber ILIKE :likeTerm
          OR room.displayName ILIKE :likeTerm
          OR roomType.name ILIKE :likeTerm
          OR roomType.code ILIKE :likeTerm
        )`,
        { likeTerm },
      )
      .addSelect(
        `CASE
          WHEN lower(room.roomNumber) = lower(:term) THEN 1
          WHEN lower(room.roomNumber) LIKE lower(:startsWithTerm) THEN 2
          ELSE 3
        END`,
        'search_rank',
      )
      .orderBy('search_rank', 'ASC')
      .addOrderBy('room.roomNumber', 'ASC')
      .setParameters({
        term,
        startsWithTerm,
      })
      .take(limit)
      .getMany();

    return rooms.map((room) => ({
      id: room.id,
      type: GlobalSearchResultType.ROOM,
      title: `Room ${room.roomNumber}`,
      subtitle: [room.roomType?.name, room.floor?.name].filter(Boolean).join(' · '),
      description: room.displayName ?? undefined,
      badge: room.operationalStatus,
      route: `/rooms/${room.id}`,
      priority: this.calculatePriority(term, room.roomNumber, room.displayName ?? '', 70),
    }));
  }

  private async searchFolios(
    propertyId: string,
    term: string,
    likeTerm: string,
    startsWithTerm: string,
    normalizedDigits: string,
    limit: number,
  ): Promise<GlobalSearchResultDto[]> {
    const folios = await this.foliosRepository
      .createQueryBuilder('folio')
      .leftJoinAndSelect('folio.guest', 'guest')
      .leftJoinAndSelect('folio.reservation', 'reservation')
      .leftJoinAndSelect('reservation.room', 'room')
      .where('folio.propertyId = :propertyId', {
        propertyId,
      })
      .andWhere(
        `(
          folio.folioNumber ILIKE :likeTerm
          OR reservation.reservationCode ILIKE :likeTerm
          OR guest.displayName ILIKE :likeTerm
          OR guest.phone ILIKE :likeTerm
          OR room.roomNumber ILIKE :likeTerm
          ${
            normalizedDigits
              ? `OR regexp_replace(
                  COALESCE(guest.phone, ''),
                  '[^0-9]',
                  '',
                  'g'
                ) LIKE :digits`
              : ''
          }
        )`,
        {
          likeTerm,
          ...(normalizedDigits ? { digits: `%${normalizedDigits}%` } : {}),
        },
      )
      .addSelect(
        `CASE
          WHEN lower(folio.folioNumber) = lower(:term) THEN 1
          WHEN lower(reservation.reservationCode) = lower(:term) THEN 2
          WHEN lower(guest.displayName) = lower(:term) THEN 3
          WHEN lower(guest.displayName) LIKE lower(:startsWithTerm) THEN 4
          ELSE 5
        END`,
        'search_rank',
      )
      .orderBy('search_rank', 'ASC')
      .addOrderBy('folio.updatedAt', 'DESC')
      .setParameters({
        term,
        startsWithTerm,
      })
      .take(limit)
      .getMany();

    return folios.map((folio) => ({
      id: folio.id,
      type: GlobalSearchResultType.FOLIO,
      title: folio.folioNumber,
      subtitle: `${folio.guest.displayName} · ` + `${folio.reservation.reservationCode}`,
      description: folio.reservation.room ? `Room ${folio.reservation.room.roomNumber}` : undefined,
      badge: folio.status,
      route: `/billing/${folio.id}`,
      priority: this.calculatePriority(term, folio.folioNumber, folio.guest.displayName, 75),
    }));
  }

  private calculatePriority(
    term: string,
    primaryValue: string,
    secondaryValue: string,
    basePriority: number,
  ): number {
    const normalizedTerm = term.toLowerCase();
    const normalizedPrimary = (primaryValue ?? '').toLowerCase();
    const normalizedSecondary = (secondaryValue ?? '').toLowerCase();

    if (normalizedPrimary === normalizedTerm) {
      return basePriority + 30;
    }

    if (normalizedSecondary === normalizedTerm) {
      return basePriority + 25;
    }

    if (normalizedPrimary.startsWith(normalizedTerm)) {
      return basePriority + 20;
    }

    if (normalizedSecondary.startsWith(normalizedTerm)) {
      return basePriority + 15;
    }

    return basePriority;
  }
}
