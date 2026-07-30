# Events Documentation

This folder captures event-driven architecture, domain events, and integration event patterns.

## Current State

The Property module does not publish domain or integration events yet.

## Future Candidates

- `PropertyCreated`
- `PropertyUpdated`
- `PropertyStatusChanged`
- `GuestCreated`
- `GuestUpdated`
- `GuestStatusChanged`
- `ReservationCreated`
- `ReservationUpdated`
- `ReservationStatusChanged`

Events should be introduced only when another module or integration needs asynchronous behavior.

## Hotel Inventory Events

These events define the domain event contract for Hotel Inventory. Event emission is not implemented yet; the modules currently expose REST persistence only.

### Property Events

- `PropertyCreated`
- `PropertyUpdated`
- `PropertyStatusChanged`

### Floor Events

- `FloorCreated`
- `FloorUpdated`
- `FloorStatusChanged`

Payload fields:

- `eventId`
- `eventType`
- `occurredAt`
- `propertyId`
- `floorId`
- changed fields when applicable

### Room Type Events

- `RoomTypeCreated`
- `RoomTypeUpdated`
- `RoomTypeStatusChanged`

Payload fields:

- `eventId`
- `eventType`
- `occurredAt`
- `propertyId`
- `roomTypeId`
- changed fields when applicable

### Room Events

- `RoomCreated`
- `RoomUpdated`
- `RoomStatusChanged`
- `RoomOperationalStatusChanged`
- `RoomMovedToFloor`
- `RoomTypeChanged`

Payload fields:

- `eventId`
- `eventType`
- `occurredAt`
- `propertyId`
- `roomId`
- `floorId`
- `roomTypeId`
- changed fields when applicable
- `operationalStatusReason` and `operationalStatusNote` when an operational hold reason is supplied

### Event Rules

- Events must not contain secrets.
- Events must include `propertyId` for tenant and operational scoping.
- Events should be emitted after successful transaction commit.
- Integration events can be introduced later through an outbox pattern if external systems need inventory changes.
- Room operational status mutation APIs do not emit events yet; this document defines the future event contract only.

## Guest Events

These events define the future domain event contract for Guests. Event emission is not implemented yet; the module currently exposes REST persistence only.

- `GuestCreated`
- `GuestUpdated`
- `GuestStatusChanged`
- `GuestVipStatusChanged`
- `GuestBlacklistStatusChanged`

Payload fields:

- `eventId`
- `eventType`
- `occurredAt`
- `propertyId`
- `guestId`
- changed fields when applicable

Event rules:

- Guest events must include `propertyId`.
- Guest events must not include secrets or raw internal metadata.
- Integration events for reservations, stays, billing, and guest history should be introduced only when those modules exist.

## Reservation Events

These events define the future domain event contract for Reservations. Event emission is not implemented yet; the module currently exposes REST persistence only.

- `ReservationCreated`
- `ReservationUpdated`
- `ReservationStatusChanged`
- `ReservationRoomAssigned`
- `ReservationPaymentStatusChanged`
- `ReservationCancelled`
- `ReservationNoShowMarked`

Payload fields:

- `eventId`
- `eventType`
- `occurredAt`
- `propertyId`
- `reservationId`
- `guestId`
- `roomTypeId`
- `roomId` when assigned
- arrival/departure dates when applicable
- changed fields when applicable

Event rules:

- Reservation events must include `propertyId`.
- Reservation events should be emitted only after successful transaction commit.
- Future check-in, stay, billing, payment, and inventory events should be introduced by their owning modules.
