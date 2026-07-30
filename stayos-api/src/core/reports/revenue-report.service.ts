import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { FolioChargeEntity } from '../billing/infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from '../billing/infrastructure/folio-payment.entity';
import { ReportsRevenueDto } from './dto/reports.dto';
import { ReportsOccupancyDto } from './dto/reports.dto';
import { ReportRange, round } from './reports-range';

@Injectable()
export class RevenueReportService {
  constructor(
    @InjectRepository(FolioChargeEntity) private readonly chargesRepository: Repository<FolioChargeEntity>,
    @InjectRepository(FolioPaymentEntity) private readonly paymentsRepository: Repository<FolioPaymentEntity>,
  ) {}

  async getRevenue(propertyId: string, range: ReportRange, occupancy: ReportsOccupancyDto): Promise<ReportsRevenueDto> {
    const [charges, payments] = await Promise.all([
      this.chargesRepository.find({ where: { folio: { propertyId }, chargedAt: Between(range.from, range.to) }, relations: ['folio'] }),
      this.paymentsRepository.find({ where: { folio: { propertyId }, receivedAt: Between(range.from, range.to) }, relations: ['folio'] }),
    ]);
    const byChargeType = new Map<string, number>();
    const byPaymentMethod = new Map<string, number>();
    const totalRevenue = charges.reduce((sum, charge) => {
      const amount = Number(charge.amount) + Number(charge.taxAmount);
      byChargeType.set(charge.type, round((byChargeType.get(charge.type) ?? 0) + amount));
      return sum + amount;
    }, 0);
    const totalPayments = payments.reduce((sum, payment) => {
      const amount = Number(payment.amount);
      byPaymentMethod.set(payment.method, round((byPaymentMethod.get(payment.method) ?? 0) + amount));
      return sum + amount;
    }, 0);
    const adr = occupancy.roomNightsOccupied === 0 ? 0 : totalRevenue / occupancy.roomNightsOccupied;
    const revPar = occupancy.roomNightsAvailable === 0 ? 0 : totalRevenue / occupancy.roomNightsAvailable;

    return {
      totalRevenue: round(totalRevenue),
      totalPayments: round(totalPayments),
      adr: round(adr),
      revPar: round(revPar),
      byChargeType: [...byChargeType.entries()].map(([label, value]) => ({ label, value })),
      byPaymentMethod: [...byPaymentMethod.entries()].map(([label, value]) => ({ label, value })),
    };
  }
}
