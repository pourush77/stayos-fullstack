import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const authContextSource = fs.readFileSync(
  path.resolve('apps/web/src/features/auth/auth-context.tsx'),
  'utf8',
);
const backendConnectivitySource = fs.readFileSync(
  path.resolve('packages/ui/src/connectivity/backend-connectivity.tsx'),
  'utf8',
);
const groupHoldSource = fs.readFileSync(
  path.resolve('apps/web/src/features/reservations/GroupHoldDetailPage.tsx'),
  'utf8',
);

test('SESSION_LOCKED refresh failures preserve local tokens for unlock/continue handling', () => {
  assert.match(authContextSource, /refreshError instanceof AuthRequestError/);
  assert.match(authContextSource, /refreshError\.code === 'SESSION_LOCKED'/);
  assert.match(authContextSource, /setIsLocked\(true\);\s+return response;/);
});

test('failed auth redirects are single-flight per route', () => {
  assert.match(authContextSource, /redirectingToLoginRef/);
  assert.match(authContextSource, /if \(redirectingToLoginRef\.current\) return;/);
});

test('health readiness checks bypass authenticated refresh handling', () => {
  assert.match(backendConnectivitySource, /'X-StayOS-Skip-Auth': 'true'/);
  assert.match(authContextSource, /headers\.get\(skipAuthHeader\) === 'true'/);
});

test('group hold detail initial load uses stable explicit property id', () => {
  assert.match(groupHoldSource, /const load = useCallback/);
  assert.doesNotMatch(groupHoldSource, /async \(id = propertyId/);
});
