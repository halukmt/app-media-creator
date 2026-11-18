import sharp from 'sharp';
import type { Background } from '../../src/core/screenshots/index.js';

/** Card texts per locale: long German compounds and Turkish characters (ç ğ ı İ ş ü). */
export const CARD_TEXTS = {
  'de-DE': { headline: 'Faire Mannschaften in Sekunden', subline: 'Mannschaftsaufstellung ohne Diskussion' },
  'tr-TR': { headline: 'İstanbul’da şampiyonluğa giden yol', subline: 'Çağrı, Gülşen ve Işıl için ücretsiz' },
} as const;

export type CardLocale = keyof typeof CARD_TEXTS;

/** A dark blue gradient background, like the store cards of the prototype. */
export function gradientBackground(): Background {
  return { kind: 'gradient', from: '#003a72', to: '#0079dd', angle: 160 };
}

/** A fake app screenshot at the iPhone 6.3" size: a blue app bar and two grey list rows on white. */
export async function appScreenshot(width = 1179, height = 2556): Promise<Uint8Array> {
  const row = (top: number) => ({
    input: { create: { width: Math.round(width * 0.85), height: Math.round(height * 0.08), channels: 3 as const, background: '#dde4f0' } },
    left: Math.round(width * 0.075),
    top: Math.round(height * top),
  });
  return Uint8Array.from(
    await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
      .composite([
        { input: { create: { width, height: Math.round(height * 0.12), channels: 3, background: '#2255aa' } }, left: 0, top: 0 },
        row(0.16),
        row(0.28),
      ])
      .png()
      .toBuffer(),
  );
}
