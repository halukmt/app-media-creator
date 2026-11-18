import type { MiddlewareHandler } from 'hono';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Hostname part of a Host header value (`localhost:4790` → `localhost`, `[::1]:4790` → `[::1]`). */
function hostnameOf(host: string): string {
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1).toLowerCase();
  return (host.split(':')[0] ?? '').toLowerCase();
}

/**
 * Protects the local API against other websites in the user's browser:
 * - every request must name a local host (blocks DNS rebinding),
 * - changing requests from a browser must come from the same origin as the host they are sent to
 *   (blocks cross-site form posts and fetches, which need no CORS preflight).
 */
export function localOnly(): MiddlewareHandler {
  return async (c, next) => {
    // Node's HTTP server always passes Host; in-process requests (tests) only have the URL.
    const host = c.req.header('host') ?? new URL(c.req.url).host;
    if (!LOCAL_HOSTNAMES.has(hostnameOf(host))) {
      return c.json({ error: 'Requests must be sent to localhost' }, 403);
    }
    if (!SAFE_METHODS.has(c.req.method)) {
      const origin = c.req.header('origin');
      if (origin !== undefined && origin !== `http://${host}`) {
        return c.json({ error: 'Requests from other websites are not allowed' }, 403);
      }
      if (c.req.header('sec-fetch-site') === 'cross-site') {
        return c.json({ error: 'Requests from other websites are not allowed' }, 403);
      }
    }
    await next();
  };
}
