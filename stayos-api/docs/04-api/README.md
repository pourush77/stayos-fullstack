# API Documentation

This folder documents public API contracts, endpoints, versioning, and Swagger design.

## Versioning

All current REST endpoints are served under `/api/v1`.

Swagger UI is available at `/docs`.

## Request Tracing

All API responses include an `x-request-id` header.

- If the request includes `x-request-id`, the same value is returned.
- If the request does not include `x-request-id`, the API generates a UUID.
- Error logs include the request ID.

## Error Response Standard

All unhandled API errors use this response shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [],
    "path": "/api/v1/properties",
    "method": "POST",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "requestId": "request-id"
  }
}
```

Supported error codes:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `INTERNAL_SERVER_ERROR`
- `DATABASE_ERROR`
- `INVALID_CREDENTIALS`
- `USER_INACTIVE`
- `SESSION_LOCKED`
- `SESSION_REVOKED`
- `SESSION_EXPIRED`
- `TOKEN_EXPIRED`
- `INVALID_REFRESH_TOKEN`
- `RESERVATION_NOT_FOUND`
- `ROOM_NOT_FOUND`
- `GUEST_NOT_FOUND`
- `ROOM_NOT_READY`
- `ROOM_ALREADY_OCCUPIED`
- `ROOM_OUT_OF_SERVICE`
- `ROOM_OUT_OF_ORDER`
- `ROOM_TYPE_MISMATCH`
- `ROOM_CAPACITY_EXCEEDED`
- `RESERVATION_NOT_CONFIRMED`
- `RESERVATION_NOT_CHECKED_IN`
- `ROOM_ALREADY_ASSIGNED`
- `INVALID_RESERVATION_STATE_TRANSITION`

Validation error details include the field name, constraint message, and safe rejected primitive values. Sensitive fields such as passwords, secrets, tokens, and keys do not include rejected values.

## Success Response Standard

Single-record and command responses use this shape:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {},
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "version": "v1"
  }
}
```

List responses use this shape when pagination is requested:

```json
{
  "success": true,
  "message": "Records fetched successfully.",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "version": "v1"
  }
}
```

When clients omit `page` and `limit`, list endpoints return the full result set without a `pagination` object:

```json
{
  "success": true,
  "message": "Records fetched successfully.",
  "data": [],
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "version": "v1"
  }
}
```

Controllers should return domain DTOs or already wrapped responses. The global response interceptor applies the envelope and preserves responses that are already wrapped.

## Pagination, Sorting, and Search

Future list endpoints should use these query parameters:

| Parameter   | Default          | Rule                                             |
| ----------- | ---------------- | ------------------------------------------------ |
| `page`      | `1`              | Positive integer                                 |
| `limit`     | `20`             | Positive integer, maximum `100`                  |
| `sortBy`    | endpoint-defined | Must map to an allowed sortable field            |
| `sortOrder` | `ASC`            | `ASC` or `DESC`                                  |
| `search`    | none             | Free-text search term, endpoint-defined behavior |

Sorting must be allowlisted per endpoint before it is applied to database queries.

## Swagger Response Patterns

Reusable Swagger decorators live in `src/common/decorators/api-standard-response.decorator.ts`:

- `ApiStandardOkResponse`
- `ApiStandardCreatedResponse`
- `ApiStandardListResponse`

## Health API

### `GET /api/v1/health`

Returns the raw backend health contract. This endpoint is intentionally not wrapped in the standard success envelope.

Response:

```json
{
  "status": "ok",
  "service": "StayOS Platform API",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "uptime": 1234
}
```

### `GET /api/v1/health/live`

Confirms the application process is running.

Use this endpoint for container liveness probes. It does not check downstream dependencies and returns the same raw shape as `/health` with `status: "ok"`.

### `GET /api/v1/health/ready`

Confirms the application is ready to receive traffic.

Checks:

- PostgreSQL query execution only.

