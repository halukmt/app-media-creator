import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCatalogue, fetchProject, type Catalogue, type ProjectSettings } from './api';
import { StatusAlert } from './components/StatusAlert';
import { en } from './i18n/en';
import { AppShell } from './layouts/AppShell';
import { selectionForProject } from './lib/locale-selection';
import { sectionFromHash, type SectionId } from './lib/sections';
import { ProjectPage } from './pages/ProjectPage';
import { SectionPage } from './pages/SectionPage';

interface Health {
  version: string;
}

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; catalogue: Catalogue; project: ProjectSettings };

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

export function App() {
  const [section, navigated] = useSection();
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
      .catch(() => setLoad({ kind: 'failed' }));
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
      {load.kind === 'loading' ? (
        <p role="status" className="flex items-center gap-3">
          <span className="loading loading-spinner" aria-hidden="true" />
          {en.app.loading}
        </p>
      ) : null}
      {load.kind === 'failed' ? (
        <div className="flex flex-col items-start gap-3">
          <StatusAlert tone="error" title={en.app.loadFailed} />
          <button type="button" className="btn min-h-11" onClick={reload}>
            {en.app.retry}
          </button>
        </div>
      ) : null}
      {load.kind === 'ready' && section === 'project' ? (
        <ProjectPage catalogue={load.catalogue} project={load.project} onSaved={onSaved} focusHeading={navigated} />
      ) : null}
      {load.kind === 'ready' && section !== 'project' ? (
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
