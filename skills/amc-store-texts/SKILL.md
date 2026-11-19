---
name: amc-store-texts
description: Writes the App Store and Google Play listing texts (name, subtitle, promotional text, description, keywords, what's new; Play title, short and full description) for an app-media-creator AI job, in every language of the job, within each store's limits. Use when the app-media-creator UI shows a command like `/amc-store-texts "<job folder>"`, or when the user asks to write or improve store listing texts from an app-media-creator job folder.
argument-hint: "<job folder, e.g. .app-media/jobs/20261119-104512-k3x9>"
allowed-tools: Read, Write, Glob, Bash(node *)
---

# amc-store-texts: store listing texts from a job folder

app-media-creator prepares a **job folder** and shows the command to run this skill. You learn what the app does,
write the store texts and save one file per text in the same folder. The tool checks the files and shows them in its
Store texts section, where the user applies them. Never edit anything outside the job folder.

Reply to the user in the language they write in. Write the store texts in the languages of the job.

## 1. Read the job

The argument is the job folder (quoted path). Read, in this order:

1. `brief.json`: project name, `project.sourceLocale`, `project.locales`, and `storeTexts`:
   - `fields`: the fields to write, with `target` (`apple` or `google`), `name`, `max` and `unit` (`bytes` for Apple
     keywords: UTF-8 bytes, so ü, ş or ğ count twice), `required`, `multiline` and `notes`.
   - `current`: texts the user already has per language. Keep their facts and ideas unless they break a rule.
   - `screenshots[locale]`: the store screenshots (`image`) with their `headline` and `subline`.
2. `claims.json`: `allowed` and `forbidden` claims. **A forbidden claim must never appear**, not even paraphrased.
3. [references/store-text-rules.md](references/store-text-rules.md): the rules per field. Read it fully.
4. [references/humanizer-light.md](references/humanizer-light.md): the light humanizer pass for long texts.

If `brief.json` has no `storeTexts`, stop and tell the user to prepare a new AI job in the Store texts section.

## 2. Learn what the app does

Collect the facts before writing: look at every screenshot of the brief; read the current texts; if you run inside the
app's own repository, read its README and other user-facing docs. Write down a short fact list: what the app does,
for whom, the main features, and what is verifiably true (privacy, offline use, price). Every sentence you write later
must come from this list. Never invent numbers, awards, prices or features.

## 3. Write the source language first

For `project.sourceLocale`, write every field of `storeTexts.fields`, within its limit. Follow the store text rules:
name and subtitle say what the app is; the short texts lead with the main benefit; descriptions start with the
outcome in the first lines, then features, then trust points that are allowed claims.

Then apply the light humanizer pass to the long texts (promotional text, descriptions, what's new). Never to name,
subtitle, title or keywords.

## 4. Localize, don't translate

For every other locale of `project.locales`, write the same facts as a native copywriter for that market would.
**Keywords are researched per language, not translated:** use the words people in that market type into the store
search, in that language, within 100 bytes. Do not repeat words from that language's name and subtitle in its
keywords.

## 5. Save and check

Write one plain-text file per field and language, named after the field:

```
store-texts/de-DE/apple-name.md
store-texts/de-DE/apple-description.md
store-texts/tr-TR/google-short-description.md
```

The file holds only the text, no heading or quotes. Line breaks only in multi-line fields. Then run the check that ships
with this skill:

```bash
node "<this skill's folder>/scripts/check.mjs" "<job folder>"
```

Fix every **error** and run it again. Fix **warnings** about limits; other warnings are fine when you have a reason;
mention them to the user.

## 6. Hand over

Tell the user in a few lines: which languages and fields are written, the key message you chose, the keywords of the
source language, any warnings, and that the app-media-creator page updates by itself; they review the texts there and
apply them. Do not apply anything yourself.