Responses:

`200` application is ready:

```json
{
  "status": "ready",
  "database": {
    "status": "connected"
  },
  "environment": "development",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "uptime": 1234
}
```

`503` application is not ready:

```json
{
  "status": "not_ready",
  "database": {
    "status": "disconnected"
  }
}
```

Health responses must not expose secrets, passwords, connection strings, stack traces, or raw internal errors.

Browser clients from `http://localhost:3000` are allowed to call the health endpoints via CORS.

## Properties API

### `GET /api/v1/properties`

Returns all properties ordered by name.

### `GET /api/v1/properties/:id`

Returns one property by UUID.

Responses:

- `200` property found.
- `400` invalid UUID.
- `404` property not found.

### `POST /api/v1/properties`

Creates a property.

Required fields: `code`, `name`, `legalName`, `gstNumber`, `email`, `phone`, `addressLine1`, `city`, `state`, `stateCode`, `country`, `postalCode`, `timezone`, `currency`, `checkInTime`, `checkOutTime`, `totalFloors`, `totalRooms`.

Optional fields: `panNumber`, `cinNumber`, `logoUrl`, `website`, `addressLine2`, `status`.

Responses:

- `201` property created.
- `400` invalid payload.
- `409` property code already exists.

### `PATCH /api/v1/properties/:id`

Partially updates a property.

Responses:

- `200` property updated.
- `400` invalid UUID or payload.
- `404` property not found.
- `409` property code already exists.

## Hotel Inventory API

Hotel Inventory endpoints are implemented under the Property scope. List endpoints support `page`, `limit`, `sortBy`, `sortOrder`, and `search` query parameters.

### Floors

| Method  | Path                                        | Purpose                    |
| ------- | ------------------------------------------- | -------------------------- |
| `GET`   | `/api/v1/properties/:propertyId/floors`     | List Floors for a Property |
| `GET`   | `/api/v1/properties/:propertyId/floors/:id` | Get one Floor              |
| `POST`  | `/api/v1/properties/:propertyId/floors`     | Create a Floor             |
| `PATCH` | `/api/v1/properties/:propertyId/floors/:id` | Update a Floor             |

Create Floor request:

```json
{
  "code": "FLOOR-01",
  "name": "First Floor",
  "floorNumber": 1,
  "displayOrder": 1,
  "description": "Guest rooms near elevator",
  "status": "ACTIVE"
}
```

### Room Types

| Method  | Path                                            | Purpose                        |
| ------- | ----------------------------------------------- | ------------------------------ |
| `GET`   | `/api/v1/properties/:propertyId/room-types`     | List Room Types for a Property |
| `GET`   | `/api/v1/properties/:propertyId/room-types/:id` | Get one Room Type              |
| `POST`  | `/api/v1/properties/:propertyId/room-types`     | Create a Room Type             |
| `PATCH` | `/api/v1/properties/:propertyId/room-types/:id` | Update a Room Type             |

Create Room Type request:

```json
{
  "code": "DLX",
  "name": "Deluxe Room",
  "description": "Deluxe king room",
  "baseOccupancy": 2,
  "maxOccupancy": 3,
  "maxAdults": 2,
  "maxChildren": 1,
  "bedType": "King",
  "sizeSqFt": 320,
  "status": "ACTIVE"
}
```

### Rooms

