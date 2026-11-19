import type { SpecEntry, Size } from './types.js';

// Sources (checked 2026-11-18, see .claude/research/2026-11-18_store-media-specs.md section B).
const SCREENSHOTS = 'https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications';
const PREVIEWS = 'https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications';
const CREATIVE = 'https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications';
const ICONS = 'https://developer.apple.com/design/human-interface-guidelines/app-icons';

const MB = 1024 * 1024;
const sizes = (...pairs: [number, number][]): Size[] => pairs.map(([width, height]) => ({ width, height }));

function screenshot(
  id: string,
  name: string,
  dims: Size[],
  options: { required?: boolean; condition?: string; rotatable?: boolean; notes?: string } = {},
): SpecEntry {
  return {
    id: `apple.screenshot.${id}`,
    target: 'apple',
    group: 'screenshot',
    name,
    kind: 'image',
    required: options.required ?? false,
    ...(options.condition ? { condition: options.condition } : {}),
    dimensions: { kind: 'fixed', sizes: dims, rotatable: options.rotatable ?? true },
    formats: ['png', 'jpeg'],
    alpha: 'forbidden',
    minCount: 1,
    maxCount: 10,
    localized: true,
    verified: true,
    sourceUrl: SCREENSHOTS,
    ...(options.notes ? { notes: options.notes } : {}),
  };
}

function preview(id: string, name: string, dims: Size[], rotatable: boolean, extraNote = ''): SpecEntry {
  return {
    id: `apple.preview.${id}`,
    target: 'apple',
    group: 'preview',
    name,
    kind: 'video',
    required: false,
    dimensions: { kind: 'fixed', sizes: dims, rotatable },
    formats: ['mp4', 'mov', 'm4v'],
    alpha: 'forbidden',
    maxBytes: 500 * MB,
    maxCount: 3,
    video: { minSeconds: 15, maxSeconds: 30, maxFps: 30, audioChannels: 2 },
    localized: true,
    verified: true,
    sourceUrl: PREVIEWS,
    notes: `H.264 10–12 Mbps or ProRes 422 HQ; stereo AAC 256 kbps; only footage captured from the app.${extraNote}`,
  };
}

const CREATIVE_VIDEO = { minSeconds: 5, maxSeconds: 30, allowedFps: [30, 60] } as const;

