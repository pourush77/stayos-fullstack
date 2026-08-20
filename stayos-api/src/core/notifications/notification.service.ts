import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { NotificationChannel } from './domain/notification-channel.enum';
import { NotificationStatus } from './domain/notification-status.enum';
import { NotificationType } from './domain/notification-type.enum';
import { EMAIL_PROVIDER, EmailProvider, EmailSendInput } from './email/email-provider.interface';
import { NotificationDeliveryEntity } from './infrastructure/notification-delivery.entity';

export interface QueueEmailNotificationInput {
  propertyId: string;
  notificationType: NotificationType;
  entityType: string;
  entityId: string;
  recipient: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveriesRepository: Repository<NotificationDeliveryEntity>,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  async queueEmail(
    input: QueueEmailNotificationInput,
    manager?: EntityManager,
  ): Promise<NotificationDeliveryEntity> {
    const repository = manager
      ? manager.getRepository(NotificationDeliveryEntity)
      : this.deliveriesRepository;

    const recipient = this.normalizeEmail(input.recipient);
    const dedupeKey = this.buildAutomaticDedupeKey({
      propertyId: input.propertyId,
      notificationType: input.notificationType,
      entityId: input.entityId,
      channel: NotificationChannel.EMAIL,
    });

    const existing = await repository.findOne({ where: { dedupeKey } });
    if (existing) {
      return existing;
    }

    const delivery = repository.create({
      propertyId: input.propertyId,
      channel: NotificationChannel.EMAIL,
      notificationType: input.notificationType,
      entityType: input.entityType,
      entityId: input.entityId,
      recipient,
      status: NotificationStatus.PENDING,
      provider: null,
      providerMessageId: null,
      dedupeKey,
      attemptCount: 0,
      nextAttemptAt: null,
      lastError: null,
      sentAt: null,
    });

    try {
      return await repository.save(delivery);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await repository.findOne({ where: { dedupeKey } });
        if (duplicate) {
          return duplicate;
        }
      }

      throw error;
    }
  }

  async queueEmailResend(input: QueueEmailNotificationInput): Promise<NotificationDeliveryEntity> {
    const recipient = this.normalizeEmail(input.recipient);
    const dedupeKey = [
      input.propertyId,
      input.notificationType,
      input.entityId,
      NotificationChannel.EMAIL,
      'resend',
      randomUUID(),
    ].join(':');

    const delivery = this.deliveriesRepository.create({
      propertyId: input.propertyId,
      channel: NotificationChannel.EMAIL,
      notificationType: input.notificationType,
      entityType: input.entityType,
      entityId: input.entityId,
      recipient,
      status: NotificationStatus.PENDING,
      provider: null,
      providerMessageId: null,
      dedupeKey,
      attemptCount: 0,
      nextAttemptAt: null,
      lastError: null,
      sentAt: null,
    });

    return this.deliveriesRepository.save(delivery);
  }

  async sendEmail(
    deliveryId: string,
    input: Omit<EmailSendInput, 'to'>,
  ): Promise<NotificationDeliveryEntity> {
    const delivery = await this.deliveriesRepository.findOne({
      where: {
        id: deliveryId,
        channel: NotificationChannel.EMAIL,
      },
    });

    if (!delivery) {
      throw new Error('Email notification delivery was not found');
    }

    if (delivery.status === NotificationStatus.SENT) {
      return delivery;
    }

    delivery.attemptCount += 1;
    delivery.lastError = null;
    delivery.nextAttemptAt = null;

    try {
      const result = await this.emailProvider.send({
        ...input,
        to: delivery.recipient,
      });

      delivery.status = NotificationStatus.SENT;
      delivery.provider = 'resend';
      delivery.providerMessageId = result.providerMessageId ?? null;
      delivery.sentAt = new Date();
      delivery.lastError = null;

      return await this.deliveriesRepository.save(delivery);
    } catch (error) {
      delivery.status = NotificationStatus.FAILED;
      delivery.provider = 'resend';
      delivery.providerMessageId = null;
      delivery.sentAt = null;
      delivery.lastError = this.safeErrorMessage(error);

      await this.deliveriesRepository.save(delivery);
      return delivery;
    }
  }

  isEmailConfigured(): boolean {
    return this.emailProvider.isConfigured();
  }

  buildAutomaticDedupeKey(input: {
    propertyId: string;
    notificationType: NotificationType;
    entityId: string;
    channel: NotificationChannel;
  }): string {
    return [input.propertyId, input.notificationType, input.entityId, input.channel].join(':');
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private safeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 1000);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