| Method  | Path                                       | Purpose                   |
| ------- | ------------------------------------------ | ------------------------- |
| `GET`   | `/api/v1/properties/:propertyId/rooms`     | List Rooms for a Property |
| `GET`   | `/api/v1/properties/:propertyId/rooms/:id` | Get one Room              |
| `POST`  | `/api/v1/properties/:propertyId/rooms`     | Create a Room             |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id` | Update a Room             |

Room operational status mutations:

| Method  | Path                                                       | Resulting `operationalStatus` |
| ------- | ---------------------------------------------------------- | ----------------------------- |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/mark-ready`      | `READY`                       |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/mark-cleaning`   | `NEEDS_CLEANING`              |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/mark-inspection` | `INSPECTION`                  |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/block`           | `OUT_OF_SERVICE`              |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/out-of-service`  | `OUT_OF_SERVICE`              |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/out-of-order`    | `OUT_OF_ORDER`                |
| `PATCH` | `/api/v1/properties/:propertyId/rooms/:id/maintenance`     | `MAINTENANCE`                 |

Create Room request:

```json
{
  "floorId": "uuid",
  "roomTypeId": "uuid",
  "roomNumber": "101",
  "displayName": "Room 101",
  "description": "Near elevator",
  "status": "ACTIVE",
  "operationalStatus": "READY"
}
```

Optional status note request for `block`, `out-of-service`, `out-of-order`, and `maintenance`:

```json
{
  "reason": "Plumbing",
  "note": "Bathroom leak reported by front desk"
}
```

Operational status mutation rules:

- `propertyId` and `id` must identify the same Room.
- Lifecycle `status` remains separate from `operationalStatus`.
- These endpoints do not create reservations, check-ins, guests, or housekeeping tasks.
- Responses return the updated Room through the standard success envelope.

### Swagger Models

- `FloorResponseDto`
- `CreateFloorDto`
- `UpdateFloorDto`
- `RoomTypeResponseDto`
- `CreateRoomTypeDto`
- `UpdateRoomTypeDto`
- `RoomResponseDto`
- `CreateRoomDto`
- `UpdateRoomDto`
- `RoomOperationalStatusNoteDto`

All responses should use the standard success envelope and reusable Swagger decorators.

### Hillston API Smoke Coverage

API smoke tests cover:

- `GET /api/v1/properties`
- `GET /api/v1/properties/:propertyId/floors`
- `GET /api/v1/properties/:propertyId/room-types`
- `GET /api/v1/properties/:propertyId/rooms`

The tests verify routing, standard success envelopes, pagination metadata, and request ID behavior.

### Swagger Verification

`npm run verify:hillston` checks the generated Swagger document contains:

- `/api/v1/properties`
- `/api/v1/properties/{propertyId}/floors`
- `/api/v1/properties/{propertyId}/room-types`
- `/api/v1/properties/{propertyId}/rooms`

## Guests API

Guest endpoints are implemented under the Property scope. List endpoints support `page`, `limit`, `sortBy`, `sortOrder`, and `search` query parameters.

| Method  | Path                                        | Purpose                    |
| ------- | ------------------------------------------- | -------------------------- |
| `GET`   | `/api/v1/properties/:propertyId/guests`     | List Guests for a Property |
| `GET`   | `/api/v1/properties/:propertyId/guests/:id` | Get one Guest              |
| `POST`  | `/api/v1/properties/:propertyId/guests`     | Create a Guest             |
| `PATCH` | `/api/v1/properties/:propertyId/guests/:id` | Update a Guest             |

Search fields:

- `firstName`
- `lastName`
- `displayName`
- `phone`
- `email`
- `companyName`

Allowed sort fields:

- `firstName`
- `lastName`
- `displayName`
- `phone`
- `email`
- `companyName`
- `status`
- `createdAt`
- `updatedAt`

Default sort: `displayName ASC`.

Create Guest request:

```json
{
  "firstName": "Aarav",
  "lastName": "Mehta",
  "phone": "+919876543210",
  "email": "aarav.mehta@example.com",
  "nationality": "Indian",
  "preferredLanguage": "English",
  "vipStatus": false,
  "blacklistStatus": false,
  "status": "ACTIVE"
}
```

Rules:

- `firstName` and `phone` are required.
- `phone` must be unique within the Property.
- `email` and `gstNumber` are validated when provided.
- `propertyId` and `id` must identify the same Guest.
- These endpoints do not create reservations, check-ins, stays, or billing records.

Swagger models:

- `GuestResponseDto`
- `CreateGuestDto`
- `UpdateGuestDto`

## Reservations API

Reservation endpoints are implemented under the Property scope. List endpoints support `page`, `limit`, `sortBy`, `sortOrder`, and `search` query parameters.

| Method  | Path                                              | Purpose                         |
| ------- | ------------------------------------------------- | ------------------------------- |
| `GET`   | `/api/v1/properties/:propertyId/reservations`     | List Reservations for a Property |
| `GET`   | `/api/v1/properties/:propertyId/reservations/:id` | Get one Reservation              |
| `POST`  | `/api/v1/properties/:propertyId/reservations`     | Create a Reservation             |
| `PATCH` | `/api/v1/properties/:propertyId/reservations/:id` | Update a Reservation             |

Search fields:

- `reservationCode`
- Guest `firstName`
- Guest `lastName`
- Guest `displayName`
- Guest `phone`

Allowed sort fields:

- `reservationCode`
- `arrivalDate`
- `departureDate`
- `status`
- `paymentStatus`
- `source`
- `createdAt`
- `updatedAt`

Default sort: `arrivalDate ASC`.

Create Reservation request:

```json
{
  "guestId": "uuid",
  "reservationCode": "RSV-HILL-0001",
  "arrivalDate": "2026-07-15",
  "departureDate": "2026-07-17",
  "adults": 2,
  "children": 0,
  "roomTypeId": "uuid",
  "roomId": "uuid",
  "source": "DIRECT",
  "status": "CONFIRMED",
  "paymentStatus": "PAYMENT_DUE",
  "notes": "Guest requested airport transfer",
  "specialRequests": "Twin bed setup and late arrival"
}
```

Rules:

- `guestId`, `reservationCode`, `arrivalDate`, `departureDate`, `adults`, and `roomTypeId` are required.
- `departureDate` must be after `arrivalDate`.
- The Guest must belong to the Property.
- The Room Type must belong to the Property.
- The Room, when assigned, must belong to the Property.
- These endpoints do not perform availability checks, check-in, check-out, billing, payment capture, or housekeeping changes yet.

Swagger models:

- `ReservationResponseDto`
- `CreateReservationDto`
- `UpdateReservationDto`

## Hillston Reservation Seed API Scenarios

`npm run bootstrap:reservations` creates five property-scoped Reservation records for API and frontend testing.

Seeded API states:

- Confirmed arrivals: `ST1842`, `ST1851`, `ST1856`.
- Pending corporate booking: `ST1849`.
- Checked-in walk-in stay: `ST1838`.
- Assigned room bookings: `ST1842`, `ST1851`, `ST1838`.
- Unassigned room-type bookings: `ST1849`, `ST1856`.

Expected list/search behavior after seeding:

- Search `ST1842` returns Ananya Rao's reservation.
- Search `Kapoor` or `9000088221` returns `ST1851`.
- Search `Jaipur` or `9988743000` returns `ST1849`.

## Authentication API

Swagger supports bearer authentication. Protected endpoints include `@ApiBearerAuth`.

### `POST /api/v1/auth/login`

Public endpoint. Creates a session and returns access/refresh tokens.

Request:

```json
{
  "email": "frontdesk@stayos.local",
  "password": "Password123!",
  "terminalName": "Front Desk Terminal 1"
}
```

Response data:

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-token",
  "expiresIn": 1800,
  "user": {
    "id": "uuid",
    "propertyId": "uuid",
    "name": "Front Desk",
    "email": "frontdesk@stayos.local",
    "role": "FRONT_DESK",
    "permissions": ["rooms.view", "checkin.manage"]
  }
}
```

