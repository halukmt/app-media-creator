import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCatalogue, fetchProject, messagesOf, type Catalogue, type ProjectSettings } from './api';
import { ProgressStatus } from './components/ProgressStatus';
import { StatusAlert } from './components/StatusAlert';
import { en } from './i18n/en';
import { AppShell } from './layouts/AppShell';
import { selectionForProject } from './lib/locale-selection';
import { pendingSaves, type SaveOutcome } from './lib/pending-saves';
import { sectionFromHash, sectionHref, type SectionId } from './lib/sections';
import { ProjectPage } from './pages/ProjectPage';
import { ExportPage } from './pages/ExportPage';
import { LogoPage } from './pages/LogoPage';
import { ScreenshotsPage } from './pages/ScreenshotsPage';
import { SectionPage } from './pages/SectionPage';
import { StoreTextsPage } from './pages/StoreTextsPage';

interface Health {
  version: string;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; messages: string[] }
  | { kind: 'ready'; catalogue: Catalogue; project: ProjectSettings };

function useSection(): [SectionId, boolean] {
  const [section, setSection] = useState<SectionId>(() => sectionFromHash(window.location.hash));
  // True after the first in-app navigation: only then the page heading takes focus.
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setSection(sectionFromHash(window.location.hash));
      setNavigated(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = `${en.sections[section].title} · ${en.app.name}`;
  }, [section]);

  return [section, navigated];
}

interface LostEdit {
  section: SectionId;
  reason: Exclude<SaveOutcome, 'saved'>;
}

/**
 * Sections whose last edit was lost after the user left them: the save failed or was dropped because the data changed
 * elsewhere (#98). The message stays, also in the section opened again, until the user dismisses it or a later save
 * in that section works.
 */
function useLostEdits(): [LostEdit[], (section: SectionId) => void] {
  const [lost, setLost] = useState<LostEdit[]>([]);
  useEffect(
    () =>
      pendingSaves.subscribe((section, outcome) =>
        setLost((current) => {
          const others = current.filter((entry) => entry.section !== section);
          if (outcome === 'saved') return others.length === current.length ? current : others;
          // Two saves of one section can be lost at once (Screenshots: sets and header settings): the failure wins.
          const reason = current.some((entry) => entry.section === section && entry.reason === 'failed') ? 'failed' : outcome;
          return [...others, { section, reason }];
        }),
      ),
    [],
  );
  const dismiss = useCallback((section: SectionId) => setLost((current) => current.filter((entry) => entry.section !== section)), []);
  return [lost, dismiss];
}

export function App() {
  const [section, navigated] = useSection();
  const [lostEdits, dismissLostEdit] = useLostEdits();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [health, setHealth] = useState<Health | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const started = useRef(false);

  const reload = useCallback(() => {
    setLoad({ kind: 'loading' });
    Promise.all([fetchCatalogue(), fetchProject()])
      .then(([catalogue, project]) => {
        setLoad({ kind: 'ready', catalogue, project });
        setSelection((current) => selectionForProject(current, project.locales));
      })
      // Server messages (e.g. which fields of project.json are invalid) are shown; a network error has none.
      .catch((error: unknown) => setLoad({ kind: 'failed', messages: messagesOf(error) }));
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reload();
    fetch('/api/health')
      .then((response) => (response.ok ? (response.json() as Promise<Health>) : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [reload]);

  function onSaved(project: ProjectSettings) {
    setLoad((current) => (current.kind === 'ready' ? { ...current, project } : current));
    setSelection((current) => selectionForProject(current, project.locales));
  }

  return (
    <AppShell current={section} status={health ? en.app.serverConnected(health.version) : undefined}>
      {/* Mounted all the time, so a failure that arrives after a navigation is announced once; focus stays put. */}
      <div role="alert" className={lostEdits.length > 0 ? 'mb-4 flex flex-col gap-2' : undefined}>
        {lostEdits.map(({ section: id, reason }) => {
          const name = en.sections[id].title;
          return (
            <StatusAlert
              key={id}
              announce={false}
              tone={reason === 'dropped' ? 'warning' : 'error'}
              title={reason === 'dropped' ? en.app.editDropped(name) : en.app.editLost(name)}
            >
              <div className="mt-2 flex flex-wrap gap-2">
                {section !== id ? (
                  <a className="btn btn-sm min-h-11" href={sectionHref(id)}>
                    {en.app.openSection(name)}
                  </a>
                ) : null}
                <button type="button" className="btn btn-sm btn-ghost min-h-11" onClick={() => dismissLostEdit(id)}>
                  {en.app.dismiss}
                </button>
              </div>
            </StatusAlert>
          );
        })}
      </div>
      {load.kind === 'loading' ? (
        <div role="status">
          <ProgressStatus label={en.app.loading} />
        </div>
      ) : null}
      {load.kind === 'failed' ? (
        <div className="flex flex-col items-start gap-3">
          <StatusAlert tone="error" title={load.messages.length > 0 ? en.app.loadRejected : en.app.loadFailed}>
            {load.messages.length > 0 ? (
              <ul className="list-disc pl-5">
                {load.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </StatusAlert>
          <button type="button" className="btn min-h-11" onClick={reload}>
            {en.app.retry}
          </button>
        </div>
      ) : null}
      {load.kind === 'ready' ? (
        // Stays mounted while other sections are shown, so unsaved edits survive navigation.
        <div hidden={section !== 'project'}>
          <ProjectPage
            catalogue={load.catalogue}
            project={load.project}
            onSaved={onSaved}
            focusHeading={navigated && section === 'project'}
          />
        </div>
      ) : null}
      {load.kind === 'ready' && section === 'export' ? (
        <ExportPage
          project={load.project}
          locales={load.catalogue.locales}
          selection={selection}
          onSelectionChange={setSelection}
          focusHeading={navigated}
        />
      ) : null}
      {load.kind === 'ready' && section === 'logo' ? (
        <LogoPage
          project={load.project}
          catalogue={load.catalogue}
          selection={selection}
          onSelectionChange={setSelection}
          focusHeading={navigated}
        />
      ) : null}
      {load.kind === 'ready' && section === 'screenshots' ? (
        <ScreenshotsPage
          project={load.project}
          catalogue={load.catalogue}
          selection={selection}
          onSelectionChange={setSelection}
          focusHeading={navigated}
        />
      ) : null}
      {load.kind === 'ready' && section === 'store-texts' ? (
        <StoreTextsPage
          project={load.project}
          catalogue={load.catalogue}
          selection={selection}
          onSelectionChange={setSelection}
          focusHeading={navigated}
        />
      ) : null}
      {load.kind === 'ready' && section !== 'project' && section !== 'export' && section !== 'screenshots' && section !== 'logo' && section !== 'store-texts' ? (
        <SectionPage
          key={section}
          section={section}
          project={load.project}
          locales={load.catalogue.locales}
          selection={selection}
          onSelectionChange={setSelection}
          focusHeading={navigated}
        />
      ) : null}
    </AppShell>
  );
}
