---
name: amc-copy
description: Writes App Store and Google Play screenshot headlines for an app-media-creator AI job, in every language of the job, as two variants (A outcome-first, B mechanism-first) that tell a story across the screenshots. Use when the app-media-creator UI shows a command like `/amc-copy "<job folder>"`, or when the user asks to write or improve store screenshot headlines from an app-media-creator job folder.
argument-hint: "<job folder, e.g. .app-media/jobs/20261119-104512-k3x9>"
allowed-tools: Read, Write, Glob, Bash(node *)
---

# amc-copy: screenshot headlines from a job folder

app-media-creator prepares a **job folder** and shows the command to run this skill. You look at the screenshots,
write the headlines and save them as `headlines.json` in the same folder. The tool checks the file and shows both
variants in its UI, where the user applies one. Never edit anything outside the job folder.

Reply to the user in the language they write in. Write the headlines in the languages of the job.

## 1. Read the job

The argument is the job folder (quoted path). Read, in this order:

1. `brief.json`: project name, `project.sourceLocale`, `project.locales`, and per locale `screenshots[locale]`. Each slot
   has `slot` (position), `input` (the id you must copy into the result), `image` (file to look at), the current
   `headline` and `subline` (may be empty or written by the user), `fallbackInput`, `layout` and `limits`
   (recommended maximum characters for headline and subline on that card layout).
2. `claims.json`: `allowed` and `forbidden` claims. **A forbidden claim must never appear**, not even paraphrased.
3. `schemas/headlines.schema.json`: the exact format of your result.
4. [references/copy-rules.md](references/copy-rules.md): the rules for good, honest store copy. Read it fully.

If `brief.json` is missing, stop and tell the user to prepare a new AI job in the Screenshots section.

## 2. Look at every screenshot

Open each distinct `image` of the brief (the same image can serve several languages). For each slot note in one line
what the screen visibly shows and what the user achieves with it. A headline may only promise what its screenshot
shows (copy rule 3). Do not reorder slots: the order is the user's; if the story would read better in another order,
say so in your reply instead.

## 3. Write the source language first

For `project.sourceLocale`, write per slot:

- **Variant A, outcome first:** the result the user gets on this screen.
- **Variant B, mechanism first:** the concrete feature that produces it.

Screens 1–3 must work on their own (they appear in search results). Keep each headline within the slot's
`limits.headline` (subline within `limits.subline`); 2–5 words is ideal. A subline is optional; leave it empty rather
than repeating the headline. Use the current headline as context: if the user wrote one, keep its idea unless it breaks
a rule.

## 4. Localize, don't translate

For every other locale of `project.locales`, write the same facts in native phrasing for that market, as a local
copywriter would (copy rule 9). Do not keep English words a native speaker would not use. German and Turkish words are
long: prefer short words over cramming. Use the same slots (`input` values) as that locale's brief entries.

## 5. Save and check

Write `headlines.json` into the job folder:

```json
{
  "version": 1,
  "locales": {
    "de-DE": {
      "slots": [
        { "input": "<input of slot 1>", "A": { "headline": "…", "subline": "" }, "B": { "headline": "…", "subline": "…" } }
      ]
    }
  }
}
```

Then run the check that ships with this skill:

```bash
node "<this skill's folder>/scripts/check.mjs" "<job folder>"
```

Fix every **error** and run it again. **Warnings** (length, punctuation, a missing slot) are fine when you have a reason;
mention them to the user.

## 6. Hand over

Tell the user in a few lines: that the headlines are written, the story you chose (one line per slot for the source
language), any warnings, and that the app-media-creator page updates by itself; they compare A and B there and apply
one. Do not apply anything yourself.