Possible errors: `INVALID_CREDENTIALS`, `USER_INACTIVE`.

### `POST /api/v1/auth/refresh`

Public endpoint. Rotates refresh token and returns new tokens.

Possible errors: `INVALID_REFRESH_TOKEN`, `SESSION_LOCKED`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `USER_INACTIVE`.

### `POST /api/v1/auth/unlock`

Public endpoint. Unlocks an idle-locked session with password and rotates refresh token.

Possible errors: `INVALID_REFRESH_TOKEN`, `INVALID_CREDENTIALS`, `USER_INACTIVE`.

### `POST /api/v1/auth/logout`

Requires bearer auth. Revokes the current session.

### `GET /api/v1/auth/me`

Requires bearer auth. Returns the current user and permissions.

### User and Session Management

| Method  | Path                                                        | Permission        |
| ------- | ----------------------------------------------------------- | ----------------- |
| `GET`   | `/api/v1/properties/:propertyId/users`                      | `users.view`      |
| `GET`   | `/api/v1/properties/:propertyId/users/:userId`              | `users.view`      |
| `POST`  | `/api/v1/properties/:propertyId/users`                      | `users.manage`    |
| `PATCH` | `/api/v1/properties/:propertyId/users/:userId`              | `users.manage`    |
| `GET`   | `/api/v1/properties/:propertyId/sessions`                   | `sessions.view`   |
| `PATCH` | `/api/v1/properties/:propertyId/sessions/:sessionId/revoke` | `sessions.manage` |

