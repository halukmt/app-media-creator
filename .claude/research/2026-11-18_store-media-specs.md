# Store media specifications (research 2026-11-18)

Catalogue of all **media** assets (not text metadata) for the Apple App Store, Google Play and web/social.
This file is the source for `src/core/specs/`. Items marked **unverified** come from third-party sources
or general knowledge and must carry `verified: false` in the catalogue.

Apple and Google pages show only a "© 2026" footer, no update date. The Apple HIG app icon page change log
runs to 2026-10-28. Pages that need JavaScript and could not be read: Apple "Promotional Artwork Guidelines"
(featuring nominations), the device frame download page.

## A. App Store Connect screens (reference PDFs)

Source: 14 screenshots of App Store Connect pages (German UI) from an existing app, kept outside this repo.

| PDF | Page | Media slots |
|---|---|---|
| 1 | Version page "Produktseiteninformationen" | Tabs **"Kopfzeile und Suchergebnisse"** (sub-tabs header / search results, "0 von 1 Kopfzeilen-Inhalt", supported sizes **5244×2950 and 3840×1646**, "Vorlagen durchsuchen") and "App-Vorschauen und Bildschirmfotos". Banner announces iPhone Duo previews and screenshots. |
| 6 | In-app events | Up to 15 approved, 10 published events. Media slots appear per event. |
| 7 | Custom product pages | 0 of 70. Own previews, screenshots, promo text per page. |
| 8 | Asset library ("Inhalts-Mediathek") | Central media library; raw screenshots and framed marketing screenshots per language. |
| 9 | Product page optimization | Up to 3 treatments per test. |
| 10 | Game Center | Achievement/leaderboard artwork (not opened). |
| 11 | Pricing and availability | Apple Silicon Mac availability on; Vision Pro off. |
| 12 / 13 | In-app purchases / subscriptions | Promo image per purchase; retention messaging with creative content. |
| 14 | Featuring nominations | Landing card only. |

Other PDFs (2, 3, 4, 5) have no media slots.

## B. Apple App Store

### B1. Screenshots

Source: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications

- 1–10 screenshots per device size and language. Formats `.jpeg`, `.jpg`, `.png`, **no alpha**.
- If the UI is the same across sizes, only the largest required size is needed; smaller sizes are scaled.

**iPhone**

| Display class | Portrait | Required |
|---|---|---|
| iPhone Duo outer | 1398×2034 (landscape 2034×1398) | Optional now, **required from April 2027** for iOS 27.1 SDK builds |
| iPhone Duo inner | 2007×2853 (landscape 2853×2007) | Same |
| Dynamic Island large 6.9"/6.7" | 1260×2736, 1290×2796, 1320×2868 | Optional (scaled from Face ID large) |
| Face ID large 6.5" | 1284×2778, 1242×2688 | Required if Dynamic Island large missing |
| **Dynamic Island medium 6.3"** | 1179×2556, 1206×2622 | **Required (at least 1)** |
| Face ID medium 6.1"/5.8"/5.4" | 1170×2532, 1125×2436, 1080×2340 | Optional |
| Home button 5.5" | 1242×2208 | Optional |
| Home button 4.7" | 750×1334 | Optional |
| 4" | 640×1096, 640×1136 | Optional |
| 3.5" | 640×920, 640×960 | Optional |

Landscape = swapped values.

**iPad**

| Display | Portrait | Required |
|---|---|---|
| **13"** | 2064×2752 or 2048×2732 | **Required** if the app runs on iPad |
| 12.9" (2nd gen) | 2048×2732 | Scaled from 13" |
| 11" | 1488×2266, 1512×2316, 1668×2420, 1668×2388, 1640×2360 | Scaled |
| 10.5" | 1668×2224 | Scaled |
| 9.7" | 1536×2008, 1536×2048, 768×1004, 768×1024 | Scaled |

**Other platforms:** Mac 1280×800 / 1440×900 / 2560×1600 / 2880×1800; Apple TV 1920×1080 / 3840×2160;
Vision Pro 3840×2160; Watch Ultra 4/3 422×514, Ultra 2/1 410×502, Series 12/11/10 416×496,
Series 9/8/7 396×484, Series 6/5/4/SE 368×448, Series 3 312×390.

