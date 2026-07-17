// supabase-js treats any 5xx auth response as "retryable" and skips parsing
// the JSON body entirely — it builds the error message by JSON.stringify-ing
// the raw fetch Response object instead, which has no enumerable own
// properties and always serializes to the literal string "{}". Any real
// server-side auth failure (e.g. the mail provider rejecting a send) would
// otherwise surface to users as a bare "{}" instead of a readable message.
const RETRYABLE_ERROR_NAMES = new Set(["AuthRetryableFetchError", "AuthUnknownError"]);

export function authErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as { name?: string; status?: number; message?: string };

  if (RETRYABLE_ERROR_NAMES.has(e.name ?? "") || (typeof e.status === "number" && e.status >= 500)) {
    return "Our server had a problem processing that. Please try again in a moment.";
  }

  const message = typeof e.message === "string" ? e.message.trim() : "";
  if (!message || message.startsWith("{") || message.startsWith("[")) return fallback;
  return message;
}
