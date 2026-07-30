import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { GuestStatus } from '../../guests/domain/guest-status.enum';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { CFormStatus } from '../domain/c-form-status.enum';
import { IdentityDocumentType } from '../domain/identity-document-type.enum';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';
import { GuestIdentityDocumentEntity } from '../infrastructure/guest-identity-document.entity';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { GuestDocumentEntity } from '../check-in-capture/guest-document.entity';
import { CheckInService } from './check-in.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';

const guest = (overrides: Partial<GuestEntity> = {}): GuestEntity => ({
  id: guestId,
  propertyId,
  property: undefined as never,
  firstName: 'Rahul',
  lastName: 'Sharma',
  displayName: 'Rahul Sharma',
  phone: '9876500001',
  alternatePhone: null,
  email: 'rahul@example.com',
  gender: null,
  dateOfBirth: null,
  anniversaryDate: null,
  nationality: 'Indian',
  addressLine1: '12 MG Road',
  addressLine2: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  country: 'India',
  postalCode: '560001',
  purposeOfVisit: 'Business',
  arrivalFrom: null,
  nextDestination: null,
  preferredLanguage: null,
  companyName: null,
  gstNumber: null,
  vipStatus: false,
  blacklistStatus: false,
  notes: null,
  status: GuestStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const reservation = (overrides: Partial<ReservationEntity> = {}): ReservationEntity => ({
  id: reservationId,
  propertyId,
  property: undefined as never,
  guestId,
  guest: undefined as never,
  reservationCode: 'RSV-001',
  arrivalDate: '2026-07-15',
  departureDate: '2026-07-17',
  adults: 2,
  children: 0,
  roomTypeId: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673',
  roomType: undefined as never,
  roomId,
  room: null,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  notes: null,
  specialRequests: null,
  paymentReviewed: true,
  paymentMethod: 'UPI',
  paymentReviewNotes: null,
  isForeignNational: false,
  passportNumberMasked: null,
  passportIssuePlace: null,
  passportIssueDate: null,
  passportExpiryDate: null,
  visaNumberMasked: null,
  visaType: null,
  visaIssueDate: null,
  visaExpiryDate: null,
  cFormRequired: false,
  cFormStatus: CFormStatus.NOT_REQUIRED,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const room = (overrides: Partial<RoomEntity> = {}): RoomEntity => ({
  id: roomId,
  propertyId,
  property: undefined as never,
  floorId: 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676',
  floor: { name: '2' } as never,
  roomTypeId: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673',
  roomType: { name: 'Deluxe' } as never,
  roomNumber: '204',
  displayName: '204',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: RoomOperationalStatus.READY,
  operationalStatusReason: null,
  operationalStatusNote: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const identity = (overrides: Partial<GuestIdentityDocumentEntity> = {}): GuestIdentityDocumentEntity => ({
  id: '1075c8fa-f36e-4f40-a3ef-2e9dbb1f0679',
  propertyId,
  property: undefined as never,
  guestId,
  guest: undefined as never,
  reservationId,
  reservation: undefined as never,
  idType: IdentityDocumentType.AADHAAR,
  idNumberMasked: '********9012',
  documentFrontUrl: 'https://example.test/front.jpg',
  documentBackUrl: null,
  verified: true,
  verifiedByUserId: '2075c8fa-f36e-4f40-a3ef-2e9dbb1f0679',
  verifiedAt: new Date('2026-07-09T00:00:00.000Z'),
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('CheckInService', () => {
  let service: CheckInService;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let guestsRepository: MockRepository<GuestEntity>;
  let identityRepository: MockRepository<GuestIdentityDocumentEntity>;
  let documentsRepository: MockRepository<GuestDocumentEntity>;
  let auditRepository: MockRepository<AuditEventEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;

  beforeEach(() => {
    reservationsRepository = { findOne: jest.fn(), save: jest.fn(async (entity) => entity) };
    guestsRepository = { findOne: jest.fn(), save: jest.fn(async (entity) => entity) };
    identityRepository = {
      findOne: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
    };
    documentsRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    auditRepository = { save: jest.fn(async (entity) => entity) };
    activityRepository = { save: jest.fn(async (entity) => entity) };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ReservationEntity) return reservationsRepository;
        if (entity === GuestEntity) return guestsRepository;
        if (entity === GuestIdentityDocumentEntity) return identityRepository;
        if (entity === GuestDocumentEntity) return documentsRepository;
        if (entity === AuditEventEntity) return auditRepository;
        if (entity === ActivityEventEntity) return activityRepository;
        return { findOne: jest.fn() };
      }),
    } as unknown as EntityManager;
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource;

    service = new CheckInService(dataSource);
  });

  it('maps workspace DTO with masked identity only', () => {
    const workspace = service.toWorkspace({
      reservation: reservation(),
      guest: guest(),
      room: room(),
      identity: identity(),
    });

    expect(workspace.identity.idNumberMasked).toBe('********9012');
    expect(workspace.finalChecklist.canCheckIn).toBe(true);
    expect(workspace.room.readyForCheckIn).toBe(true);
  });

  it('requires mobile for domestic guest registration completion', () => {
    const workspace = service.toWorkspace({
      reservation: reservation(),
      guest: guest({ phone: '' }),
      room: room(),
      identity: identity(),
    });

    expect(workspace.finalChecklist.guestRegistrationComplete).toBe(false);
    expect(workspace.finalChecklist.blockers).toContain('CHECKIN_GUEST_REGISTRATION_INCOMPLETE');
  });

  it('requires passport and visa fields for foreign guest registration completion', () => {
    const workspace = service.toWorkspace({
      reservation: reservation({ isForeignNational: true, cFormRequired: true, cFormStatus: CFormStatus.PENDING }),
      guest: guest({ nationality: 'French', country: 'France' }),
      room: room(),
      identity: identity({ idType: IdentityDocumentType.PASSPORT }),
    });

    expect(workspace.finalChecklist.guestRegistrationComplete).toBe(false);
  });

  it('stores masked identity verification', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservation());
    guestsRepository.findOne?.mockResolvedValue(guest());
    identityRepository.findOne?.mockResolvedValue(null);

    const workspace = await service.updateIdentity(
      propertyId,
      reservationId,
      {
        idType: IdentityDocumentType.AADHAAR,
        idNumber: '1234 5678 9012',
        verified: true,
      },
      { actorId: '2075c8fa-f36e-4f40-a3ef-2e9dbb1f0679' },
    );

    expect(identityRepository.save).toHaveBeenCalledWith(expect.objectContaining({ idNumberMasked: '********9012' }));
    expect(workspace.identity.verified).toBe(true);
  });

  it('updates payment review state', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservation({ paymentReviewed: false }));
    guestsRepository.findOne?.mockResolvedValue(guest());
    identityRepository.findOne?.mockResolvedValue(identity());

    const workspace = await service.reviewPayment(propertyId, reservationId, {
      paymentReviewed: true,
      paymentMethod: 'CARD',
    });

    expect(reservationsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ paymentReviewed: true }));
    expect(workspace.finalChecklist.paymentReviewed).toBe(true);
  });

  it('blocks final check-in when identity is not verified', () => {
    expect(() =>
      service.validateFinalChecklist({
        reservation: reservation(),
        guest: guest(),
        room: room(),
        identity: identity({ verified: false }),
      }),
    ).toThrow(BadRequestException);
  });

  it('blocks final check-in when room is dirty or maintenance', () => {
    expect(() =>
      service.validateFinalChecklist({
        reservation: reservation(),
        guest: guest(),
        room: room({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
        identity: identity(),
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.validateFinalChecklist({
        reservation: reservation(),
        guest: guest(),
        room: room({ operationalStatus: RoomOperationalStatus.MAINTENANCE }),
        identity: identity(),
      }),
    ).toThrow(BadRequestException);
  });
});
