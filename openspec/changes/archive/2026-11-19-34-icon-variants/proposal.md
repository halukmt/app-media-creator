Issue: #34

# Proposal

## Why

Testers often have the production app and a preview or development build installed side by side. With the same icon
they confuse them. The logo packs should also produce labelled icon variants for non-production installs on iOS,
Android and staging websites. The idea comes from blueprint by Mustafa Natur (MIT, macOS and Xcode only). This change
implements it with sharp, cross-platform, without copying code.

## What Changes

- Project settings get `environments`. Each environment has an id (folder name), a badge text (up to 10 characters),
  a colour preset and a style (`badge` | `blueprint`).
  - Up to 5 environments. The default is `preview` (PREVIEW, orange, badge).
  - Project files without the field get the default list.
  - The Project screen gets an editor for them: `EnvironmentCard`.
- Two styles:
  - **badge:** the production icon with a label pill in the visible circle at the bottom centre.
  - **blueprint:** the logo outline in white on a blue gradient with grid lines, plus the label.
  - Icons under 64 px get a colour bar instead of a label.
- Outputs per environment, next to the production files: `<target>/<environment>/<folder>/…`.
  - App Store: icon 1024, dark and tinted appearances, Icon Composer layers.
  - Android: launcher icons and adaptive layers per density, plus `ic_launcher.xml`. The Play icon has no variants;
    the themed monochrome layer stays the production silhouette.
  - Web: the full favicon set. The manifest name gets the badge.
  - Production files stay byte-identical.
- The manifest gets an `environment` field. It is part of the path and of the set position, and it is validated like
  a subfolder. Icon generators replace their whole set, so files of a removed environment go away.
- The export checklist validates each environment as its own set (not required). The UI shows those sets as separate
  assets, in the ChecklistCard and in the Logo preview.
- Documentation: `docs/icon-variants.md` covers Xcode `ASSETCATALOG_COMPILER_APPICON_NAME`, Expo `APP_VARIANT`,
  Android product flavors, the staging favicon, and credits blueprint.

Acceptance criteria from the issue:
- Project settings list environments: production plus configurable ones (default `preview`), each with badge text and
  colour preset.
- Two styles, badge and blueprint, as an own implementation with sharp.
- Outputs per environment for App Store (#6), Android (#7) and favicons (#8); production files unchanged.
- The export keeps environments apart, and the checklist validates them like the production icons.
- Docs on how to use the variants; blueprint is mentioned.
- Tests for both styles with a transparent SVG logo and a flat PNG logo.

Targets: App Store, Google Play, Web. Locales: not language-specific.

## Capabilities

### New Capabilities
- `icon-variants`: environment settings, the two styles, outputs per environment.

### Modified Capabilities
- `export`: environment folders in the output layout and the checklist.

## Impact

- New: `src/core/generators/environments.ts`, `src/web/components/EnvironmentCard.tsx`, `docs/icon-variants.md`,
  `tests/unit/icon-environments.test.ts`.
- Changed:
  - Core: `src/core/workspace/project.ts`, `src/core/export/{manifest,checklist}.ts`, the three icon generators,
    `logo-packs.ts`.
  - Server: `catalogue-routes.ts` (environment colours).
  - Web: `api.ts`, `lib/{export,errors,logo}.ts`, `ChecklistCard`, `ProjectPage`, `LogoPage`, `en.ts`.
  - Tests: the factories and the existing icon and API tests (production subsets).
