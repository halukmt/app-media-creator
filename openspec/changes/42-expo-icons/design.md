# Design

## Decisions

1. **One `expo` folder per store.** Expo files belong to both app stores; each store's folder holds its images and its
   `app.json` fragment, so a store-only project gets a complete set. The docs say to copy both folders into
   `assets/expo/`; the fragments point there.
2. **Verified only what Expo states.** The keys, the 1024 × 1024 recommendation and the opaque, exactly square iOS icon
   come from the Expo docs (checked 2026-11-20). Dark, tinted and the Android layers carry `verified: false`: Expo
   names no size or rule; the renders follow Apple's dark / tinted rules and the Android safe circle of the native pack.
3. **Same renders as the native packs.** The iOS images reuse the App Store pack's light / dark / tinted renders; the
   adaptive layers reuse `ADAPTIVE_LOGO_SHARE` and the silhouette of the Android pack, at 1024 px. The background is
   the Logo background and becomes `backgroundColor`.
4. **Opt-in pack.** New projects do not get it by default (most apps are not Expo apps); the pack is offered while the
   App Store or Google Play is on (`PACK_TARGETS` in the Logo page).
5. **No environments.** Expo picks icon variants per build profile in `app.config.js`; the pack writes production only.
6. **No `.icon` directory.** Expo SDK 54+ also accepts an Icon Composer `.icon` in `ios.icon`; building one needs
   Icon Composer on macOS. The docs point to the layer files of the App Store pack.
7. **Review fixes.** Every run replaces all Expo entries, so the files of a store turned off since are removed. The
   Android fragment also sets `android.icon` (a 1024 legacy icon in the Google Play folder) for launchers without
   adaptive icons. `packOf` uses the Expo spec ids. The iOS appearances come from one shared `renderIosAppearances`
   (App Store and Expo pack), rendered from the logo itself; the monochrome colour is shared with the Android pack.
   Unverified entries point to Apple's and Android's own icon pages.
8. **Design check.** The hint wording matches the other cards ("appearances", "snippet"); with only one app store on,
   the card shows "<store> only", because only that store's part is made.
