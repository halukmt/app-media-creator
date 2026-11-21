---
name: amc-video
description: Renders the promo videos of an app-media-creator AI job with brag (HyperFrames): one MP4 per language and format (16:9, 9:16, 1:1), with captions per language, from the job's screenshots and recordings or the app's website or repository. Use when the app-media-creator UI shows a command like `/amc-video "<job folder>"`, or when the user asks to make promo videos from an app-media-creator job folder.
argument-hint: "<job folder, e.g. .app-media/jobs/20261121-091500-k3x9>"
allowed-tools: Read, Write, Glob, Bash(node *), Bash(ffprobe *), Bash(ffmpeg *), Bash(npx hyperframes *)
---

# amc-video: promo videos from a job folder

app-media-creator prepares a **job folder** and shows the command to run this skill. You plan one promo story, write
its captions in every language of the job, render one video per language and format with **brag** (HyperFrames), and
save the videos in the same folder. The tool checks every video against its spec and adds it to the outputs when the
user chooses to. Never change anything outside the job folder, except what brag writes into the job's `work/` folder.

Reply to the user in the language they write in. Write the captions in the languages of the job.

## 1. Read the job

The argument is the job folder (quoted path). Read, in this order:

1. `brief.json`: `project` (name, `sourceLocale`, `locales`) and `promo`:
   - `formats`: each `format` (`landscape`, `vertical`, `square`) with its exact `width` and `height`.
   - `seconds`: the length to aim for (`min`–`max`); `fps`: 30.
   - `sources`: optional `website` and `repo` URLs of the app.
   - `output`: where each video goes, `videos/<locale>/<format>.mp4`.
   - `screenshots[locale]` and `videos[].frames`: the app's own images in `images/` and `frames/`.
2. `claims.json`: `allowed` and `forbidden` claims. **A forbidden claim must never appear**, not even paraphrased,
   not in a caption, not on screen.
3. [references/promo-rules.md](references/promo-rules.md): story, captions and licence rules. Read it fully.

If `brief.json` has no `promo`, stop and tell the user to prepare a new AI job in the Video section ("Promo video").

## 2. Check the tools

You need **brag** (the `/brag` skill), Node 22 or newer and ffmpeg with ffprobe. If `/brag` is not available, stop
and tell the user how to install it, then to run this command again:

```
/plugin marketplace add latent-spaces/brag
/plugin install brag@brag
```

(or `npx skills add https://github.com/latent-spaces/brag --skill brag`). brag renders with HyperFrames through
`npx hyperframes`; it fetches it itself. Do not install anything else globally.

## 3. Plan one story

Collect the facts first: look at every image of the brief; if `sources.website` is set, read the site as brag's
website inspection describes; if `sources.repo` is set and you run inside that repository, read its README and main
screens. Write a short fact list: what the app does, for whom, the two or three key moments (entry → key action →
result), and what is verifiably true. Every caption must come from this list.

Plan the story once, in the source language: 3–5 scenes, `seconds.min`–`seconds.max` long, the outcome in the first
3 seconds, one idea per scene. Use the app's real screens (the job's images and frames, or the site's real UI) as the
visuals. When a scene shows an image of the job, also record it in `storyboard.json` (optional; see
`schemas/storyboard.schema.json`): `image` is the path as in the brief, `captions` has one text per language.

## 4. Captions per language

Write the captions of the source language, then localize them for every other locale of `project.locales`: same
facts, native phrasing, not a word-by-word translation. Keep each caption short enough to read in the scene's time
(see the rules). German and Turkish run long: check that the longest language still fits the frame.

## 5. Render with brag

Work inside `<job folder>/work/` so brag's output stays in the job folder. For each format of `promo.formats`, build
the composition once with brag, as a launch video for this app:

- `--format <format>` and `--duration <seconds>` within `promo.seconds`, 30 fps.
- `--no-music` unless the user gave you a music file they have the rights to. Never use bundled tracks without
  their licence terms; see the rules.
- Direction for brag: the story and captions from steps 3 and 4, the material (job images, frames, website, repo),
  and the claims rules.

Then render the same composition for every language by swapping only the captions (batch render; do not plan a new
story per language). Check the size of each render with ffprobe: it must be exactly the `width` × `height` of its
format. When a render is complete, copy it to `videos/<locale>/<format>.mp4` (for example
`videos/tr-TR/vertical.mp4`). Copy only finished files: the tool reads the folder while you work.

## 6. Check

Run the check that ships with this skill:

```bash
node "<this skill's folder>/scripts/check.mjs" "<job folder>"
```

Fix every **error** (wrong size, wrong length, unknown file) and run it again. Warnings about missing languages or
formats are fine when the user asked for fewer; mention them.

## 7. Hand over

Tell the user in a few lines: which languages and formats are rendered, the story in one sentence, any warnings, and
that the app-media-creator Video section updates by itself; they review the videos there and add them to the
outputs. Remind them that Google Play needs the 16:9 video uploaded to YouTube (public or unlisted, no ads,
embeddable) and its URL in the Play listing. Do not upload anything yourself.
