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

### Fixed

- Generated files with dots in their name stay in the export, and a failed ZIP write returns an error instead of stopping the tool. (#35)
- A failed batch of generated files leaves the previous files untouched, and rotated JPEG logos are rendered upright. (#38)
- Closing the sections menu on a phone returns focus to the menu button, and widening the window with the menu open no longer locks the page. (#44)
- The shadow of a user bezel no longer darkens the edges of the screenshot inside it. (#51)
- Semi-transparent parts of a user bezel keep their opacity instead of being drawn twice. (#53)

