# Domain Documentation

This folder captures domain models, bounded contexts, and business capabilities for StayOS.

## Core Context

### Property

Property is a Core module because it owns the root aggregate that all future business modules depend on.

#### Business Rules

- A Property has a globally unique `code`.
- A Property must have a legal identity, GST number, contact details, physical address, timezone, currency, check-in time, and check-out time.
- `gstNumber` is required for the initial India-focused market.
- `stateCode` is required and stores the two-digit Indian GST state code.
- `panNumber`, `cinNumber`, `logoUrl`, `website`, and `addressLine2` are optional.
- `status` can be `ACTIVE` or `INACTIVE`.
- `totalFloors` and `totalRooms` are non-negative statistics owned by the Property record for now.
- No authentication, RBAC, or cross-module business behavior is applied yet.

#### Fields

Identity: `id`, `code`, `name`, `legalName`, `gstNumber`, `panNumber`, `cinNumber`, `logoUrl`.

Contact: `email`, `phone`, `website`.

Address: `addressLine1`, `addressLine2`, `city`, `state`, `stateCode`, `country`, `postalCode`.

Business settings: `timezone`, `currency`, `checkInTime`, `checkOutTime`.

Statistics: `totalFloors`, `totalRooms`.

Status and audit: `status`, `createdAt`, `updatedAt`.

## Hotel Inventory Context

Hotel Inventory is the bounded context that models the physical and sellable inventory of a Property.

### Entity Diagram

```text
Property
  1 ─── * Floor
  1 ─── * RoomType
  1 ─── * Room

Floor
  1 ─── * Room

RoomType
  1 ─── * Room
```

### Aggregate Boundaries

Property remains the root entity for platform scoping.

Floor, Room Type, and Room are inventory entities scoped to a Property. They should not exist without a Property. Room additionally belongs to one Floor and one Room Type.

### Property Responsibilities

- Own hotel identity, legal details, contact details, address, operating settings, and lifecycle status.
- Provide the root scope for Floor, Room Type, Room, and future operational modules.
- Store high-level statistics such as total floors and total rooms until those values are derived from inventory records.

### Floor Responsibilities

- Represent a physical or operational level inside a Property.
- Group Rooms for operations, housekeeping, maintenance, and navigation.
- Support future extensions such as floor plans, wings, zones, and display ordering.

#### Floor Fields

- Identity: `id`, `propertyId`, `code`, `name`.
- Structure: `floorNumber`, `displayOrder`.
- Description: `description`.
- Status and audit: `status`, `createdAt`, `updatedAt`.

#### Floor Business Rules

- A Floor belongs to exactly one Property.
- Floor `code` must be unique within a Property.
- `floorNumber` should be unique within a Property unless future multi-building support introduces building scope.
- A Floor cannot be deleted while Rooms are assigned to it; it should be deactivated instead.
- A Floor can be `ACTIVE` or `INACTIVE`.
- Inactive Floors should not be available for new Room creation unless explicitly allowed by an admin workflow.

### Room Type Responsibilities

- Represent a sellable room category such as Deluxe, Suite, Dorm Bed, or Standard Twin.
- Provide booking-facing inventory classification for pricing, availability, and channel distribution.
- Define standard occupancy and descriptive attributes shared by Rooms of the type.

#### Room Type Fields

- Identity: `id`, `propertyId`, `code`, `name`.
- Description: `description`.
- Occupancy: `baseOccupancy`, `maxOccupancy`, `maxAdults`, `maxChildren`.
- Physical attributes: `bedType`, `sizeSqFt`.
- Status and audit: `status`, `createdAt`, `updatedAt`.

#### Room Type Business Rules

- A Room Type belongs to exactly one Property.
- Room Type `code` must be unique within a Property.
- `baseOccupancy` must be at least `1`.
- `maxOccupancy` must be greater than or equal to `baseOccupancy`.
- `maxAdults` must be at least `1`.
- `maxChildren` must be zero or greater.
- A Room Type cannot be deleted while Rooms reference it; it should be deactivated instead.
- Inactive Room Types should not be used for new Room creation or future sellable inventory.

### Room Responsibilities

- Represent a physical room inside a Property.
- Connect physical location through Floor and sellable category through Room Type.
- Provide the operational unit for future reservations, stays, housekeeping, maintenance, and billing.

#### Room Fields

- Identity: `id`, `propertyId`, `floorId`, `roomTypeId`, `roomNumber`, `displayName`.
- Operations: `status`, `operationalStatus`, `operationalStatusReason`, `operationalStatusNote`.
- Description: `description`.
- Audit: `createdAt`, `updatedAt`.

#### Room Business Rules

