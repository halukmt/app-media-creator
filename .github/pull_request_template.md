## What changes?

<!-- Short summary -->

Closes #

## OpenSpec

`openspec/changes/<n>-<slug>/`

## Verification

- [ ] `npm run build` and `npm run check`
- [ ] `npm run check:all`
- [ ] `npm test` (renderer tests at least for `de-DE` and `tr-TR`)
- [ ] `npm run test:e2e` including axe
- [ ] `/code-review`
- [ ] UI: `component-architect` before, `design-critic` after
- [ ] Server API or file handling: `security-review`
- [ ] New store sizes only in `src/core/specs/` with `verified` flag and source
- [ ] CHANGELOG updated under `[Unreleased]`
