import { useEffect, useState, type ReactNode } from 'react';
import { en } from '../i18n/en';
import { SECTION_IDS, sectionHref, type SectionId } from '../lib/sections';

interface Props {
  current: SectionId;
  /** Short status text in the sidebar footer (server version). */
  status?: string;
  children: ReactNode;
}

const DRAWER_ID = 'app-drawer';

/**
 * L1 shell: sidebar with the sections (always open on large screens), a top bar with a menu button on small
 * screens, and the main area. The drawer checkbox is driven by React state so the menu button is a real button.
 */
export function AppShell({ current, status, children }: Props) {
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating and on Escape.
  useEffect(() => setOpen(false), [current]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <a href="#main" className="btn btn-sm absolute left-2 top-2 z-50 -translate-y-20 focus:translate-y-0" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        {en.app.skipToContent}
      </a>
      <div className="drawer lg:drawer-open">
        <input
          id={DRAWER_ID}
          type="checkbox"
          className="drawer-toggle"
          checked={open}
          onChange={(event) => setOpen(event.target.checked)}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="drawer-content flex min-h-screen min-w-0 flex-col bg-base-200">
          <header className="navbar sticky top-0 z-10 gap-2 bg-base-100 shadow-sm lg:hidden">
            <button
              type="button"
              className="btn btn-square btn-ghost min-h-11 min-w-11"
              aria-label={en.app.openMenu}
              aria-expanded={open}
              aria-controls="app-sidebar"
              onClick={() => setOpen(true)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-lg font-semibold">{en.app.name}</span>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 p-4 focus:outline-none sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
        <div className="drawer-side z-20">
          <button
            type="button"
            className="drawer-overlay"
            aria-label={en.app.closeMenu}
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          />
          <div id="app-sidebar" className="flex min-h-full w-72 flex-col bg-base-100">
            <div className="flex min-h-16 items-center px-6 text-lg font-semibold">{en.app.name}</div>
            <nav aria-label={en.app.navLabel} className="flex-1">
              <ul className="menu w-full gap-1 px-3">
                {SECTION_IDS.map((id) => (
                  <li key={id}>
                    <a
                      href={sectionHref(id)}
                      className={`min-h-11 ${id === current ? 'menu-active' : ''}`}
                      aria-current={id === current ? 'page' : undefined}
                    >
                      {en.sections[id].title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            {status ? (
              <p className="px-6 py-4 text-sm text-base-content/70" data-testid="server-status">
                {status}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
