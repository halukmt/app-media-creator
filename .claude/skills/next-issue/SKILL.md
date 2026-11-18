---
name: next-issue
description: Takes the next issue from the "Ready" column of the GitHub project "app-media-creator" (project 10), implements it with OpenSpec, opens a PR to dev, merges after green CI and documents everything in the issue. Built for the automatic loop "/loop /next-issue". Never merges to main.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, Skill
argument-hint: "[optional: issue number to take a specific issue]"
---

# Implement the next issue

One run implements exactly **one** issue. Everything in issues, PRs, commits, OpenSpec and code is English
(see `.github/copilot-instructions.md`). Report to Haluk in German.

## 0. Preconditions

- `git status` must be clean and `dev` up to date (`git checkout dev && git pull`). Otherwise stop and report.
- Read the newest handoff note in `.claude/sessions/`.
- **Comments on the previous PR:** check review comments of the last merged PR
  (`gh api repos/halukmt/app-media-creator/pulls/<n>/comments`). Fix security findings right away as a new
  `fix` issue (prio P0); record other valid findings as new issues in Backlog.

## 1. Pick the issue

    gh project item-list 10 --owner halukmt --format json --limit 200

- Only items with status **Ready** that are open issues.
- Skip: label `needs-input`, label `task-haluk`, and issues with an open `task-haluk` sub-issue
  (`gh api repos/halukmt/app-media-creator/issues/<n>/sub_issues`).
- **Stop** (end the loop with `ScheduleWakeup stop` and a message to Haluk) when a Ready issue has
  `needs-decision` or no suitable issue is left. Name the issues finished since the loop started.
- Order: Priority P0 before P1 before P2; same priority: Size XS before S, M, L, XL; then the lowest issue number.
- If a number was passed (`$ARGUMENTS`), take that issue.
- Read the issue: `gh issue view <n> --comments`. If it depends on an open issue ("Depends on #…"), take the next one.

## 2. Start

- Set the project status to **In progress** (`gh project item-edit` with field "Status").
- Create the branch from `dev`: `feat/<n>-<slug>` for `enhancement`, `fix/<n>-<slug>` for `bug`. Short English slug.

## 3. Implement with OpenSpec

1. `/opsx:propose <n>-<slug>` based on the issue text. `proposal.md` starts with `Issue: #<n>`.
2. UI work: first the agent `component-architect`, then the skill `daisyui`. The reuse map goes into `design.md`.
   Decide new components yourself (do not wait for Haluk) and add them to `src/web/components/INVENTORY.md`.
   Use `needs-decision` only for high-impact design questions.
3. Media work: sizes and limits only from `src/core/specs/`; every new asset type gets a spec entry with
   `verified` flag and source URL first. Localized assets must work for all 6 locales (`de-DE`, `en-US`,
   `es-ES`, `it-IT`, `fr-FR`, `tr-TR`) and for "one / several / all" selection.
4. `/opsx:apply` works through `tasks.md`.
5. If material or a decision is missing: commit the work in progress, comment on the issue, create one
   sub-issue with `task-haluk` per missing item (rule in `.github/copilot-instructions.md`), add `needs-decision`
   for a high-impact design question, set the status back to **Ready**, end the run.
6. If items for Haluk remain after the merge (approval, account step, real store upload test), create
   `task-haluk` sub-issues for them as well, not only a closing comment.

## 4. Local verification

All steps must pass. On failure: fix and repeat.

    npm run build
    npm run check
    npm run check:all
    npm test
    npm run test:e2e

Then `/code-review` on the changes. For changes to the server API or file handling also `security-review`.
For visible changes the agent `design-critic`. Fix critical findings before the PR.

## 5. PR and merge

1. Commit: `feat(#<n>): <description>` with the attribution from the system reminder.
2. Add a line under `[Unreleased]` in `CHANGELOG.md` (matching section, one sentence, ending with `(#<n>)`).
3. Push the branch, then open the PR to `dev`:
   `gh pr create --base dev --title "#<n> <title>" --body "<summary>\n\nCloses #<n>"`.
   Set the issue status to **In review**.
4. Wait for CI: `gh pr checks <pr> --watch`.
   - Green: `gh pr merge <pr> --squash --delete-branch`.
   - Red: fix the cause and push again. If CI is red **twice**, stop and report to Haluk.

## 6. Wrap-up

1. `/opsx:archive <n>-<slug>` and push the archive commit directly to `dev`
   (`chore(#<n>): archive OpenSpec change`).
2. Comment on the issue: what was implemented, how to try it (`npm run dev`, section and steps), path of the
   archived OpenSpec folder, open points. For UI work also the new components with their reason.
3. Set the project status to **Done**. (`dev` is the default branch, so `Closes #<n>` closes the issue on merge.)
4. Append to the handoff note `.claude/sessions/YYYY-MM-DD_next-issue.md`: issue, result, notable findings.

## Limits

- **Never** merge or push to `main`. Releases only via `/release`, started by Haluk.
- Never `--force`, never `--no-verify`.
- Never read or print secrets (`.env`, GitHub secrets).
- One run, one issue. Then the skill ends and `/loop` starts the next run.
