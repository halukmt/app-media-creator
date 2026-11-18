---
name: release
description: Prepares a release from dev to main. Turns [Unreleased] in the CHANGELOG into a dated version, sets the same version in package.json, opens the PR dev → main and verifies tag and GitHub release afterwards. Use when Haluk says "release", "bring to main" or "publish a version".
allowed-tools: Bash, Read, Edit
argument-hint: "[optional: patch | minor | major or a version like 0.2.0]"
---

# Release dev → main

Builds on the global skill `release-github` but follows the rules of this repo. Report to Haluk in German.

## Steps

1. **Check the state**
   - `git checkout dev && git pull`, clean working tree.
   - Last CI run on `dev` is green (`gh run list --branch dev --limit 3`).
   - `[Unreleased]` in `CHANGELOG.md` has at least one entry. Otherwise there is nothing to release; stop.
2. **Choose the version** by SemVer from the last version in the CHANGELOG:
   - before 1.0.0: `minor` for new features, `patch` for fixes only
   - after 1.0.0: `major` for breaking CLI, API or output layout changes, `minor` for features, `patch` for fixes
   - The first version is `0.1.0`. If `$ARGUMENTS` is given, use it.
   - Tell Haluk the version and let him confirm it.
3. **First public release (0.1.0) only:** run the go-public audit before continuing:
   - licences of all dependencies and bundled code; `THIRD_PARTY_NOTICES.md` complete
   - no secrets in the git history (`gitleaks` result of the CI)
   - no private content: app-specific strategy or private repo content in `.claude/`,
     assets with third-party branding (the gitignored `legacy/` must stay out of git), session notes
   - Report findings and stop until Haluk confirms.
4. **Rewrite the CHANGELOG**
   - Entries under `[Unreleased]` move to `## [X.Y.Z] - YYYY-MM-DD` (today).
   - `## [Unreleased]` stays as an empty heading at the top.
   - Add compare links at the end (`[X.Y.Z]: https://github.com/halukmt/app-media-creator/compare/vA.B.C...vX.Y.Z`).
5. **Set the version:** `npm version X.Y.Z --no-git-tag-version`.
6. **Check and commit on dev:** `npm run check:release` must pass. Then `chore(release): vX.Y.Z` and push.
7. **⚠️ Ask Haluk explicitly before the next step**, because it changes `main`.
8. **PR dev → main:** `gh pr create --base main --head dev --title "Release vX.Y.Z" --body "<CHANGELOG section>"`.
9. Wait for CI (`gh pr checks --watch`). Then a **merge commit** (no squash, so dev and main stay equal):
   `gh pr merge --merge`.
10. **Afterwards**
    - `release.yml` created tag `vX.Y.Z` and the GitHub release (`gh release view vX.Y.Z`).
    - Set all issues of the release to **Released** in the project.
    - `git checkout dev && git pull origin main` and push, so dev contains the merge commit.
    - Going public and npm publish are separate steps that Haluk confirms (milestone M7).

## Limits

- Never release with entries left under `[Unreleased]`. `scripts/check-release.mjs` checks this in the CI for
  PRs to `main` and in `release.yml`.
- Never set tags by hand; `release.yml` does that.
- Never `--force`.
