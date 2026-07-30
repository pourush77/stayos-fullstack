# Database Documentation

This folder documents PostgreSQL architecture, migration strategy, and data modeling guidance.

## Strategy

- PostgreSQL is the system of record.
- TypeORM is used for entity mapping and migrations.
- Runtime schema synchronization is disabled.
- Schema changes must be represented by explicit migrations.
- The NestJS runtime and TypeORM CLI share the same environment-driven database configuration.
- Pending migrations are not run automatically on application startup.

## Environment Variables

The database connection is configured from:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_HOST` | Yes | PostgreSQL host |
| `DATABASE_PORT` | Yes | PostgreSQL port |
| `DATABASE_NAME` | Yes | Database name |
| `DATABASE_USERNAME` | Yes | Database user |
| `DATABASE_PASSWORD` | Yes | Database password |
| `TYPEORM_LOGGING` | No | Set to `true` to enable TypeORM SQL logging |

## TypeORM Runtime

Runtime configuration lives in `src/database/database.config.ts`.

The NestJS database module uses `TypeOrmModule.forRootAsync` and logs a clear startup message when PostgreSQL connects successfully.

Database connection failures are logged with host, port, and database name only. Credentials and secrets are not logged.

Important production settings:

- `synchronize: false`
- `migrationsRun: false`
- explicit migration execution through package scripts
- credentials are never written to startup logs

## Health Checks

The readiness endpoint performs a lightweight PostgreSQL check with `SELECT 1`.

Endpoint:

```bash
GET /api/v1/health/ready
```

Database diagnostic values:

- `up` when PostgreSQL responds successfully.
- `down` when the check fails.

Raw database errors are not returned to API clients.

## TypeORM CLI

The CLI data source is `src/database/data-source.ts`.

Migration commands:

```bash
npm run migration:create -- src/database/migrations/MigrationName
npm run migration:generate -- src/database/migrations/MigrationName
npm run migration:run
npm run migration:revert
```

## Folders

- `src/database/migrations` stores TypeORM migration files.
- `src/database/seeds` is reserved for future seed scripts.

## Tables

### `properties`

The `properties` table stores the StayOS root entity.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `uuid_generate_v4()` |
| `code` | `varchar(32)` | Required, unique |
| `name` | `varchar(160)` | Required |
| `legal_name` | `varchar(200)` | Required |
| `gst_number` | `varchar(15)` | Required |
| `pan_number` | `varchar(10)` | Optional |
| `cin_number` | `varchar(32)` | Optional |
| `logo_url` | `varchar(512)` | Optional |
| `email` | `varchar(254)` | Required |
| `phone` | `varchar(32)` | Required |
| `website` | `varchar(255)` | Optional |
| `address_line_1` | `varchar(255)` | Required |
| `address_line_2` | `varchar(255)` | Optional |
| `city` | `varchar(120)` | Required |
| `state` | `varchar(120)` | Required |
| `state_code` | `varchar(2)` | Required |
| `country` | `varchar(120)` | Required |
| `postal_code` | `varchar(16)` | Required |
| `timezone` | `varchar(64)` | Required |
| `currency` | `char(3)` | Required |
| `check_in_time` | `time without time zone` | Required |
| `check_out_time` | `time without time zone` | Required |
| `total_floors` | `integer` | Required, default `0` |
| `total_rooms` | `integer` | Required, default `0` |
| `status` | `properties_status_enum` | Required, default `ACTIVE` |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Migration: `src/database/migrations/1782790200000-CreatePropertiesTable.ts`.

## Hotel Inventory Schema

Implemented by migration: `src/database/migrations/1782795600000-CreateHotelInventoryTables.ts`.

### `floors`

Stores physical or operational floors for a Property.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `property_id` | `uuid` | Required, foreign key to `properties.id` |
| `code` | `varchar(32)` | Required |
| `name` | `varchar(120)` | Required |
| `floor_number` | `integer` | Required |
| `display_order` | `integer` | Required, default `0` |
| `description` | `text` | Optional |
| `status` | `floor_status_enum` | Required, default `ACTIVE` |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Indexes and constraints:

- Unique `property_id, code`.
- Unique `property_id, floor_number`.
- Index `property_id`.
- Foreign key `property_id` references `properties.id`.

### `room_types`

Stores sellable room categories for a Property.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `property_id` | `uuid` | Required, foreign key to `properties.id` |
| `code` | `varchar(32)` | Required |
| `name` | `varchar(120)` | Required |
| `description` | `text` | Optional |
| `base_occupancy` | `integer` | Required, minimum `1` |
| `max_occupancy` | `integer` | Required, minimum `1` |
| `max_adults` | `integer` | Required, minimum `1` |
| `max_children` | `integer` | Required, default `0` |
| `bed_type` | `varchar(80)` | Optional |
| `size_sq_ft` | `integer` | Optional |
| `status` | `room_type_status_enum` | Required, default `ACTIVE` |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Indexes and constraints:

- Unique `property_id, code`.
- Index `property_id`.
- Check `base_occupancy >= 1`.
- Check `max_occupancy >= base_occupancy`.
- Check `max_adults >= 1`.
- Check `max_children >= 0`.
- Check `size_sq_ft IS NULL OR size_sq_ft > 0`.
- Foreign key `property_id` references `properties.id`.

### `rooms`

Stores physical rooms for a Property.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `property_id` | `uuid` | Required, foreign key to `properties.id` |
| `floor_id` | `uuid` | Required, foreign key to `floors.id` |
| `room_type_id` | `uuid` | Required, foreign key to `room_types.id` |
| `room_number` | `varchar(32)` | Required |
| `display_name` | `varchar(120)` | Optional |
| `description` | `text` | Optional |
| `status` | `room_status_enum` | Required, default `ACTIVE` |
| `operational_status` | `rooms_operational_status_enum` | Required, default `READY` |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Indexes and constraints:

- Unique `property_id, room_number`.
- Index `property_id`.
- Index `floor_id`.
- Index `room_type_id`.
- Foreign key `property_id` references `properties.id`.
- Foreign key `floor_id` references `floors.id`.
- Foreign key `room_type_id` references `room_types.id`.

Application-level consistency rule:

- `rooms.property_id`, `floors.property_id`, and `room_types.property_id` must match.

### Planned Enums

- `floors_status_enum`: `ACTIVE`, `INACTIVE`.
- `room_types_status_enum`: `ACTIVE`, `INACTIVE`.
- `rooms_status_enum`: `ACTIVE`, `INACTIVE`.
- `rooms_operational_status_enum`: `READY`, `OCCUPIED`, `NEEDS_CLEANING`, `INSPECTION`, `OUT_OF_SERVICE`, `OUT_OF_ORDER`, `MAINTENANCE`.

## Hillston Bootstrap Data

Script: `scripts/bootstrap-hillston.ts`.

Command:

```bash
npm run bootstrap:hillston
```

The script runs inside a database transaction and creates or updates:

- Property `HILLSTON_IND`.
- Guest Floors `SECOND` and `THIRD`.
- Room Types `DLX` and `STE`.
- 24 Rooms.

Expected scoped inventory counts after bootstrap:

| Record | Count |
| --- | --- |
| Property `HILLSTON_IND` | 1 |
| Guest Floors | 2 |
| Room Types | 2 |
| Rooms | 24 |
| Deluxe Rooms | 20 |
| Suite Rooms | 4 |

Amenity data is not inserted yet because Amenity and RoomTypeAmenity tables do not exist.

## Guest Schema

Implemented by migration: `src/database/migrations/1782973800000-CreateGuestsTable.ts`.

### `guests`

Stores property-scoped guest profile records.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `property_id` | `uuid` | Required, foreign key to `properties.id` |
| `first_name` | `varchar(120)` | Required |
| `last_name` | `varchar(120)` | Optional |
| `display_name` | `varchar(240)` | Required |
| `phone` | `varchar(32)` | Required |
| `alternate_phone` | `varchar(32)` | Optional |
| `email` | `varchar(254)` | Optional |
| `gender` | `varchar(32)` | Optional |
| `date_of_birth` | `date` | Optional |
| `anniversary_date` | `date` | Optional |
| `nationality` | `varchar(120)` | Optional |
| `preferred_language` | `varchar(64)` | Optional |
| `company_name` | `varchar(160)` | Optional |
| `gst_number` | `varchar(15)` | Optional |
| `vip_status` | `boolean` | Required, default `false` |
| `blacklist_status` | `boolean` | Required, default `false` |
| `notes` | `text` | Optional |
| `status` | `guests_status_enum` | Required, default `ACTIVE` |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Indexes and constraints:

- Unique `property_id, phone`.
- Index `property_id`.
- Index `display_name`.
- Index `phone`.
- Index `email`.
- Foreign key `property_id` references `properties.id`.

Application-level consistency rule:

- Guest operations must always be scoped by `property_id`.

## Reservation Schema

Implemented by migration: `src/database/migrations/1783060200000-CreateReservationsTable.ts`.

### `reservations`

Stores property-scoped booking records.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `property_id` | `uuid` | Required, foreign key to `properties.id` |
| `guest_id` | `uuid` | Required, foreign key to `guests.id` |
| `reservation_code` | `varchar(32)` | Required |
| `arrival_date` | `date` | Required |
| `departure_date` | `date` | Required |
| `adults` | `integer` | Required, minimum `1` |
| `children` | `integer` | Required, default `0` |
| `room_type_id` | `uuid` | Required, foreign key to `room_types.id` |
| `room_id` | `uuid` | Optional, foreign key to `rooms.id` |
| `source` | `reservations_source_enum` | Required, default `DIRECT` |
| `status` | `reservations_status_enum` | Required, default `CONFIRMED` |
| `payment_status` | `reservations_payment_status_enum` | Required, default `PAYMENT_DUE` |
| `notes` | `text` | Optional |
| `special_requests` | `text` | Optional |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Indexes and constraints:

- Unique `property_id, reservation_code`.
- Index `property_id`.
- Index `guest_id`.
- Index `room_type_id`.
- Index `room_id`.
- Index `arrival_date`.
- Check `adults >= 1 AND children >= 0`.
- Check `departure_date > arrival_date`.
- Foreign key `property_id` references `properties.id`.
- Foreign key `guest_id` references `guests.id`.
- Foreign key `room_type_id` references `room_types.id`.
- Foreign key `room_id` references `rooms.id`.

Application-level consistency rules:

- `guest_id`, `room_type_id`, and optional `room_id` must belong to the Reservation `property_id`.
- The current schema stores one primary Guest; multi-guest sharing can be introduced later with a ReservationGuest relation.
