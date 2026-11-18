import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The web UI lives in src/web and is built into dist/web, which the local server serves.
// In development, API calls are proxied to the server started by `npm run dev:server`.
const serverPort = Number(process.env.AMC_PORT ?? 4790);

export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': `http://127.0.0.1:${serverPort}`,
    },
  },
});