- A Room belongs to exactly one Property.
- A Room belongs to exactly one Floor in the same Property.
- A Room belongs to exactly one Room Type in the same Property.
- `roomNumber` must be unique within a Property.
- Room creation must fail if Floor or Room Type belongs to a different Property.
- `status` controls lifecycle: `ACTIVE` or `INACTIVE`.
- `operationalStatus` controls operational readiness: `READY`, `OCCUPIED`, `NEEDS_CLEANING`, `INSPECTION`, `OUT_OF_SERVICE`, `OUT_OF_ORDER`, `MAINTENANCE`.
- Operational status changes must be scoped by `propertyId`; a Room can only be mutated through the Property it belongs to.
- Operational status changes do not change lifecycle `status`.
- `block`, `out-of-service`, `out-of-order`, and `maintenance` mutations may capture `operationalStatusReason` and `operationalStatusNote`.
- `block` is a generic operational hold and maps to `OUT_OF_SERVICE` until a dedicated block model exists.
- Rooms are not physically deleted; lifecycle deactivation and operational status mutations are the supported controls.
- Reservations should eventually book Room Type inventory first and assign physical Room later, unless direct room assignment is required.

### Relationship Rules

- Property to Floor: one-to-many.
- Property to Room Type: one-to-many.
- Property to Room: one-to-many.
- Floor to Room: one-to-many.
- Room Type to Room: one-to-many.
- Floor and Room Type references on Room must be property-consistent.

### Validation Rules

- Codes should use uppercase letters, numbers, and hyphens.
- Names should be trimmed and non-empty.
- Numeric counts must be non-negative unless explicitly defined as minimum `1`.
- Status fields must use documented enums.
- Foreign keys must reference active parent records for creation workflows.

### Future Extensibility

- Introduce Building as an optional parent above Floor without changing Property ownership.
- Add Room Amenity and Room Type Amenity mappings.
- Add room media, virtual tours, and channel-facing descriptions.
- Add room connectivity for adjoining rooms.
- Add room blocks for renovation, maintenance, owner use, and long-term holds.
- Add derived inventory statistics instead of manually stored totals.

## Hillston Resort & Club Bootstrap

Hillston Resort & Club is the first real StayOS property bootstrap.

Property code: `HILLSTON_IND`.

Inventory:

- Guest Floors: `SECOND`, `THIRD`.
- Room Types: `DLX`, `STE`.
- Rooms: 24 total.
- Deluxe Rooms: 20.
- Suite Rooms: 4.

The bootstrap is idempotent and uses natural keys scoped to the property:

- Property: `code`.
- Floors: `propertyId + code`.
- Room Types: `propertyId + code`.
- Rooms: `propertyId + roomNumber`.

Amenities are intentionally skipped until Amenity and RoomTypeAmenity entities exist. See `docs/02-domain/hotel-inventory-amenities-todo.md`.

## Guest Context

Guests model people or companies that interact with a Property. The module is deliberately limited to profile data and property-scoped lookup; it does not implement reservations, check-in, guest stay, billing, or identity documents yet.

### Guest Responsibilities

- Store reusable guest profile details for a Property.
- Provide the future anchor for reservations, check-in, stay folios, billing, guest history, CRM, and AI search.
- Support property-scoped search across name, phone, email, and company fields.

### Guest Fields

- Identity: `id`, `propertyId`.
- Name: `firstName`, `lastName`, `displayName`.
- Contact: `phone`, `alternatePhone`, `email`.
- Personal profile: `gender`, `dateOfBirth`, `anniversaryDate`, `nationality`, `preferredLanguage`.
- Business profile: `companyName`, `gstNumber`.
- Operations: `vipStatus`, `blacklistStatus`, `notes`, `status`.
- Audit: `createdAt`, `updatedAt`.

### Guest Business Rules

- A Guest belongs to exactly one Property.
- `firstName` and `phone` are required.
- `displayName` is stored for fast display and search; it defaults to first name plus last name when not provided.
- `phone` must be unique within a Property.
- The same phone can exist in different Properties.
- Guest reads and mutations must include `propertyId`; a Guest from another Property is treated as not found.
- `email` must be valid when provided.
- `gstNumber` must match the Indian GST format when provided.
- `status` can be `ACTIVE` or `INACTIVE`.
- Guests are not physically deleted in the current API.

## Hillston Guest Bootstrap

Hillston guest seed data exists for frontend Guest Profile testing.

Command:

```bash
npm run bootstrap:guests
```

Seeded guests:

- Ananya Rao, VIP.
- Rhea Malhotra.
- Dev Sharma.
- Mr Kapoor, VIP.
- Jaipur Textiles Group, corporate/group contact.

Rules:

