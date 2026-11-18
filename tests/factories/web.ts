import type { TargetId } from '../../src/web/lib/sections.js';

/** The 6 media locale ids in catalogue order. */
export function allLocaleIds(): string[] {
  return ['de-DE', 'en-US', 'es-ES', 'it-IT', 'fr-FR', 'tr-TR'];
}

/** Section ids with their page headings, in sidebar order. */
export function sectionTitles(): [string, string][] {
  return [
    ['project', 'Project'],
    ['logo', 'Logo'],
    ['screenshots', 'Screenshots'],
    ['video', 'Video'],
    ['store-texts', 'Store texts'],
    ['export', 'Export'],
  ];
}

/** Viewport widths for screenshots and layout checks: phone, tablet, desktop. */
export function viewportWidths(): number[] {
  return [375, 768, 1280];
}

/** All three targets enabled, with optional overrides. */
export function enabledTargets(overrides: Partial<Record<TargetId, boolean>> = {}): Record<TargetId, boolean> {
  return { apple: true, google: true, web: true, ...overrides };
}
