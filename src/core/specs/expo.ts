import type { SpecEntry } from './types.js';

/**
 * Icons for Expo / React Native projects (#42). Expo reads them from `app.json` (`ios.icon` with light / dark / tinted,
 * `android.icon` and `android.adaptiveIcon`) and builds the native sizes itself. The files go into one `expo` folder
 * per store, next to an `app.json` fragment for that store. Sources checked 2026-11-20.
 */

const EXPO_ICONS = 'https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/';
const EXPO_CONFIG = 'https://docs.expo.dev/versions/latest/config/app/';
// Expo states no rules for these; the rules they follow come from the platforms.
const APPLE_ICONS = 'https://developer.apple.com/design/human-interface-guidelines/app-icons';
const ANDROID_ADAPTIVE = 'https://developer.android.com/develop/ui/views/launch/icon_design_adaptive';
const FOLDER = 'expo';
const SIZE = { kind: 'fixed', sizes: [{ width: 1024, height: 1024 }], rotatable: false } as const;
const CONDITION = 'For Expo and React Native projects that configure icons in app.json.';

function image(id: string, target: 'apple' | 'google', name: string, alpha: SpecEntry['alpha'], source: { verified: boolean; url: string }, notes: string): SpecEntry {
  return {
    id,
    target,
    group: 'icon',
    folder: FOLDER,
    name,
    kind: 'image',
    required: false,
    condition: CONDITION,
    dimensions: SIZE,
    formats: ['png'],
    alpha,
    localized: false,
    verified: source.verified,
    sourceUrl: source.url,
    notes,
  };
}

function config(id: string, target: 'apple' | 'google', name: string, notes: string): SpecEntry {
  return {
    id,
    target,
    group: 'icon',
    folder: FOLDER,
    name,
    kind: 'document',
    required: false,
    condition: CONDITION,
    dimensions: { kind: 'none' },
    formats: ['json'],
    alpha: 'allowed',
    localized: false,
    verified: true,
    sourceUrl: EXPO_CONFIG,
    notes,
  };
}

const FROM_EXPO = { verified: true, url: EXPO_ICONS };

export const EXPO_SPECS: readonly SpecEntry[] = [
  image('apple.expo.icon', 'apple', 'Expo iOS icon (ios.icon light)', 'forbidden', FROM_EXPO, 'Expo: 1024 × 1024 PNG, exactly square, filling the whole square without transparent pixels; the system applies the mask.'),
  image('apple.expo.icon-dark', 'apple', 'Expo iOS icon, dark (ios.icon dark)', 'allowed', { verified: false, url: APPLE_ICONS }, 'Expo states no own rule; follows Apple: the logo on a transparent background, same size as the light icon.'),
  image('apple.expo.icon-tinted', 'apple', 'Expo iOS icon, tinted (ios.icon tinted)', 'allowed', { verified: false, url: APPLE_ICONS }, 'Expo states no own rule; follows Apple: the logo in grey tones on a transparent background.'),
  config('apple.expo.config', 'apple', 'Expo app.json fragment for iOS', 'The ios.icon object (light, dark, tinted) pointing to the files of this folder.'),
  image('google.expo.icon', 'google', 'Expo Android icon (android.icon)', 'allowed', FROM_EXPO, 'Expo: 1024 × 1024 PNG; the legacy launcher icon for Android versions without adaptive icons.'),
  image(
    'google.expo.adaptive-foreground',
    'google',
    'Expo adaptive icon foreground (android.adaptiveIcon.foregroundImage)',
    'allowed',
    { verified: false, url: ANDROID_ADAPTIVE },
    'Expo gives no pixel size; 1024 × 1024 with the logo inside the 66 dp safe circle of the 108 dp layer, like the native foreground.',
  ),
  image(
    'google.expo.adaptive-monochrome',
    'google',
    'Expo adaptive icon monochrome (android.adaptiveIcon.monochromeImage)',
    'allowed',
    { verified: false, url: ANDROID_ADAPTIVE },
    'Android 13+ themed icon; Expo gives no pixel size. One colour on transparency, same layout as the foreground.',
  ),
  config('google.expo.config', 'google', 'Expo app.json fragment for Android', 'android.icon and the android.adaptiveIcon object: foregroundImage, monochromeImage and the backgroundColor.'),
];

/** The ids of the Expo entries: one logo pack of their own, independent of folder or order. */
export const EXPO_SPEC_IDS: ReadonlySet<string> = new Set(EXPO_SPECS.map((spec) => spec.id));
