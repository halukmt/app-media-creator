import { useEffect, useState } from 'react';

interface Health {
  name: string;
  version: string;
}

/**
 * Placeholder entry screen. The real app shell (sidebar with Project, Logo, Screenshots,
 * Video, Store texts, Export) is built in milestone M1.
 */
export function App() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => (response.ok ? (response.json() as Promise<Health>) : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <main className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-sm max-w-md w-full">
        <div className="card-body">
          <h1 className="card-title text-2xl">app-media-creator</h1>
          <p>Store and web media from your logo, screenshots and video.</p>
          <p className="text-sm text-base-content/70" data-testid="server-status">
            {health ? `Server ${health.version} connected` : 'Connecting to server…'}
          </p>
        </div>
      </div>
    </main>
  );
}
