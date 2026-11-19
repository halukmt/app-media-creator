import sharp from 'sharp';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { ANDROID_DENSITIES } from '../specs/index.js';
import { readProject, type Workspace } from '../workspace/workspace.js';
import { clampLogoScale } from './app-store-icons.js';
import { ICON_SAFE_RADIUS, variantRenderer } from './environments.js';
import { GeneratorError, loadNewestLogo } from './logo.js';
import { assertValidOutputs, fixedSizes, squareSize } from './outputs.js';
import { isHexColor, rasterizeLogo, renderLogoSquare, renderSilhouette, type HexColor } from './render.js';

export interface AndroidIconOptions {
  /** Background of the Play icon, the adaptive background layer and the legacy icon. Default white. */
  background?: HexColor;
  /** Share of the Play icon and legacy icon canvas the logo box takes, 0.4 to 0.8 (clamped). Default 0.7. */
  logoScale?: number;
}

/**
 * Logo box of the adaptive foreground and monochrome layers. The safe zone is a circle of 66 dp in the 108 dp layer;
 * a square box with a diagonal of 66 dp (66 / √2 ≈ 46.7 dp) keeps even the corners of a square logo inside it.
 */
export const ADAPTIVE_LOGO_SHARE = 66 / Math.SQRT2 / 108;
/** Radius of that 66 dp safe circle as a share of the layer, for the environment label. */
const ADAPTIVE_SAFE_RADIUS = 33 / 108;
/** Largest box any Android render needs (the Play icon); the logo is rasterized once at this size. */
const RASTER_BOX = 512;
/** Monochrome layers are tinted by the system; only their coverage counts. */
const MONOCHROME_COLOR: HexColor = '#ffffff';

const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;

/** One size per density, in the order of ANDROID_DENSITIES. */
function sizesPerDensity(specId: string): number[] {
  const sizes = fixedSizes(specId).map((size) => size.width);
  if (sizes.length !== ANDROID_DENSITIES.length) throw new Error(`${specId} needs one size per Android density`);
  return sizes;
}

/**
 * Generates the Google Play icon and the Android launcher resources (adaptive layers per density, legacy icons and
 * ic_launcher.xml) from the newest uploaded logo, plus the launcher resources per non-production environment
 * (google/<environment>/android-res/...; the Play icon is a store asset and has no variants). All files are rendered
 * and validated, then registered as one batch.
 * Throws GeneratorError for a missing or unreadable logo or an invalid colour.
 */
