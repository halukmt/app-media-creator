# Rules for App Store and Google Play listing texts

General rules for store listing texts. They come from the store guidelines and from what works on product pages; they
hold for every app. The exact limits per field are in `brief.json` (`storeTexts.fields`).

## All fields

1. **Facts only.** Every sentence comes from what the app really does. No invented numbers, prices, awards, user counts,
   dates or "new". No superlatives or rankings ("best", "#1", "top", "number one"). App Store guideline 2.3; Google Play
   metadata policy.
2. **Claims list.** `claims.json` lists `allowed` and `forbidden` claims. Never use a forbidden claim, also not in other
   words. Privacy claims ("no tracking", "your data stays on your device") only when they are allowed claims.
3. **No other brands.** No names of other apps, companies or stores, also not in keywords. No "for iPhone" in Play texts or
   "for Android" in App Store texts.
4. **Localize, don't translate.** The same facts in every language, phrased by a native copywriter for that market.
   Keep the product name as it is.
5. **Plain, honest tone.** Friendly and direct, no hype, no exclamation marks in name, subtitle or title.
6. **Within the limit.** Stay within `max` in its `unit`. Apple keywords count bytes (UTF-8): letters such as ü, ş, ğ,
   é take two bytes.

## App Store

7. **App name** (30): the brand, optionally with a short descriptor ("Teamfinder: Fair Teams"). At least 2 characters.
8. **Subtitle** (30): what the app does for the user in a few words. Do not repeat words of the name.
9. **Promotional text** (170): the current main message; it can change without an app update, so it may name a
   season or a new feature that really shipped.
10. **Description** (4000, plain text, no HTML): the first two or three lines are visible without "more", so they carry
    the outcome. Then the main features as short paragraphs or simple lines (no decorative emoji), then trust points
    that are allowed claims. No keyword lists in the description.
11. **Keywords** (100 bytes): single words or short phrases separated by commas, **without spaces after commas**. Do
    not repeat words from the name or subtitle (they already count), no plurals of words already listed, no app or
    company names, no "app". Research them per language: the words people in that market search for.
12. **What's new** (4000): what changed for the user in this version, in plain sentences. Required for every version
    after the first.

## Google Play

13. **App name** (30): the brand with an optional short descriptor. No emoji, no ALL CAPS (unless the brand is written
    that way), no ranking, price or promotion words ("free", "sale", "top", "new").
14. **Short description** (80): the main benefit in one sentence. Shown under the screenshots before "more".
15. **Full description** (4000): like the App Store description. Google Play also uses it for search: name the main
    features in natural sentences; never repeat keywords or list them. No unattributed user testimonials.
