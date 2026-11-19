Issue: #10

# Proposal

## Why

The logo generators (#6 App Store, #7 Google Play, #8 web, #9 share and social) exist only as API routes. Users need
one screen that takes a logo, asks which packs to make and with which background, shows every generated file with its
validation state and leads to the export.

## What Changes

- New Logo section with the steps Upload → Options → Preview → Export (rule L2):
  - Upload: one logo (PNG, JPEG, WebP or SVG) with a preview of the current logo.
  - Options: packs App Store, Google Play, Web and Social (packs of stores turned off in Project are disabled with a
    note); a solid background from the presets and the logo palette (no free colour picker); a tagline per language
    of the locale bar for the social pack. Options are saved automatically.
  - Preview: "Generate all" runs every chosen pack in one run with progress; a failed pack does not stop the others.
    The grid shows one card per asset and language (densities and sizes of one asset grouped, largest image shown)
    with the worst validation state of its files.
  - Export: link to the Export section.
- Logo settings stored in `<workspace>/logo.json` (packs, background, taglines per locale), read leniently.
- API: `GET /api/inputs/logo-preview`, `GET|PUT /api/logo/settings`, `POST /api/generate/logo/:pack`,
  `GET /api/logo/output`, `GET /api/output`, `GET /api/output/file?path=&width=` (manifest images only, own files
  only, optional downscale, no-sniff and sandbox CSP).
- Component changes: `OptionGroup` gets an optional colour swatch, `PreviewCard` takes optional media and size,
  `SectionLayout` passes a hint to the locale bar.

Acceptance criteria from the issue:
- Steps Upload → Options → Preview → Export (rule L2).
- Background colour from the logo palette or presets, no free colour picker.
- Preview grid with validation badges; "Generate all" produces every pack in one run.
- E2E test: upload logo → export ZIP → file list per target.

Targets: App Store, Google Play, web / social. Locales: all 6 for the taglines and share images; icons are shared.

## Not in this change

- Icon variants for preview and production (#34).
- Per-pack backgrounds or gradients for icons.

## Capabilities

### New Capabilities
- `logo-section`: the Logo section UI and its settings and preview API.

### Modified Capabilities
- (none)

## Impact

- New: `src/core/workspace/logo-settings.ts`, `src/core/generators/logo-packs.ts`, `src/web/pages/LogoPage.tsx`,
  `src/web/lib/logo.ts`, `tests/unit/logo-api.test.ts`, `tests/unit/web-logo.test.ts`, `tests/e2e/logo.spec.ts`.
- Changed: `src/server/{generate,export}-routes.ts`, `src/web/{App.tsx,api.ts,i18n/en.ts}`,
  `src/web/components/{OptionGroup,PreviewCard}.tsx`, `src/web/layouts/SectionLayout.tsx`,
  `src/web/lib/screenshots.ts`, `src/web/pages/ScreenshotsPage.tsx`, `playwright.config.ts`.
