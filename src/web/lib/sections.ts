/** The sections of the app in sidebar order. Pure data and helpers, no React. */

export const SECTION_IDS = ['project', 'logo', 'screenshots', 'video', 'store-texts', 'export'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type TargetId = 'apple' | 'google' | 'web';

export const DEFAULT_SECTION: SectionId = 'project';

/** Sections that produce localized media and therefore show the locale bar. */
export const LOCALIZED_SECTIONS: readonly SectionId[] = ['logo', 'screenshots', 'video', 'store-texts', 'export'];

/**
 * Targets that need the output of a section. Store texts exist only for the two stores;
 * everything else is used by all three targets.
 */
const SECTION_TARGETS: Record<SectionId, readonly TargetId[]> = {
  project: [],
  logo: ['apple', 'google', 'web'],
  screenshots: ['apple', 'google', 'web'],
  video: ['apple', 'google', 'web'],
  'store-texts': ['apple', 'google'],
  export: ['apple', 'google', 'web'],
};

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

/** Section of a location hash (`#/logo` → `logo`); unknown or empty hashes fall back to the Project section. */
export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  return isSectionId(id) ? id : DEFAULT_SECTION;
}

export function sectionHref(id: SectionId): string {
  return `#/${id}`;
}

/** Enabled targets that need the given section, in the fixed order App Store, Google Play, web. */
export function targetsNeeding(section: SectionId, enabled: Readonly<Record<TargetId, boolean>>): TargetId[] {
  return SECTION_TARGETS[section].filter((target) => enabled[target]);
}
