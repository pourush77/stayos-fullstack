# StayOS V1 E2E Tests

These Playwright tests cover the first release smoke path, starting with RBAC and direct URL access.

## Run

Start the API and web app, then run:

```bash
npm run test:e2e
```

Fast V1 release checks:

```bash
npm run test:e2e:release
npm run test:e2e:ops
npm run test:e2e:checkin
```

Use `test:e2e:release` first before staff testing. It covers RBAC, front desk, check-in, checkout, and stay billing. Use `test:e2e:ops` for availability, group, housekeeping, and responsive layout checks.

To let Playwright start the web app:

```bash
PLAYWRIGHT_START_WEB=true npm run test:e2e
```

The API still needs to be running on the URL configured by the web app.

## Demo Accounts

All demo accounts use:

```text
Password123!
```

- `frontdesk@stayos.local`
- `manager@stayos.local`
- `housekeeping@stayos.local`
- `maintenance@stayos.local`
- `accounts@stayos.local`
