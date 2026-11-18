# Tasks

## 1. Output layout and catalogue

- [x] 1.1 Add `subfolder` to `outputPath`, `OutputEntry` and `checkEntry`; verify manifest tests for a density subfolder, the round trip and an invalid subfolder
- [x] 1.2 Add `xml` format, `ANDROID_DENSITIES`, `google.adaptive-icon.xml` and the `android-res` folder; verify catalogue tests

## 2. Rendering and generator

- [x] 2.1 Bound the SVG decode in `loadLogo`; add silhouette rendering; verify unit tests
- [x] 2.2 Add `generateAndroidIcons`; verify tests for the Play icon (32-bit, opaque, corners), density sizes, foreground safe zone, monochrome silhouette, `ic_launcher.xml`, missing logo, clean checklist

## 3. API

- [x] 3.1 Add `POST /api/generate/android-icons`; verify server tests for success and missing logo

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review` and `security-review` on the change; findings recorded in the review log of `design.md`
