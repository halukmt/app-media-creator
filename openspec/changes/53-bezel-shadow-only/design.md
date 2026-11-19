# Design

## Decision

The lower layer uses a shadow-only filter (`feGaussianBlur` on `SourceAlpha` → `feOffset` → `feFlood` black 30 % →
`feComposite in`) instead of `feDropShadow`, which merges the source graphic. Same blur and offset as the generic
frames (`SHADOW`). This was the rejected alternative in #51; the review showed why it is needed.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
