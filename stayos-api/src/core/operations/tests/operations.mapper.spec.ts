import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationSource } from '../../reservations/domain/reservation-source.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { OperationsAttentionLevel, OperationsRoomUiStatus } from '../dto/operations.dto';
import { OperationsMapper } from '../mappers/operations.mapper';

const room = (operationalStatus = RoomOperationalStatus.READY): RoomEntity => ({
  id: '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674',
  propertyId: '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  property: undefined as never,
  floorId: '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671',
  floor: { id: '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671', name: 'Second', floorNumber: 2 } as never,
  roomTypeId: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
  roomType: {
    id: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
    code: 'DLX',
    name: 'Deluxe',
    maxOccupancy: 3,
  } as never,
  roomNumber: '204',
  displayName: '204',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus,
  operationalStatusReason: null,
  operationalStatusNote: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
});

const reservation = (departureDate = '2026-07-03'): ReservationEntity => ({
  id: '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675',
  propertyId: '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  property: undefined as never,
  guestId: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
  guest: { displayName: 'Rahul Sharma' } as never,
  reservationCode: 'RSV-001',
  arrivalDate: '2026-07-01',
  departureDate,
  adults: 2,
  children: 0,
  roomTypeId: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
  roomType: undefined as never,
  roomId: '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674',
  room: undefined as never,
  inventoryReserved: true,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CHECKED_IN,
  paymentStatus: ReservationPaymentStatus.PAID,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
});

describe('OperationsMapper', () => {
  it('maps occupied rooms with current stay into room board items', () => {
    expect(
      OperationsMapper.toRoomBoardItem(
        room(RoomOperationalStatus.OCCUPIED),
        reservation(),
        '2026-07-03',
      ),
    ).toMatchObject({
      uiStatus: OperationsRoomUiStatus.OCCUPIED,
      currentStay: { guestName: 'Rahul Sharma' },
      checkoutLabel: 'Checkout Today',
      primaryAction: 'Open Stay',
      attentionLevel: OperationsAttentionLevel.WARNING,
    });
  });

  it('shows a checked-in stay as occupied even when the stored room status is accidentally ready', () => {
    expect(
      OperationsMapper.toRoomBoardItem(
        room(RoomOperationalStatus.READY),
        reservation('2026-07-03'),
        '2026-07-03',
      ),
    ).toMatchObject({
      uiStatus: OperationsRoomUiStatus.OCCUPIED,
      operationalStatus: RoomOperationalStatus.OCCUPIED,
      currentStay: {
        status: ReservationStatus.CHECKED_IN,
      },
      checkoutLabel: 'Checkout Today',
      primaryAction: 'Open Stay',
      attentionLevel: OperationsAttentionLevel.WARNING,
    });
  });

  it('keeps checked-in stays authoritative even when the room is marked maintenance', () => {
    expect(
      OperationsMapper.toRoomBoardItem(
        room(RoomOperationalStatus.MAINTENANCE),
        reservation(),
        '2026-07-03',
      ),
    ).toMatchObject({
      uiStatus: OperationsRoomUiStatus.MAINTENANCE,
      currentStay: {
        guestName: 'Rahul Sharma',
        status: ReservationStatus.CHECKED_IN,
      },
      primaryAction: 'Open Stay',
      attentionLevel: OperationsAttentionLevel.WARNING,
    });
  });

  it('maps group context into room board items when a room is occupied by a checked-in group', () => {
    expect(
      OperationsMapper.toRoomBoardItem(
        room(RoomOperationalStatus.OCCUPIED),
        reservation(),
        '2026-07-03',
        {
          groupBookingId: 'group-booking-id',
          groupCode: 'GRP-00007',
          groupName: 'Hillston Visit',
          masterFolioId: 'folio-id',
          masterFolioNumber: 'GFO-00001',
          status: 'OPEN',
        },
      ),
    ).toMatchObject({
      groupContext: {
        groupCode: 'GRP-00007',
        masterFolioNumber: 'GFO-00001',
      },
    });
  });

  it('surfaces group and individual reservation conflicts without exposing check-in', () => {
    expect(
      OperationsMapper.toRoomBoardItem(
        room(RoomOperationalStatus.READY),
        { ...reservation('2026-07-04'), status: ReservationStatus.CONFIRMED },
        '2026-07-03',
        {
          groupBookingId: 'group-booking-id',
          groupCode: 'GRP-00007',
          groupName: 'Hillston Visit',
          masterFolioId: 'folio-id',
          masterFolioNumber: 'GFO-00001',
          status: 'OPEN',
        },
      ),
    ).toMatchObject({
      uiStatus: OperationsRoomUiStatus.UNAVAILABLE,
      groupContext: {
        groupCode: 'GRP-00007',
      },
      primaryAction: 'View Details',
      attentionLevel: OperationsAttentionLevel.CRITICAL,
    });
  });

  it('keeps a pre-check-in group allocation on a ready room out of occupied state', () => {
    expect(
      OperationsMapper.toRoomBoardItem(room(RoomOperationalStatus.READY), null, '2026-07-03', {
        groupBookingId: 'group-booking-id',
        groupCode: 'GRP-00007',
        groupName: 'Hillston Visit',
        masterFolioId: 'folio-id',
        masterFolioNumber: 'Master folio pending',
        status: 'CONFIRMED',
      }),
    ).toMatchObject({
      uiStatus: OperationsRoomUiStatus.READY,
      operationalStatus: RoomOperationalStatus.READY,
      groupContext: {
        groupCode: 'GRP-00007',
        status: 'CONFIRMED',
      },
      primaryAction: 'View Details',
      attentionLevel: OperationsAttentionLevel.NORMAL,
    });
  });

  it('keeps checked-in group rooms occupied when the room lifecycle is occupied', () => {
    expect(
      OperationsMapper.toRoomBoardItem(room(RoomOperationalStatus.OCCUPIED), null, '2026-07-03', {
        groupBookingId: 'group-booking-id',
        groupCode: 'GRP-00007',
        groupName: 'Hillston Visit',
        masterFolioId: 'folio-id',
        masterFolioNumber: 'GFO-00001',
        status: 'CHECKED_IN',
      }),
    ).toMatchObject({
      uiStatus: OperationsRoomUiStatus.OCCUPIED,
      operationalStatus: RoomOperationalStatus.OCCUPIED,
      groupContext: {
        groupCode: 'GRP-00007',
        status: 'CHECKED_IN',
      },
      primaryAction: 'View Details',
    });
  });
});
