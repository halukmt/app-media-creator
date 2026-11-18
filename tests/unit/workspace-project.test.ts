// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { defaultProject, deviceOptions, validateProject } from '../../src/core/workspace/index.js';
import { projectInputFactory } from '../factories/workspace.js';

describe('Project settings are validated and normalized', () => {
  test('selects all six locales, source en-US and every target in a new project', () => {
    const project = defaultProject('Demo');
    expect(project.locales).toEqual(['de-DE', 'en-US', 'es-ES', 'it-IT', 'fr-FR', 'tr-TR']);
    expect(project.sourceLocale).toBe('en-US');
    expect([project.targets.apple.enabled, project.targets.google.enabled, project.targets.web.enabled]).toEqual([true, true, true]);
  });

  test('accepts the default project', () => {
    expect(validateProject(defaultProject()).ok).toBe(true);
  });

  test('keeps the given name, locales and devices', () => {
    const result = validateProject(
      projectInputFactory({
        name: 'Demo',
        locales: ['tr-TR', 'de-DE'],
        sourceLocale: 'de-DE',
        targets: {
          apple: { enabled: true, devices: ['apple.screenshot.iphone-6.9'] },
          google: { enabled: false, devices: [] },
          web: { enabled: true, devices: [] },
        },
      }),
    );
    expect(result.ok && result.project).toMatchObject({
      name: 'Demo',
      locales: ['de-DE', 'tr-TR'],
      targets: { apple: { devices: ['apple.screenshot.iphone-6.9'] }, google: { enabled: false } },
    });
  });

  test('stores "all" as the six locales in catalogue order', () => {
    const result = validateProject(projectInputFactory({ locales: 'all' }));
    expect(result.ok && result.project.locales).toHaveLength(6);
  });

  test('rejects an App Store device that belongs to Google Play and an unsupported locale', () => {
    const result = validateProject(
      projectInputFactory({
        locales: ['de-DE', 'pt-BR'],
        targets: {
          apple: { enabled: true, devices: ['google.screenshot.phone'] },
          google: { enabled: true, devices: [] },
          web: { enabled: true, devices: [] },
        },
      }),
    );
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors;
    expect(errors.some((e) => e.includes('pt-BR'))).toBe(true);
    expect(errors.some((e) => e.includes('google.screenshot.phone'))).toBe(true);
  });

  test('rejects a source locale that is not selected', () => {
    const result = validateProject(projectInputFactory({ sourceLocale: 'de-DE', locales: ['en-US'] }));
    expect(result.ok ? [] : result.errors).toEqual(['sourceLocale: de-DE must be one of the selected locales']);
  });

  test('rejects a missing app name and a wrong type with the field path', () => {
    const result = validateProject(projectInputFactory({ name: '  ', claims: { allowed: 'x', forbidden: [] } }));
    const errors = result.ok ? [] : result.errors;
    expect(errors.some((e) => e.startsWith('name:'))).toBe(true);
    expect(errors.some((e) => e.startsWith('claims.allowed:'))).toBe(true);
  });

  test('offers only screenshot entries of the target as devices', () => {
    expect(deviceOptions('apple')).toContain('apple.screenshot.iphone-duo-inner');
    expect(deviceOptions('google')).toContain('google.screenshot.tablet-10');
    expect(deviceOptions('web')).toEqual([]);
  });
});
