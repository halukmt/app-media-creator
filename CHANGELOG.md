# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Rule: a release on `main` always has a version number with a date. A release with
entries left under `[Unreleased]` is rejected by `npm run check:release`.

## [Unreleased]

### Added

- Project setup: package scaffold, OpenSpec, GitHub issue workflow, Claude Code skills `next-issue` and `release`, CI. (#1)
- Spec catalogue for all App Store, Google Play and web media assets, locale catalogue for the 6 media languages, and validation of generated images against their spec. (#2)
- Workspace folder (`.app-media/` or `--workspace`) with project settings, input uploads per locale checked by file content, and a local API that rejects requests from other websites. (#3)
- Output manifest with a store-ready folder layout, export checklist per target and locale, and ZIP export for one, several or all locales. (#5)
- Web icon set from the logo: favicon.ico, icon.svg with dark mode, apple-touch-icon, manifest and maskable icons, site.webmanifest and a head snippet, all in one folder. (#8)
- App Store icon set from the logo: 1024 icon on a background colour, dark and tinted appearances, Icon Composer layers, and a logo palette for background suggestions. (#6)
- Google Play icon and Android launcher resources from the logo: adaptive layers (foreground, background, monochrome) and legacy icons in all densities plus ic_launcher.xml, ready for app/src/main/res. (#7)
- App shell: sidebar with Project, Logo, Screenshots, Video, Store texts and Export; a Project screen for stores, device models, languages and claims; one shared language selector (one, several or all languages); empty states that say what to upload and which stores need it. (#4)
- Export section: overall status and ZIP download for the selected languages (with a confirmation while required files are missing), and a checklist per store grouped by asset with a status per language. (#32)
- Screenshot card renderer: headline and subline above or below the app screenshot in a generic device frame (iPhone, iPhone Duo, iPad, Android phone and tablet, or your own bezel), three layouts, background presets and logo colours, text fitting for long German and Turkish words, opaque PNG at the exact store size. (#11)
- Website screenshots: every uploaded screenshot in a device frame on transparency, with an optional shadow, as PNG and WebP in 1x and 2x per language. (#13)
- Screenshot sets per language with headlines that move with their screenshot, a device matrix (iPhone 6.9"/6.5"/6.3", iPhone Duo, iPad 13", Android phone and tablets), fallback to the source language, and card generation for one, several or all languages. (#12)
- Screenshots section: upload per language, choose store cards or frame only, edit headlines and the style per screenshot, see each card per device with its warnings, and generate the selected languages. (#14)
- Share and social images from the logo: Open Graph, X card and WhatsApp preview per language with a tagline, profile pictures and banners for WhatsApp, Instagram, Facebook, LinkedIn, X, YouTube and TikTok, an email signature logo, and monochrome, inverse and square-mark logo variants. (#9)
- Logo section: upload a logo, choose the App Store, Google Play, web and social packs, a background from the presets or the logo colours and a tagline per language, generate everything in one run and check each asset with its validation state before exporting. (#10)
- Icon variants for preview and test installs: environments in the Project screen (folder name, label, colour, badge or blueprint style) give App Store, Android and favicon sets of their own next to the unchanged production icons, checked in the export checklist and documented for Xcode, Expo, Android flavors and staging sites. (#34)
- App Store product page header, search results and universal images per language: your first screenshot and a short phrase inside the art safe area, a row of devices across the rest, previews with a safe-area guide in the Screenshots section. (#18)
- Google Play feature graphic with your phrase and App Store in-app event card and details images without text, per language, from the same background and phrases as the header images. (#19)
- AI job folders: the Screenshots section prepares a job with your screenshots, texts, claims and video frames, shows the command to run in Claude Code, updates live when the result arrives, compares variant A and B per language and applies one; invalid AI results are reported and never applied. (#15)

### Changed

- New projects start without a preview environment, so only the production icons are generated until you add one on the Project screen. (#70)
- Every logo is read as 8-bit colour with transparency before its pixels are analysed, so greyscale and 16-bit logos are handled like colour logos in silhouettes and palettes. (#74)

### Fixed

- Generated files with dots in their name stay in the export, and a failed ZIP write returns an error instead of stopping the tool. (#35)
- A failed batch of generated files leaves the previous files untouched, and rotated JPEG logos are rendered upright. (#38)
- Closing the sections menu on a phone returns focus to the menu button, and widening the window with the menu open no longer locks the page. (#44)
- The shadow of a user bezel no longer darkens the edges of the screenshot inside it. (#51)
- Semi-transparent parts of a user bezel keep their opacity instead of being drawn twice. (#53)
- When screenshot edits cannot be saved, upload and generate stop and the edits are kept instead of being lost or ignored. (#57)
- A failed older save of screenshot edits can no longer overwrite newer edits. (#59)
- The app name on share images and banners is drawn completely instead of being cut off after part of the first letter. (#62)
- Environment labels with characters the icon font cannot draw (e.g. Cyrillic or Chinese) are rejected at the label field instead of vanishing from the icons. (#68)
- Changing the languages while a ZIP download runs cancels it, so no ZIP or message for the old selection appears and only one download runs at a time. (#48)
- A logo that is one solid colour or a gradient without transparency keeps its shape in the Android monochrome layer, the monochrome and inverse logo variants and blueprint icons instead of coming out empty or cut apart. (#63)
- Unit tests that render many images no longer time out in a full local run on a busy machine. (#72)
- App previews for the iPad 12.9" (2nd generation) accept 1200×1600 as well, and a language list with "all" plus an unsupported language is rejected instead of ignored. (#30)
- Applying AI headlines can no longer be overwritten by an edit made at the same moment, a rewritten AI result is not mistaken for the applied one, and a broken result folder shows as an invalid job instead of an error. (#84)
- After a failed reload following an AI apply, any later successful reload (not only "Try again") makes the screenshot texts editable again. (#87)

