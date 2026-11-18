// Runs all project checks and reports every failure at once. Run: npm run check:all
import { spawnSync } from 'node:child_process';

const CHECKS = [{ name: 'inventory', script: 'scripts/check-inventory.mjs' }];

let failed = 0;
for (const check of CHECKS) {
  const result = spawnSync(process.execPath, [check.script], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`✗ ${check.name}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failed > 0) {
  console.error(`${failed} of ${CHECKS.length} checks failed`);
  process.exit(1);
}
