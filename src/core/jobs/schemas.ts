import { z } from 'zod';

/**
 * The job folder contract between the tool and the AI (the `amc-copy` / `amc-video` skills or the optional API
 * client). The tool writes `brief.json`, `claims.json`, `images/`, `frames/` and `schemas/`; the AI writes the result
 * files below. Every result is validated against these schemas before anything is applied.
 */

export const JOB_VERSION = 1;
/** Longest headline or subline the screenshot sets store (MAX_TEXT in screenshot-sets.ts). */
const MAX_TEXT = 200;
/** Longest store text file (the store text catalogue's MAX_STORE_TEXT). */
export { MAX_STORE_TEXT } from '../specs/texts.js';

const copy = z.object({
  headline: z.string().trim().min(1, 'headline is required').max(MAX_TEXT),
  subline: z.string().trim().max(MAX_TEXT).default(''),
});

/** `headlines.json`: per locale, per screenshot slot, variant A (outcome first) and B (mechanism first). */
export const headlinesSchema = z.object({
  version: z.literal(JOB_VERSION),
  locales: z.record(
    z.string(),
    z.object({
      slots: z
        .array(
          z.object({
            /** The `input` of the slot in brief.json, so a result always names the screenshot it belongs to. */
            input: z.string().min(1),
            A: copy,
            B: copy,
          }),
        )
        .min(1)
        .max(10),
    }),
  ),
});
export type HeadlinesResult = z.infer<typeof headlinesSchema>;

/** `storyboard.json`: scenes of a promo or preview video with a caption per locale (used by the video skills). */
export const storyboardSchema = z.object({
  version: z.literal(JOB_VERSION),
  scenes: z
    .array(
      z.object({
        /** Image of the brief (`images/…` or `frames/…`) the scene shows. */
        image: z.string().min(1),
        seconds: z.number().min(0.5).max(30),
        captions: z.record(z.string(), z.string().trim().max(MAX_TEXT)),
      }),
    )
    .min(1)
    .max(30),
});
export type StoryboardResult = z.infer<typeof storyboardSchema>;

/** Store text files the AI may write as `store-texts/<locale>/<field>.md` (the store text catalogue). */
export { STORE_TEXT_FIELDS, type StoreTextField } from '../specs/texts.js';

/** JSON Schema files written into every job folder, so the skill can check its output before saving it. */
export function resultJsonSchemas(): Record<string, unknown> {
  return {
    'headlines.schema.json': z.toJSONSchema(headlinesSchema, { io: 'input' }),
    'storyboard.schema.json': z.toJSONSchema(storyboardSchema, { io: 'input' }),
  };
}
