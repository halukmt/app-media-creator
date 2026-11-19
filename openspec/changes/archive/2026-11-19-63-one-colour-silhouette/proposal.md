Issue: #63

# Proposal

## Why

`renderSilhouette` treats the colour of the first covered pixel of an opaque logo as its background and removes every
pixel close to it. For a logo that is one solid colour (a filled square without transparency, a flat JPEG mark)
every pixel is removed, so `ic_launcher_monochrome.png`, the web monochrome and inverse logo variants, the blueprint
icon variants and the monochrome preview in the Logo section come out fully transparent.

## What Changes

- Whether an opaque logo has a background to cut out is decided once per logo from the source image: only when at
  least 60 % of its border shares one corner's flat colour and at least 0.1 % of its pixels differ from it. A one-colour mark and a gradient
  mark keep their full coverage instead of coming out empty or as a partial shape.
- Every size and variant rendered from one logo uses the same decision, so densities never disagree.
- Logos on a separate background colour (a red mark on white, line art on white, a cropped wordmark touching the edge) keep working as before.

Acceptance criteria from the issue:
- When removing the background colour would leave (almost) nothing, the silhouette keeps the full coverage.
- Unit test with a one-colour opaque logo: the monochrome layer has visible pixels.

Targets: Google Play (monochrome layer); the shared function also serves web logo variants and blueprint icons.
Locales: shared (no text).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `android-icons`: the monochrome layer of a one-colour opaque logo is not empty.

## Impact

- `src/core/generators/render.ts`; tests in `tests/unit/android-icons.test.ts` and `tests/unit/share-images.test.ts`,
  factories in `tests/factories/logos.ts`.
