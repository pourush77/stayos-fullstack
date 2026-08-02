export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3002/api/v1'
  ).replace(/\/+$/, '');
}

export const API_BASE_URL = getApiBaseUrl();

export function getBrowserReachableApiBaseUrl() {
  const configured = API_BASE_URL;
  const publicBaseUrl = process.env.NEXT_PUBLIC_API_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (publicBaseUrl) return publicBaseUrl;

  if (typeof window === 'undefined') return configured;
  const pageHost = window.location.hostname;
  if (pageHost === 'localhost' || pageHost === '127.0.0.1') return configured;

  try {
    const url = new URL(configured);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = pageHost;
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    return configured;
  }

  return configured;
}

export function getPublicAppOrigin() {
  const publicOrigin = process.env.NEXT_PUBLIC_APP_PUBLIC_ORIGIN?.replace(/\/+$/, '');
  if (publicOrigin) return publicOrigin;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
