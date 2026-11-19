# Icon variants for preview and test installs

Testers often have the production app and a preview or development build on the same device. If both show the same
icon, they get confused. app-media-creator generates a second icon set for each **environment** you list in the
Project screen (under "Preview and test installs"). The production icons stay exactly as they are.

## Settings

Each environment has:

| Field | Example | Notes |
|---|---|---|
| Folder name | `preview` | Lower-case letters, digits and dashes. Cannot be `production` or `shared`. |
| Label on the icon | `PREVIEW`, `DEV`, `BETA` | Up to 10 characters, written in capitals. |
| Label colour | orange, purple, green, red, blue, gray | Presets only. The label text is black or white, whichever reads better. |
| Style | badge or blueprint | See below. |

New projects start with one environment: `preview`, orange, badge. Remove it if you only need production icons.

## Styles

- **Badge:** your normal icon with the label as a pill at the bottom centre. The pill stays inside the area that
  survives the platform masks: the iOS rounded square, Android circles and squircles, and the maskable safe zone.
  Icons under 64 px, such as favicons, are too small for text, so they get a coloured bar along the bottom instead.
- **Blueprint:** the outline of your logo in white on a blue gradient with grid lines, plus the label. Use it when
  you want the test build to look completely different from production. The idea comes from
  [blueprint](https://github.com/MustafaNatur/blueprint) by Mustafa Natur (MIT). blueprint needs macOS 14+ and
  Xcode 26; this tool has its own cross-platform implementation and copies no code from it.

## Where the files go

When you generate the Logo packs, every environment gets its own folder next to `shared`:

```
apple/shared/icon/app-icon.png             production
apple/preview/icon/app-icon.png            preview (plus dark, tinted and Icon Composer layers)
google/shared/android-res/mipmap-*/…       production
google/preview/android-res/mipmap-*/…      preview launcher icons and adaptive layers
web/shared/favicons/…                      production
web/preview/favicons/…                     favicons for a staging site
```

The Google Play icon (512 px) is a store listing asset, so it has no variants. The themed (monochrome) Android layer
stays the production silhouette, because themed icons are one colour by definition.

The export checklist checks each environment's files against the same store rules as the production icons and lists
them as separate assets. If you remove an environment, its files are deleted the next time you generate.

## Using the variants

### Xcode (native iOS)

1. Add a second app icon set to the asset catalogue, e.g. `AppIcon-Preview`, and fill it with the files from
   `apple/preview/icon/`.
2. In the build settings of the preview configuration, set **Primary App Icon Set Name**
   (`ASSETCATALOG_COMPILER_APPICON_NAME`) to `AppIcon-Preview`.
3. For Icon Composer, build a second `.icon` file from `apple/preview/icon-composer/`.

### Expo / React Native

Use [app variants](https://docs.expo.dev/tutorial/eas/multiple-app-variants/) and pick the icon in `app.config.js`:

```js
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

export default {
  icon: IS_PREVIEW ? './assets/icon-preview.png' : './assets/icon.png',
  android: {
    adaptiveIcon: {
      foregroundImage: IS_PREVIEW ? './assets/adaptive-preview.png' : './assets/adaptive.png',
    },
  },
};
```

Copy `apple/preview/icon/app-icon.png` to `assets/icon-preview.png`. Copy the `xxxhdpi` foreground from
`google/preview/android-res/` to `assets/adaptive-preview.png`.

### Android product flavors

Copy `google/preview/android-res/*` into the flavor's resource folder, e.g. `app/src/preview/res/`. Gradle merges it
over `app/src/main/res/` for that flavor, so the preview build gets the labelled launcher icon.

### Staging website

Deploy `web/preview/favicons/*` to the root of the staging site instead of the production favicons. The included
`site.webmanifest` names the app "<App name> (PREVIEW)".
