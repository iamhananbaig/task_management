import { apiErrorMessage, errorResponse } from "@/lib/api"

/** Readable message for a failed request or any thrown value. */
export function errorMessage(error: unknown): string {
  return apiErrorMessage(error)
}

/** HTTP status of a failed request (e.g. 409 = needs confirmation), if any. */
export function httpStatus(error: unknown): number | undefined {
  return errorResponse(error)?.status
}

/** Laravel validation errors per field (422), or {}. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  return errorResponse(error)?.data?.errors ?? {}
}
