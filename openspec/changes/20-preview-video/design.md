# Design

## Decisions

1. **One ffmpeg run per preview.** Cards are PNGs looped for their length; the recording is cut with input seeking
   (`-ss` / `-t`, frame-accurate because it is re-encoded). All parts go through the same chain (scale into the box,
   pad, `setsar=1`, 30 fps, yuv420p, fade) and are joined with `concat` together with their audio.
2. **Pad, never crop.** Cropping could hide parts of the app; the bars take the card background colour (gradient:
   its first colour). A landscape recording uses the landscape size of the entry (rotatable in the catalogue).
3. **Constant bitrate.** Apple asks for 10–12 Mbps; x264 would encode calm screen recordings far below that, so the
   preview uses CBR 11 Mbps (`nal-hrd=cbr`). Bitrate is not part of the catalogue checks (ffprobe reports it only
   roughly); size, fps, duration and stereo audio are.
4. **Cards keep their length, the recording is cut.** The total must stay within 15–30 s: cards (1–5 s each) come
   first, the recording is cut at the end and a warning says so. Shorter than 15 s is an error that suggests a longer
   recording, a wider trim or cards. No speed changes or other effects (Apple: no implied functionality).
5. **Audio.** The recording's own audio is resampled to 48 kHz stereo and faded; without audio and for the cards a
   silent stereo track (`anullsrc`), because Apple requires stereo audio.
6. **Poster frame.** Apple's poster frame is chosen in App Store Connect per preview (default 5 s), not uploaded. The
   tool offers `renderPreviewFrame` / `GET /api/video/frame` for the UI (#23) to pick a time; only manifest entries of
   preview specs are read, so the route cannot read other files.
7. **Validation.** The rendered file is measured with ffprobe (`probeVideo`, rotation-aware) and validated against the
   catalogue entry before registration; the export checklist uses the same probe. Without ffprobe the checklist
   warns instead of failing.
8. **Tools.** `src/core/video/tools.ts` owns binary lookup and process helpers (no shell, separate arguments);
   `jobs/frames.ts` re-exports them. `FFPROBE_PATH` is new; by default ffprobe is taken from the folder of
   `FFMPEG_PATH`, then from the PATH.
9. **Tests.** Pure planning, args and probe parsing run everywhere. Real renders (short `testsrc2` recordings) run when
   ffmpeg is installed; CI installs it so they run there too.

10. **Review fixes.** Encoded previews are registered from their temp files (`RegisterOptions.sourceFile`, copied in
    `registerOutputs`) instead of being held in memory. Identical encodes and cards (same recording, size, plan,
    texts, background) are made once. Limits come from the catalogue (`maxCount`, `video.maxFps`, `minSeconds`,
    `maxSeconds`, sizes in messages). `replaceSets` covers both preview sizes, so an iPad preview goes when the
    project drops iPad. The frame route checks the time against the measured length. ffprobe falls back to the PATH
    when none lies beside `FFMPEG_PATH`. `-protocol_whitelist file` on every input read from the workspace
    (security review hardening). x264 preset `veryfast` keeps renders short.

## Not in this change

- Video section UI (#23), persisted video settings, embedded / looping videos (#21), promo reels (#22).
