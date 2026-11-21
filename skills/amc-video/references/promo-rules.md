# Promo video rules

Rules for the promo videos of the `amc-video` skill. They follow the copy rules of app-media-creator
(`.claude/research/2026-11-18_strategy-and-copy-rules.md` in the tool's repository) and the store facts in its
specs catalogue.

## Story

- **Outcome first.** The first 3 seconds say what the user gets, not the app's name or a logo animation.
- **One idea per scene**, 3–5 scenes, 15–30 seconds in total. Google Play autoplays the first 30 seconds muted.
- **Show the real app.** Use the app's own screens: the job's screenshots and recording frames, or the real UI of
  the website. No invented screens, no fake data that looks like real people (use clearly fictional names).
- **End with the call to action** and the app name ("Get it on Google Play" style wording is fine; never a store
  badge image: badges are third-party artwork).

## Captions

- **Work without sound.** Every message is on screen; sound and music are extras.
- **Short:** about 6 words or 40 characters per caption, at most two lines. Reading time at least 1.5 s per caption.
- **Safe area:** keep text inside the middle 80 % of the frame, so feed and story overlays do not cover it
  (vertical: away from the top and bottom 15 %).
- **Same facts in every language.** Localize, do not translate word by word. Use the market's own words.
- **Claims:** every claim must be true and visible in the app. Never a forbidden claim from `claims.json`, never
  prices, rankings or superlatives ("best", "#1") unless they are listed as allowed.

## Licences

- brag is MIT-licensed; HyperFrames is Apache-2.0. Both run on the user's machine and are not part of
  app-media-creator's package.
- **Music:** render with `--no-music` by default. brag's bundled tracks are CC BY 4.0 and need an attribution with
  the video; use one only when the user asks for music and then write `videos/CREDITS.txt` with the track's
  attribution. A music file from the user is fine when they have the rights to it.
- No third-party logos, store badges, device bezels or fonts without a licence that allows it.

## Formats

| Format | Size | Use |
|---|---|---|
| `landscape` | 1920 × 1080 | YouTube (the Google Play promo video is a YouTube URL), websites |
| `vertical` | 1080 × 1920 | Reels, Shorts, TikTok, stories |
| `square` | 1080 × 1080 | Feeds |

The size must match exactly; the tool rejects other sizes. 30 fps, H.264 in MP4.
