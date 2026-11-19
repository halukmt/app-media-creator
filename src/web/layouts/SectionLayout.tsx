import type { ReactNode } from 'react';
import type { CatalogueLocale } from '../api';
import { LocaleSelector } from '../components/LocaleSelector';
import { PageHeader } from '../components/PageHeader';
import { StepsBar, type Step } from '../components/StepsBar';
import { en } from '../i18n/en';
import type { SectionId } from '../lib/sections';

interface Props {
  section: SectionId;
  focusHeading: boolean;
  /** Locale bar (L3) of a localized section: the project's locales and the shared selection. */
  localeBar?: {
    options: readonly CatalogueLocale[];
    selection: readonly string[];
    onChange: (next: string[]) => void;
  };
  /** L2 step flow of the section (rendered between heading and locale bar). */
  steps?: { items: readonly Step[]; current: string; onSelect: (id: string) => void; unavailableHint?: string };
  children: ReactNode;
}

/** Frame of an asset section: heading, the locale bar in its fixed place (L3), then the section content. */
export function SectionLayout({ section, focusHeading, localeBar, steps, children }: Props) {
  return (
    <>
      <PageHeader title={en.sections[section].title} description={en.sections[section].description} focusOnMount={focusHeading} />
      <div className="flex flex-col gap-6">
        {steps ? (
          <StepsBar
            steps={steps.items}
            current={steps.current}
            onSelect={steps.onSelect}
            {...(steps.unavailableHint ? { unavailableHint: steps.unavailableHint } : {})}
          />
        ) : null}
        {localeBar ? (
          <LocaleSelector
            label={en.locales.barLabel}
            mode="multiple"
            options={localeBar.options}
            value={localeBar.selection}
            onChange={localeBar.onChange}
          />
        ) : null}
        {children}
      </div>
    </>
  );
}
