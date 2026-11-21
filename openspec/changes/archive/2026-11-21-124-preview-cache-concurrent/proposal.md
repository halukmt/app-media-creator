Issue: #124

## Why

Codex on #123: concurrent requests that miss the same preview key each render and each add their bytes to the cache
total while the map keeps only one buffer. The total drifts upwards, the usable capacity shrinks, and after enough
overlapping misses every new preview is evicted at once.

## What Changes

- Requests that miss the same key at the same time share one render.
- Storing a key that already exists subtracts the old buffer first, so the total always equals the cached bytes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None (bug fix inside the existing preview cache; no requirement changes).

## Impact

- `src/server/preview-cache.ts`, `tests/unit/preview-cache.test.ts`, CHANGELOG.
