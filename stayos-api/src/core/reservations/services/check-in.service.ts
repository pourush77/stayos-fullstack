import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Not } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { calculateTotals } from '../../billing/billing.mapper';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { CFormStatus } from '../domain/c-form-status.enum';
import { IdentityDocumentType } from '../domain/identity-document-type.enum';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { PaymentReviewDto } from '../dto/payment-review.dto';
import { CheckInWorkspaceResponseDto } from '../dto/check-in-workspace-response.dto';
import { UpdateGuestRegistrationDto } from '../dto/update-guest-registration.dto';
import { UpdateIdentityVerificationDto } from '../dto/update-identity-verification.dto';
import { GuestIdentityDocumentEntity } from '../infrastructure/guest-identity-document.entity';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { GuestDocumentEntity } from '../check-in-capture/guest-document.entity';

interface ActorContext {
  actorId?: string | null;
}

interface WorkspaceParts {
  reservation: ReservationEntity;
  guest: GuestEntity;
  room: RoomEntity | null;
  identity: GuestIdentityDocumentEntity | null;
  documents?: GuestDocumentEntity[];
  folio?: FolioEntity | null;
}

@Injectable()
export class CheckInService {
  constructor(private readonly dataSource: DataSource) {}

  async getWorkspace(
    propertyId: string,
    reservationId: string,
  ): Promise<CheckInWorkspaceResponseDto> {
    const parts = await this.loadWorkspaceParts(propertyId, reservationId);
    return this.toWorkspace(parts);
  }

