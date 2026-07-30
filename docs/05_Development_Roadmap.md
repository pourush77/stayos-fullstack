# Development Roadmap

## Current State

StayOS has completed the core guest lifecycle loop:

- Login and permissions.
- Users and employees.
- Rooms, floors, room types, and amenities.
- Guest profiles and identity documents.
- Reservations and room assignment.
- Front-desk check-in and guest mobile document capture.
- Stay workspace with extend stay and move room.
- Housekeeping operations.
- Guest requests.
- Billing and folios.
- Reports.
- Maintenance tickets.
- Marketplace placeholder.

## v1 Hardening - In Progress

The current priority is stabilizing the shipped v1 workflows.

- Add smoke coverage around booking, check-in, document capture, stay workspace, extend, move room, billing, requests, reports, and maintenance.
- Normalize response envelopes where legacy modules still return direct DTOs.
- Continue tightening cross-property isolation tests.
- Improve empty, loading, and error states on frontend operational pages.
- Reduce fallback/mock UI paths as backend coverage becomes complete.
- Review document storage paths and production storage strategy.
- Add audit/activity coverage for key operational transitions.

## v1.1 - Operations Depth

v1.1 expands operational depth without changing the core architecture.

- Maintenance module polish: richer assignment, filters, notes, and room-state integration.
- Amenities module polish: CRUD UI, room-type editor integration, and room search/filter support.
- Availability calendar: real matrix view for rooms, reservations, blocks, and stay extensions.
- Guest document upload polish on guest profile and check-in flows.
- Marketplace placeholder polish and integration category previews.
- Better role-based navigation and settings structure.

## v2 - Revenue and Connectivity

v2 introduces hotel revenue and integration capabilities.

- Rate engine for pricing, date ranges, room type rates, and re-pricing after stay changes.
- Channel manager integration for OTA inventory and reservation sync.
- Payment gateway integrations.
- POS integration for restaurant/spa/incidental charges.
- Event emission for operational transitions, audit stream, and downstream automation.
- Webhook/event subscription model for external integrations.

## Later

- Multi-property owner dashboard.
- Advanced analytics and forecasting.
- Guest messaging.
- Housekeeping and maintenance mobile apps.
- Enterprise audit controls.
- Data warehouse exports.
