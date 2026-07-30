# Workflows Documentation

This folder describes workflows, process orchestration, and operational patterns for the StayOS platform.

## Hotel Inventory Workflows

These workflows describe the implemented inventory structure and the operational rules future modules must respect.

### Property Inventory Setup

1. Create or activate Property.
2. Create Floors for the Property.
3. Create Room Types for the Property.
4. Create Rooms and assign each Room to a Floor and Room Type.
5. Verify inventory counts and statuses.

### Floor Lifecycle

1. Create Floor with unique code and floor number within a Property.
2. Assign Rooms to the Floor.
3. Deactivate Floor only when it should no longer be used for new Rooms.
4. Prevent destructive deletion while Rooms exist.

### Room Type Lifecycle

1. Create Room Type with occupancy rules.
2. Assign Rooms to the Room Type.
3. Use Room Type for future rate plans and reservations.
4. Deactivate Room Type when no longer sellable.
5. Prevent destructive deletion while Rooms exist.

### Room Lifecycle

1. Create Room under a Property.
2. Validate Floor and Room Type belong to the same Property.
3. Set lifecycle `status` to `ACTIVE`.
4. Set operational `operationalStatus` to `READY`.
5. Future modules update `operationalStatus` through reservations, stays, housekeeping, and maintenance.

### Operational Status Changes

- `ACTIVE` and `INACTIVE` control whether inventory is part of normal operations.
- `READY`, `OCCUPIED`, `NEEDS_CLEANING`, `INSPECTION`, `OUT_OF_SERVICE`, `OUT_OF_ORDER`, and `MAINTENANCE` describe Room operational state.
- Current Room mutation APIs support marking a Room ready, needing cleaning, pending inspection, blocked, out of service, out of order, or under maintenance.
- `block` is a generic operational hold and currently maps to `OUT_OF_SERVICE`.
- `block`, `out-of-service`, `out-of-order`, and `maintenance` can store a reason and note for operator context.
- Operational status changes validate that the Room belongs to the requested Property.
- Operational status changes do not change lifecycle `status`.
- Future Reservation and Housekeeping modules must coordinate status transitions.

Room readiness workflow:

1. Mark a departed or dirty Room as `NEEDS_CLEANING`.
2. Mark cleaned Room as `INSPECTION` when supervisor review is required.
3. Mark inspected Room as `READY` when it can be assigned again.

Room hold workflow:

1. Mark Room as blocked, out of service, out of order, or maintenance with an optional reason and note.
2. Keep lifecycle `status` unchanged unless the Room should be removed from normal inventory administration.
3. Mark Room as `READY` after operations clears the hold.
4. Do not create reservations, check-ins, guests, or housekeeping tasks from these mutations.

## Hillston Bootstrap Workflow

Command:

```bash
npm run bootstrap:hillston
```

Workflow:

1. Run database migrations.
2. Start a transaction.
3. Create or update Property `HILLSTON_IND`.
4. Create or update guest Floors.
5. Create or update Room Types.
6. Skip Amenities with a documented TODO until amenity entities exist.
7. Create or update Rooms using `floor_id` and `room_type_id`.
8. Verify inventory counts.
9. Commit transaction.

The bootstrap can be rerun safely. Existing records are updated through natural keys and duplicate records are not created.

## Hillston Guest Bootstrap Workflow

Command:

```bash
npm run bootstrap:guests
```

Workflow:

1. Run database migrations.
2. Run `npm run bootstrap:hillston` first if Property `HILLSTON_IND` does not exist.
3. Start a transaction.
4. Find Hillston by Property code `HILLSTON_IND`.
5. Upsert five guest profile records using `property_id` and `phone` as the natural key.
6. Verify total Hillston guests is `5`.
7. Verify VIP Hillston guests is `2`.
8. Commit transaction.

The guest bootstrap can be rerun safely. Existing Guest records are updated and duplicate seeded Guests are not created.

## Hillston Reservation Bootstrap Workflow

Command:

```bash
npm run bootstrap:reservations
```

Workflow:

1. Run database migrations.
2. Run `npm run bootstrap:hillston` first if Property `HILLSTON_IND`, Rooms, or Room Types do not exist.
3. Run `npm run bootstrap:guests` first if the seeded Guests do not exist.
4. Start a transaction.
5. Find Hillston by Property code `HILLSTON_IND`.
6. Resolve Guests by phone, Room Types by code, and Rooms by room number.
7. Upsert five Reservation records by `reservationCode`.
8. Verify total reservations is `5`.
9. Verify confirmed `3`, pending `1`, checked-in `1`.
10. Verify payment due `2`.
11. Verify assigned rooms `3` and unassigned rooms `2`.
12. Commit transaction.

The reservation bootstrap can be rerun safely. Existing Reservation records are updated and duplicate seeded Reservations are not created.

## Reservation Workflows

Reservation has two API layers:

- CRUD endpoints manage reservation profile data.
- Workflow endpoints perform operational state transitions with audit and activity side effects.

The Reservation module still does not perform rate pricing, folio creation, payment capture, or billing. Payment checks are limited to existing `paymentStatus` fields.

### Reservation Creation

1. Validate `propertyId`.
2. Validate required fields: `guestId`, `reservationCode`, `arrivalDate`, `departureDate`, `adults`, and `roomTypeId`.
3. Validate `departureDate` is after `arrivalDate`.
4. Validate the Guest belongs to the Property.
5. Validate the Room Type belongs to the Property.
6. Validate the optional Room belongs to the Property.
7. Store Reservation with lifecycle `status` and `paymentStatus`.
8. Return the Reservation through the standard success envelope.