- Uses Property code `HILLSTON_IND`.
- Upserts by `propertyId + phone`.
- Creates missing guests and updates existing guests.
- Never creates duplicate seeded guests when rerun.
- Verifies total Hillston guests is `5`.
- Verifies VIP Hillston guests is `2`.

## Reservation Context

Reservations model a booking intent for a Property. The module supports booking creation, arrival planning, check-in readiness, optional room assignment, and future billing integration. It does not implement check-in side effects, stay folios, invoices, payments, rates, inventory availability, or channel management yet.

### Reservation Responsibilities

- Connect a Property, primary Guest, Room Type, and optional physical Room.
- Store arrival and departure dates for PMS arrival/departure views.
- Track lifecycle state from pending/confirmed through checked-in, checked-out, cancelled, or no-show.
- Track high-level payment state for future billing.
- Support property-scoped search by reservation code, guest name, and guest phone.

### Reservation Fields

- Identity: `id`, `propertyId`, `reservationCode`.
- Guest: `guestId`.
- Stay dates: `arrivalDate`, `departureDate`.
- Occupancy: `adults`, `children`.
- Inventory: `roomTypeId`, optional `roomId`.
- Classification: `source`.
- Status: `status`, `paymentStatus`.
- Operator context: `notes`, `specialRequests`.
- Audit: `createdAt`, `updatedAt`.

### Reservation Business Rules

- A Reservation belongs to exactly one Property.
- The primary Guest must belong to the same Property.
- The Room Type must belong to the same Property.
- The assigned Room, when present, must belong to the same Property.
- `departureDate` must be after `arrivalDate`.
- `adults` must be at least `1`; `children` must be zero or greater.
- `reservationCode` must be unique within a Property.
- Reservation reads and mutations must include `propertyId`; a Reservation from another Property is treated as not found.
- Room assignment is optional to support room-type booking first and physical room assignment later.
- Availability checks, rate pricing, check-in side effects, billing, and payments are future modules.

## Hillston Reservation Bootstrap

Hillston reservation seed data exists for frontend Reservations, Check-in, and Guest Stay testing.

Command:

```bash
npm run bootstrap:reservations
```

Seeded reservations:

- `ST1842`: Ananya Rao, Suite 212, confirmed, partially paid.
- `ST1849`: Jaipur Textiles Group, Deluxe room type, pending, payment due, unassigned.
- `ST1851`: Mr Kapoor, Suite 303, confirmed, paid.
- `ST1856`: Rhea Malhotra, Deluxe room type, confirmed, payment due, unassigned.
- `ST1838`: Dev Sharma, Deluxe 201, checked in, paid.

Rules:

- Uses Property code `HILLSTON_IND`.
- Requires Hillston guests, rooms, and room types to exist first.
- Upserts by `reservationCode`.
- Creates missing reservations and updates existing reservations.
- Never creates duplicate seeded reservations when rerun.
- Verifies total reservations is `5`.
- Verifies status counts: confirmed `3`, pending `1`, checked-in `1`.
- Verifies payment due count is `2`.
- Verifies assigned rooms is `3` and unassigned rooms is `2`.

## Operational Domain Philosophy

StayOS separates entity storage, workflow commands, and operations read models.

Entity APIs manage individual records such as Rooms, Guests, and Reservations. They are useful for administration and direct resource management, but they are not sufficient for PMS operations.

Workflow commands perform business state transitions. Reservation workflows now model:

```text
Assign Room
  -> Check In
  -> Check Out
  -> Room NEEDS_CLEANING
```

Each workflow writes Audit Events and Activity Events transactionally with the state change.

Operations APIs are UI-ready read models. They aggregate the data needed by Room Board, Room Drawer, Front Desk, and future dashboards without requiring frontend clients to call multiple CRUD endpoints and reimplement PMS logic.

This separation is a core backend principle:

```text
CRUD Modules
  -> Workflow Layer
  -> Operations Read Models
  -> Frontend / AI Assistant
```

Responsibilities:

- CRUD modules own entity validation, persistence, and basic resource APIs.
- Workflow services own state transitions and side effects.
- Operations services own backend-driven read models and should not mutate state.
- Future AI features should consume Operations APIs when they need hotel state, because these responses already encode operational context.

Future modules should integrate through these boundaries:

- Housekeeping can create cleaning tasks and extend Room Board/Needs Attention.
- Billing can add folio/payment rules and extend Needs Attention.
- AI Assistant can summarize Room Board, Activity Feed, and Needs Attention without querying raw entities.
- Marketplace and Channel Manager can consume availability read models rather than Room CRUD.
- Notifications and Reports can subscribe to activity/audit foundations as they mature.
