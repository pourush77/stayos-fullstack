import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { GuestIdentityDocumentEntity } from '../infrastructure/guest-identity-document.entity';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { DocumentStorageService } from './document-storage.service';
import { GuestDocumentEntity, GuestDocumentSide } from './guest-document.entity';
import {
  MobileCaptureSessionEntity,
  MobileCaptureSessionStatus,
} from './mobile-capture-session.entity';
import { MobileCaptureDto } from './mobile-capture.dto';

const ALLOWED_DOCUMENT_TYPES = [
  'Aadhaar',
  'Passport',
  'Driving Licence',
  'PAN',
  'Voter ID',
  'Other',
];
const SESSION_TTL_MS = 30 * 60 * 1000;

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class MobileCaptureService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: DocumentStorageService,
  ) {}

  async createSession(propertyId: string, reservationId: string): Promise<MobileCaptureDto> {
    return this.dataSource.transaction(async (manager) => {
      const { reservation, guest } = await this.loadReservation(propertyId, reservationId, manager);
      const sessionRepository = manager.getRepository(MobileCaptureSessionEntity);
      const now = new Date();
      const active = await sessionRepository.findOne({
        where: { reservationId, propertyId, status: MobileCaptureSessionStatus.ACTIVE },
        order: { createdAt: 'DESC' },
      });

      if (active && active.expiresAt > now) {
        return this.toDto(
          active,
          reservation,
          guest,
          await this.loadDocuments(reservationId, manager),
        );
      }
      if (active) {
        active.status = MobileCaptureSessionStatus.EXPIRED;
        await sessionRepository.save(active);
      }

      const session = await sessionRepository.save(
        sessionRepository.create({
          propertyId,
          reservationId,
          token: randomBytes(32).toString('hex'),
          status: MobileCaptureSessionStatus.ACTIVE,
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        }),
      );

      return this.toDto(
        session,
        reservation,
        guest,
        await this.loadDocuments(reservationId, manager),
      );
    });
  }

  async getSessionByToken(token: string): Promise<MobileCaptureDto> {
    const { session, reservation, guest } = await this.loadActiveSessionByToken(token);
    return this.toDto(session, reservation, guest, await this.loadDocuments(session.reservationId));
  }

  async getSessionStatus(id: string): Promise<MobileCaptureDto> {
    const session = await this.dataSource.getRepository(MobileCaptureSessionEntity).findOne({
      where: { id },
    });
    if (!session) throw this.invalid();
    this.assertNotExpired(session);
    const { reservation, guest } = await this.loadReservation(
      session.propertyId,
      session.reservationId,
    );
    return this.toDto(session, reservation, guest, await this.loadDocuments(session.reservationId));
  }

  async getReservationSessionStatus(
    propertyId: string,
    reservationId: string,
  ): Promise<MobileCaptureDto> {
    const session = await this.dataSource.getRepository(MobileCaptureSessionEntity).findOne({
      where: { propertyId, reservationId, status: MobileCaptureSessionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
    if (!session) throw this.invalid();
    this.assertNotExpired(session);
    const { reservation, guest } = await this.loadReservation(propertyId, reservationId);
    return this.toDto(session, reservation, guest, await this.loadDocuments(reservationId));
  }

  async uploadByToken(
    token: string,
    side: GuestDocumentSide,
    file: UploadFile,
  ): Promise<MobileCaptureDto> {
    const { session } = await this.loadActiveSessionByToken(token);
    return this.uploadForSession(session, side, file);
  }

  async uploadBySessionId(
    id: string,
    side: GuestDocumentSide,
    file: UploadFile,
  ): Promise<MobileCaptureDto> {
    const session = await this.dataSource
      .getRepository(MobileCaptureSessionEntity)
      .findOne({ where: { id } });
    if (!session) throw this.invalid();
    this.assertNotExpired(session);
    return this.uploadForSession(session, side, file);
  }

  async completeByToken(token: string): Promise<MobileCaptureDto> {
    const { session } = await this.loadActiveSessionByToken(token);
    return this.complete(session);
  }

  async deleteDocument(propertyId: string, reservationId: string, documentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { reservation } = await this.loadReservation(propertyId, reservationId, manager);
      const repository = manager.getRepository(GuestDocumentEntity);
      const document = await repository.findOne({
        where: { id: documentId, propertyId, reservationId: reservation.id },
      });
      if (!document) throw this.invalid();
      await repository.delete(document.id);
      const identity = await manager.getRepository(GuestIdentityDocumentEntity).findOne({
        where: { reservationId: reservation.id, propertyId },
      });
      if (identity) {
        if (document.side === 'ID_FRONT') identity.documentFrontUrl = null;
        if (document.side === 'ID_BACK') identity.documentBackUrl = null;
        await manager.getRepository(GuestIdentityDocumentEntity).save(identity);
      }
      return { deleted: true, documentId };
    });
  }

  async getDocumentPreview(
    propertyId: string,
    reservationId: string,
    documentId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const { reservation } = await this.loadReservation(propertyId, reservationId);
    const document = await this.dataSource
      .getRepository(GuestDocumentEntity)
      .findOne({ where: { id: documentId, propertyId, reservationId: reservation.id } });
    if (!document) throw new NotFoundException('Document not found');
    const buffer = await this.storage.read(document.storagePath);
    return { buffer, mimeType: document.mimeType, filename: document.originalFilename };
  }

  private async uploadForSession(
    session: MobileCaptureSessionEntity,
    side: GuestDocumentSide,
    file: UploadFile,
  ): Promise<MobileCaptureDto> {
    if (!file)
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'File is required',
      });
    if (!['ID_FRONT', 'ID_BACK', 'GUEST_FACE'].includes(side)) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Document type must be ID_FRONT, ID_BACK or GUEST_FACE',
      });
    }
    return this.dataSource.transaction(async (manager) => {
      const { reservation, guest } = await this.loadReservation(
        session.propertyId,
        session.reservationId,
        manager,
      );
      const repository = manager.getRepository(GuestDocumentEntity);
      const existing = await repository.findOne({ where: { reservationId: reservation.id, side } });
      const document =
        existing ??
        repository.create({
          propertyId: session.propertyId,
          guestId: reservation.guestId,
          reservationId: reservation.id,
          side,
        });
      document.id = existing?.id ?? randomUUID();
      document.documentKind = side;
      document.originalFilename = file.originalname.slice(0, 160);
      document.mimeType = file.mimetype;
      document.sizeBytes = file.size;
      document.storagePath = await this.storage.save({
        buffer: file.buffer,
        documentId: document.id,
        mimeType: file.mimetype,
        propertyId: session.propertyId,
        reservationId: reservation.id,
      });
      const finalDocument = await repository.save(document);
      if (side === 'ID_FRONT' || side === 'ID_BACK') {
        await this.syncIdentityUrls(manager, reservation, side, finalDocument.storagePath);
      }
      return this.toDto(
        session,
        reservation,
        guest,
        await this.loadDocuments(reservation.id, manager),
      );
    });
  }

  private async complete(session: MobileCaptureSessionEntity): Promise<MobileCaptureDto> {
    return this.dataSource.transaction(async (manager) => {
      const { reservation, guest } = await this.loadReservation(
        session.propertyId,
        session.reservationId,
        manager,
      );
      const documents = await this.loadDocuments(reservation.id, manager);
      if (
        !documents.some((doc) => doc.side === 'ID_FRONT') ||
        !documents.some((doc) => doc.side === 'ID_BACK')
      ) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Both front and back documents are required',
        });
      }
      session.status = MobileCaptureSessionStatus.COMPLETED;
      const saved = await manager.getRepository(MobileCaptureSessionEntity).save(session);
      return this.toDto(saved, reservation, guest, documents);
    });
  }

  private async syncIdentityUrls(
    manager: EntityManager,
    reservation: ReservationEntity,
    side: GuestDocumentSide,
    storagePath: string,
  ): Promise<void> {
    const repository = manager.getRepository(GuestIdentityDocumentEntity);
    const identity =
      (await repository.findOne({
        where: { reservationId: reservation.id, propertyId: reservation.propertyId },
      })) ??
      repository.create({
        propertyId: reservation.propertyId,
        guestId: reservation.guestId,
        reservationId: reservation.id,
        idType: 'OTHER' as GuestIdentityDocumentEntity['idType'],
        idNumberMasked: '',
        verified: false,
      });
    if (side === 'ID_FRONT') identity.documentFrontUrl = storagePath;
    if (side === 'ID_BACK') identity.documentBackUrl = storagePath;
    await repository.save(identity);
  }

  private async loadActiveSessionByToken(token: string) {
    const session = await this.dataSource.getRepository(MobileCaptureSessionEntity).findOne({
      where: { token, status: MobileCaptureSessionStatus.ACTIVE },
    });
    if (!session) throw this.invalid();
    this.assertNotExpired(session);
    const { reservation, guest } = await this.loadReservation(
      session.propertyId,
      session.reservationId,
    );
    return { session, reservation, guest };
  }

  private async loadReservation(
    propertyId: string,
    reservationId: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const reservation = await manager.getRepository(ReservationEntity).findOne({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) throw this.invalid();
    const guest = await manager.getRepository(GuestEntity).findOne({
      where: { id: reservation.guestId, propertyId },
    });
    if (!guest) throw this.invalid();
    return { reservation, guest };
  }

  private loadDocuments(reservationId: string, manager: EntityManager = this.dataSource.manager) {
    return manager.getRepository(GuestDocumentEntity).find({ where: { reservationId } });
  }

  private toDto(
    session: MobileCaptureSessionEntity,
    reservation: ReservationEntity,
    guest: GuestEntity,
    documents: GuestDocumentEntity[],
  ): MobileCaptureDto {
    return {
      allowedDocumentTypes: ALLOWED_DOCUMENT_TYPES,
      backUploaded: documents.some((doc) => doc.side === 'ID_BACK'),
      completedAt:
        session.status === MobileCaptureSessionStatus.COMPLETED
          ? session.updatedAt.toISOString()
          : null,
      expiresAt: session.expiresAt.toISOString(),
      frontUploaded: documents.some((doc) => doc.side === 'ID_FRONT'),
      guestDisplayName: guest.displayName,
      reservationReference: reservation.reservationCode,
      sessionId: session.id,
      status: session.status,
      token: session.token,
    };
  }

  private assertNotExpired(session: MobileCaptureSessionEntity): void {
    if (session.expiresAt > new Date()) return;
    throw new GoneException({
      code: 'MOBILE_CAPTURE_EXPIRED',
      message: 'Mobile capture session expired',
    });
  }

  private invalid(): NotFoundException {
    return new NotFoundException({
      code: 'MOBILE_CAPTURE_INVALID',
      message: 'Mobile capture session not found',
    });
  }
}
