import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { GuestRequestStatus } from '../guest-requests/domain/guest-request-status.enum';
import { GuestRequestEntity } from '../guest-requests/infrastructure/guest-request.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReportsOperationsDto } from './dto/reports.dto';
import { ReportRange, round } from './reports-range';

const activeRequestStatuses = [GuestRequestStatus.REQUESTED, GuestRequestStatus.ACCEPTED, GuestRequestStatus.IN_PROGRESS];

@Injectable()
export class OperationsReportService {
  constructor(
    @InjectRepository(ReservationEntity) private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GuestRequestEntity) private readonly requestsRepository: Repository<GuestRequestEntity>,
  ) {}

  async getOperations(propertyId: string, range: ReportRange): Promise<ReportsOperationsDto> {
    const [arrivals, departures, requests] = await Promise.all([
      this.reservationsRepository.count({ where: { propertyId, arrivalDate: Between(range.fromKey, range.toKey) } }),
      this.reservationsRepository.count({ where: { propertyId, departureDate: Between(range.fromKey, range.toKey) } }),
      this.requestsRepository.find({ where: { propertyId, createdAt: Between(range.from, range.to) } }),
    ]);
    const now = new Date();
    const completed = requests.filter((request) => request.status === GuestRequestStatus.COMPLETED);
    const avgResolution =
      completed.length === 0
        ? 0
        : completed.reduce((sum, request) => {
            const end = request.completedAt?.getTime() ?? request.updatedAt.getTime();
            return sum + (end - request.createdAt.getTime()) / 60_000;
          }, 0) / completed.length;

    return {
      arrivals,
      departures,
      openRequests: requests.filter((request) => activeRequestStatuses.includes(request.status)).length,
      completedRequests: completed.length,
      overdueRequests: requests.filter((request) => request.dueAt && request.dueAt < now && activeRequestStatuses.includes(request.status)).length,
      avgRequestResolutionMinutes: round(avgResolution, 1),
    };
  }
}