Store behaviour (https://developer.apple.com/app-store/product-page/): up to 10 screenshots on the product page;
without an app preview the first 1–3 screenshots show in search results; at least one Dark Mode screenshot recommended.

### B2. App previews

Source: https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications

| Item | Spec |
|---|---|
| Count | Up to 3 per device size and language, optional |
| Length | 15–30 s |
| File size | ≤ 500 MB |
| Container | `.mov`, `.m4v`, `.mp4` (H.264); `.mov` (ProRes 422 HQ) |
| H.264 | 10–12 Mbps, progressive, up to High Profile Level 4.0, max 30 fps |
| Audio | Stereo, AAC 256 kbps 44.1/48 kHz (ProRes also PCM); all tracks enabled |
| Poster frame | Default frame at 5 s, selectable |
| Orientation | iOS portrait or landscape; Mac, tvOS, visionOS landscape only |

| Device | Portrait | Landscape |
|---|---|---|
| iPhone Duo, 6.9"/6.7"/6.5"/6.3"/6.1" | **886×1920** | 1920×886 |
| 5.5" and 4" | 1080×1920 | 1920×1080 |
| 4.7" | 750×1334 | 1334×750 |
| iPad 13"/11"/10.5" | 1200×1600 | 1600×1200 |
| iPad 12.9" (2nd gen) | 1200×1600 or 900×1200 | swapped |
| iPad 9.7" | 900×1200 | 1200×900 |
| Mac / Apple TV | — | 1920×1080 |
| Vision Pro | — | 3840×2160 |

Content rules (https://developer.apple.com/app-store/app-previews/): only footage captured from the app;
transitions must not imply functionality the app does not have.

**Open issue:** iPhone Duo previews accept only 886×1920; native Duo proportions failed processing
(https://developer.apple.com/forums/thread/849757, FB25097203). Treat Duo preview export as experimental.

### B3. Creative assets: product page header and search results ("moving backgrounds")

Sources: https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications,
https://developer.apple.com/videos/play/wwdc2026/205/, PDF 1.

- Optional. Shown on iOS 27 / iPadOS 27 and later. Submitted standalone via the asset library.
- One universal asset for both placements, or one dedicated asset per placement. Usable in Apple Ads and custom product pages.
- Images: no alpha. Videos loop; muted in search results; product page starts muted.

| Asset | Type | Ratio | Resolution | Art safe area (w×h at x,y) | Format | Video |
|---|---|---|---|---|---|---|
| Product page header | Image | 21:9 | 3840×1646 | 1646×661 at (1097, 493) | PNG only | — |
| Product page header | Video | 21:9 | 3840×1646 | same | mov/m4v/mp4 | 30 or 60 fps, 5–30 s |
| Search results | Image | 3:2 | 1920×1280 – 3840×2560 | max 2168×1030 at (836, 765) | jpeg/jpg/png | — |
| Search results | Video | 3:2 | 1920×1280 – 3840×2560 | — | mov/m4v/mp4 | 30 or 60 fps, 5–30 s |
| Universal | Image | 16:9 | 5244×2950 | 1402×962 at (1921, 660) | PNG only | — |

Design guidance (https://developer.apple.com/app-store/asset-best-practices/): key art inside the art safe area,
background across the auxiliary art area; text = one short localized phrase; videos need a strong poster frame,
a seamless loop, no fast cuts, must work without sound. Codec, bitrate and file-size limits are not stated (unverified).

### B4. In-app event media

| Asset | Ratio | Resolution | Format | Video | Max size |
|---|---|---|---|---|---|
| Event card | 16:9 | 1920×1080 – 3840×2160 | jpg/png or mov/m4v/mp4 | 30/60 fps, 5–30 s | 500 MB |
| Event details | 9:16 | 1080×1920 – 2160×3840 | same | same | 500 MB |

Apple adds crops and gradients; avoid own borders, gradients, text and logos.

### B5. Custom product pages and product page optimization

- Custom product pages: up to 70; vary screenshots, previews, promo text, keywords, deep link.
- Product page optimization: up to 3 treatments, one test at a time, max 90 days; tests icon, screenshots, previews.
  Alternate icons must be in the shipped binary.

### B6. App icon and Icon Composer

Sources: https://developer.apple.com/icon-composer/, HIG app icons (JSON variant).

| Platform | Canvas | Shape | Layers |
|---|---|---|---|
| iOS, iPadOS, macOS | 1024×1024 | Rounded rectangle | 1 background + ≥1 foreground |
| watchOS | 1088×1088 | Circle | same |
| visionOS | 1024×1024 | Circle (3D) | 1 background + 1–2 layers |
| tvOS | 800×480 | Rounded rectangle | 2–5 layers |

- Appearances: default, dark, clear-light, clear-dark, tinted-light, tinted-dark (system generates missing ones).
- Layers: square, full-bleed, **not pre-masked**, opaque background, no feathered edges; vector preferred (SVG/PDF), PNG for raster.
- Color spaces: sRGB, Gray Gamma 2.2, Display P3.
- Icon Composer runs on macOS Tahoe 26.4+, exports a layered file plus a flattened marketing export.
  File extension `.icon` is **unverified**. Our tool exports layer-ready files only.
- Legacy `AppIcon.appiconset` sizes (20/29/40/60 pt @2x/@3x, iPad 76/83.5 pt @2x, 1024) are **unverified**; a single 1024 icon is enough since Xcode 14.

### B7. Marketing assets and device frames

Source: https://developer.apple.com/app-store/marketing/guidelines/, https://developer.apple.com/design/resources/

- Badges: Apple-provided only, black preferred; min height 40 px on screen; clear space ¼ badge height; never modify or animate.
- **Device frames:** Apple-provided bezels only, unmodified, latest-generation devices; no reflections, shadows, tilting,
  cropping, cases or 3D renders; min device height 200 px; text beside the device, not over it.
  Bezels must not be redistributed → the tool ships its own generic frames and lets users add official bezels locally.
- Featuring artwork specs (https://help.apple.com/asc/appspromoart/): **unverified**.

## C. Google Play

Sources: https://support.google.com/googleplay/android-developer/answer/9866151,
https://developer.android.com/distribute/google-play/resources/icon-design-specifications

| Asset | Required | Size | Format | Notes |
|---|---|---|---|---|
| App icon | Yes | 512×512 | 32-bit PNG with alpha, sRGB, ≤1024 KB | Full square, no rounding or shadow (Play applies 30 % radius + shadow), no badges |
| Feature graphic | Yes | 1024×500 | JPEG or 24-bit PNG, no alpha | Key elements centred, don't repeat the icon, alt text ≤140 chars |
| Phone screenshots | ≥2 total across device types | each side 320–3840, long side ≤2× short side | JPEG or 24-bit PNG, no alpha | Up to 8; recommended ≥4 at 1080×1920 or 1920×1080 |
| 7" / 10" tablet screenshots | Optional | each side 1080–7680, 16:9 or 9:16 | same | ≥4, up to 8 |
| Chromebook screenshots | Optional | same as tablets | same | ≥4 |
| Android TV banner | TV apps | 1280×720 | JPEG or 24-bit PNG | In-app banner 320×180 (xhdpi) |
| Android TV screenshots | TV apps, ≥1 | **unverified** (commonly 1920×1080) | — | |
| Wear OS screenshots | Wear apps, ≥1 | 1:1, ≥384×384 | — | **No device frames**, no extra text |
| Android XR screenshots | XR apps, 4–8 | 8:5, 3840×2400 recommended | PNG/JPEG ≤8 MB | |
| Automotive screenshots | Most categories | 2× 800×1280 + 2× 1024×768 | — | |
| Promo video | Optional | — | One YouTube URL | Public or unlisted, no ads, embeddable; autoplays muted up to 30 s; no black bars on portrait |
| Promotional content (LiveOps) | Event-based | **unverified** | — | No text or logos on images |

Screenshot content rules: device imagery discouraged ("can become obsolete"); no "Best/#1/Top/New/Sale", no CTAs,
no other store badges; overlay text **under 20 %** of the image; clean status bar.
The Device Art Generator says framed images must **not** be used in Play screenshots or the feature graphic.

**Adaptive launcher icon** (https://developer.android.com/develop/ui/views/launch/icon_design_adaptive):
foreground, background, optional monochrome (themed icons). Each layer 108×108 dp; inner 66×66 dp never clipped;
logo 48–66 dp. Defined in `mipmap-anydpi-v26/ic_launcher.xml`.

| Density | Legacy 48 dp icon | Adaptive 108 dp layer |
|---|---|---|
| mdpi | 48 | 108 |
| hdpi | 72 | 162 |
| xhdpi | 96 | 216 |
| xxhdpi | 144 | 324 |
| xxxhdpi | 192 | 432 |

## D. Web and social

| Asset | Size | Format | Status |
|---|---|---|---|
| favicon.ico | 32×32 (16, 48 optional) | ICO | Secondary source (evilmartians "How to Favicon", 2026-01) |
| icon.svg | vector, dark-mode media query | SVG | same |
| apple-touch-icon | 180×180, artwork ~140 px on solid background | PNG | same |
| Manifest icons | 192×192, 512×512 | PNG | https://web.dev/articles/add-manifest |
| Maskable icon | 512×512, artwork inside 409 px circle | PNG `purpose: maskable` | web.dev |
| Manifest screenshots | 320–3840, ratio ≤2.3, `form_factor` wide/narrow | PNG/JPEG | web.dev |
| Safari mask-icon, MS tile | obsolete, optional legacy | — | evilmartians |
| Open Graph | 1200×630, ≤8 MB | JPG/PNG | https://developers.facebook.com/docs/sharing/webmasters/images/ |
| X `summary_large_image` | 1200×628 (2:1), ≤5 MB | JPG/PNG/WEBP | **unverified** |
| WhatsApp link preview | og:image ≥300 px wide, ratio ≤4:1, <600 KB (aim ≤300 KB) | JPG/PNG | Meta docs + community reports |
| WhatsApp profile | 640×640 | — | **unverified** |
| Instagram profile | 320×320 | — | **unverified** |
| Facebook profile / cover | 320×320 / 1640×624 | — | **unverified** |
| LinkedIn profile / banner | 400×400 / 1584×396 | — | **unverified** |
| LinkedIn company logo / cover | 300×300 / 1128×191 | — | **unverified** |
| X profile / header | 400×400 / 1500×500 | — | **unverified** |
| YouTube profile / banner | 800×800 / 2560×1440 (safe 1546×423) | — | **unverified** |
| TikTok profile | ≥200×200 (1080×1080 typical) | — | **unverified** |
| Email signature logo | ~300×100 (@2x) | PNG | **unverified** |
| Logo variants | full colour, monochrome, dark, inverse/white, square mark, horizontal wordmark | SVG/PNG | Design practice |

## Not verified

Apple featuring artwork; codec/bitrate/size limits for header and search videos; Play promotional content sizes;
Android TV screenshot size; X card; all social profile and banner sizes; Icon Composer file extension and export sizes.
