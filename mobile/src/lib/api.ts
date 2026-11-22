import { create } from 'axios';

/**
 * The Laravel API (/api/v1). The server address comes from EXPO_PUBLIC_API_URL (set per build
 * profile in eas.json) and can be changed on the sign-in screen (saved on the phone).
 */
export const DEFAULT_SERVER = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = create({
  headers: { Accept: 'application/json' },
  timeout: 20_000,
});

let onUnauthorized: (() => void) | null = null;

export function configureApi(server: string, token: string | null, unauthorized: () => void) {
  api.defaults.baseURL = `${server.replace(/\/+$/, '')}/api/v1`;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
  onUnauthorized = unauthorized;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) onUnauthorized?.();
    return Promise.reject(error);
  }
);

type ErrorBody = { message?: string; errors?: Record<string, string[]> };

function errorBody(error: unknown): { status?: number; data?: ErrorBody } | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  return (error as { response?: { status?: number; data?: ErrorBody } }).response;
}

/** Readable message: the first validation error, the server's message, or a network hint. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const response = errorBody(error);
  if (!response) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ECONNABORTED') return 'The server took too long to answer.';
    if (error && typeof error === 'object' && 'message' in error && /Network/i.test(String((error as { message?: string }).message))) {
      return 'Cannot reach the server. Check your connection and the server address.';
    }
    return fallback;
  }
  const first = response.data?.errors ? Object.values(response.data.errors)[0]?.[0] : undefined;
  if (response.status === 403 && !response.data?.message?.includes('requires')) return first ?? response.data?.message ?? 'You do not have permission to do this.';
  return first ?? response.data?.message ?? fallback;
}

export function httpStatus(error: unknown): number | undefined {
  return errorBody(error)?.status;
}
