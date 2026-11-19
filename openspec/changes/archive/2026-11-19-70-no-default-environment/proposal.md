Issue: #70

# Proposal

## Why

Since #34 every project got the environment `preview` by default, so every icon run wrote a second icon set (App
Store, Android, favicons) that most users do not need: about twice the icon files, a larger ZIP and extra checklist
items. Haluk decided on 2026-11-19 that new projects start without environments.

## What Changes

- `defaultEnvironments()` returns an empty list: new projects and project files without the field have no environments.
- Project files that list environments keep them.
- The Project screen and the Logo section already handle an empty list (hint "No preview or test icons…", no "Icon
  set" filter); the first environment added is still suggested as `preview`.
- Docs (`docs/icon-variants.md`) and tests follow.

Acceptance criteria from the issue:
- `defaultProject()` and a project file without `environments` give an empty list.
- A project file that lists environments keeps them.
- Without environments the generators write only production icons; checklist and ZIP contain no environment sets.
- The Project screen shows the empty section with the Add button and a hint.
- The Logo section shows no "Icon set" filter without environments.
- Tests and docs are updated.

Targets: App Store, Google Play, Web (icon variants). Locales: not localized.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `icon-variants`: no default environment.

## Impact

- `src/core/workspace/project.ts`, `docs/icon-variants.md`; tests in `tests/unit/icon-environments.test.ts`,
  `tests/unit/server-generate.test.ts`, `tests/e2e/project.spec.ts`, `tests/e2e/logo.spec.ts`.
- Existing workspaces saved since #34 list `preview` explicitly and keep it until the user removes it.
