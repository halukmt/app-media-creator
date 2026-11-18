import type { CatalogueLocale, ProjectSettings } from '../api';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { SectionLayout } from '../layouts/SectionLayout';
import { projectLocaleOptions } from '../lib/locale-selection';
import { LOCALIZED_SECTIONS, type SectionId } from '../lib/sections';

interface Props {
  section: Exclude<SectionId, 'project'>;
  project: ProjectSettings;
  locales: readonly CatalogueLocale[];
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

/**
 * The asset sections that have no own UI yet: heading, the locale bar (L3) for localized sections and the
 * empty state (L6). Later issues replace the empty state with the real steps and previews.
 */
export function SectionPage({ section, project, locales, selection, onSelectionChange, focusHeading }: Props) {
  return (
    <SectionLayout
      section={section}
      focusHeading={focusHeading}
      localeBar={
        LOCALIZED_SECTIONS.includes(section)
          ? { options: projectLocaleOptions(locales, project.locales), selection, onChange: onSelectionChange }
          : undefined
      }
    >
      <SectionEmptyState section={section} project={project} />
    </SectionLayout>
  );
}
