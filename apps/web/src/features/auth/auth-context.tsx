'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../lib/api-base';

type AuthRole =
  | 'FRONT_DESK'
  | 'MANAGER'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'ACCOUNTS'
  | 'OWNER'
  | 'ADMIN'
  | 'READ_ONLY'
  | string;

export type AuthUser = {
  email: string;
  id: string;
  name: string;
  permissions: string[];
  propertyId?: string;
  propertyName?: string;
  role: AuthRole;
};

type LoginPayload = {
  email: string;
  password: string;
  rememberDevice: boolean;
};

type AuthContextValue = {
  accessToken?: string;
  error?: string;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLocked: boolean;
  continueSession: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  lockSession: () => void;
  refreshCurrentUser: () => Promise<AuthUser>;
  unlock: (password: string) => Promise<void>;
  user?: AuthUser;
};

type ApiResponse<T> = T | { data?: T } | { user?: T };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
//const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';
const accessTokenKey = 'stayos.accessToken';
const refreshTokenKey = 'stayos.refreshToken';
const rememberDeviceKey = 'stayos.rememberDevice';
const manualLogoutKey = 'stayos.manualLogout';
const publicPaths = new Set(['/login']);
const refreshExcludedPaths = ['/auth/login', '/auth/logout', '/auth/refresh', '/auth/unlock'];

function isRefreshExcludedUrl(url: string) {
  return refreshExcludedPaths.some((path) => url.includes(path));
}

function isPublicPath(pathname: string | null) {
  return Boolean(
    pathname &&
    (publicPaths.has(pathname) ||
      pathname.startsWith('/housekeeping/staff/') ||
      pathname.startsWith('/check-in-capture/') ||
      pathname.startsWith('/mobile-capture/')),
  );
}

function unwrap<T>(payload: ApiResponse<T>): T {
  if (payload && typeof payload === 'object') {
    if ('data' in payload && payload.data !== undefined) return payload.data;
    if ('user' in payload && payload.user !== undefined) return payload.user;
  }

  return payload as T;
}

function readToken(key: string) {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key) ?? undefined;
}

function writeToken(key: string, value: string, persistent: boolean) {
  const target = persistent ? window.localStorage : window.sessionStorage;
  const other = persistent ? window.sessionStorage : window.localStorage;
  target.setItem(key, value);
  other.removeItem(key);
}

function clearTokens() {
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    storage.removeItem(accessTokenKey);
    storage.removeItem(refreshTokenKey);
  });
}

function hasManualLogout() {
  if (typeof window === 'undefined') return false;
  return (
    window.sessionStorage.getItem(manualLogoutKey) === 'true' ||
    window.localStorage.getItem(manualLogoutKey) === 'true'
  );
}

function setManualLogout() {
  window.sessionStorage.setItem(manualLogoutKey, 'true');
  window.localStorage.setItem(manualLogoutKey, 'true');
}

function clearManualLogout() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(manualLogoutKey);
  window.localStorage.removeItem(manualLogoutKey);
}

function normalizeRole(value: unknown): AuthRole {
  return typeof value === 'string' && value ? value : 'FRONT_DESK';
}

function defaultRouteForRole(role?: AuthRole) {
  switch (role) {
    case 'HOUSEKEEPING':
      return '/housekeeping';
    case 'MAINTENANCE':
      return '/maintenance';
    case 'ACCOUNTS':
      return '/billing';
    case 'OWNER':
    case 'ADMIN':
    case 'MANAGER':
    case 'FRONT_DESK':
    case 'READ_ONLY':
    default:
      return '/';
  }
}

function shouldHonorLoginNext(role: AuthRole, next: string | null) {
  if (!next?.startsWith('/')) return false;
  return role !== 'FRONT_DESK';
}