export async function generateAndroidIcons(workspace: Workspace, options: AndroidIconOptions = {}): Promise<OutputEntry[]> {
  if (options.background !== undefined && !isHexColor(options.background)) {
    throw new GeneratorError('background must be a colour like #1a2b3c');
  }
  const background = options.background ?? '#ffffff';
  const scale = clampLogoScale(options.logoScale);
  const logo = await rasterizeLogo(await loadNewestLogo(workspace), RASTER_BOX);

  const playSize = squareSize('google.icon');
  // Play asks for a 32-bit PNG: keep an alpha channel, fully opaque.
  const playIcon = await sharp(await renderLogoSquare(logo, { size: playSize, logoBox: Math.round(playSize * scale), background }))
    .ensureAlpha()
    .png()
    .toBuffer();

  const files: RegisterOptions[] = [{ specId: 'google.icon', name: 'play-icon', extension: 'png', order: 1, bytes: playIcon }];

  const foreground = sizesPerDensity('google.adaptive-icon.foreground');
  const backgroundSizes = sizesPerDensity('google.adaptive-icon.background');
  const monochrome = sizesPerDensity('google.adaptive-icon.monochrome');
  const legacy = sizesPerDensity('google.launcher-icon');

  const perDensity = await Promise.all(
    ANDROID_DENSITIES.map(async (density, index) => {
      const subfolder = `mipmap-${density}`;
      const order = index + 1;
      const fg = foreground[index]!;
      const mono = monochrome[index]!;
      const bgSize = backgroundSizes[index]!;
      const legacySize = legacy[index]!;
      const [fgBytes, bgBytes, monoBytes, legacyBytes] = await Promise.all([
        renderLogoSquare(logo, { size: fg, logoBox: Math.floor(fg * ADAPTIVE_LOGO_SHARE) }),
        sharp({ create: { width: bgSize, height: bgSize, channels: 3, background } }).png().toBuffer(),
        renderSilhouette(logo, { size: mono, logoBox: Math.floor(mono * ADAPTIVE_LOGO_SHARE), color: MONOCHROME_COLOR }),
        renderLogoSquare(logo, { size: legacySize, logoBox: Math.round(legacySize * scale), background }),
      ]);
      return [
        { specId: 'google.adaptive-icon.foreground', subfolder, name: 'ic_launcher_foreground', extension: 'png', order, bytes: fgBytes },
        { specId: 'google.adaptive-icon.background', subfolder, name: 'ic_launcher_background', extension: 'png', order, bytes: bgBytes },
        { specId: 'google.adaptive-icon.monochrome', subfolder, name: 'ic_launcher_monochrome', extension: 'png', order, bytes: monoBytes },
        { specId: 'google.launcher-icon', subfolder, name: 'ic_launcher', extension: 'png', order, bytes: legacyBytes },
      ] satisfies RegisterOptions[];
    }),
  );
  files.push(...perDensity.flat());
  files.push({
    specId: 'google.adaptive-icon.xml',
    subfolder: 'mipmap-anydpi-v26',
    name: 'ic_launcher',
    extension: 'xml',
    order: 1,
    bytes: Buffer.from(ADAPTIVE_XML, 'utf8'),
  });

  const { environments } = await readProject(workspace);
  for (const environment of environments) {
    const variant = variantRenderer(logo, environment);
    const perDensityVariant = await Promise.all(
      ANDROID_DENSITIES.map(async (density, index) => {
        const subfolder = `mipmap-${density}`;
        const order = index + 1;
        const fg = foreground[index]!;
        const bgSize = backgroundSizes[index]!;
        const legacySize = legacy[index]!;
        const [fgBytes, bgBytes, legacyBytes] = await Promise.all([
          variant.transparent(fg, Math.floor(fg * ADAPTIVE_LOGO_SHARE), ADAPTIVE_SAFE_RADIUS),
          variant.backgroundLayer(bgSize, background),
          variant.opaque(legacySize, Math.round(legacySize * scale), background, ICON_SAFE_RADIUS),
        ]);
        // The themed (monochrome) icon is one colour by definition; it stays the production silhouette.
        const mono = files.find((f) => f.specId === 'google.adaptive-icon.monochrome' && f.subfolder === subfolder)?.bytes;
        if (!mono) throw new Error(`The production monochrome layer for ${subfolder} is missing`);
        const common = { environment: environment.id, subfolder, extension: 'png', order };
        return [
          { ...common, specId: 'google.adaptive-icon.foreground', name: 'ic_launcher_foreground', bytes: fgBytes },
          { ...common, specId: 'google.adaptive-icon.background', name: 'ic_launcher_background', bytes: bgBytes },
          { ...common, specId: 'google.adaptive-icon.monochrome', name: 'ic_launcher_monochrome', bytes: mono },
          { ...common, specId: 'google.launcher-icon', name: 'ic_launcher', bytes: legacyBytes },
        ] satisfies RegisterOptions[];
      }),
    );
    files.push(...perDensityVariant.flat(), {
      specId: 'google.adaptive-icon.xml',
      environment: environment.id,
      subfolder: 'mipmap-anydpi-v26',
      name: 'ic_launcher',
      extension: 'xml',
      order: 1,
      bytes: Buffer.from(ADAPTIVE_XML, 'utf8'),
    });
  }

  await assertValidOutputs(files);
  // A full set per run: files of environments that were removed from the project go away.
  return registerOutputs(workspace, files, { replaceSets: { specIds: [...new Set(files.map((f) => f.specId))], locales: [undefined] } });
}