export const APPLE_SPECS: readonly SpecEntry[] = [
  // Screenshots: iPhone
  screenshot('iphone-duo-outer', 'iPhone Duo, outer display', sizes([1398, 2034]), {
    notes: 'Required from April 2027 for apps built with the iOS 27.1 SDK or later.',
  }),
  screenshot('iphone-duo-inner', 'iPhone Duo, inner display', sizes([2007, 2853]), {
    notes: 'Required from April 2027 for apps built with the iOS 27.1 SDK or later.',
  }),
  screenshot('iphone-6.9', 'iPhone 6.9" / 6.7" (Dynamic Island large)', sizes([1260, 2736], [1290, 2796], [1320, 2868])),
  screenshot('iphone-6.5', 'iPhone 6.5" (Face ID large)', sizes([1284, 2778], [1242, 2688]), {
    condition: 'Required if no 6.9" screenshots are provided.',
  }),
  screenshot('iphone-6.3', 'iPhone 6.3" (Dynamic Island medium)', sizes([1179, 2556], [1206, 2622]), {
    required: true,
  }),
  screenshot('iphone-6.1', 'iPhone 6.1" / 5.8" / 5.4" (Face ID medium)', sizes([1170, 2532], [1125, 2436], [1080, 2340])),
  screenshot('iphone-5.5', 'iPhone 5.5" (Home button large)', sizes([1242, 2208])),
  screenshot('iphone-4.7', 'iPhone 4.7" (Home button medium)', sizes([750, 1334])),
  screenshot('iphone-4.0', 'iPhone 4"', sizes([640, 1096], [640, 1136], [1136, 600], [1136, 640]), { rotatable: false }),
  screenshot('iphone-3.5', 'iPhone 3.5"', sizes([640, 920], [640, 960], [960, 600], [960, 640]), { rotatable: false }),

  // Screenshots: iPad
  screenshot('ipad-13', 'iPad 13"', sizes([2064, 2752], [2048, 2732]), {
    condition: 'Required if the app runs on iPad.',
  }),
  screenshot('ipad-12.9', 'iPad 12.9" (2nd generation)', sizes([2048, 2732])),
  screenshot('ipad-11', 'iPad 11"', sizes([1488, 2266], [1512, 2316], [1668, 2420], [1668, 2388], [1640, 2360])),
  screenshot('ipad-10.5', 'iPad 10.5"', sizes([1668, 2224])),
  screenshot(
    'ipad-9.7',
    'iPad 9.7"',
    sizes([1536, 2008], [1536, 2048], [768, 1004], [768, 1024], [2048, 1496], [2048, 1536], [1024, 748], [1024, 768]),
    { rotatable: false },
  ),

  // Screenshots: other platforms
  screenshot('mac', 'Mac', sizes([1280, 800], [1440, 900], [2560, 1600], [2880, 1800]), {
    condition: 'Required for Mac apps.',
    rotatable: false,
  }),
  screenshot('apple-tv', 'Apple TV', sizes([1920, 1080], [3840, 2160]), {
    condition: 'Required for tvOS apps.',
    rotatable: false,
  }),
  screenshot('vision-pro', 'Apple Vision Pro', sizes([3840, 2160]), {
    condition: 'Required for visionOS apps.',
    rotatable: false,
  }),
  screenshot('watch', 'Apple Watch', sizes([422, 514], [410, 502], [416, 496], [396, 484], [368, 448], [312, 390]), {
    condition: 'Required for watchOS apps; use the same size in every language.',
    rotatable: false,
  }),

  // App previews
  preview('iphone', 'App preview iPhone (incl. iPhone Duo, 6.9" to 6.1")', sizes([886, 1920]), true, ' iPhone Duo previews are experimental: Apple accepts only 886×1920 and native Duo proportions failed processing (developer forums thread 849757).'),
  preview('iphone-5.5', 'App preview iPhone 5.5" and 4"', sizes([1080, 1920]), true),
  preview('iphone-4.7', 'App preview iPhone 4.7"', sizes([750, 1334]), true),
  preview('ipad', 'App preview iPad 13", 11", 10.5"', sizes([1200, 1600]), true),
  // The 12.9" (2nd gen) takes both sizes, the 9.7" only the smaller one.
  preview('ipad-12.9', 'App preview iPad 12.9" (2nd gen)', sizes([1200, 1600], [900, 1200]), true),
  preview('ipad-9.7', 'App preview iPad 9.7"', sizes([900, 1200]), true),
  preview('mac', 'App preview Mac', sizes([1920, 1080]), false),
  preview('apple-tv', 'App preview Apple TV', sizes([1920, 1080]), false),
  preview('vision-pro', 'App preview Apple Vision Pro', sizes([3840, 2160]), false),

  // Creative assets: product page header and search results (iOS 27 and later)
  {
    id: 'apple.creative.header-image',
    target: 'apple',
    group: 'creative',
    name: 'Product page header (image)',
    kind: 'image',
    required: false,
    dimensions: { kind: 'fixed', sizes: sizes([3840, 1646]), rotatable: false },
    formats: ['png'],
    alpha: 'forbidden',
    maxCount: 1,
    safeArea: { x: 1097, y: 493, width: 1646, height: 661 },
    localized: true,
    verified: true,
    sourceUrl: CREATIVE,
    notes: 'Shown on iOS 27 / iPadOS 27 and later. Key art inside the safe area.',
  },
  {
    id: 'apple.creative.header-video',
    target: 'apple',
    group: 'creative',
    name: 'Product page header (looping video)',
    kind: 'video',
    required: false,
    dimensions: { kind: 'fixed', sizes: sizes([3840, 1646]), rotatable: false },
    formats: ['mp4', 'mov', 'm4v'],
    alpha: 'forbidden',
    maxCount: 1,
    video: CREATIVE_VIDEO,
    safeArea: { x: 1097, y: 493, width: 1646, height: 661 },
    localized: true,
    verified: true,
    sourceUrl: CREATIVE,
    notes: 'Loops; starts muted. Codec and file size limits are not stated by Apple.',
  },
  {
    id: 'apple.creative.search-image',
    target: 'apple',
    group: 'creative',
    name: 'Search results asset (image)',
    kind: 'image',
    required: false,
    dimensions: {
      kind: 'range',
      min: { width: 1920, height: 1280 },
      max: { width: 3840, height: 2560 },
      aspect: { ratio: 1.5, tolerance: 0.01 },
      orientation: 'landscape',
    },
    // The size the safe area is given for; the generator renders at this size.
    defaultSize: { width: 3840, height: 2560 },
    formats: ['png', 'jpeg'],
    alpha: 'forbidden',
    maxCount: 1,
    safeArea: { x: 836, y: 765, width: 2168, height: 1030 },
    localized: true,
    verified: true,
    sourceUrl: CREATIVE,
    notes: 'Safe area given for the 3840×2560 maximum size. Without this asset, search shows events, previews or screenshots.',
  },
  {
    id: 'apple.creative.search-video',
    target: 'apple',
    group: 'creative',
    name: 'Search results asset (looping video)',
    kind: 'video',
    required: false,
    dimensions: {
      kind: 'range',
      min: { width: 1920, height: 1280 },
      max: { width: 3840, height: 2560 },
      aspect: { ratio: 1.5, tolerance: 0.01 },
      orientation: 'landscape',
    },
    formats: ['mp4', 'mov', 'm4v'],
    alpha: 'forbidden',
    maxCount: 1,
    video: CREATIVE_VIDEO,
    localized: true,
    verified: true,
    sourceUrl: CREATIVE,
    notes: 'Always muted in search results.',
  },
  {
    id: 'apple.creative.universal-image',
    target: 'apple',
    group: 'creative',
    name: 'Universal asset for header and search (image)',
    kind: 'image',
    required: false,
    dimensions: { kind: 'fixed', sizes: sizes([5244, 2950]), rotatable: false },
    formats: ['png'],
    alpha: 'forbidden',
    maxCount: 1,
    safeArea: { x: 1921, y: 660, width: 1402, height: 962 },
    localized: true,
    verified: true,
    sourceUrl: CREATIVE,
    notes: 'One asset for both placements; also used for hero treatments on the Today and Games tabs.',
  },

  // In-app event media
  ...(['image', 'video'] as const).flatMap((kind): SpecEntry[] => [
    {
      id: `apple.event.card-${kind}`,
      target: 'apple',
      group: 'event',
      name: `In-app event card (${kind})`,
      kind,
      required: false,
      dimensions: {
        kind: 'range',
        min: { width: 1920, height: 1080 },
        max: { width: 3840, height: 2160 },
        aspect: { ratio: 16 / 9, tolerance: 0.01 },
        orientation: 'landscape',
      },
      // Rendered at the largest size: Apple crops the card for different placements.
      ...(kind === 'image' ? { defaultSize: { width: 3840, height: 2160 } } : {}),
      formats: kind === 'image' ? ['png', 'jpeg'] : ['mp4', 'mov', 'm4v'],
      alpha: 'forbidden',
      maxBytes: 500 * MB,
      ...(kind === 'video' ? { video: CREATIVE_VIDEO } : {}),
      localized: true,
      verified: true,
      sourceUrl: CREATIVE,
      notes: 'Apple adds crops and gradients; avoid own borders, text and logos.',
    },
    {
      id: `apple.event.details-${kind}`,
      target: 'apple',
      group: 'event',
      name: `In-app event details page (${kind})`,
      kind,
      required: false,
      dimensions: {
        kind: 'range',
        min: { width: 1080, height: 1920 },
        max: { width: 2160, height: 3840 },
        aspect: { ratio: 16 / 9, tolerance: 0.01 },
        orientation: 'portrait',
      },
      ...(kind === 'image' ? { defaultSize: { width: 2160, height: 3840 } } : {}),
      formats: kind === 'image' ? ['png', 'jpeg'] : ['mp4', 'mov', 'm4v'],
      alpha: 'forbidden',
      maxBytes: 500 * MB,
      ...(kind === 'video' ? { video: CREATIVE_VIDEO } : {}),
      localized: true,
      verified: true,
      sourceUrl: CREATIVE,
      notes: 'Apple adds crops and gradients; avoid own borders, text and logos.',
    },
  ]),

  // App icon
  {
    id: 'apple.icon',
    target: 'apple',
    group: 'icon',
    name: 'App Store icon',
    kind: 'image',
    required: true,
    dimensions: { kind: 'fixed', sizes: sizes([1024, 1024]), rotatable: false },
    formats: ['png'],
    alpha: 'forbidden',
    localized: false,
    verified: true,
    sourceUrl: ICONS,
    notes: 'Square, full-bleed, not pre-masked, opaque. Dark and tinted variants use the same size.',
  },
  ...(
    [
      ['dark', 'App icon, dark appearance', 'The logo on a transparent background; the system draws the dark backdrop.'],
      ['tinted', 'App icon, tinted appearance', 'The logo in grey tones on a transparent background; the system applies the tint.'],
    ] as const
  ).map(
    ([variant, name, notes]): SpecEntry => ({
      id: `apple.icon-${variant}`,
      target: 'apple',
      group: 'icon',
      folder: 'icon',
      name,
      kind: 'image',
      required: false,
      condition: 'Added to the app asset catalog (iOS 18 and later); not uploaded to App Store Connect.',
      dimensions: { kind: 'fixed', sizes: sizes([1024, 1024]), rotatable: false },
      formats: ['png'],
      alpha: 'allowed',
      localized: false,
      verified: false,
      sourceUrl: ICONS,
      notes,
    }),
  ),
  {
    id: 'apple.icon-layer-background',
    target: 'apple',
    group: 'icon',
    folder: 'icon-composer',
    name: 'Icon Composer background layer',
    kind: 'image',
    required: false,
    condition: 'Imported into Icon Composer (macOS) to build a layered Liquid Glass icon.',
    dimensions: { kind: 'fixed', sizes: sizes([1024, 1024]), rotatable: false },
    formats: ['png'],
    alpha: 'forbidden',
    localized: false,
    verified: true,
    sourceUrl: ICONS,
    notes: 'Square, full bleed, not pre-masked, opaque.',
  },
  {
    id: 'apple.icon-layer-foreground',
    target: 'apple',
    group: 'icon',
    folder: 'icon-composer',
    name: 'Icon Composer foreground layer',
    kind: 'image',
    required: false,
    condition: 'Imported into Icon Composer (macOS) to build a layered Liquid Glass icon.',
    dimensions: { kind: 'fixed', sizes: sizes([1024, 1024]), rotatable: false },
    formats: ['png'],
    alpha: 'allowed',
    localized: false,
    verified: true,
    sourceUrl: ICONS,
    notes: 'Square, not pre-masked; transparent around the logo; no feathered edges. Vector (SVG) is preferred where available.',
  },
];
