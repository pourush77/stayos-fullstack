# Security Documentation

This folder documents authentication, authorization, encryption, and API security standards.

## Current Scope

Authentication and authorization are not implemented yet.

The current security baseline includes:

- Helmet HTTP security headers.
- Strict request DTO validation.
- Environment validation during startup.
- Secret-safe logging and diagnostics.
- Request correlation IDs for traceable error logs.

## Environment Secrets

JWT settings are validated even before auth is implemented so production deployments cannot start with weak placeholders.

Required variables:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Development, test, and staging may use local placeholder values.

Production values must be:

- present
- non-placeholder
- at least 32 characters
- stored in a secret manager or equivalent deployment secret store

Secrets must not be committed, returned from health endpoints, or written to logs.

## Error Safety

API errors use a standard response shape and include a request ID for support tracing.

Production responses must not expose:

- stack traces
- raw database errors
- secrets
- rejected values for sensitive fields

Sensitive validation fields include names containing `password`, `secret`, `token`, `key`, or `authorization`.

## Request IDs

The API accepts `x-request-id` from trusted clients and generates a UUID when the header is absent.

The same value is returned in the `x-request-id` response header and included in standardized success and error responses.

## Response Metadata

Success responses include metadata with request ID, timestamp, and API version.

This metadata is safe for clients and support workflows. It must not include secrets, internal database identifiers beyond normal resource IDs, stack traces, or infrastructure topology.

## Future Security Work

- Authentication module.
- JWT access and refresh token issuance.
- RBAC and permission model.
- Rate limiting.
- Audit logging.
