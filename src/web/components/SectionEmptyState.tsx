import type { ProjectSettings } from '../api';
import { en } from '../i18n/en';
import { sectionHref, targetsNeeding, type SectionId } from '../lib/sections';
import { EmptyState } from './EmptyState';

interface Props {
  section: Exclude<SectionId, 'project'>;
  project: ProjectSettings;
}

/**
 * The L6 empty state of one section: its text, the enabled stores that need it, and a link to Project when the
 * section needs a Project change first.
 */
export function SectionEmptyState({ section, project }: Props) {
  const enabled = {
    apple: project.targets.apple.enabled,
    google: project.targets.google.enabled,
    web: project.targets.web.enabled,
  };
  const neededBy = targetsNeeding(section, enabled).map((target) => en.targets[target]);
  const content = en.empty.content[section];
  return (
    <EmptyState
      title={content.title}
      neededBy={neededBy}
      actions={
        neededBy.length === 0 || section === 'store-texts' ? (
          <a href={sectionHref('project')} className="btn btn-primary min-h-11">
            {en.empty.toProject}
          </a>
        ) : undefined
      }
    >
      <p>{content.body}</p>
    </EmptyState>
  );
}