## Reservation Workflow API

Reservation workflow endpoints are command APIs. They perform explicit PMS state transitions and create audit/activity events inside the same transaction.

| Method  | Path                                                                        | Purpose              |
| ------- | --------------------------------------------------------------------------- | -------------------- |
| `PATCH` | `/api/v1/properties/:propertyId/reservations/:reservationId/assign-room`    | Assign a ready Room  |
| `PATCH` | `/api/v1/properties/:propertyId/reservations/:reservationId/check-in`       | Check in a Guest     |
| `PATCH` | `/api/v1/properties/:propertyId/reservations/:reservationId/check-out`      | Check out a Guest    |

Assign Room request:

```json
{
  "roomId": "uuid"
}
```

Workflow response data:

```json
{
  "reservation": {
    "id": "uuid",
    "reservationCode": "RSV-001",
    "status": "CHECKED_IN",
    "roomId": "uuid"
  },
  "room": {
    "id": "uuid",
    "roomNumber": "204",
    "operationalStatus": "OCCUPIED"
  }
}
```

Rules:

- Assign Room accepts only `PENDING` or `CONFIRMED` reservations.
- Assigned rooms must be `READY`, same Property, same Room Type, sufficiently large, and free of overlapping active reservations.
- Check In accepts only `CONFIRMED` reservations with an assigned `READY` room.
- Check Out accepts only `CHECKED_IN` reservations and marks the room `NEEDS_CLEANING`.
- Workflow errors use stable codes such as `ROOM_NOT_READY`, `ROOM_ALREADY_ASSIGNED`, `RESERVATION_NOT_CONFIRMED`, and `RESERVATION_NOT_CHECKED_IN`.

## Operations API

Operations endpoints are backend-driven read models for frontend surfaces. They aggregate Rooms, Room Types, Floors, Guests, Reservations, Audit Events, and Activity Events so clients do not stitch together multiple CRUD responses.

Authentication: no auth layer is implemented yet. Future auth will protect these endpoints with property-scoped access.

### `GET /api/v1/properties/:propertyId/operations/room-board`

Purpose: returns the complete Room Board.

Business rules:

