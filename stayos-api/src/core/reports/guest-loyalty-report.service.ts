import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { FolioChargeEntity } from '../billing/infrastructure/folio-charge.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { TopGuestDto } from './dto/reports.dto';
import { ReportRange, round } from './reports-range';

@Injectable()
export class GuestLoyaltyReportService {
  constructor(
    @InjectRepository(ReservationEntity) private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(FolioChargeEntity) private readonly chargesRepository: Repository<FolioChargeEntity>,
    @InjectRepository(GuestEntity) private readonly guestsRepository: Repository<GuestEntity>,
  ) {}

  async getTopGuests(propertyId: string, range: ReportRange): Promise<TopGuestDto[]> {
    const reservations = await this.reservationsRepository.find({
      where: { propertyId, arrivalDate: Between(range.fromKey, range.toKey) },
    });
    const guestIds = [...new Set(reservations.map((reservation) => reservation.guestId))];
    const guests = guestIds.length
      ? await this.guestsRepository.findBy(guestIds.map((id) => ({ id, propertyId })))
      : [];
    const charges = await this.chargesRepository.find({
      where: { folio: { propertyId }, chargedAt: Between(range.from, range.to) },
      relations: ['folio'],
    });
    const revenueByGuest = new Map<string, number>();
    charges.forEach((charge) => {
      const guestId = charge.folio.guestId;
      revenueByGuest.set(guestId, (revenueByGuest.get(guestId) ?? 0) + Number(charge.amount) + Number(charge.taxAmount));
    });

    return guestIds
      .map((guestId) => ({
        guestId,
        guestDisplayName: guests.find((guest) => guest.id === guestId)?.displayName ?? 'Guest',
        stays: reservations.filter((reservation) => reservation.guestId === guestId).length,
        revenue: round(revenueByGuest.get(guestId) ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue || b.stays - a.stays)
      .slice(0, 10);
  }
}
