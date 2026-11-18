# Copy rules for screenshot headlines and store texts (research 2026-11-18)

Generic rules for the AI that writes screenshot headlines and store texts (used by the `amc-copy` skill).
Derived from App Store and Google Play guidelines and from a real store listing review of an existing app;
the app-specific findings are kept outside this repo.

## Rules

1. **Story order, outcome first:** (1) promise / outcome screen, (2) why to trust it (concrete mechanism),
   (3) next step after the outcome, only if it exists, (4+) supporting features, (last) trust points, only if verifiably true.
2. **Screens 1–3 must work alone.** They appear in search results without a preview video.
3. **One idea per screenshot.** The headline must describe what the screenshot visibly shows.
   Never advertise a feature that is hidden or not in the shipped build.
4. **No invented facts:** no unproven numbers, prices, dates or "new", competitor names, superlatives ("best", "#1").
   Apple App Review Guideline 2.3.14; Play forbids "Best / #1 / Top / New / Sale" and calls to action.
5. **Claims list per project:** `claims.json` with `allowed` and `forbidden` entries. The AI must never use a forbidden claim.
   Privacy claims ("your data stays on your device", "no tracking") only when the app really has no analytics or crash reporting.
6. **Concrete over abstract:** name the visible mechanism instead of an adjective ("rate speed and stamina" beats "smart algorithm").
7. **Separate from competitors' positioning** when the project defines one.
8. **Length:** headline ≤ ~30 characters, 2–5 words; optional subline ≤ ~40 characters; active voice, user's perspective,
   no exclamation marks, no dashes.
9. **Localize, don't translate:** same facts, native phrasing per locale.
10. **Variants:** A = outcome-first, B = mechanism-first (one product page optimization treatment);
    optional per-audience sets for custom product pages.
11. **Tone:** plain, honest, low hype. Longer store texts get a humanizer pass (ste80-humanizer, Light mode).
12. **Google Play:** overlay text under 20 % of the image area.

## Product page optimization facts (Apple)

- Tests icon, screenshots and app previews only, not name or subtitle.
- One test at a time, up to 3 treatments (use 1 for low traffic), max 90 days; judge by impressions → page views →
  first-time downloads → conversion, without worse activation.
