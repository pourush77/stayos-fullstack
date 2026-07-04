export function friendlyAssignmentError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const normalized = raw.toUpperCase();

  if (normalized.includes('ROOM_CAPACITY_EXCEEDED') || normalized.includes('CAPACITY')) {
    return 'This room cannot accommodate everyone in the booking. Please choose a larger room.';
  }
  if (normalized.includes('ROOM_TYPE_MISMATCH') || normalized.includes('ROOM TYPE')) {
    return 'This booking requires a different room type.';
  }
  if (normalized.includes('ROOM_NOT_READY') || normalized.includes('NOT_READY')) {
    return 'This room is not ready for guest assignment yet.';
  }
  if (normalized.includes('BOOKING_ALREADY_ASSIGNED') || normalized.includes('ALREADY_ASSIGNED')) {
    return 'This booking already has a room assigned.';
  }

  return 'Unable to assign this room. Please try again.';
}

export function friendlyRoomChangeError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const normalized = raw.toUpperCase();

  if (normalized.includes('ROOM_CAPACITY_EXCEEDED') || normalized.includes('CAPACITY')) {
    return 'This room cannot fit all guests in this booking. Please choose a larger room.';
  }
  if (normalized.includes('ROOM_TYPE_MISMATCH') || normalized.includes('ROOM TYPE')) {
    return 'This booking needs a different room type.';
  }
  if (normalized.includes('ROOM_ALREADY_ASSIGNED') || normalized.includes('ALREADY_ASSIGNED')) {
    return 'This room is already assigned to another booking.';
  }
  if (normalized.includes('ROOM_NOT_READY') || normalized.includes('NOT_READY')) {
    return 'This room is not ready right now.';
  }

  return 'Unable to change the room. Please try again.';
}

export function friendlyRemoveAssignmentError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const normalized = raw.toUpperCase();

  if (normalized.includes('NOT_FOUND')) {
    return 'This room assignment could not be found. Please refresh and try again.';
  }

  return 'Unable to remove this room assignment. Please try again.';
}

export function friendlyCheckInError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const normalized = raw.toUpperCase();

  if (normalized.includes('ALREADY') || normalized.includes('CHECKED_IN')) {
    return 'This guest is already checked in.';
  }
  if (normalized.includes('NOT_ASSIGNED') || normalized.includes('ROOM')) {
    return 'Assign a room before checking in this guest.';
  }
  if (normalized.includes('CANCEL')) {
    return 'This booking cannot be checked in.';
  }

  return 'Unable to check in this guest. Please try again.';
}

export function friendlyCheckOutError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const normalized = raw.toUpperCase();

  if (normalized.includes('NOT_CHECKED_IN') || normalized.includes('NOT CHECKED')) {
    return 'Guest has not checked in yet.';
  }
  if (normalized.includes('ALREADY') || normalized.includes('CHECKED_OUT')) {
    return 'This guest is already checked out.';
  }

  return 'Unable to check out this guest. Please try again.';
}
