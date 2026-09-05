import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import {
  NightAuditActionDto,
  NightAuditPendingArrivalItemDto,
  NightAuditPendingArrivalsSectionDto,
} from '../dto/night-audit-workspace.dto';

@Injectable()
export class NightAuditPendingArrivalsCollector {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationRepository: Repository<ReservationEntity>,
  ) {}

  /**
   * Collects individual reservations that require an arrival decision for the
   * specified property and businessDate.
   *
   * Criteria:
   * - reservation.propertyId = propertyId
   * - status IN (PENDING, CONFIRMED)
   * - arrivalDate <= businessDate (only date boundary used; no clock/server dates)
   * - deterministic ordering: arrivalDate ASC, createdAt ASC, id ASC
   * - assigned and unassigned qualifying reservations appear
   * - blockingCount equals count
   */
  async collect(
    propertyId: string,
    businessDate: string,
  ): Promise<NightAuditPendingArrivalsSectionDto> {
    const reservations = await this.reservationRepository.find({
      where: {
        propertyId,
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
        arrivalDate: LessThanOrEqual(businessDate),
      },
      relations: {
        guest: true,
        room: true,
      },
      order: {
        arrivalDate: 'ASC',
        createdAt: 'ASC',
        id: 'ASC',
      },
    });

    const items: NightAuditPendingArrivalItemDto[] = reservations.map((reservation) => {
      const guestName =
        reservation.guest?.displayName?.trim() ||
        [reservation.guest?.firstName, reservation.guest?.lastName].filter(Boolean).join(' ').trim() ||
        'Unknown Guest';

      return {
        reservationId: reservation.id,
        confirmationNumber: reservation.reservationCode,
        reservationCode: reservation.reservationCode,
        guestId: reservation.guestId ?? reservation.guest?.id ?? null,
        guestName,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        status: reservation.status,
        roomId: reservation.roomId ?? null,
        roomNumber: reservation.room?.roomNumber ?? null,
        roomTypeId: reservation.roomTypeId ?? null,
        actions: this.resolveActions(reservation.status),
      };
    });

    return {
      count: items.length,
      blockingCount: items.length,
      items,
    };
  }

  /**
   * Returns valid lifecycle actions for the reservation's current status.
   * - CONFIRMED: OPEN_BOOKING, CHECK_IN, MARK_NO_SHOW, CANCEL
   * - PENDING: OPEN_BOOKING, CONFIRM, MARK_NO_SHOW, CANCEL (cannot check in until confirmed)
   */
  private resolveActions(status: ReservationStatus): NightAuditActionDto[] {
    const actions: NightAuditActionDto[] = [{ type: 'OPEN_BOOKING' }];

    if (status === ReservationStatus.CONFIRMED) {
      actions.push({ type: 'CHECK_IN' });
    } else if (status === ReservationStatus.PENDING) {
      actions.push({ type: 'CONFIRM' });
    }

    actions.push({ type: 'MARK_NO_SHOW' }, { type: 'CANCEL' });

    return actions;
  }
}
