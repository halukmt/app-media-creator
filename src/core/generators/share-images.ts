import sharp, { type Sharp } from 'sharp';
import { outputPath, registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { isLocaleId, resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { cardFont, cardSizeForSpec, textBlockSvg, textColorFor, type CardWarning } from '../screenshots/index.js';
import { getSpec, listSpecs, type Rect, type SpecEntry } from '../specs/index.js';
import { readProject, type Workspace } from '../workspace/index.js';
import { GeneratorError, loadNewestLogo } from './logo.js';
import { assertValidOutputs, fixedSizes } from './outputs.js';
import { isHexColor, rasterizeLogo, renderLogoSquare, renderSilhouette, type HexColor, type LogoSource } from './render.js';

export interface ShareImageOptions {
  /**
   * Background of share, profile and banner images; default white. (A logo colour as default would hide the logo
   * parts in that colour; the Logo section offers the palette as a choice.)
   */
  background?: HexColor;
  /** Optional tagline per locale, shown under the app name on the share images. */
  taglines?: Partial<Record<string, string>>;
  /** Languages of the share images: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
}

export interface ShareWarning extends CardWarning {
  path: string;
}

export interface ShareImageResult {
  entries: OutputEntry[];
  warnings: ShareWarning[];
}

const MAX_TAGLINE = 120;
/** Logo share of a profile picture, small enough for the circle crop of Instagram, WhatsApp and others. */
const PROFILE_LOGO_SHARE = 0.6;
const SHARE_SPECS = ['web.og-image', 'web.x-card', 'web.whatsapp-preview'] as const;
const LOGO_VARIANTS = { monochrome: '#000000', inverse: '#ffffff' } as const;

interface Layer {
  png: Buffer;
  left: number;
  top: number;
}

/** Background (or transparency), logo layers and an SVG text layer, flattened to one image. */
async function compose(width: number, height: number, background: HexColor | null, layers: Layer[], textSvg: string): Promise<Sharp> {
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${textSvg}</svg>`);
  return sharp({ create: { width, height, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    ...layers.map((layer) => ({ input: layer.png, left: Math.round(layer.left), top: Math.round(layer.top) })),
    { input: text, left: 0, top: 0 },
  ]);
}

/** The logo fitted into a square box on transparency; cached per box size for the whole run. */
function logoCache(logo: LogoSource): (box: number) => Promise<Buffer> {
  const cache = new Map<number, Promise<Buffer>>();
  return (box) => {
    const side = Math.round(box);
    let png = cache.get(side);
    if (!png) {
      png = renderLogoSquare(logo, { size: side, logoBox: side });
      cache.set(side, png);
    }
    return png;
  };
}

type LogoAt = (box: number) => Promise<Buffer>;

/** Logo on the left, app name and tagline on the right: Open Graph, X card and the WhatsApp preview. */
async function shareImage(logoAt: LogoAt, width: number, height: number, background: HexColor, name: string, tagline: string | undefined) {
  const pad = width * 0.07;
  const box = height * 0.42;
  const textX = pad + box + width * 0.05;
  const text = textBlockSvg({
    x: textX,
    y: height * 0.12,
    width: width - textX - pad,
    height: height * 0.76,
    title: name,
    ...(tagline ? { subtitle: tagline } : {}),
    titleSize: height * 0.12,
    subtitleSize: height * 0.065,
    color: textColorFor({ kind: 'solid', color: background }),
    align: 'left',
    valign: 'middle',
  });
  const image = await compose(width, height, background, [{ png: await logoAt(box), left: pad, top: (height - box) / 2 }], text.svg);
  return { image, warnings: text.warnings };
}

/** Logo and app name centred in the safe area (or the whole image) of a banner. */
async function bannerImage(logoAt: LogoAt, spec: SpecEntry, width: number, height: number, background: HexColor, name: string) {
  const area: Rect = spec.safeArea ?? { x: 0, y: 0, width, height };
  const box = area.height * 0.55;
  const gap = area.height * 0.15;
  const titleSize = area.height * 0.24;
  // Measured with the title font, so logo and name are centred as one group; long names shrink to fit.
  const textWidth = Math.max(1, Math.min(area.width - box - gap - area.width * 0.1, cardFont(800).measure(name.normalize('NFC').trim(), titleSize) * 1.02));
  const start = area.x + (area.width - (box + gap + textWidth)) / 2;
  const text = textBlockSvg({
    x: start + box + gap,
    y: area.y + area.height * 0.1,
    width: textWidth,
    height: area.height * 0.8,
    title: name,
    titleSize,
    subtitleSize: titleSize / 2,
    color: textColorFor({ kind: 'solid', color: background }),
    align: 'left',
    valign: 'middle',
  });
  const image = await compose(width, height, background, [{ png: await logoAt(box), left: start, top: area.y + (area.height - box) / 2 }], text.svg);
  return { image, warnings: text.warnings };
}

/** Email signature: logo and name on white, so it stays readable in dark-mode mail clients too. */
async function signatureImage(logoAt: LogoAt, width: number, height: number, name: string) {
  const box = height * 0.8;
  const pad = height * 0.1;
  const text = textBlockSvg({
    x: pad * 2 + box,
    y: pad,
    width: width - box - pad * 3,
    height: height - pad * 2,
    title: name,
    titleSize: height * 0.32,
    subtitleSize: height * 0.16,
    color: '#0a0a0a',
    align: 'left',
    valign: 'middle',
  });
  const image = await compose(width, height, '#ffffff', [{ png: await logoAt(box), left: pad, top: pad }], text.svg);
  return { image, warnings: text.warnings };
}

/** JPEG below `maxBytes`: quality steps down until the file fits. */
async function jpegWithin(image: Sharp, maxBytes: number, label: string): Promise<Buffer> {
  const flat = await image.flatten({ background: '#ffffff' }).png().toBuffer();
  for (let quality = 88; quality >= 40; quality -= 8) {
    const jpeg = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= maxBytes) return jpeg;
  }
  throw new GeneratorError(`${label} stays above ${Math.round(maxBytes / 1024)} KB even at low quality`);
}

function checkTaglines(taglines: ShareImageOptions['taglines'], projectLocales: readonly LocaleId[]): Partial<Record<LocaleId, string>> {
  if (taglines === undefined) return {};
  if (typeof taglines !== 'object' || taglines === null) throw new GeneratorError('taglines must be an object of locale → text');
  const result: Partial<Record<LocaleId, string>> = {};
  for (const [locale, text] of Object.entries(taglines)) {
    if (!isLocaleId(locale)) throw new GeneratorError(`taglines: ${locale} is not a supported locale`);
    if (!projectLocales.includes(locale)) throw new GeneratorError(`taglines: ${locale} is not a language of this project`);
    if (typeof text !== 'string' || text.length > MAX_TAGLINE) throw new GeneratorError(`taglines.${locale} must be text up to ${MAX_TAGLINE} characters`);
    if (text.trim()) result[locale] = text.trim();
  }
  return result;
}

/**
 * Generates the share and social images from the newest logo: per locale the Open Graph image, the X card and the
 * WhatsApp preview (name + optional tagline); once for all locales the profile pictures, banners, the email signature
 * logo and the logo variants (monochrome, inverse, square mark). Sizes come from the catalogue; many social sizes are
 * unverified there, which the export checklist reports.
 */
export async function generateShareImages(workspace: Workspace, options: ShareImageOptions = {}): Promise<ShareImageResult> {
  if (options.background !== undefined && !isHexColor(options.background)) throw new GeneratorError('background must be a colour like #1a2b3c');
  const project = await readProject(workspace);
  const taglines = checkTaglines(options.taglines, project.locales);
  let locales: LocaleId[];
  try {
    locales = options.locales === undefined ? project.locales : resolveLocales(options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }

  const source = await loadNewestLogo(workspace);
  const logo = await rasterizeLogo(source, 2048);
  const logoAt = logoCache(logo);
  const background: HexColor = options.background ?? '#ffffff';
  const files: RegisterOptions[] = [];
  const warnings: ShareWarning[] = [];
  const add = (file: RegisterOptions, found: CardWarning[] = []) => {
    files.push(file);
    const filePath = outputPath(getSpec(file.specId), file);
    for (const warning of found) warnings.push({ ...warning, path: filePath });
  };

  // Share images per locale. Locales without a tagline look the same, so each distinct image is rendered once.
  const rendered = new Map<string, { bytes: Buffer; warnings: CardWarning[] }>();
  for (const locale of locales) {
    const tagline = taglines[locale];
    for (const specId of SHARE_SPECS) {
      const spec = getSpec(specId);
      const size = cardSizeForSpec(spec);
      // A byte limit the PNG would break means JPEG (WhatsApp preview); otherwise PNG.
      const jpeg = spec.maxBytes !== undefined && spec.maxBytes < 1024 * 1024 && spec.formats.includes('jpeg');
      const key = JSON.stringify([specId, tagline ?? '']);
      let image = rendered.get(key);
      if (!image) {
        const share = await shareImage(logoAt, size.width, size.height, background, project.name, tagline);
        const bytes = jpeg ? await jpegWithin(share.image, spec.maxBytes!, spec.name) : await share.image.flatten({ background }).png().toBuffer();
        image = { bytes, warnings: share.warnings };
        rendered.set(key, image);
      }
      add({ specId, locale, order: 1, name: specId.replace('web.', ''), extension: jpeg ? 'jpg' : 'png', bytes: image.bytes }, image.warnings);
    }
  }

  // Profile pictures, banners and the email signature, shared by all locales.
  for (const spec of listSpecs({ target: 'web', group: 'social' })) {
    const [size] = fixedSizes(spec.id);
    if (!size) continue;
    const name = spec.id.replace('web.social.', '');
    if (spec.id === 'web.social.email-signature-logo') {
      const { image, warnings: found } = await signatureImage(logoAt, size.width, size.height, project.name);
      add({ specId: spec.id, order: 1, name, extension: 'png', bytes: await image.flatten({ background: '#ffffff' }).png().toBuffer() }, found);
    } else if (size.width === size.height) {
      const box = Math.round(size.width * PROFILE_LOGO_SHARE);
      add({ specId: spec.id, order: 1, name, extension: 'png', bytes: await renderLogoSquare(logo, { size: size.width, logoBox: box, background }) });
    } else {
      const { image, warnings: found } = await bannerImage(logoAt, spec, size.width, size.height, background, project.name);
      add({ specId: spec.id, order: 1, name, extension: 'png', bytes: await image.flatten({ background }).png().toBuffer() }, found);
    }
  }

  // Logo variants.
  const variant = cardSizeForSpec(getSpec('web.logo.mark'));
  for (const [kind, color] of Object.entries(LOGO_VARIANTS)) {
    add({ specId: `web.logo.${kind}`, order: 1, name: `logo-${kind}`, extension: 'png', bytes: await renderSilhouette(logo, { size: variant.width, logoBox: Math.round(variant.width * 0.9), color }) });
  }
  add({ specId: 'web.logo.mark', order: 1, name: 'logo-mark', extension: 'png', bytes: await renderLogoSquare(logo, { size: variant.width, logoBox: Math.round(variant.width * 0.8) }) });

  try {
    await assertValidOutputs(files);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }
  return { entries: await registerOutputs(workspace, files), warnings };
}
