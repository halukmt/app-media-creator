Issue: #16

# Proposal

## Why

#15 created the job folder contract; nothing wrote the results yet. Users need a shipped Claude Code skill that turns a
job folder into storytelling headlines in all languages of the job, following the copy rules and the project's claims.

## What Changes

- New user skill `skills/amc-copy/` (shipped in the npm package, installable with `npx skills add`):
  - `SKILL.md`: read brief, claims and schema; look at every screenshot; write the source language (A outcome-first,
    B mechanism-first) within the slot limits; localize for every other language; save `headlines.json`; run the
    check; hand over without applying anything.
  - `references/copy-rules.md`: the general copy rules (story order, screens 1–3 alone, one idea per screen, no
    invented facts or superlatives, claims, concrete over abstract, lengths, localize don't translate, variants, tone).
  - `scripts/check.mjs`: dependency-free check of `headlines.json` against the brief and claims (errors exit 1,
    warnings for length, exclamation marks and missing slots).
- The brief gives each slot its card `layout` and `limits` (`COPY_LIMITS`: text-top 30/40, text-top-large 26/36,
  text-bottom 34/44); `readJob` warns per slot instead of one global length.
- README: how to install and use the skill.

Acceptance criteria from the issue:
- Follows the copy rules (outcome first, one idea per screen, no unprovable claims).
- Respects `claims.json`; never uses a forbidden claim.
- Variants A (outcome-first) and B (mechanism-first).
- Localize, not translate: native phrasing per locale, length limits per layout.
- Installable with `npx skills add halukmt/app-media-creator --skill amc-copy`.

Targets: App Store, Google Play. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `ai-jobs`: the amc-copy skill and per-layout copy limits.

## Impact

- New: `skills/amc-copy/` (SKILL.md, references, scripts), `tests/unit/amc-copy-skill.test.ts`.
- Changed: `src/core/jobs/jobs.ts` (brief layout and limits, per-slot warnings), `README.md`.
