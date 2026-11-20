# Expo / React Native icons

Expo projects configure the app icon in `app.json` instead of native resource folders; Expo builds every native size
from one 1024 × 1024 image. The **Expo icons** pack of the Logo section writes exactly those images and the matching
`app.json` lines. It is not chosen by default: tick it under Logo → Options.

## Files

| Store | File | `app.json` key | Notes |
|---|---|---|---|
| App Store | `apple/shared/expo/icon.png` | `ios.icon.light` | 1024 × 1024, opaque, fills the whole square |
| App Store | `apple/shared/expo/icon-dark.png` | `ios.icon.dark` | the logo on transparency (iOS dark appearance) |
| App Store | `apple/shared/expo/icon-tinted.png` | `ios.icon.tinted` | the logo in grey tones on transparency |
| App Store | `apple/shared/expo/app.ios.json` | — | the `ios.icon` object |
| Google Play | `google/shared/expo/android-icon.png` | `android.icon` | 1024 × 1024 legacy icon for launchers without adaptive icons |
| Google Play | `google/shared/expo/adaptive-foreground.png` | `android.adaptiveIcon.foregroundImage` | 1024 × 1024, logo inside the safe circle |
| Google Play | `google/shared/expo/adaptive-monochrome.png` | `android.adaptiveIcon.monochromeImage` | themed icon (Android 13+) |
| Google Play | `google/shared/expo/app.android.json` | — | `android.icon` and the `android.adaptiveIcon` object with `backgroundColor` |

Only the stores turned on in Project are written; the files of a store turned off since are removed.

## Use them

1. Copy the files of both `expo` folders into `assets/expo/` of your Expo project.
2. Merge the two fragments into your `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "ios": {
      "icon": { "light": "./assets/expo/icon.png", "dark": "./assets/expo/icon-dark.png", "tinted": "./assets/expo/icon-tinted.png" }
    },
    "android": {
      "icon": "./assets/expo/android-icon.png",
      "adaptiveIcon": {
        "foregroundImage": "./assets/expo/adaptive-foreground.png",
        "monochromeImage": "./assets/expo/adaptive-monochrome.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

The background colour is the Logo background. With SDK 54 and later, Expo also accepts an Icon Composer `.icon`
directory in `ios.icon`; build one from the layer files of the App Store pack (`apple/shared/icon-composer/`) if you
want the Liquid Glass look.

## What is verified

From the Expo docs (checked 2026-11-20): the keys, the 1024 × 1024 recommendation and that the iOS icon must be square
and opaque. Expo states no sizes or rules for the dark and tinted iOS images or for the Android layers; those follow
Apple's and Android's own rules and are marked unverified in the catalogue.

Environments (icon variants, `docs/icon-variants.md`) are not part of this pack: in Expo they are usually picked in
`app.config.js` per build profile.
