# Product Documentation

StayOS is a hospitality platform for managing hotel and serviced-stay operations.

## Core Product Concepts

### Property

A Property is the root operating entity in StayOS. Every Floor, Room Type, Room, Reservation, Guest Stay, Housekeeping Task, Billing Record, and Notification belongs to a Property.

The first market focus is India, so the platform captures GST registration details and Indian state codes at the Property level.

## Current Product Scope

- Property setup and lifecycle status.
- Property contact, address, statutory, and operating settings.
- Foundation for future operational modules that must be scoped to a Property.

## Hotel Inventory

Hotel Inventory is the first business bounded context in StayOS. It defines the physical and sellable structure of a hotel before reservations, stays, housekeeping, billing, and notifications can operate.

### Product Responsibilities

- Property represents the hotel or serviced-stay business unit.
- Floor represents a physical or operational level inside a Property.
- Room Type represents the sellable room category used for pricing, availability, and booking decisions.
- Room represents a physical room that can be assigned, maintained, blocked, or occupied.

### User Outcomes

- Operators can model a hotel's building structure.
- Operators can define sellable room categories before pricing and reservations.
- Operators can create physical rooms and map them to a floor and room type.
- Future modules can reliably scope operational data to Property, Floor, Room Type, and Room.

### Future Product Extensions

- Multi-building properties.
- Room amenities and media.
- Room type rate plans.
- Inventory blocks and out-of-order periods.
- Housekeeping zones and room attendant assignments.
- Channel manager room type mappings.

## First Production Property

Hillston Resort & Club is the first real property onboarded into StayOS for development, testing, and frontend integration.

Inventory baseline:

- Property code: `HILLSTON_IND`.
- Guest Floors: Second Floor and Third Floor.
- Room Types: Deluxe and Suite.
- Rooms: 24.
- Deluxe Rooms: 20.
- Suite Rooms: 4.
