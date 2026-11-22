import axios from 'axios';

// Set VITE_API_URL in frontend/.env (see .env.example) for non-local deployments.
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
    headers: {
        'Accept': 'application/json',
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

/** Body of a Laravel error response. */
export interface ApiErrorBody {
    message?: string;
    error?: string;
    errors?: Record<string, string[]>;
    [key: string]: unknown;
}

/** The HTTP response of a failed request, if it was one. */
export function errorResponse(error: unknown): { status?: number; data?: ApiErrorBody } | undefined {
    if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    if (!response) return undefined;
    const data = typeof response.data === 'object' && response.data !== null ? (response.data as ApiErrorBody) : undefined;
    return { status: response.status, data };
}

/** Human-readable message from an API error (Laravel `message` / first validation error). */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
    const res = errorResponse(error);
    const data = res?.data;
    const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    if (res?.status === 403 && !data?.message?.includes('requires')) {
        return 'You do not have permission to perform this action.';
    }
    // Server-provided reason first; generic HTTP/network text falls back to the caller's message
    return firstFieldError || data?.message || data?.error || fallback;
}
