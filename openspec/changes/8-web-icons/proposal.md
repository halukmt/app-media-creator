Issue: #8

# Proposal

## Why

Every app needs a website icon set next to the store icons: favicons for browser tabs and bookmarks, a touch icon for
iOS home screens and installable web app icons. Users should get the whole set from their logo in one step, ready to
copy into their site.

## What Changes

- A web icon generator that takes the newest uploaded logo (PNG, JPEG, WebP or SVG) and writes:
  `favicon.ico` (16, 32, 48), `icon.svg` with a light and a dark background (dark-mode media query),
  `apple-touch-icon.png` (180, opaque), manifest icons `icon-192.png` and `icon-512.png`, `icon-maskable-512.png`
  (logo inside the safe circle), `site.webmanifest` and `head.html` (the tags to paste into `<head>`).
- All files go into one folder, `web/shared/favicons/`, so the folder can be copied to the site root.
- Spec catalogue: new document entries for `site.webmanifest` and `head.html`; favicon entries share the `favicons`
  folder; ICO files can be measured (sharp cannot read them).
- Registering a file whose path belongs to another asset is rejected, so shared folders cannot overwrite each other.
- API: `POST /api/generate/web-icons` with optional background colours.

Acceptance criteria from the issue:
- `favicon.ico` (16/32/48), `icon.svg` with dark-mode media query, `apple-touch-icon.png` 180, manifest icons 192 / 512, maskable 512.
- `site.webmanifest` and an HTML snippet to paste into `<head>`.
- Spec validation and tests.

Targets: web. Locales: not language-specific (shared by all locales).

## Not in this change

- Logo section UI (#10); background colour from the logo palette (#10).
- Social and share images (#9), preview / production variants (#34).

## Capabilities

### New Capabilities
- `web-icons`: generation of the favicon and web app icon set from a logo.

### Modified Capabilities
- `media-specs`: document assets (web manifest, HTML snippet) and measuring of ICO files.
- `export`: a file path that belongs to another asset cannot be registered.

## Impact

- New `src/core/generators/web-icons.ts`, `src/server/generate-routes.ts`.
- `src/core/specs/` (types, web entries, ICO inspection), `src/core/export/manifest.ts`, checklist for documents.
