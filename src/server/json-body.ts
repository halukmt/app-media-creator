import type { Context } from 'hono';

export type JsonBody = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

/**
 * Reads an optional JSON object body: an empty body is `{}`; anything that is not a JSON object
 * (invalid JSON, null, a number, an array) is an error the route answers with 400.
 */
export async function readOptionalJsonObject(c: Context): Promise<JsonBody> {
  const text = await c.req.text();
  if (text.trim() === '') return { ok: true, body: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The request body must be JSON' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'The request body must be a JSON object' };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}
