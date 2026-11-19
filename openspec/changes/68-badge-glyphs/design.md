# Design

## Decisions

1. **Reject at validation** with `cardFont(800).missing(badge)`, the same check the screenshot text renderer uses for
   its `missing-glyphs` warning.
   - *Alternative:* a font fallback (e.g. Noto for Cyrillic and CJK). Rejected for now: it adds font files to the
     package for a label that is a short code (PREVIEW, DEV, BETA).
   - *Alternative:* a warning at generation time. Rejected: the user would only find out after generating, and the
     icons would still be wrong.
2. Labels are short codes and are written in capitals, so a Latin-only label is no real limitation.

## Review log

- **/code-review:** no findings.
