// Starts the API server (tsx watch) and the Vite dev server together; Ctrl+C stops both.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['dev:server', 'dev:web'].map((script) =>
  spawn(npm, ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' }),
);

function stopAll(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

process.on('SIGINT', () => stopAll(0));
for (const child of children) {
  child.on('exit', (code) => {
    if (code) stopAll(code);
  });
}
