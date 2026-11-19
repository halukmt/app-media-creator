# Design

## Decisions

1. **Three layers instead of drawing every frame.** The plate (background, text, device body with its shadow) and the
   overlay (the frame with the screen cut out, cutouts on top) are rendered once by the existing SVG renderer; ffmpeg
   scales the recording into the screen rectangle between them. The rounded screen corners need no mask: the rectangle
   corners lie under the frame body of the overlay. The shadow stays in the plate, so it never falls onto the video.
2. **Same layout as the images.** Loop videos use `renderCreativeAsset` with the recording's first frame as the
   screenshot (side devices show it as a still), and its new `key` result gives the screen rectangle and overlay
   (generic frame or the user's bezel). Header uses its fixed size and safe area; search uses the smallest allowed size
   (1920×1280, quicker to render and upload) with the search image's safe area scaled from its default size.
3. **Seamless loop by crossfade.** The clip is split: its first 0.5 s fade in over its last 0.5 s (`xfade`), so the
   last frame leads into the first. The loop is 0.5 s shorter than the clip; 5–30 s from the catalogue. No audio track:
   the App Store plays these videos muted, so nothing may rely on sound.
4. **Device videos keep their audio** (social posts often play with sound) and fade in and out; no audio track when the
   recording has none. Frame rate: the recording's, at most the catalogue maximum.
5. **Catalogue first.** The three web sizes are new entries (`verified: false`, common sizes from third-party guides,
   not store rules) with loose limits (1–60 s). No size is hard-coded in the generators.
6. **Shared helpers.** Recordings per language with source fallback, the probe cache and the post-render validation
   moved to `recordings.ts`; the store previews use them too.
7. **Encode once.** Languages that share a recording and the same text (or phrase) share the encoded file; each of
   them still gets the warnings of that encode.
8. **Review fixes.** Only the requested formats are replaced. The device video overlay is the whole plate with the
   rounded screen cut out, so the video's square corners and its extra pixel stay hidden also without a frame. The
   loop still is taken at `clipStart + LOOP_FADE` (the loop's first frame) and once per recording. The creative
   renderer returns only the key device; `keyScreen` builds the overlay on demand, so image renders do not encode the
   bezel. Loop canvases come from `creativeGeometry`. Option checks (`checkTrim`, `checkLocaleTexts`,
   `videoLimits`) are shared with the store previews. Plans use the video track length (`videoSeconds`) when it is
   shorter than the container.

## Not in this change

- Video section UI (#23); promo reels (#22).
- Text cards inside device videos; several recordings per loop video (the App Store takes one per placement).
