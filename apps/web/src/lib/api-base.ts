export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3002/api/v1'
  ).replace(/\/+$/, '');
}

export const API_BASE_URL = getApiBaseUrl();
