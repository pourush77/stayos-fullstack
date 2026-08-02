import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationPaymentStatus } from '../reservations/domain/reservation-payment-status.enum';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { FolioEntity } from './infrastructure/folio.entity';
import { FolioStatus } from './domain/folio-status.enum';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { CreateFolioPaymentDto } from './dto/create-folio-payment.dto';
import { calculateTotals } from './billing.mapper';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(FolioEntity)
    private readonly foliosRepository: Repository<FolioEntity>,
    @InjectRepository(FolioChargeEntity)
    private readonly chargesRepository: Repository<FolioChargeEntity>,
    @InjectRepository(FolioPaymentEntity)
    private readonly paymentsRepository: Repository<FolioPaymentEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly dataSource: DataSource,
  ) {}

  async listFolios(propertyId: string, status?: FolioStatus): Promise<FolioEntity[]> {
    await this.propertiesService.findOne(propertyId);
    const qb = this.foliosRepository
      .createQueryBuilder('folio')
      .leftJoinAndSelect('folio.guest', 'guest')
      .leftJoinAndSelect('folio.reservation', 'reservation')
      .leftJoinAndSelect('folio.charges', 'charges')
      .leftJoinAndSelect('folio.payments', 'payments')
      .where('folio.propertyId = :propertyId', { propertyId });
    if (status) qb.andWhere('folio.status = :status', { status });
    qb.orderBy('folio.createdAt', 'DESC');
    return qb.getMany();
  }

  async getFolio(propertyId: string, folioId: string): Promise<FolioEntity> {
    await this.propertiesService.findOne(propertyId);
    const folio = await this.foliosRepository.findOne({
      where: { id: folioId, propertyId },
      relations: { property: true, guest: true, reservation: { room: true }, charges: true, payments: true },
    });
    if (!folio) throw new NotFoundException(`Folio ${folioId} was not found`);
    return folio;
  }

  async getOrCreateFolioForReservation(
    propertyId: string,
    reservationId: string,
  ): Promise<FolioEntity> {
    await this.propertiesService.findOne(propertyId);
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} was not found`);

    const existing = await this.foliosRepository.findOne({
      where: { reservationId, propertyId },
      relations: { guest: true, reservation: true, charges: true, payments: true },
    });
    if (existing) return existing;

    const folioNumber = await this.generateFolioNumber(propertyId);
    const nights = this.calculateNights(reservation.arrivalDate, reservation.departureDate);
    const folio = await this.dataSource.transaction(async (manager) => {
      const created = await manager.getRepository(FolioEntity).save(
        manager.getRepository(FolioEntity).create({
          propertyId,
          reservationId,
          guestId: reservation.guestId,
          folioNumber,
          status: FolioStatus.OPEN,
          currency: 'INR',
        }),
      );

      if (nights > 0) {
        const nightlyRate = 3500;
        await manager.getRepository(FolioChargeEntity).save(
          manager.getRepository(FolioChargeEntity).create({
            folioId: created.id,
            type: 'ROOM' as never,
            description: `Room charges - ${nights} night${nights === 1 ? '' : 's'}`,
            quantity: nights,
            unitAmount: nightlyRate.toFixed(2),
            amount: (nightlyRate * nights).toFixed(2),
            taxAmount: (nightlyRate * nights * 0.12).toFixed(2),
            chargedAt: new Date(),
          }),
        );
      }
      return created;
    });

    return this.getFolio(propertyId, folio.id);
  }

  async addCharge(
    propertyId: string,
    folioId: string,
    dto: CreateFolioChargeDto,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Cannot add charges to a folio that is not OPEN');
    }
    const quantity = dto.quantity ?? 1;
    const unit = parseFloat(dto.unitAmount);
    if (!Number.isFinite(unit)) throw new BadRequestException('unitAmount must be numeric');
    const amount = unit * quantity;
    const taxAmount = dto.taxAmount ? parseFloat(dto.taxAmount) : 0;
    const chargedAt = dto.chargedAt ? new Date(dto.chargedAt) : new Date();

    const charge = this.chargesRepository.create({
      folioId,
      type: dto.type,
      description: dto.description,
      quantity,
      unitAmount: unit.toFixed(2),
      amount: amount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      chargedAt,
      createdByUserId: actorUserId ?? null,
    });
    await this.chargesRepository.save(charge);
    await this.foliosRepository.update({ id: folioId }, { updatedAt: new Date() });
    return this.getFolio(propertyId, folioId);
  }

  async addPayment(
    propertyId: string,
    folioId: string,
    dto: CreateFolioPaymentDto,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status === FolioStatus.VOID) {
      throw new BadRequestException('Cannot record payments on a voided folio');
    }
    const amount = parseFloat(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    const payment = this.paymentsRepository.create({
      folioId,
      method: dto.method,
      amount: amount.toFixed(2),
      reference: dto.reference ?? null,
      notes: dto.notes ?? null,
      receivedAt,
      receivedByUserId: actorUserId ?? null,
    });
    await this.paymentsRepository.save(payment);

    // Update reservation payment status based on totals
    const updatedFolio = await this.getFolio(propertyId, folioId);
    const totals = calculateTotals(updatedFolio.charges, updatedFolio.payments);
    const balance = parseFloat(totals.balance);
    const paid = parseFloat(totals.paid);
    let paymentStatus: ReservationPaymentStatus = ReservationPaymentStatus.PAYMENT_DUE;
    if (balance <= 0.01 && paid > 0) paymentStatus = ReservationPaymentStatus.PAID;
    else if (paid > 0) paymentStatus = ReservationPaymentStatus.PARTIALLY_PAID;
    await this.reservationsRepository.update(
      { id: updatedFolio.reservationId, propertyId },
      { paymentStatus },
    );

    return this.getFolio(propertyId, folioId);
  }

  async settleFolio(propertyId: string, folioId: string): Promise<FolioEntity> {
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status === FolioStatus.SETTLED) return folio;
    if (folio.status === FolioStatus.VOID) {
      throw new BadRequestException('Voided folios cannot be settled');
    }
    const totals = calculateTotals(folio.charges, folio.payments);
    const balance = parseFloat(totals.balance);
    if (balance > 0.01) {
      throw new BadRequestException(`Folio has an outstanding balance of ${totals.balance}`);
    }
    await this.foliosRepository.update(
      { id: folioId },
      { status: FolioStatus.SETTLED, settledAt: new Date() },
    );
    await this.reservationsRepository.update(
      { id: folio.reservationId, propertyId },
      { paymentStatus: ReservationPaymentStatus.PAID },
    );
    return this.getFolio(propertyId, folioId);
  }

  private calculateNights(arrival: string, departure: string): number {
    const arr = new Date(arrival);
    const dep = new Date(departure);
    if (Number.isNaN(arr.getTime()) || Number.isNaN(dep.getTime())) return 0;
    return Math.max(
      0,
      Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private async generateFolioNumber(propertyId: string): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const count = await this.foliosRepository.count({ where: { propertyId } });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const seq = String(count + attempt + 1).padStart(5, '0');
      const candidate = `FO${yy}${mm}${dd}-${seq}`;
      const existing = await this.foliosRepository.findOne({
        where: { propertyId, folioNumber: candidate },
      });
      if (!existing) return candidate;
    }
    return `FO${yy}${mm}${dd}-${String(Date.now()).slice(-6)}`;
  }

  // Reservation status update helpers reserved for future workflow integration.

  async getOverviewSummary(propertyId: string): Promise<{
    openFolios: number;
    settledFolios: number;
    voidFolios: number;
    outstandingBalance: string;
    todayRevenue: string;
    monthRevenue: string;
  }> {
    await this.propertiesService.findOne(propertyId);
    const folios = await this.foliosRepository.find({
      where: { propertyId },
      relations: { charges: true, payments: true },
    });

    let openFolios = 0;
    let settledFolios = 0;
    let voidFolios = 0;
    let outstandingBalance = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    for (const folio of folios) {
      if (folio.status === FolioStatus.OPEN) openFolios += 1;
      else if (folio.status === FolioStatus.SETTLED) settledFolios += 1;
      else voidFolios += 1;

      const totals = calculateTotals(folio.charges, folio.payments);
      const balance = parseFloat(totals.balance);
      if (balance > 0) outstandingBalance += balance;

      for (const payment of folio.payments ?? []) {
        const d = new Date(payment.receivedAt);
        const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const amount = parseFloat(payment.amount);
        if (!Number.isFinite(amount)) continue;
        if (dKey === todayKey) todayRevenue += amount;
        if (mKey === monthKey) monthRevenue += amount;
      }
    }

    return {
      openFolios,
      settledFolios,
      voidFolios,
      outstandingBalance: outstandingBalance.toFixed(2),
      todayRevenue: todayRevenue.toFixed(2),
      monthRevenue: monthRevenue.toFixed(2),
    };
  }
}