- Includes every room in the Property.
- Includes current checked-in stay data when present.
- Maps backend room status to UI status: `READY`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`, or `UNAVAILABLE`.
- Provides `checkoutLabel`, `primaryAction`, and `attentionLevel`.

Example request:

```http
GET /api/v1/properties/{propertyId}/operations/room-board
```

Example data item:

```json
{
  "roomId": "uuid",
  "roomNumber": "204",
  "floor": { "id": "uuid", "name": "Second", "floorNumber": 2 },
  "roomType": { "id": "uuid", "code": "DLX", "name": "Deluxe" },
  "uiStatus": "OCCUPIED",
  "operationalStatus": "OCCUPIED",
  "currentStay": {
    "reservationId": "uuid",
    "reservationCode": "RSV-001",
    "guestId": "uuid",
    "guestName": "Rahul Sharma",
    "arrivalDate": "2026-07-01",
    "departureDate": "2026-07-03",
    "status": "CHECKED_IN",
    "paymentStatus": "PAID"
  },
  "checkoutLabel": "Checkout Today",
  "primaryAction": "Open Stay",
  "attentionLevel": "WARNING"
}
```

Possible errors: `NOT_FOUND`, `VALIDATION_ERROR`.

### `GET /api/v1/properties/:propertyId/operations/rooms/:roomId`

Purpose: returns all data needed for the Room Drawer.

Includes Room Summary, Current Reservation, Guest Summary, Upcoming Reservation, Operational Status, Available Actions, Recent Activity, and Audit Timeline.

Example request:

```http
GET /api/v1/properties/{propertyId}/operations/rooms/{roomId}
```

Possible errors: `ROOM_NOT_FOUND`, `NOT_FOUND`, `VALIDATION_ERROR`.

### `GET /api/v1/properties/:propertyId/operations/available-rooms`

Purpose: returns only rooms eligible for assignment.

Query parameters:

| Parameter       | Rule                          |
| --------------- | ----------------------------- |
| `arrivalDate`   | Optional ISO date             |
| `departureDate` | Optional ISO date, after arrival |
| `roomTypeId`    | Optional UUID                 |
| `guestCount`    | Optional positive integer     |
| `accessible`    | Reserved boolean filter       |
| `connecting`    | Reserved boolean filter       |
| `vipPreferred`  | Reserved boolean filter       |

Business rules:

- Excludes occupied, maintenance, out-of-order, out-of-service, cleaning, and inspection rooms.
- Excludes date conflicts when arrival/departure are provided.
- Applies Room Type and capacity filters when provided.

Example request:

```http
GET /api/v1/properties/{propertyId}/operations/available-rooms?arrivalDate=2026-07-15&departureDate=2026-07-17&guestCount=2
```

Possible errors: `VALIDATION_ERROR`, `NOT_FOUND`.

### `GET /api/v1/properties/:propertyId/activity`

Purpose: returns Recent Activity for rooms, room drawers, front desk, dashboards, and future assistant surfaces.

Query parameters: `entityType`, `entityId`, `type`, `limit`.

Example data item:

```json
{
  "title": "Guest checked in",
  "description": "Rahul Sharma checked into Room 204.",
  "timestamp": "2026-07-03T10:00:00.000Z",
  "entity": { "type": "Reservation", "id": "uuid" },
  "metadata": { "roomNumber": "204", "reservationCode": "RSV-001" }
}
```

Possible errors: `VALIDATION_ERROR`, `NOT_FOUND`.

### `GET /api/v1/properties/:propertyId/operations/needs-attention`

Purpose: returns receptionist-facing operational issues, not informational activity.

Initial rules:

- Unassigned arrivals today.
- VIP arrivals today without assigned room.
- Rooms in maintenance.
- Rooms out of order.
- Rooms cleaning longer than the threshold.
- Checked-in departures today.
- Pending payments when `paymentStatus` exists.

Example data item:

```json
{
  "type": "UNASSIGNED_ARRIVAL",
  "title": "Assign Room",
  "description": "Rahul Sharma arrives today without an assigned room.",
  "priority": "HIGH",
  "relatedEntity": { "type": "Reservation", "id": "uuid" },
  "primaryAction": "Assign Room"
}
```

Possible errors: `NOT_FOUND`, `VALIDATION_ERROR`.