function stringValue(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapUser(payload: unknown): AuthUser {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const profile =
    record.user && typeof record.user === 'object'
      ? (record.user as Record<string, unknown>)
      : record;
  const property =
    profile.property && typeof profile.property === 'object'
      ? (profile.property as Record<string, unknown>)
      : undefined;

  return {
    email: stringValue(profile, ['email'], 'frontdesk@stayos.local'),
    id: stringValue(profile, ['id', '_id', 'uuid'], 'current-user'),
    name:
      stringValue(profile, ['name', 'fullName', 'displayName']) ||
      [stringValue(profile, ['firstName']), stringValue(profile, ['lastName'])]
        .filter(Boolean)
        .join(' ') ||
      stringValue(profile, ['email'], 'StayOS User'),
    permissions: stringArray(profile.permissions ?? record.permissions),
    propertyId:
      stringValue(
        property,
        ['id', '_id', 'uuid', 'propertyId'],
        stringValue(profile, ['propertyId']),
      ) || undefined,
    propertyName:
      stringValue(property, ['name'], stringValue(profile, ['propertyName'])) || undefined,
    role: normalizeRole(profile.role ?? record.role),
  };
}

function getMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
    if (record.error && typeof record.error === 'object') {
      const error = record.error as Record<string, unknown>;
      if (typeof error.message === 'string') return error.message;
      if (typeof error.code === 'string') return error.code;
    }
    if (typeof record.code === 'string') return record.code;
  }
  return fallback;
}

function getErrorCode(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.code === 'string') return record.code;
  if (record.error && typeof record.error === 'object') {
    const error = record.error as Record<string, unknown>;
    if (typeof error.code === 'string') return error.code;
  }
  return undefined;
}

