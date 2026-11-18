// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';

describe('createApp serves the local API', () => {
  const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory() });

  test('answers the health check with name and version', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', name: 'app-media-creator', version: '1.2.3' });
  });

  test('returns 404 as JSON for an unknown API route', async () => {
    const response = await app.request('/api/unknown');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
