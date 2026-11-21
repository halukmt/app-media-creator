import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { saveInput, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { appScreenshot } from './screenshots.js';
import { projectInputFactory, workspaceFactory } from './workspace.js';

/**
 * A German and Turkish project for promo video jobs with one German screenshot. `google` and `web` turn the targets
 * off; `screenshot: false` leaves the uploads empty; `forbidden` adds a forbidden claim.
 */
export async function promoWorkspace(options: { google?: boolean; web?: boolean; screenshot?: boolean; forbidden?: string } = {}): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const defaults = projectInputFactory().targets as Record<string, { enabled: boolean; devices: string[] }>;
  const saved = await saveProject(
    workspace,
    projectInputFactory({
      sourceLocale: 'de-DE',
      locales: ['de-DE', 'tr-TR'],
      claims: { allowed: [], forbidden: options.forbidden ? [options.forbidden] : [] },
      targets: {
        ...defaults,
        google: { ...defaults.google, enabled: options.google ?? true },
        web: { ...defaults.web, enabled: options.web ?? true },
      },
    }),
  );
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  if (options.screenshot ?? true) {
    await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: 'teams.png', bytes: await appScreenshot(118, 256) });
  }
  return workspace;
}

/** Saves a rendered promo video into a job folder as the skill does: `videos/<locale>/<file>`. */
export function writePromoVideo(folder: string, locale: string, file: string, bytes: Uint8Array): string {
  const dir = path.join(folder, 'videos', locale);
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  writeFileSync(target, bytes);
  return target;
}
