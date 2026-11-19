import sharp from 'sharp';

/** A transparent 300×300 PNG logo: a large red block (#dd1111) with a smaller blue block (#1133dd) below it. */
export async function twoColourPng(): Promise<Uint8Array> {
  return Uint8Array.from(
    await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: { create: { width: 200, height: 150, channels: 4, background: '#dd1111' } }, left: 50, top: 20 },
        { input: { create: { width: 100, height: 60, channels: 4, background: '#1133dd' } }, left: 100, top: 200 },
      ])
      .png()
      .toBuffer(),
  );
}

/** An opaque JPEG logo: a red block (#dd1111) on a white background, no transparency at all. */
export async function opaqueJpegLogo(): Promise<Uint8Array> {
  return Uint8Array.from(
    await sharp({ create: { width: 300, height: 300, channels: 3, background: '#ffffff' } })
      .composite([{ input: { create: { width: 150, height: 150, channels: 3, background: '#dd1111' } }, left: 75, top: 75 }])
      .jpeg({ quality: 95 })
      .toBuffer(),
  );
}

/** An opaque JPEG logo that is one solid colour (#7c3aed) edge to edge, like a filled square mark. */
export async function oneColourJpeg(): Promise<Uint8Array> {
  return Uint8Array.from(await sharp({ create: { width: 300, height: 300, channels: 3, background: '#7c3aed' } }).jpeg({ quality: 90 }).toBuffer());
}

/** An opaque JPEG mark filled edge to edge with a purple-to-blue diagonal gradient. */
export async function gradientJpeg(): Promise<Uint8Array> {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>';
  return Uint8Array.from(await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer());
}

/** An opaque JPEG line-art logo: a thin dark ring (stroke 2 % of the canvas, about 1 % of its pixels) on white. */
export async function outlineJpeg(): Promise<Uint8Array> {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#ffffff"/>' +
    '<circle cx="500" cy="500" r="80" fill="none" stroke="#111827" stroke-width="20"/></svg>';
  return Uint8Array.from(await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer());
}

/** An opaque, tightly cropped JPEG wordmark: four dark letter bars (#111827) touching the top and bottom edge, on white. */
export async function croppedWordmarkJpeg(): Promise<Uint8Array> {
  const bars = [60, 200, 340, 480].map((left) => ({ input: { create: { width: 50, height: 150, channels: 3 as const, background: '#111827' } }, left, top: 0 }));
  return Uint8Array.from(await sharp({ create: { width: 600, height: 150, channels: 3, background: '#ffffff' } }).composite(bars).jpeg({ quality: 92 }).toBuffer());
}

/** An opaque one-channel greyscale PNG logo: a dark block (grey 30) on white. */
export async function greyscalePng(): Promise<Uint8Array> {
  return Uint8Array.from(
    await sharp({ create: { width: 300, height: 300, channels: 3, background: '#ffffff' } })
      .composite([{ input: { create: { width: 150, height: 150, channels: 3, background: '#1e1e1e' } }, left: 75, top: 75 }])
      .greyscale()
      .toColourspace('b-w')
      .removeAlpha()
      .png()
      .toBuffer(),
  );
}

/** A transparent SVG logo: a green ring with a dark dot inside, nothing in the corners. */
export function transparentSvg(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
      '<circle cx="100" cy="100" r="80" fill="none" stroke="#16a34a" stroke-width="28"/><circle cx="100" cy="100" r="30" fill="#111827"/></svg>',
  );
}

/** A flat PNG logo without transparency: an orange block on a white background. */
export async function flatPng(): Promise<Uint8Array> {
  return Uint8Array.from(
    await sharp({ create: { width: 300, height: 300, channels: 3, background: '#ffffff' } })
      .composite([{ input: { create: { width: 180, height: 120, channels: 3, background: '#ea580c' } }, left: 60, top: 90 }])
      .png()
      .toBuffer(),
  );
}

/** A square SVG filled edge to edge, declaring the given canvas size. */
export function squareSvg(side: number, fill = '#0099ff'): Uint8Array {
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" fill="${fill}"/></svg>`,
  );
}
