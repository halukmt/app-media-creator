// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { Catalogue } from '../../src/server/catalogue-routes.js';
import { packageInfoFactory } from '../factories/package-info.js';

describe('GET /api/catalogue gives the UI its choices', () => {
  const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory() });

  async function catalogue(): Promise<Catalogue> {
    const response = await app.request('/api/catalogue');
    expect(response.status).toBe(200);
    return (await response.json()) as Catalogue;
  }

  test('lists the 6 locales with native names', async () => {
    const { locales } = await catalogue();
    expect(locales.map((locale) => locale.id)).toEqual(['de-DE', 'en-US', 'es-ES', 'it-IT', 'fr-FR', 'tr-TR']);
    expect(locales.find((locale) => locale.id === 'tr-TR')?.nativeName).toBe('Türkçe');
  });

  test('lists device models per target with name and required flag', async () => {
    const { devices } = await catalogue();
    const iphone = devices.apple.find((device) => device.id === 'apple.screenshot.iphone-6.3');
    expect(iphone).toMatchObject({ name: expect.stringContaining('6.3') as unknown, required: true });
    expect(devices.google.map((device) => device.id)).toContain('google.screenshot.phone');
    expect(devices.web).toEqual([]);
  });

  test('does not accept changes to the catalogue', async () => {
    const response = await app.request('/api/catalogue', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: '{}',
    });
    expect(response.status).toBe(404);
  });
});
