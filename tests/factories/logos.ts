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

/** A square SVG filled edge to edge, declaring the given canvas size. */
export function squareSvg(side: number, fill = '#0099ff'): Uint8Array {
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" fill="${fill}"/></svg>`,
  );
}
