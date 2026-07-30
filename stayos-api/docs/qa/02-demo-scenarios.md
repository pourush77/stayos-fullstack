# StayOS Demo Scenarios

## Rooms

- Ready: 201, 202, 205, 210, 211, 212, 301, 302, 304, 305, 307, 308, 309, 310.
- Needs cleaning: 203, 204, 207, 208, 209.
- Inspection: 206.
- Occupied: 303, 306.
- Maintenance: 311.
- Out of service: 312.

The backend does not currently define a `CLEANING` room operational status. Room 208 represents cleaning in progress with `NEEDS_CLEANING`, an assigned employee, and `started_at` set.

## Booking Matrix

- Today arrivals: paid unassigned Deluxe, assigned room 201 paid, assigned room 202 payment due, family Suite, VIP Suite room 212.
- Pre-arrivals: tomorrow arrival, next week booking, OTA, direct, corporate, walk-in, pending, cancelled.
- Requests: accessibility, early check-in, late checkout, extra bed, airport pickup, high floor, quiet room.
- Active stays: rooms 303 and 306, VIP stay, payment due stay, checkout today, checkout tomorrow.
- Departure and housekeeping: checked-out rooms 203, 204, 206, Kaju assigned, Deepak started, inspection completed, rework.
- Edge cases: same-day arrival/departure skipped because the reservation table requires departure after arrival, long stay, child occupancy, Suite capacity, Deluxe capacity, payment due, paid, cancelled paid, no-show, past completed stay, future OTA family, returning guest second booking.

## Housekeeping

- Room 203: needs cleaning, unassigned.
- Room 204: needs cleaning, assigned to Kaju Devi, not started.
- Room 207: needs cleaning, assigned to Deepak Sharma, not started.
- Room 208: cleaning in progress, assigned to Ram Kumar, `started_at` present.
- Room 206: inspection, completed by Shyam Yadav, checklist complete.
- Room 209: needs cleaning with Bathroom rework reason.
- Room 311: maintenance.
- Room 312: out of service.

Completed checklist keys are BED, BATHROOM, TOWELS, TOILETRIES, MIRROR, FLOOR, and DUSTBIN.

## Role-Based Login

- Manager testing: `manager@stayos.local` or `gaurav.gaur@stayos.local`.
- Front desk testing: `frontdesk@stayos.local`.
- Housekeeping testing: `housekeeping@stayos.local`.
- Maintenance testing: `maintenance@stayos.local`.
- Accounts testing: `accounts@stayos.local`.
- Read-only testing: `readonly@stayos.local`.

Password for all listed users is `Password123!`.
