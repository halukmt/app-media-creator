# Design

## Decisions

1. **Groups in one generator** instead of a second generator: the same inputs (screenshots, background, phrases), the
   same renderer and the same preview API. `CREATIVE_IMAGES` lists each image with its group, file name, whether it
   draws the phrase, and a centred `keyArea` (shares of the image) for specs without a store safe area.
   - *Alternative:* separate settings (background, phrases) for the feature group. Rejected: users write the same
     short phrase twice; the header and feature images are one campaign look.
2. **Key areas** are composition constants, not store sizes (sizes stay in the catalogue): feature graphic centred
   70 % × 80 % (Play: "keep key elements centred", the play button may sit on top when a video exists); event card
   centred; event details in the upper half (Apple overlays the event title at the bottom).
3. **No text on event images** (Apple: avoid own text, borders and logos). Tested: de-DE and tr-TR event images are
   byte-identical when they share screenshots.
4. **Centred group:** the phrase is fitted and measured first; `creativeLayout(…, textWidth)` then moves phrase and
   key device towards each other (pure, tested), and the drawn text is translated instead of laid out twice. A short
   phrase no longer leaves a gap between text and device (seen in the first feature graphic render).
5. **Store per image:** the feature graphic needs Google Play, the event images the App Store; a run makes what is
   enabled and replaces the whole group of a language, so switching a store off removes its stale images.
6. UI reuses everything from #18: the purpose shares the options panel; the guide label says "key area" for
   images without a store safe area (`storeSafeArea` from the catalogue).

## Review log

- **/code-review:** 8 findings. Fixed: the centring shift lived only in the renderer → moved into `creativeLayout`
  (`textWidth`, `textShift`) with a test; the phrase was laid out twice → one layout, drawn in a translated group;
  text-free event images were rendered again per language → rendered once per screenshot set and shared (project rule:
  text-free assets once for all locales); phrase fields showed with only the App Store on → shown only when an image
  of the purpose draws text; header-only texts on the feature purpose → neutral load error, "Show key area" and its
  own hint; the group literal was repeated in `api.ts` → `CreativePurpose`; nested ternary for the button → lookup.
  Accepted: a language without any screenshots has its earlier images of the group removed on a run, the same rule as
  the screenshot cards ("languages without screenshots are cleaned up").
- **security-review:** no findings (`group` only selects from constant lists; paths and deletions unchanged).
- **design-critic:** 5 findings. Fixed: the tall 9:16 card stretched the grid row → `items-start`; "centred key area"
  was wrong for the event details (upper half) → "key area"; phrase fields without a text image (as above); hints and
  the load error named header images; the button named a feature graphic with Google Play off → "Generate event
  images". Deferred: an optional max media height on `PreviewCard` (needs component-architect; the 9:16 card is
  about 570 px tall at 375 px).
- A local `npx prettier` run reformatted ScreenshotsPage completely (the project has no Prettier); the file was
  restored and only the intended edits re-applied.
