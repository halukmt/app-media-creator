import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { StoreTextsFileError, readStoreTexts, saveStoreTexts, storeTextChecks, type StoreTexts, type Workspace } from '../core/workspace/index.js';

/** Largest store texts document a page may send: 6 locales × 9 fields × 10 000 characters of up to 4 bytes, plus JSON. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/** The document with the check messages of its texts, so the page shows the same checks as the export. */
const withChecks = (storeTexts: StoreTexts) => ({ ...storeTexts, checks: storeTextChecks(storeTexts) });

/** The store texts document: read and revision-checked save. Mounted under /api. */
export function storeTextsRoutes(workspace: Workspace): Hono {
  const api = new Hono();
  // A broken file is reported, never replaced: the page shows the error instead of empty fields it would save over it.
  api.onError((error, c) => {
    if (error instanceof StoreTextsFileError) return c.json({ errors: [error.message], problems: error.problems }, 500);
    throw error;
  });

  api.get('/store-texts', async (c) => c.json(withChecks(await readStoreTexts(workspace))));

  api.put(
    '/store-texts',
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ errors: ['The store texts are too large'] }, 413) }),
    async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ errors: ['The request body must be JSON'] }, 400);
      }
      // The page names the revision its document is based on; without it an older tab could overwrite newer changes.
      if (typeof body !== 'object' || body === null || typeof (body as { revision?: unknown }).revision !== 'number') {
        return c.json({ errors: ['revision: the revision the changes are based on is required'] }, 400);
      }
      const result = await saveStoreTexts(workspace, body);
      if (result.ok) return c.json(withChecks(result.storeTexts));
      if (result.conflict) return c.json({ errors: result.errors, current: result.current ? withChecks(result.current) : undefined }, 409);
      return c.json({ errors: result.errors }, 400);
    },
  );

  return api;
}