### Reservation Lookup

1. List Reservations under a Property with optional search, sorting, and pagination.
2. Search by reservation code, guest name, and guest phone.
3. Get one Reservation by `propertyId` and Reservation `id`.
4. Treat Reservations from another Property as not found.

### Reservation Update

1. Validate `propertyId` and Reservation `id`.
2. Apply partial changes to stay dates, occupancy, room type, room assignment, source, status, payment status, notes, or special requests.
3. Revalidate date range when either date changes.
4. Revalidate Guest, Room Type, and optional Room property ownership when references change.
5. Do not create check-in records, stays, bills, payments, or housekeeping tasks from this CRUD workflow.

### Assign Room Workflow

Endpoint:

```http
PATCH /api/v1/properties/:propertyId/reservations/:reservationId/assign-room
```

Flow:

1. Validate Reservation exists under the Property.
2. Require Reservation status `PENDING` or `CONFIRMED`.
3. Validate Room exists under the same Property.
4. Require Room operational status `READY`.
5. Reject occupied, out-of-service, out-of-order, maintenance, cleaning, or inspection rooms.
6. Validate Room Type matches Reservation Room Type.
7. Validate Room Type capacity supports adults plus children.
8. Reject overlapping active assignments for the same Room.
9. Set `reservation.roomId`.
10. Write Audit Event `RESERVATION_ROOM_ASSIGNED`.
11. Write Activity Event `ROOM_ASSIGNED`.
12. Commit transaction and return Reservation plus Room summary.

### Check In Workflow

Endpoint:

```http
PATCH /api/v1/properties/:propertyId/reservations/:reservationId/check-in
```

Flow:

1. Validate Reservation exists under the Property.
2. Require Reservation status `CONFIRMED`.
3. Require assigned Room.
4. Validate Room exists under the same Property.
5. Require Room operational status `READY`.
6. Validate Guest exists.
7. Set Reservation status `CHECKED_IN`.
8. Set Room operational status `OCCUPIED`.
9. Write Audit Event `RESERVATION_CHECKED_IN`.
10. Write Activity Event `GUEST_CHECKED_IN`.
11. Commit transaction and return Reservation plus Room summary.

### Check Out Workflow

Endpoint:

```http
PATCH /api/v1/properties/:propertyId/reservations/:reservationId/check-out
```

Flow:

1. Validate Reservation exists under the Property.
2. Require Reservation status `CHECKED_IN`.
3. Require assigned Room.
4. Validate Room exists under the same Property.
5. Set Reservation status `CHECKED_OUT`.
6. Set Room operational status `NEEDS_CLEANING`.
7. Write Audit Event `RESERVATION_CHECKED_OUT`.
8. Write Activity Event `GUEST_CHECKED_OUT`.
9. Commit transaction and return Reservation plus Room summary.

Workflow lifecycle:

```text
Assign Room
  -> Check In
  -> Check Out
  -> Room NEEDS_CLEANING

Every transition
  -> Audit Event
  -> Activity Event
```

## Operations Read Model Workflows

Operations endpoints are read-only orchestration workflows. They aggregate existing domain data for frontend and future AI use.

### Room Board

1. Validate Property.
2. Load Rooms with Floor and Room Type.
3. Load current checked-in stays with Guests.
4. Map operational status to UI status.
5. Return current stay, checkout label, primary action, and attention level per Room.

### Room Drawer

1. Validate Property and Room.
2. Load current Reservation, Guest summary, upcoming Reservation, recent Activity, and Audit timeline.
3. Return a dedicated DTO; do not expose entities directly.

### Available Rooms

1. Validate Property and date range.
2. Load Rooms with inventory data.
3. Exclude non-ready Rooms.
4. Exclude overlapping active Reservation assignments.
5. Apply Room Type and capacity filters.
6. Return assignable Rooms only.

### Activity Feed

1. Validate Property.
2. Apply optional `entityType`, `entityId`, `type`, and `limit` filters.
3. Return backend-generated Activity Events ordered newest first.

### Needs Attention

1. Validate Property.
2. Evaluate operational rules for unassigned arrivals, VIP arrivals, room issues, departures, and pending payments.
3. Return action-oriented items with priority and related entity metadata.

## Hillston Verification Workflow

Command:

```bash
npm run verify:hillston
```

The verifier checks:

1. Required tables exist: `properties`, `floors`, `room_types`, `rooms`, `migrations`.
2. Property name is `Hillston Resort & Club`.
3. Floors count is `2`.
4. Room Types count is `2`.
5. Rooms count is `24`.
6. Deluxe count is `20`.
7. Suite count is `4`.
8. Swagger contains Hotel Inventory GET endpoints.

## Guest Workflows

The Guest module currently supports profile management only.

### Guest Creation

1. Validate `propertyId`.
2. Validate required fields: `firstName` and `phone`.
3. Validate optional `email` and `gstNumber` formats.
4. Reject duplicate `phone` within the same Property.
5. Store `displayName`; when omitted, derive it from first name and last name.
6. Return the Guest through the standard success envelope.

### Guest Lookup

1. List Guests under a Property with optional search, sorting, and pagination.
2. Search by first name, last name, display name, phone, email, and company name.
3. Get one Guest by `propertyId` and Guest `id`.
4. Treat Guests from another Property as not found.

### Guest Update

1. Validate `propertyId` and Guest `id`.
2. Apply partial profile changes.
3. Recalculate `displayName` when first or last name changes and `displayName` is not explicitly supplied.
4. Reject duplicate `phone` within the same Property.
5. Do not create reservations, check-ins, stay records, or billing records from this workflow.
