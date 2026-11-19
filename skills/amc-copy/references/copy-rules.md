# Copy rules for store screenshot headlines

General rules for writing App Store and Google Play screenshot headlines. They come from the store guidelines and from
what works on product pages; they hold for every app.

1. **Story order, outcome first:** (1) the promise or outcome, (2) why to trust it (the concrete mechanism), (3) the
   next step after the outcome, only if it exists, (4+) supporting features, (last) trust points, only if verifiably
   true. The slots keep the user's order; write each headline for its position in that story.
2. **Screens 1–3 must work alone.** They appear in search results without the rest of the page or a video.
3. **One idea per screenshot.** The headline describes what the screenshot visibly shows. Never advertise a feature that
   is hidden or not in the shipped app.
4. **No invented facts:** no numbers, prices, dates or "new" you cannot prove, no competitor names, no superlatives
   ("best", "#1", "fastest"). App Store guideline 2.3; Google Play forbids "Best", "#1", "Top", "New", "Sale" and calls
   to action such as "Download now".
5. **Claims list:** `claims.json` lists `allowed` and `forbidden` claims for this app. Never use a forbidden claim, also
   not in other words. Privacy claims ("your data stays on your device", "no tracking") only when the app really has no
   analytics or crash reporting, i.e. only when they are allowed claims.
6. **Concrete over abstract:** name the visible mechanism instead of an adjective ("Rate speed and stamina" beats
   "Smart algorithm").
7. **Own position:** describe what this app does, not what others do badly.
8. **Length:** the brief gives `limits` per slot (headline about 26–34 characters depending on the layout, subline about
   36–44); 2–5 words per headline. Active voice, the user's perspective, no exclamation marks, no dashes as decoration.
9. **Localize, don't translate:** the same facts in every language, phrased the way a native copywriter in that market
   would write them. Adapt idioms, word order and length; keep product names as they are.
10. **Variants:** A is outcome-first, B is mechanism-first. Both follow every rule above; they differ in angle, not in
    facts. The user tests them against each other (App Store product page optimization) or simply picks one.
11. **Tone:** plain, honest, low hype. Friendly, never pushy.
12. **Google Play:** keep overlay text short; Play recommends that text covers under 20 % of the image.
