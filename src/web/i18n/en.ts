/**
 * UI strings (English). The UI language is separate from the 6 media locales the tool generates.
 * Keep every visible text here so a later UI translation only adds files.
 * Store sizes never appear here; they live in src/core/specs/.
 */
import type { SectionId, TargetId } from '../lib/sections';

type AssetSection = Exclude<SectionId, 'project'>;

export const en = {
  app: {
    name: 'app-media-creator',
    skipToContent: 'Skip to content',
    openMenu: 'Open sections menu',
    closeMenu: 'Close sections menu',
    navLabel: 'Sections',
    loading: 'Loading project…',
    loadFailed: 'The project could not be loaded. Is app-media-creator still running in your project folder?',
    retry: 'Try again',
    serverConnected: (version: string) => `Server ${version} connected`,
  },
  sections: {
    project: {
      title: 'Project',
      description: 'Name your app, pick the stores and languages, and set the claims your copy may and may not make.',
    },
    logo: { title: 'Logo', description: 'App icons, favicons and share images from one logo.' },
    screenshots: { title: 'Screenshots', description: 'Store screenshots with headline cards, or framed screenshots for your website.' },
    video: { title: 'Video', description: 'App previews, promo reels and moving backgrounds.' },
    'store-texts': { title: 'Store texts', description: 'Name, subtitle, description and keywords for each store and language.' },
    export: { title: 'Export', description: 'Check every generated file against the store rules and download it per store and language.' },
  } satisfies Record<SectionId, { title: string; description: string }>,
  targets: {
    apple: 'Apple App Store',
    google: 'Google Play',
    web: 'Web and social',
  } satisfies Record<TargetId, string>,
  locales: {
    all: 'All languages',
    selectedCount: (count: number, total: number) => `${count} of ${total} languages`,
    barLabel: 'Languages for this section',
  },
  project: {
    appHeading: 'App',
    nameLabel: 'App name',
    nameHint: 'Used in headlines and store texts.',
    languagesHeading: 'Languages',
    localesLabel: 'Languages to generate',
    localesHint: 'Text-free assets are made once and shared by all languages.',
    sourceLocaleLabel: 'Source language',
    sourceLocaleHint: 'The language your screenshots and texts are written in.',
    targetsHeading: 'Stores and web',
    claimsHeading: 'Claims',
    claimsIntro: 'The AI copy may only make allowed claims and never forbidden ones.',
    allowedLabel: 'Allowed claims',
    forbiddenLabel: 'Forbidden claims',
    claimsHint: 'One claim per line.',
    save: 'Save project',
    saving: 'Saving…',
    saved: 'Project saved.',
    saveFailed: 'The project could not be saved. Check the marked fields.',
    unsaved: 'Unsaved changes',
  },
  target: {
    enabled: (target: string) => `Create media for ${target}`,
    devices: 'Device models',
    moreDevices: (count: number) => `More devices (${count})`,
    required: 'Required',
    noDevices: 'Web media does not use device models.',
    selectedCount: (count: number, total: number) => `${count} of ${total} selected`,
  },
  empty: {
    neededBy: 'Needed by',
    noTarget: 'None of the enabled stores needs this section. Enable a store in Project.',
    toProject: 'Open Project settings',
    content: {
      logo: {
        title: 'Upload your logo',
        body: 'A square logo as SVG or PNG with transparency. It becomes the app icons, favicons and share images.',
      },
      screenshots: {
        title: 'Upload your screenshots',
        body: 'Plain screenshots of your app, one set per language or one set to reuse. Frames and headline cards are added for you.',
      },
      video: {
        title: 'Upload a screen recording',
        body: 'A recording of your app in use. It becomes app previews, promo videos and moving backgrounds.',
      },
      'store-texts': {
        title: 'No store texts yet',
        body: 'Store texts are written from your project settings and claims. Fill in the Project screen first.',
      },
      export: {
        title: 'Nothing to export yet',
        body: 'Generate logo, screenshot, video or text assets first. Export packs them per store and language.',
      },
    } satisfies Record<AssetSection, { title: string; body: string }>,
  },
};
