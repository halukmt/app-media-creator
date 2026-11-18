import type { CatalogueLocale, ProjectSettings } from '../api';
import { EmptyState } from '../components/EmptyState';
import { LocaleSelector } from '../components/LocaleSelector';
import { PageHeader } from '../components/PageHeader';
import { en } from '../i18n/en';
import { LOCALIZED_SECTIONS, sectionHref, targetsNeeding, type SectionId } from '../lib/sections';

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
  const enabled = {
    apple: project.targets.apple.enabled,
    google: project.targets.google.enabled,
    web: project.targets.web.enabled,
  };
  const neededBy = targetsNeeding(section, enabled).map((target) => en.targets[target]);
  const projectLocales = locales.filter((locale) => project.locales.includes(locale.id));
  const content = en.empty.content[section];

  return (
    <>
      <PageHeader title={en.sections[section].title} description={en.sections[section].description} focusOnMount={focusHeading} />
      <div className="flex flex-col gap-6">
        {LOCALIZED_SECTIONS.includes(section) ? (
          <LocaleSelector
            label={en.locales.barLabel}
            mode="multiple"
            options={projectLocales}
            value={selection}
            onChange={onSelectionChange}
          />
        ) : null}
        <EmptyState
          title={content.title}
          neededBy={neededBy}
          actions={
            neededBy.length === 0 || section === 'store-texts' ? (
              <a href={sectionHref('project')} className="btn min-h-11">
                {en.empty.toProject}
              </a>
            ) : undefined
          }
        >
          <p>{content.body}</p>
        </EmptyState>
      </div>
    </>
  );
}
