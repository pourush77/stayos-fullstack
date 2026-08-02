import type { OperationsRoomBoardItemDto } from '../../../lib/operations-api';
import type { Room } from '../types';
import { formatArrivalLabel } from './room-formatters';
import { mapOperationsStatus, statusLabel } from './room-status';

function isPreCheckInReservation(status: string | undefined) {
  const normalized = (status ?? '').toUpperCase().replace(/[\s-]/g, '_');
  return normalized === 'CONFIRMED' || normalized === 'PENDING';
}

export function mapOperationsRoom(dto: OperationsRoomBoardItemDto): Room {
  const roomStatus = dto.uiStatus ?? dto.operationalStatus;
  const mappedStatus = mapOperationsStatus(roomStatus ?? dto.currentStay?.status);
  const canShowAssignedReservation = mappedStatus === 'ready' || mappedStatus === 'vacant';
  const floorLabel =
    dto.floor.name ??
    dto.floor.code ??
    (dto.floor.floorNumber ? `Floor ${dto.floor.floorNumber}` : 'Floor');
  const preCheckInAssignment = isPreCheckInReservation(dto.currentStay?.status);
  const displayAsReserved = preCheckInAssignment && canShowAssignedReservation;

  return {
    accessible: false,
    amenities: [],
    bedType: 'King',
    bookingId: dto.currentStay?.reservationCode,
    reservationId: dto.currentStay?.reservationId,
    capacity: '2 guests',
    checkInTime: dto.currentStay?.checkedInAt ?? dto.currentStay?.checkInTime,
    connecting: false,
    departureDate: dto.currentStay?.departureDate,
    floor: floorLabel,
    guest: dto.currentStay?.guestName,
    housekeeping: {
      assignedStaff: 'Unassigned',
      estimatedFinish: mappedStatus === 'ready' ? 'Complete' : 'Not set',
      inspection: mappedStatus === 'ready' ? 'Ready' : 'Pending',
      started: 'Not recorded',
      status: roomStatus ?? statusLabel(mappedStatus),
    },
    id: dto.roomId,
    maintenance: {
      engineer: 'Unassigned',
      issue: mappedStatus === 'maintenance' ? 'Maintenance active' : 'None',
      priority: dto.attentionLevel === 'CRITICAL' ? 'High' : 'None',
      status: mappedStatus === 'maintenance' ? 'Open' : 'Clear',
    },
    number: dto.roomNumber,
    paymentStatus: dto.currentStay?.paymentStatus,
    reservation: dto.currentStay?.reservationCode ?? 'Available',
    reservationArrivalDate: dto.currentStay?.arrivalDate,
    reservationDepartureDate: dto.currentStay?.departureDate,
    roomType: dto.roomType.name,
    roomTypeId: dto.roomType.id,
    stayDates: dto.currentStay
      ? displayAsReserved
        ? `Arrival ${formatArrivalLabel(dto.currentStay.arrivalDate)}`
        : formatArrivalLabel(dto.currentStay.arrivalDate)
      : (dto.checkoutLabel ?? 'Available today'),
    status: displayAsReserved ? 'reserved' : mappedStatus,
    stayHref:
      dto.currentStay?.reservationId && !displayAsReserved
        ? `/guest-stay/${dto.currentStay.reservationId}`
        : undefined,
    timeline: [],
    view: 'City',
    vip: false,
  };
}
