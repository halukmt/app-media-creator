Issue: #42

# Proposal

## Why

Expo / React Native projects configure icons in `app.json` instead of native resource folders and build every
native size from one 1024 × 1024 image. The App Store and Google Play packs write native folders (asset catalog,
mipmaps), so Expo users had to pick files by hand.

## What Changes

- Catalogue `src/core/specs/expo.ts`: `apple.expo.icon` (1024, opaque, verified by the Expo docs), `apple.expo.icon-dark`
  and `apple.expo.icon-tinted` (1024, unverified: Expo states no rule, Apple's apply), `google.expo.adaptive-foreground`
  and `google.expo.adaptive-monochrome` (1024, unverified: Expo gives no size), and one `app.json` fragment per store
  (`apple.expo.config`, `google.expo.config`); folder `expo` per store.
- Generator `generateExpoIcons`: the iOS icon with its dark and tinted appearances, the adaptive foreground (logo
  inside the 66 dp safe circle) and monochrome layers, the fragments with `ios.icon` (light / dark / tinted) and
  `android.adaptiveIcon` (foregroundImage, monochromeImage, backgroundColor); only the stores turned on in Project.
- Logo pack `expo` (not chosen by default), offered while the App Store or Google Play is on; `packOf` maps the `expo`
  folder to it. Docs `docs/expo-icons.md`, README.

Acceptance criteria from the issue:
- 1024 × 1024 source images: iOS icon (+ dark and tinted), Android adaptive foreground, monochrome and background colour.
- Snippet for `app.json` (`ios.icon` with light / dark / tinted, `android.adaptiveIcon` with foregroundImage,
  monochromeImage, backgroundColor).
- Sizes and keys verified against the current Expo documentation (marked unverified otherwise).
- Spec validation and tests.

Targets: App Store, Google Play. Locales: shared by all locales.

## Capabilities

### New Capabilities
- `expo-icons`: icons and `app.json` fragments for Expo projects.

### Modified Capabilities
- (none; the Logo section's pack list is data)

## Impact

- New: `src/core/specs/expo.ts`, `src/core/generators/expo-icons.ts`, `docs/expo-icons.md`, `tests/unit/expo-icons.test.ts`.
- Changed: `src/core/specs/catalogue.ts`, `src/core/workspace/logo-settings.ts`, `src/core/generators/logo-packs.ts`,
  `src/web/{api.ts,i18n/en.ts,pages/LogoPage.tsx}`, README.
