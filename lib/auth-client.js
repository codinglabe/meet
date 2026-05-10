/** Same-origin + JSON; required for reliable session cookies with custom server. */
export const authFetchInit = {
  credentials: 'same-origin',
  headers: { 'content-type': 'application/json' }
};

/** Only allow in-app paths (open redirect hardening). */
export function sanitizeInternalPath(path) {
  if (path == null || typeof path !== 'string') return '/';
  const t = path.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return '/';
  return t;
}

export function redirectAfterAuth(path) {
  if (typeof window === 'undefined') return;
  window.location.assign(sanitizeInternalPath(path));
}