async function parseJson(response: Response) {
  return (await response.json().catch(() => undefined)) as unknown;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [user, setUser] = useState<AuthUser | undefined>();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const rawFetchRef = useRef<typeof fetch | undefined>(undefined);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  const redirectToLogin = useCallback(() => {
    if (hasManualLogout()) {
      router.replace('/login');
      return;
    }
    const next = pathname && !isPublicPath(pathname) ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [pathname, router]);

  const refreshTokens = useCallback((): Promise<string> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const refreshToken = readToken(refreshTokenKey);
      if (!refreshToken) throw new Error('Missing refresh token.');

      const response = await (rawFetchRef.current ?? fetch)(`${API_BASE_URL}/auth/refresh`, {
        body: JSON.stringify({ refreshToken }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = await parseJson(response);
      if (!response.ok) throw new Error(getMessage(payload, 'Session expired.'));

      const data = unwrap<Record<string, unknown>>(payload as ApiResponse<Record<string, unknown>>);
      const nextAccessToken = stringValue(data, ['accessToken', 'token']);
      const nextRefreshToken = stringValue(data, ['refreshToken']);
      if (!nextAccessToken) throw new Error('Refresh response did not include an access token.');

      const persistent = window.localStorage.getItem(rememberDeviceKey) === 'true';
      writeToken(accessTokenKey, nextAccessToken, persistent);
      if (nextRefreshToken) writeToken(refreshTokenKey, nextRefreshToken, persistent);
      setAccessToken(nextAccessToken);
      return nextAccessToken;
    })();

    refreshPromiseRef.current = refreshPromise;

    void refreshPromise.then(
      () => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
      },
      () => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
      },
    );

    return refreshPromise;
  }, []);

  const continueSession = useCallback(async () => {
    setError(undefined);

    try {
      await refreshTokens();
    } catch (continueError) {
      const message =
        continueError instanceof Error ? continueError.message : 'Unable to continue your session.';

      setError(message);
      throw new Error(message, {
        cause: continueError,
      });
    }
  }, [refreshTokens]);

  const authedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> => {
      const token = accessToken ?? readToken(accessTokenKey);
      const headers = new Headers(init.headers);
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

      const response = await (rawFetchRef.current ?? fetch)(input, { ...init, headers });
      const clone = response.clone();
      const payload = await parseJson(clone);
      const code = getErrorCode(payload);

      if ((response.status === 401 || response.status === 403) && code === 'SESSION_LOCKED') {
        setIsLocked(true);
        return response;
      }

      if (response.status === 401 && retry) {
        try {
          const nextToken = await refreshTokens();
          const retryHeaders = new Headers(init.headers);
          retryHeaders.set('Authorization', `Bearer ${nextToken}`);
          return (rawFetchRef.current ?? fetch)(input, { ...init, headers: retryHeaders });
        } catch {
          clearTokens();
          setUser(undefined);
          setAccessToken(undefined);
          redirectToLogin();
        }
      }

      return response;
    },
    [accessToken, redirectToLogin, refreshTokens],
  );

  const refreshCurrentUser = useCallback(async () => {
    const response = await authedFetch(`${API_BASE_URL}/auth/me`);
    const payload = await parseJson(response);
    if (!response.ok) throw new Error(getMessage(payload, 'Unable to load current user.'));

    const currentUser = mapUser(unwrap(payload as ApiResponse<unknown>));
    setUser(currentUser);
    return currentUser;
  }, [authedFetch]);

  const logout = useCallback(async () => {
    const refreshToken = readToken(refreshTokenKey);
    setManualLogout();
    await authedFetch(`${API_BASE_URL}/auth/logout`, {
      body: JSON.stringify({ refreshToken }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => undefined);
    clearTokens();
    setAccessToken(undefined);
    setUser(undefined);
    setIsLocked(false);
    router.replace('/login');
  }, [authedFetch, router]);

  const login = useCallback(
    async ({ email, password, rememberDevice }: LoginPayload) => {
      setError(undefined);
      const response = await (rawFetchRef.current ?? fetch)(`${API_BASE_URL}/auth/login`, {
        body: JSON.stringify({ email, password }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(getMessage(payload, 'Email or password was not recognized.'));
      }

      const data = unwrap<Record<string, unknown>>(payload as ApiResponse<Record<string, unknown>>);
      const nextAccessToken = stringValue(data, ['accessToken', 'token']);
      const nextRefreshToken = stringValue(data, ['refreshToken']);
      if (!nextAccessToken || !nextRefreshToken)
        throw new Error('Login response did not include session tokens.');

      window.localStorage.setItem(rememberDeviceKey, rememberDevice ? 'true' : 'false');
      writeToken(accessTokenKey, nextAccessToken, rememberDevice);
      writeToken(refreshTokenKey, nextRefreshToken, rememberDevice);
      setAccessToken(nextAccessToken);

      const meResponse = await (rawFetchRef.current ?? fetch)(`${API_BASE_URL}/auth/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${nextAccessToken}` },
      });
      const mePayload = await parseJson(meResponse);
      if (!meResponse.ok) throw new Error(getMessage(mePayload, 'Unable to load your workspace.'));
      const currentUser = mapUser(unwrap(mePayload as ApiResponse<unknown>));
      setUser(currentUser);

      const wasManualLogout = hasManualLogout();
      clearManualLogout();
      const next = wasManualLogout ? null : new URLSearchParams(window.location.search).get('next');
      let destination = defaultRouteForRole(currentUser.role);
      if (shouldHonorLoginNext(currentUser.role, next) && next) {
        destination = next;
      }
      router.replace(destination);
    },
    [router],
  );

  const unlock = useCallback(
    async (password: string) => {
      const refreshToken = readToken(refreshTokenKey);

      if (!refreshToken) {
        clearTokens();
        setAccessToken(undefined);
        setUser(undefined);
        setIsLocked(false);
        redirectToLogin();
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await (rawFetchRef.current ?? fetch)(`${API_BASE_URL}/auth/unlock`, {
        body: JSON.stringify({ refreshToken, password }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
      });

      const payload = await parseJson(response);

      if (!response.ok) {
        const code = getErrorCode(payload);

        if (code === 'INVALID_CREDENTIALS') {
          throw new Error('The password you entered is incorrect.');
        }

        if (response.status === 401 || response.status === 403) {
          const message = getMessage(payload, 'Unable to unlock session.');

          if (code !== 'SESSION_LOCKED') {
            clearTokens();
            setAccessToken(undefined);
            setUser(undefined);
            setIsLocked(false);
            redirectToLogin();
          }

          throw new Error(message);
        }

        throw new Error(getMessage(payload, 'Unable to unlock session.'));
      }

      const data = unwrap<Record<string, unknown>>(payload as ApiResponse<Record<string, unknown>>);
      const nextAccessToken = stringValue(data, ['accessToken', 'token']);
      const nextRefreshToken = stringValue(data, ['refreshToken']);

      if (!nextAccessToken || !nextRefreshToken) {
        throw new Error('Unlock response did not include session tokens.');
      }

      const persistent = window.localStorage.getItem(rememberDeviceKey) === 'true';
      writeToken(accessTokenKey, nextAccessToken, persistent);
      writeToken(refreshTokenKey, nextRefreshToken, persistent);
      setAccessToken(nextAccessToken);

      const meResponse = await (rawFetchRef.current ?? fetch)(`${API_BASE_URL}/auth/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${nextAccessToken}` },
      });
      const mePayload = await parseJson(meResponse);

      if (!meResponse.ok) {
        throw new Error(getMessage(mePayload, 'Unable to restore your workspace.'));
      }

      setUser(mapUser(unwrap(mePayload as ApiResponse<unknown>)));
      setIsLocked(false);
      setError(undefined);
    },
    [redirectToLogin],
  );

  const lockSession = useCallback(() => {
    setIsLocked(true);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!rawFetchRef.current) rawFetchRef.current = window.fetch.bind(window);
    const rawFetch = rawFetchRef.current;

    window.fetch = async (input, init = {}) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const isStayApi = url.startsWith(API_BASE_URL);
      const isCurrentRoutePublic = isPublicPath(pathname);
      const headers = new Headers(init.headers);
      const token = readToken(accessTokenKey);
      if (isStayApi && token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await rawFetch(input, { ...init, headers });
      if (!isStayApi || isRefreshExcludedUrl(url) || isCurrentRoutePublic) {
        return response;
      }

      if (response.status !== 401 && response.status !== 403) {
        return response;
      }

      const payload = await parseJson(response.clone());
      const code = getErrorCode(payload);
      if (code === 'SESSION_LOCKED') {
        setIsLocked(true);
        return response;
      }

      if (response.status !== 401) {
        return response;
      }

      try {
        const nextToken = await refreshTokens();
        const retryHeaders = new Headers(init.headers);
        retryHeaders.set('Authorization', `Bearer ${nextToken}`);
        return rawFetch(input, { ...init, headers: retryHeaders });
      } catch {
        clearTokens();
        setUser(undefined);
        setAccessToken(undefined);
        redirectToLogin();
        return response;
      }
    };

    return () => {
      if (rawFetchRef.current) window.fetch = rawFetchRef.current;
    };
  }, [redirectToLogin, refreshTokens]);

  useEffect(() => {
    async function bootstrap() {
      const token = readToken(accessTokenKey);
      setAccessToken(token);

      if (!token) {
        setIsBootstrapping(false);
        if (!isPublicPath(pathname)) redirectToLogin();
        return;
      }

      try {
        const currentUser = await refreshCurrentUser();

        if (pathname === '/login') {
          router.replace(defaultRouteForRole(currentUser.role));
        }
      } catch {
        try {
          await refreshTokens();
          await refreshCurrentUser();
        } catch {
          clearTokens();
          setUser(undefined);
          if (!isPublicPath(pathname)) redirectToLogin();
        }
      } finally {
        setIsBootstrapping(false);
      }
    }

    void bootstrap();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      continueSession,
      error,
      isAuthenticated: Boolean(user && accessToken),
      isBootstrapping,
      isLocked,
      lockSession,
      login,
      logout,
      refreshCurrentUser,
      unlock,
      user,
    }),
    [
      accessToken,
      continueSession,
      error,
      isBootstrapping,
      isLocked,
      lockSession,
      login,
      logout,
      refreshCurrentUser,
      unlock,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