  async updateGuestRegistration(
    propertyId: string,
    reservationId: string,
    dto: UpdateGuestRegistrationDto,
    actorContext: ActorContext = {},
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const parts = await this.loadWorkspaceParts(propertyId, reservationId, manager);
      const { reservation, guest } = parts;
      const previousState = this.registrationState(reservation, guest);

      if (dto.fullName !== undefined) {
        this.applyFullName(guest, dto.fullName);
      }
      if (dto.mobile !== undefined && dto.mobile !== guest.phone) {
        const existingGuest = await manager.getRepository(GuestEntity).findOne({
          where: { id: Not(guest.id), phone: dto.mobile, propertyId },
        });
        if (existingGuest) {
          throw new ConflictException('A guest with this mobile number already exists.');
        }
      }
      this.assignIfDefined(guest, 'phone', dto.mobile);
      this.assignIfDefined(guest, 'email', dto.email);
      this.assignIfDefined(guest, 'dateOfBirth', dto.dateOfBirth);
      this.assignIfDefined(guest, 'gender', dto.gender);
      this.assignIfDefined(guest, 'nationality', dto.nationality);
      this.assignIfDefined(guest, 'addressLine1', dto.addressLine1);
      this.assignIfDefined(guest, 'addressLine2', dto.addressLine2);
      this.assignIfDefined(guest, 'city', dto.city);
      this.assignIfDefined(guest, 'state', dto.state);
      this.assignIfDefined(guest, 'country', dto.country);
      this.assignIfDefined(guest, 'postalCode', dto.postalCode);
      this.assignIfDefined(guest, 'purposeOfVisit', dto.purposeOfVisit);
      this.assignIfDefined(guest, 'arrivalFrom', dto.arrivalFrom);
      this.assignIfDefined(guest, 'nextDestination', dto.nextDestination);

      if (dto.isForeignNational !== undefined) {
        reservation.isForeignNational = dto.isForeignNational;
      }
      if (dto.passportNumber !== undefined) {
        reservation.passportNumberMasked = this.maskIdentifier(dto.passportNumber);
      }
      this.assignIfDefined(reservation, 'passportIssuePlace', dto.passportIssuePlace);
      this.assignIfDefined(reservation, 'passportIssueDate', dto.passportIssueDate);
      this.assignIfDefined(reservation, 'passportExpiryDate', dto.passportExpiryDate);
      if (dto.visaNumber !== undefined) {
        reservation.visaNumberMasked = this.maskIdentifier(dto.visaNumber);
      }
      this.assignIfDefined(reservation, 'visaType', dto.visaType);
      this.assignIfDefined(reservation, 'visaIssueDate', dto.visaIssueDate);
      this.assignIfDefined(reservation, 'visaExpiryDate', dto.visaExpiryDate);
      if (dto.cFormRequired !== undefined) {
        reservation.cFormRequired = dto.cFormRequired;
      } else if (reservation.isForeignNational) {
        reservation.cFormRequired = true;
      }
      if (dto.cFormStatus !== undefined) {
        reservation.cFormStatus = dto.cFormStatus;
      } else if (reservation.cFormRequired && (reservation.cFormStatus ?? CFormStatus.NOT_REQUIRED) === CFormStatus.NOT_REQUIRED) {
        reservation.cFormStatus = CFormStatus.PENDING;
      }

      await manager.getRepository(GuestEntity).save(guest);
      await manager.getRepository(ReservationEntity).save(reservation);
      await this.createEvent(manager, {
        propertyId,
        actorId: actorContext.actorId ?? null,
        reservation,
        action: 'CHECKIN_GUEST_REGISTRATION_UPDATED',
        title: 'Guest registration updated',
        description: `Registration updated for ${guest.displayName}.`,
        previousState,
        nextState: this.registrationState(reservation, guest),
      });

      return this.toWorkspace({ ...parts, reservation, guest });
    });
  }

  async updateIdentity(
    propertyId: string,
    reservationId: string,
    dto: UpdateIdentityVerificationDto,
    actorContext: ActorContext = {},
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const parts = await this.loadWorkspaceParts(propertyId, reservationId, manager);
      const repository = manager.getRepository(GuestIdentityDocumentEntity);
      const identity =
        parts.identity ??
        repository.create({
          propertyId,
          guestId: parts.guest.id,
          reservationId: parts.reservation.id,
        });
      const previousState = this.identityState(identity);

      identity.idType = dto.idType;
      identity.idNumberMasked = this.maskIdentifier(dto.idNumber);
      identity.documentFrontUrl = dto.documentFrontUrl ?? null;
      identity.documentBackUrl = dto.documentBackUrl ?? null;
      identity.verified = dto.verified;
      identity.verifiedByUserId = dto.verified ? (actorContext.actorId ?? null) : null;
      identity.verifiedAt = dto.verified ? new Date() : null;

      if (parts.reservation.isForeignNational && dto.idType !== IdentityDocumentType.PASSPORT) {
        throw this.badRequest(
          ApiErrorCode.CHECKIN_IDENTITY_NOT_VERIFIED,
          'Foreign guests require passport identity verification',
        );
      }

      const savedIdentity = await repository.save(identity);
      await this.createEvent(manager, {
        propertyId,
        actorId: actorContext.actorId ?? null,
        reservation: parts.reservation,
        action: dto.verified ? 'CHECKIN_IDENTITY_VERIFIED' : 'CHECKIN_IDENTITY_UPDATED',
        title: dto.verified ? 'Identity verified' : 'Identity updated',
        description: `Identity document updated for ${parts.guest.displayName}.`,
        previousState,
        nextState: this.identityState(savedIdentity),
      });

      return this.toWorkspace({ ...parts, identity: savedIdentity });
    });
  }

  async reviewPayment(
    propertyId: string,
    reservationId: string,
    dto: PaymentReviewDto,
    actorContext: ActorContext = {},
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const parts = await this.loadWorkspaceParts(propertyId, reservationId, manager);
      const previousState = {
        paymentReviewed: parts.reservation.paymentReviewed,
        paymentMethod: parts.reservation.paymentMethod,
      };
      parts.reservation.paymentReviewed = dto.paymentReviewed;
      parts.reservation.paymentMethod = dto.paymentMethod ?? parts.reservation.paymentMethod;
      parts.reservation.paymentReviewNotes = dto.notes ?? parts.reservation.paymentReviewNotes;

      const reservation = await manager.getRepository(ReservationEntity).save(parts.reservation);
      await this.createEvent(manager, {
        propertyId,
        actorId: actorContext.actorId ?? null,
        reservation,
        action: 'CHECKIN_PAYMENT_REVIEWED',
        title: 'Payment reviewed',
        description: `Payment reviewed for reservation ${reservation.reservationCode}.`,
        previousState,
        nextState: {
          paymentReviewed: reservation.paymentReviewed,
          paymentMethod: reservation.paymentMethod,
        },
      });

      return this.toWorkspace({ ...parts, reservation });
    });
  }

  validateFinalChecklist(parts: WorkspaceParts): void {
    const workspace = this.toWorkspace(parts);
    if (workspace.finalChecklist.canCheckIn) {
      return;
    }

    const code = workspace.finalChecklist.blockers.includes(ApiErrorCode.CHECKIN_ALREADY_CHECKED_IN)
      ? ApiErrorCode.CHECKIN_ALREADY_CHECKED_IN
      : (workspace.finalChecklist.blockers[0] as ApiErrorCode);
    throw this.badRequest(code, this.messageForBlocker(code));
  }

  async loadWorkspaceParts(
    propertyId: string,
    reservationId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<WorkspaceParts> {
    const reservation = await manager.getRepository(ReservationEntity).findOne({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) {
      throw new NotFoundException({
        code: ApiErrorCode.RESERVATION_NOT_FOUND,
        message: `Reservation ${reservationId} was not found`,
      });
    }

    const [guest, room, identity] = await Promise.all([
      manager.getRepository(GuestEntity).findOne({ where: { id: reservation.guestId, propertyId } }),
      reservation.roomId
        ? manager.getRepository(RoomEntity).findOne({
            where: { id: reservation.roomId, propertyId },
            relations: { roomType: true, floor: true },
          })
        : Promise.resolve(null),
      manager.getRepository(GuestIdentityDocumentEntity).findOne({
        where: { reservationId: reservation.id, propertyId },
        order: { updatedAt: 'DESC' },
      }),
    ]);
    const [documents, folio] = await Promise.all([
      manager.getRepository(GuestDocumentEntity).find({
        where: { reservationId: reservation.id, propertyId },
        order: { createdAt: 'DESC' },
      }),
      manager.getRepository(FolioEntity).findOne({
        where: { reservationId: reservation.id, propertyId },
        relations: { charges: true, payments: true },
      }),
    ]);

    if (!guest) {
      throw new NotFoundException({
        code: ApiErrorCode.GUEST_NOT_FOUND,
        message: `Guest ${reservation.guestId} was not found`,
      });
    }

    return { reservation, guest, room, identity, documents, folio };
  }

  toWorkspace(parts: WorkspaceParts): CheckInWorkspaceResponseDto {
    const { reservation, guest, room, identity } = parts;
    const blockers = this.getBlockers(parts);
    const address = [guest.addressLine1, guest.addressLine2].filter(Boolean).join(', ') || null;
    const folioTotals = parts.folio
      ? calculateTotals(parts.folio.charges ?? [], parts.folio.payments ?? [])
      : null;
    const outstandingAmount = folioTotals
      ? Number(folioTotals.balance)
      : reservation.paymentStatus === ReservationPaymentStatus.PAID
        ? 0
        : 0;

    return {
      booking: {
        reservationId: reservation.id,
        reservationCode: reservation.reservationCode,
        status: reservation.status,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        adults: reservation.adults,
        children: reservation.children,
        source: reservation.source,
        specialRequests: reservation.specialRequests,
      },
      guest: {
        guestId: guest.id,
        fullName: guest.displayName,
        mobile: guest.phone,
        email: guest.email,
        nationality: guest.nationality,
        gender: guest.gender,
        dateOfBirth: guest.dateOfBirth,
        address,
        city: guest.city ?? null,
        state: guest.state ?? null,
        country: guest.country ?? null,
        postalCode: guest.postalCode ?? null,
        purposeOfVisit: guest.purposeOfVisit ?? null,
        arrivalFrom: guest.arrivalFrom ?? null,
        nextDestination: guest.nextDestination ?? null,
      },
      identity: {
        idType: identity?.idType ?? null,
        idNumberMasked: identity?.idNumberMasked ?? null,
        documentFrontUploaded: Boolean(identity?.documentFrontUrl),
        documentBackUploaded: Boolean(identity?.documentBackUrl),
        verified: identity?.verified ?? false,
        verifiedBy: identity?.verifiedByUserId ?? null,
        verifiedAt: identity?.verifiedAt ?? null,
      },
      documents: (parts.documents ?? []).map((document) => ({
        id: document.id,
        side: document.side,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        createdAt: document.createdAt,
      })),
      foreignGuest: {
        isForeignNational: reservation.isForeignNational ?? false,
        passportNumberMasked: reservation.passportNumberMasked ?? null,
        passportIssuePlace: reservation.passportIssuePlace ?? null,
        passportIssueDate: reservation.passportIssueDate ?? null,
        passportExpiryDate: reservation.passportExpiryDate ?? null,
        visaNumberMasked: reservation.visaNumberMasked ?? null,
        visaType: reservation.visaType ?? null,
        visaIssueDate: reservation.visaIssueDate ?? null,
        visaExpiryDate: reservation.visaExpiryDate ?? null,
        cFormRequired: reservation.cFormRequired ?? false,
        cFormStatus: reservation.cFormStatus ?? CFormStatus.NOT_REQUIRED,
      },
      payment: {
        paymentStatus: reservation.paymentStatus,
        outstandingAmount,
        paymentMethod: reservation.paymentMethod ?? null,
      },
      room: {
        roomId: room?.id ?? null,
        roomNumber: room?.roomNumber ?? null,
        roomType: room?.roomType?.name ?? null,
        floor: room?.floor?.name ?? null,
        operationalStatus: room?.operationalStatus ?? null,
        readyForCheckIn: room?.operationalStatus === RoomOperationalStatus.READY,
        warnings: this.getRoomWarnings(room),
      },
      finalChecklist: {
        bookingReviewed: true,
        guestRegistrationComplete: this.isGuestRegistrationComplete(reservation, guest),
        identityVerified: identity?.verified ?? false,
        paymentReviewed: reservation.paymentReviewed ?? false,
        roomReady: room?.operationalStatus === RoomOperationalStatus.READY,
        canCheckIn: blockers.length === 0,
        blockers,
        missingRegistrationFields: this.getMissingRegistrationFields(reservation, guest),
      },
    };
  }

  private getBlockers(parts: WorkspaceParts): string[] {
    const blockers: string[] = [];
    if (parts.reservation.status === 'CHECKED_IN') blockers.push(ApiErrorCode.CHECKIN_ALREADY_CHECKED_IN);
    if (!this.isGuestRegistrationComplete(parts.reservation, parts.guest)) {
      blockers.push(ApiErrorCode.CHECKIN_GUEST_REGISTRATION_INCOMPLETE);
    }
    if (!parts.identity?.verified) blockers.push(ApiErrorCode.CHECKIN_IDENTITY_NOT_VERIFIED);
    if (!(parts.reservation.paymentReviewed ?? false)) blockers.push(ApiErrorCode.CHECKIN_PAYMENT_NOT_REVIEWED);
    if (!parts.room || parts.room.operationalStatus !== RoomOperationalStatus.READY) {
      blockers.push(ApiErrorCode.CHECKIN_ROOM_NOT_READY);
    }
    if (
      parts.room &&
      [RoomOperationalStatus.OCCUPIED, RoomOperationalStatus.MAINTENANCE, RoomOperationalStatus.OUT_OF_ORDER, RoomOperationalStatus.OUT_OF_SERVICE].includes(
        parts.room.operationalStatus,
      )
    ) {
      blockers.push(ApiErrorCode.CHECKIN_ROOM_UNAVAILABLE);
    }
    return blockers;
  }

  private isGuestRegistrationComplete(reservation: ReservationEntity, guest: GuestEntity): boolean {
    return this.getMissingRegistrationFields(reservation, guest).length === 0;
  }

  private getMissingRegistrationFields(reservation: ReservationEntity, guest: GuestEntity): string[] {
    const missing: string[] = [];
    if (!guest.displayName?.trim()) missing.push('fullName');
    if (!guest.nationality?.trim()) missing.push('nationality');
    if (!guest.addressLine1?.trim()) missing.push('addressLine1');
    if (!guest.city?.trim()) missing.push('city');
    if (!guest.state?.trim()) missing.push('state');
    if (!guest.country?.trim()) missing.push('country');
    if (!guest.purposeOfVisit?.trim()) missing.push('purposeOfVisit');
    if (!(reservation.isForeignNational ?? false)) {
      if (!guest.phone?.trim()) missing.push('mobile');
      return missing;
    }
    if (!reservation.passportNumberMasked) missing.push('passportNumber');
    if (!reservation.passportIssuePlace) missing.push('passportIssuePlace');
    if (!reservation.passportIssueDate) missing.push('passportIssueDate');
    if (!reservation.passportExpiryDate) missing.push('passportExpiryDate');
    if (!reservation.visaNumberMasked) missing.push('visaNumber');
    if (!reservation.visaType) missing.push('visaType');
    if (!reservation.visaIssueDate) missing.push('visaIssueDate');
    if (!reservation.visaExpiryDate) missing.push('visaExpiryDate');
    return missing;
  }

  private getRoomWarnings(room: RoomEntity | null): string[] {
    if (!room) return ['No room assigned'];
    if (room.operationalStatus === RoomOperationalStatus.READY) return [];
    return [`Room is ${room.operationalStatus}`];
  }

  private applyFullName(guest: GuestEntity, fullName: string): void {
    const [firstName, ...lastName] = fullName.trim().split(/\s+/);
    guest.firstName = firstName;
    guest.lastName = lastName.length ? lastName.join(' ') : null;
    guest.displayName = fullName.trim();
  }

  private assignIfDefined<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
    if (value !== undefined) target[key] = value;
  }

  private maskIdentifier(value: string): string {
    const compact = value.replace(/\s+/g, '');
    if (compact.length <= 4) return '*'.repeat(compact.length);
    return `${'*'.repeat(Math.max(0, compact.length - 4))}${compact.slice(-4)}`;
  }

  private registrationState(reservation: ReservationEntity, guest: GuestEntity): Record<string, unknown> {
    return {
      guestId: guest.id,
      displayName: guest.displayName,
      nationality: guest.nationality,
      isForeignNational: reservation.isForeignNational,
      cFormStatus: reservation.cFormStatus,
    };
  }

  private identityState(identity: GuestIdentityDocumentEntity): Record<string, unknown> {
    return {
      id: identity.id,
      idType: identity.idType,
      idNumberMasked: identity.idNumberMasked,
      verified: identity.verified,
      verifiedByUserId: identity.verifiedByUserId,
      verifiedAt: identity.verifiedAt,
    };
  }

  private async createEvent(
    manager: EntityManager,
    input: {
      propertyId: string;
      actorId: string | null;
      reservation: ReservationEntity;
      action: string;
      title: string;
      description: string;
      previousState: Record<string, unknown>;
      nextState: Record<string, unknown>;
    },
  ): Promise<void> {
    await Promise.all([
      manager.getRepository(AuditEventEntity).save({
        propertyId: input.propertyId,
        actorId: input.actorId,
        entityType: 'Reservation',
        entityId: input.reservation.id,
        action: input.action,
        previousState: input.previousState,
        nextState: input.nextState,
        metadata: { reservationCode: input.reservation.reservationCode },
      }),
      manager.getRepository(ActivityEventEntity).save({
        propertyId: input.propertyId,
        type: input.action,
        title: input.title,
        description: input.description,
        entityType: 'Reservation',
        entityId: input.reservation.id,
        metadata: { reservationCode: input.reservation.reservationCode },
      }),
    ]);
  }

  private messageForBlocker(code: string): string {
    const messages: Record<string, string> = {
      [ApiErrorCode.CHECKIN_GUEST_REGISTRATION_INCOMPLETE]: 'Guest registration is incomplete',
      [ApiErrorCode.CHECKIN_IDENTITY_NOT_VERIFIED]: 'Guest identity has not been verified',
      [ApiErrorCode.CHECKIN_PAYMENT_NOT_REVIEWED]: 'Payment has not been reviewed',
      [ApiErrorCode.CHECKIN_ROOM_NOT_READY]: 'Room is not ready for check-in',
      [ApiErrorCode.CHECKIN_ROOM_UNAVAILABLE]: 'Room is unavailable for check-in',
      [ApiErrorCode.CHECKIN_ALREADY_CHECKED_IN]: 'Reservation is already checked in',
    };
    return messages[code] ?? 'Check-in is blocked';
  }

  private badRequest(code: ApiErrorCode, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }
}
