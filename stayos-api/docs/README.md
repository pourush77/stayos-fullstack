# StayOS API Documentation

This directory contains documentation for the StayOS Platform API foundation. Each subfolder is organized by a key area of the backend platform.

## Documentation Structure

- `01-product/` - product and platform overview
- `02-domain/` - domain concepts, bounded contexts, and architectural patterns
- `03-database/` - database architecture, models, and strategy
- `04-api/` - API design, versioning, and contracts
- `05-events/` - event-driven architecture and messaging patterns
- `06-security/` - security design, authentication, and authorization principles
- `07-workflows/` - workflows and process orchestration
- `08-integrations/` - integration patterns and external systems
- `09-deployment/` - deployment, environment, and infrastructure guidance
- `10-decisions/` - architecture decisions and rationale

## Backend Workflow

Business Rules -> Documentation -> Database Design -> API Contract -> NestJS Implementation -> Swagger -> Tests -> Documentation Update.

## Global Rules

- Always update relevant Markdown documentation.
- Never break existing APIs.
- Run lint, build, and tests before completing backend changes.
- Explain architectural decisions briefly.
- Keep modules production-ready.
- Prefer clean, maintainable code over clever code.
