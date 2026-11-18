import type { MediaProperties } from '../../src/core/specs/index.js';

/** Measured properties of a valid-looking PNG; override what a test needs. */
export function imagePropsFactory(overrides: Partial<MediaProperties> = {}): MediaProperties {
  return { width: 1206, height: 2622, format: 'png', hasAlpha: false, bytes: 2 * 1024 * 1024, ...overrides };
}

/** Measured properties of a valid-looking app preview video; override what a test needs. */
export function videoPropsFactory(overrides: Partial<MediaProperties> = {}): MediaProperties {
  return {
    width: 886,
    height: 1920,
    format: 'mp4',
    hasAlpha: false,
    bytes: 40 * 1024 * 1024,
    durationSeconds: 25,
    fps: 30,
    audioChannels: 2,
    ...overrides,
  };
}
