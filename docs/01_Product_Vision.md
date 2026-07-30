# Product Vision

## Purpose

StayOS is a hospitality operating system for independent Indian hotels. It gives small and mid-sized properties one operational workspace for bookings, rooms, guest profiles, check-in, housekeeping, maintenance, billing, reports, and daily front-desk work.

The product is built for teams that need hotel-grade workflows without the complexity and cost of large enterprise PMS platforms.

## Target Customers

- Independent hotels, boutique stays, serviced apartments, guest houses, and regional chains in India.
- Properties with lean staff, high front-desk workload, and mixed paper/digital operations.
- Owners and managers who need control over occupancy, revenue, room readiness, requests, and staff accountability.

## Personas

- Owner: Wants visibility into revenue, occupancy, performance, and operational risk.
- Admin: Configures users, permissions, inventory, and property setup.
- Manager: Oversees daily operations across front desk, housekeeping, maintenance, guest requests, and reports.
- Front Desk: Creates bookings, checks guests in and out, handles stay changes, captures documents, and creates guest requests.
- Housekeeping: Tracks room readiness, cleaning state, assignments, and guest requests routed to housekeeping.
- Maintenance: Handles repair tickets, accepts work, resolves issues, and updates room operational state.
- Accounts: Manages folios, charges, payments, billing adjustments, and reports.

## Product Principles

- Operational clarity first: every screen should answer what needs attention now.
- Role-aware workflows: each user sees the actions they can safely perform.
- Indian hotel context: workflows assume Aadhaar/passport document capture, walk-ins, extensions, room moves, and multi-role staff.
- Fast recovery from real-world exceptions: no-room assignment, late check-in, room changes, failed document capture, and billing corrections must be handled explicitly.
- Data ownership by property: every operational record is scoped to a property.

## Shipped Core Modules

- Auth and sessions with JWT access tokens, refresh tokens, lock/unlock, and role permissions.
- Users and employees.
- Bookings and reservations.
- Rooms, floors, room types, room operational status, and amenities.
- Guests and guest profile document upload.
- Housekeeping workspace and staff access.
- Check-in, including mobile document capture.
- Billing and folios.
- Stay Workspace, including stay extension and move-room during stay.
- Guest Requests with routing, transitions, summary, notes, and suggestions.
- Reports for occupancy, revenue, operations, top guests, and CSV export.
- Maintenance tickets.

## Long-Term Vision

StayOS should become the system of record for independent hotel operations: reservation lifecycle, guest identity, room readiness, service requests, repairs, folios, reporting, rates, and channel connectivity.

The long-term direction is a reliable modular monolith that can later emit events and integrate with rate engines, channel managers, payment processors, POS systems, and guest-facing workflows.

## Success Metrics

- Front desk can complete booking, check-in, document capture, stay extension, room move, billing, and checkout in one loop.
- Managers can see occupancy, ADR, RevPAR, revenue, operational load, and guest request health without exports.
- Housekeeping and maintenance work is trackable, assignable, and auditable.
- Every property-scoped API enforces cross-property isolation.
- Demo bootstrap creates a usable property with users, rooms, bookings, guests, and operational data.
