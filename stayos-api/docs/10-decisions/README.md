# Decisions Documentation

This folder captures architectural decisions, tradeoffs, and implementation rationale.

## ADR-001: Property Is a Core Module

Status: Accepted

Decision: Property is implemented under `src/core/properties` and exported as a Core module.

Rationale: Property is the root entity for StayOS. Floors, Room Types, Rooms, Reservations, Guest Stays, Housekeeping Tasks, Billing Records, and Notifications will all depend on it.

## ADR-002: Explicit TypeORM Migrations

Status: Accepted

Decision: Runtime TypeORM synchronization remains disabled. Database changes are represented by migrations.

Rationale: Production systems need reviewed, repeatable schema changes. Automatic synchronization is too risky once real data exists.

## ADR-003: Hotel Inventory Bounded Context

Status: Accepted

Decision: Property, Floor, Room Type, and Room form the Hotel Inventory bounded context.

Rationale: These entities define the physical and sellable inventory needed before reservations, guest stays, housekeeping, billing, and notifications can operate.

## ADR-004: Room References Both Floor and Room Type

Status: Accepted

Decision: Room stores both `floorId` and `roomTypeId`.

Rationale: Floor models physical location, while Room Type models sellable category. Both dimensions are independently needed in hospitality operations.

## ADR-005: Property-Scoped Uniqueness

Status: Accepted

Decision: Floor codes, Room Type codes, and Room numbers are unique within a Property, not globally.

Rationale: Hotel operators commonly reuse room numbers and short codes across different properties. Property scope keeps constraints practical while preserving data integrity.

## ADR-006: Operations Module Provides Backend-Driven Read Models

Status: Accepted

Decision: StayOS exposes a dedicated Operations Module for Room Board, Room Drawer, Available Rooms, Activity Feed, and Needs Attention.

Rationale: PMS frontends should not reconstruct hotel operations by combining multiple CRUD endpoints. The backend owns operational interpretation, including current stays, attention levels, primary actions, availability exclusions, and recent activity.

Architecture:

```text
CRUD Modules
  |
  v
Workflow Layer
  |
  v
Operations Read Models
  |
  v
Frontend, AI Assistant, Dashboards
```

Consequences:

- CRUD APIs remain stable and entity-focused.
- Workflow APIs perform mutations and create audit/activity events.
- Operations APIs aggregate existing domain data and remain read-only.
- Future modules extend read models without forcing clients to learn new entity joins.
