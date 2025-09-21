const ABSOLUTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function isAbsoluteUrl(input: string): boolean {
  // http:, https:, ws:, wss:, data:, blob:, file:, etc., or protocol-relative
  return ABSOLUTE_SCHEME_RE.test(input) || input.startsWith("//");
}

function joinBaseAndPath(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

/**
 * Prepend VITE_API_URL to relative paths; leave absolute URLs untouched.
 * When VITE_API_URL is not set, returns the input unchanged.
 *
 * Optional baseOverride is for testing or special cases.
 */
export function buildApiUrl(input: string, baseOverride?: string): string {
  // IMPORTANT: Use direct access so Vite can statically replace this at build time
  const base = baseOverride ?? import.meta.env.VITE_API_URL;
  if (!base) return input;                // Env not set: keep original relative path
  if (isAbsoluteUrl(input)) return input; // Absolute URLs: do not modify
  return joinBaseAndPath(base, input);
}
