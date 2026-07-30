# Product Requirements Document

## Overview

StayOS is a web-first PMS and operations platform for independent Indian hotels. The current product focuses on the full guest lifecycle: booking, arrival, check-in, document capture, in-stay operations, billing, checkout, reporting, and support workflows.

## Personas

- Owner: Reviews performance, revenue, occupancy, and operational bottlenecks.
- Admin: Manages users, employees, property setup, inventory, and permissions.
- Manager: Runs the daily operation and monitors rooms, requests, reports, housekeeping, and maintenance.
- Front Desk: Creates reservations, checks guests in, handles mobile capture, moves rooms, extends stays, creates guest requests, and assists checkout.
- Housekeeping: Works room cleaning/inspection state and requests routed to housekeeping.
- Maintenance: Works maintenance tickets and maintenance-related guest requests.
- Accounts: Manages folios, charges, payments, revenue reporting, and billing corrections.

## Shipped Functional Scope

- Authentication: login, refresh, logout, lock/unlock, sessions.
- Users: property-scoped user administration.
- Employees: operational staff records and staff access.
- Inventory: properties, floors, rooms, room types, operational status, and amenities.
- Reservations: create, view, update, cancel, assign room, check in, checkout, extend stay, move room.
- Guests: profile data and identity document list/upload.
- Check-in: front-desk flow and guest mobile document capture token flow.
- Stay Workspace: reservation, guest, room, activity, extend, and move-room controls.
- Housekeeping: room readiness, cleaning states, staff workflow.
- Billing/Folios: folio creation, charges, payments, settlement, summaries.
- Guest Requests: create, list, summary, suggestions, accept, start, complete, cancel, notes.
- Maintenance: tickets, summary, assign, resolve, cancel.
- Reports: overview, occupancy, revenue, operations, top guests, CSV export.

## API Base Paths

All API paths are under `/api/v1` in local development.

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/health`
- `GET /api/v1/properties`
- `GET /api/v1/properties/:propertyId/floors`
- `GET /api/v1/properties/:propertyId/rooms`
- `GET /api/v1/properties/:propertyId/rooms/:id`
- `GET /api/v1/properties/:propertyId/room-types`
- `GET /api/v1/properties/:propertyId/room-types/:id`
- `PUT /api/v1/properties/:propertyId/room-types/:id/amenities`
- `GET /api/v1/properties/:propertyId/amenities`
- `GET /api/v1/properties/:propertyId/guests`
- `GET /api/v1/properties/:propertyId/reservations`
- `PATCH /api/v1/properties/:propertyId/reservations/:id/extend`
- `PATCH /api/v1/properties/:propertyId/reservations/:id/move-room`
- `POST /api/v1/properties/:propertyId/reservations/:id/check-in/mobile-capture`
- `GET /api/v1/check-in-capture/:token`
- `GET /api/v1/properties/:propertyId/stays/:reservationId`
- `GET /api/v1/properties/:propertyId/housekeeping`
- `GET /api/v1/properties/:propertyId/guest-requests`
- `GET /api/v1/properties/:propertyId/maintenance`
- `GET /api/v1/properties/:propertyId/reports/overview`
- `GET /api/v1/properties/:propertyId/folios`
- `GET /api/v1/properties/:propertyId/users`
- `GET /api/v1/properties/:propertyId/sessions`

## Role Permission Matrix

| Role | Main permissions |
| --- | --- |
| Owner | All permissions |
| Admin | All permissions |
| Manager | Rooms, guests, bookings, arrival, check-in, checkout, stay, billing view, housekeeping, employees, maintenance view, operations, guest requests, reports, users view, sessions view |
| Front Desk | Rooms, guests, bookings, arrival, check-in, checkout, stay, billing, maintenance view, operations, guest requests |
| Housekeeping | Rooms view/status manage, housekeeping, employees view, operations, guest requests |
| Maintenance | Rooms view/status manage, maintenance, operations, guest requests |
| Accounts | Guests view, bookings view, stay view, billing, reports |
| Read Only | Rooms view, guests view, bookings view, stay view, billing view, housekeeping view, employees view, operations view, guest requests view |

## Non-Goals

- Full rate engine and automated repricing.
- Channel manager connectivity.
- POS integration.
- Real-time event bus.
- Historical room move trail table.
- Automatic conversion from guest requests to housekeeping or maintenance tasks.

## Non-Functional Requirements

- Property-scoped isolation for all tenant data.
- Standard API response envelope for list and success responses.
- Role and permission enforcement at controller level.
- Postgres migrations as the source of schema changes.
- JWT access/refresh token auth.
- Local disk storage for document uploads in development.
- Buildable monorepo with focused Jest specs for backend services.
