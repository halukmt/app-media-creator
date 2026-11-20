import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { EXPO_SPECS } from '../specs/expo.js';
import { readProject, type Workspace } from '../workspace/workspace.js';
import { ADAPTIVE_LOGO_SHARE, MONOCHROME_COLOR } from './android-icons.js';
import { clampLogoScale, renderIosAppearances } from './app-store-icons.js';
import { GeneratorError, loadNewestLogo } from './logo.js';
import { assertValidOutputs, squareSize } from './outputs.js';
import { isHexColor, rasterizeLogo, renderLogoSquare, renderSilhouette, type HexColor } from './render.js';

export interface ExpoIconOptions {
  /** Background of the light icons and the adaptive icon's backgroundColor. Default white. */
  background?: HexColor;
  /** Share of the light icon canvas the logo box takes, 0.4 to 0.8 (clamped). Default 0.7. */
  logoScale?: number;
}

/** Where the fragments expect the files: copy the `expo` folders of both stores into `assets/expo/` of the project. */
const ASSETS = './assets/expo';
/** Every Expo entry: a run replaces them all, so the files of a store turned off since go too. */
const ALL_EXPO_SPECS = EXPO_SPECS.map((spec) => spec.id);

/** The `ios.icon` object of `app.json`. */
export function iosConfig(): string {
  return `${JSON.stringify({ expo: { ios: { icon: { light: `${ASSETS}/icon.png`, dark: `${ASSETS}/icon-dark.png`, tinted: `${ASSETS}/icon-tinted.png` } } } }, null, 2)}\n`;
}

/** `android.icon` (legacy launchers) and the `android.adaptiveIcon` object; `backgroundColor` is the logo background. */
export function androidConfig(background: HexColor): string {
  const adaptiveIcon = { foregroundImage: `${ASSETS}/adaptive-foreground.png`, monochromeImage: `${ASSETS}/adaptive-monochrome.png`, backgroundColor: background };
  return `${JSON.stringify({ expo: { android: { icon: `${ASSETS}/android-icon.png`, adaptiveIcon } } }, null, 2)}\n`;
}

/**
 * Generates the icons of an Expo / React Native project (#42) from the newest logo: for the App Store the iOS icon with
 * its dark and tinted appearances, for Google Play the legacy icon and the adaptive foreground and monochrome layers,
 * each store with its `app.json` fragment. Only the stores turned on in Project are written; earlier Expo files are
 * replaced, also those of a store turned off since. Expo builds the native sizes itself; environments (icon variants)
 * are not part of this pack.
 */
export async function generateExpoIcons(workspace: Workspace, options: ExpoIconOptions = {}): Promise<OutputEntry[]> {
  if (options.background !== undefined && !isHexColor(options.background)) {
    throw new GeneratorError('background must be a colour like #1a2b3c');
  }
  const background = options.background ?? '#ffffff';
  const scale = clampLogoScale(options.logoScale);
  const { targets } = await readProject(workspace);
  if (!targets.apple.enabled && !targets.google.enabled) throw new GeneratorError('Turn on the App Store or Google Play in Project to make Expo icons');
  const logo = await loadNewestLogo(workspace);

  const files: RegisterOptions[] = [];
  if (targets.apple.enabled) {
    const size = squareSize('apple.expo.icon');
    // The same renders as the App Store pack, from the logo itself (an SVG stays sharp).
    const { light, dark, tinted } = await renderIosAppearances(logo, size, Math.round(size * scale), background);
    files.push(
      { specId: 'apple.expo.icon', name: 'icon', extension: 'png', order: 1, bytes: light },
      { specId: 'apple.expo.icon-dark', name: 'icon-dark', extension: 'png', order: 1, bytes: dark },
      { specId: 'apple.expo.icon-tinted', name: 'icon-tinted', extension: 'png', order: 1, bytes: tinted },
      { specId: 'apple.expo.config', name: 'app.ios', extension: 'json', order: 1, bytes: new TextEncoder().encode(iosConfig()) },
    );
  }
  if (targets.google.enabled) {
    const size = squareSize('google.expo.adaptive-foreground');
    const raster = await rasterizeLogo(logo, size);
    // The logo stays inside the 66 dp safe circle of the 108 dp layer, like the native adaptive foreground.
    const logoBox = Math.floor(size * ADAPTIVE_LOGO_SHARE);
    const iconSize = squareSize('google.expo.icon');
    const [icon, foreground, monochrome] = await Promise.all([
      renderLogoSquare(raster, { size: iconSize, logoBox: Math.round(iconSize * scale), background }),
      renderLogoSquare(raster, { size, logoBox }),
      renderSilhouette(raster, { size: squareSize('google.expo.adaptive-monochrome'), logoBox, color: MONOCHROME_COLOR }),
    ]);
    files.push(
      { specId: 'google.expo.icon', name: 'android-icon', extension: 'png', order: 1, bytes: icon },
      { specId: 'google.expo.adaptive-foreground', name: 'adaptive-foreground', extension: 'png', order: 1, bytes: foreground },
      { specId: 'google.expo.adaptive-monochrome', name: 'adaptive-monochrome', extension: 'png', order: 1, bytes: monochrome },
      { specId: 'google.expo.config', name: 'app.android', extension: 'json', order: 1, bytes: new TextEncoder().encode(androidConfig(background)) },
    );
  }
  await assertValidOutputs(files);
  return registerOutputs(workspace, files, { replaceSets: { specIds: ALL_EXPO_SPECS, locales: [undefined] } });
}
