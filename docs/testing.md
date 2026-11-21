# Running the tests fast

The unit tests render real images and videos in store sizes, so a full `npm test` is CPU-bound. These settings keep
it as short as the machine allows (#77).

## One temp folder for all test workspaces

Every unit test writes into one folder, by default `<system temp>/app-media-creator-tests`
(on Windows `%TEMP%\app-media-creator-tests`). Set `AMC_TEST_TMP` to move it.

An antivirus scanner that reads every written PNG and MP4 slows the run down a lot. Excluding this one folder from
real-time scanning is safe: it only ever holds files the tests generate. On Windows (Defender, as administrator):

```powershell
Add-MpPreference -ExclusionPath "$env:TEMP\app-media-creator-tests"
```

The folder is not cleaned up automatically; delete it at any time when no test run is active.

## Encoder settings in the tests

`vitest.config.ts` sets two variables that the app also reads (both optional, see `.env.example`):

| Variable | Tests | App default | Effect |
|---|---|---|---|
| `AMC_X264_PRESET` | `ultrafast` | `veryfast` | x264 speed preset; faster gives larger files, the tests check sizes, durations and streams |
| `AMC_FFMPEG_THREADS` | `2` | all cores | encoder threads per video; many encodes run at once in the tests |

The seamless-loop test sets `veryfast` itself, because its seam check compares a keyframe with the frames around it.
`tests/setup.ts` limits sharp to one libvips thread per Vitest worker for the same reason as the encoder threads.

## Finding slow tests

```sh
npx vitest run --reporter=json --outputFile=vitest-report.json
```

The report lists the duration of every test (`assertionResults[].duration`). Tests that encode full-size store videos
live in their own files (`video-loops.test.ts`, `store-previews-ipad.test.ts`) so they run in parallel to the rest.
