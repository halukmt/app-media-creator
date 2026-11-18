import type { ChecklistLike } from '../../src/web/lib/export.js';
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

/** A checklist with one ok item (2 files), one warning item (1 file) and one missing required item. */
export function checklistFactory(): ChecklistLike {
  return {
    status: 'error',
    targets: [
      {
        items: [
          { status: 'ok', files: ['apple/shared/icon/app-icon.png', 'apple/shared/icon/app-icon-dark.png'] },
          { status: 'warning', files: ['web/shared/share/og.png'] },
        ],
      },
      { items: [{ status: 'error', files: [] }] },
    ],
  };
}

/** All three targets enabled, with optional overrides. */
export function enabledTargets(overrides: Partial<Record<TargetId, boolean>> = {}): Record<TargetId, boolean> {
  return { apple: true, google: true, web: true, ...overrides };
}
