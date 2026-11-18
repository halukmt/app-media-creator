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

### Fixed

- Generated files with dots in their name stay in the export, and a failed ZIP write returns an error instead of stopping the tool. (#35)
- A failed batch of generated files leaves the previous files untouched, and rotated JPEG logos are rendered upright. (#38)

