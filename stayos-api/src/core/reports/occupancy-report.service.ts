import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { ReportsOccupancyDto } from './dto/reports.dto';
import { overlapNights, ReportRange, round } from './reports-range';

const occupiedStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT];

@Injectable()
export class OccupancyReportService {
  constructor(
    @InjectRepository(RoomEntity) private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity) private readonly reservationsRepository: Repository<ReservationEntity>,
  ) {}

  async getOccupancy(propertyId: string, range: ReportRange): Promise<ReportsOccupancyDto> {
    const [totalRooms, reservations] = await Promise.all([
      this.roomsRepository.count({ where: { propertyId } }),
      this.reservationsRepository.find({
        where: {
          propertyId,
          status: In(occupiedStatuses),
          arrivalDate: LessThanOrEqual(range.toKey),
          departureDate: MoreThanOrEqual(range.fromKey),
        },
      }),
    ]);
    const roomNightsAvailable = totalRooms * range.days;
    const roomNightsOccupied = reservations.reduce((sum, reservation) => sum + overlapNights(reservation.arrivalDate, reservation.departureDate, range), 0);
    const bySource = new Map<string, number>();
    reservations.forEach((reservation) => bySource.set(reservation.source, (bySource.get(reservation.source) ?? 0) + 1));

    return {
      totalRooms,
      roomNightsAvailable,
      roomNightsOccupied,
      occupancyPercent: round(roomNightsAvailable === 0 ? 0 : (roomNightsOccupied / roomNightsAvailable) * 100),
      bySource: [...bySource.entries()].map(([label, value]) => ({ label, value })),
    };
  }
}
