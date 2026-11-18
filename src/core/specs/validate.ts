import type { DimensionRule, MediaProperties, SpecEntry, Violation } from './types.js';

const VIDEO_FORMATS = new Set(['mp4', 'mov', 'm4v']);
const FORMAT_ALIASES: Record<string, string> = { jpg: 'jpeg', 'svg+xml': 'svg', quicktime: 'mov' };

/**
 * Normalizes a measured format into a list of candidate formats. Probes such as ffprobe report container
 * families as a comma-separated list (`mov,mp4,m4a,3gp,3g2,mj2`); any listed format may match.
 */
function formatCandidates(format: string): string[] {
  return format
    .toLowerCase()
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => FORMAT_ALIASES[token] ?? token);
}

/** Frame rates within this distance count as equal, so NTSC rates (29.97, 59.94) match 30 and 60. */
const FPS_TOLERANCE = 0.1;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function describeRule(rule: DimensionRule): string {
  switch (rule.kind) {
    case 'fixed': {
      const list = rule.sizes.map((s) => `${s.width}×${s.height}`).join(', ');
      return rule.rotatable ? `${list} (or rotated)` : list;
    }
    case 'range': {
      const parts: string[] = [];
      if (rule.min) parts.push(`at least ${rule.min.width}×${rule.min.height}`);
      if (rule.max) parts.push(`at most ${rule.max.width}×${rule.max.height}`);
      if (rule.minSide !== undefined) parts.push(`each side at least ${rule.minSide}`);
      if (rule.maxSide !== undefined) parts.push(`each side at most ${rule.maxSide}`);
      if (rule.aspect && 'ratio' in rule.aspect) parts.push(`aspect ratio ${Math.round(rule.aspect.ratio * 100) / 100}:1`);
      if (rule.aspect && 'maxRatio' in rule.aspect) parts.push(`long side at most ${rule.aspect.maxRatio}× the short side`);
      if (rule.orientation !== 'any') parts.push(rule.orientation);
      return parts.join(', ');
    }
    case 'vector':
      return 'vector';
    case 'none':
      return 'no pixel size';
  }
}

/** True when width × height satisfies the dimension rule. */
export function matchesDimensions(rule: DimensionRule, width: number, height: number): boolean {
  switch (rule.kind) {
    case 'vector':
    case 'none':
      return true;
    case 'fixed':
      return rule.sizes.some(
        (size) =>
          (size.width === width && size.height === height) ||
          (rule.rotatable && size.width === height && size.height === width),
      );
    case 'range': {
      const long = Math.max(width, height);
      const short = Math.min(width, height);
      if (rule.orientation === 'portrait' && width > height) return false;
      if (rule.orientation === 'landscape' && height > width) return false;
      if (rule.min && (long < Math.max(rule.min.width, rule.min.height) || short < Math.min(rule.min.width, rule.min.height))) {
        return false;
      }
      if (rule.max && (long > Math.max(rule.max.width, rule.max.height) || short > Math.min(rule.max.width, rule.max.height))) {
        return false;
      }
      if (rule.minSide !== undefined && short < rule.minSide) return false;
      if (rule.maxSide !== undefined && long > rule.maxSide) return false;
      if (rule.aspect) {
        const ratio = long / short;
        if ('maxRatio' in rule.aspect && ratio > rule.aspect.maxRatio) return false;
        if ('ratio' in rule.aspect && Math.abs(ratio - rule.aspect.ratio) > rule.aspect.ratio * rule.aspect.tolerance + 1e-9) {
          return false;
        }
      }
      return true;
    }
  }
}

/**
 * Checks measured file properties against a spec entry and returns every violation.
 * An empty list means the file is valid. Never throws for invalid files.
 */
export function validateMedia(spec: SpecEntry, props: MediaProperties): Violation[] {
  const violations: Violation[] = [];
  const candidates = formatCandidates(props.format);
  const format = candidates[0] ?? props.format;
  const isVideoFile = candidates.some((candidate) => VIDEO_FORMATS.has(candidate));
  const kindMatches = (spec.kind === 'video') === isVideoFile;

  if (!kindMatches) {
    violations.push({ rule: 'kind', message: `${spec.name} must be a ${spec.kind}, got a ${format} file` });
  }

  if (!candidates.some((candidate) => (spec.formats as readonly string[]).includes(candidate))) {
    violations.push({ rule: 'format', message: `Format ${format} is not allowed; use ${spec.formats.join(' or ')}` });
  }

  if (!matchesDimensions(spec.dimensions, props.width, props.height)) {
    violations.push({
      rule: 'dimensions',
      message: `Size ${props.width}×${props.height} is not allowed; expected ${describeRule(spec.dimensions)}`,
    });
  }

  if (spec.alpha === 'forbidden' && props.hasAlpha) {
    violations.push({ rule: 'alpha', message: 'The file has an alpha channel; the store requires an image without transparency' });
  } else if (spec.alpha === 'required' && !props.hasAlpha) {
    violations.push({ rule: 'alpha', message: 'The file has no alpha channel; a transparent background is required' });
  }

  if (spec.maxBytes !== undefined && props.bytes > spec.maxBytes) {
    violations.push({
      rule: 'fileSize',
      message: `File size ${formatBytes(props.bytes)} exceeds the limit of ${formatBytes(spec.maxBytes)}`,
    });
  }

  // A wrong file type is one mistake; do not add video violations for an image given to a video entry.
  if (spec.video && kindMatches) {
    const { minSeconds, maxSeconds, maxFps, allowedFps, audioChannels } = spec.video;
    if (props.durationSeconds === undefined) {
      violations.push({ rule: 'duration', message: 'The video duration could not be measured' });
    } else if (props.durationSeconds < minSeconds || props.durationSeconds > maxSeconds) {
      violations.push({
        rule: 'duration',
        message: `Duration ${Math.round(props.durationSeconds * 10) / 10} s is outside ${minSeconds}–${maxSeconds} s`,
      });
    }
    if (props.fps === undefined) {
      violations.push({ rule: 'frameRate', message: 'The video frame rate could not be measured' });
    } else {
      const fps = Math.round(props.fps * 100) / 100;
      if (maxFps !== undefined && fps > maxFps + FPS_TOLERANCE) {
        violations.push({ rule: 'frameRate', message: `Frame rate ${fps} fps exceeds ${maxFps} fps` });
      }
      if (allowedFps && !allowedFps.some((allowed) => Math.abs(allowed - fps) <= FPS_TOLERANCE)) {
        violations.push({ rule: 'frameRate', message: `Frame rate ${fps} fps is not allowed; use ${allowedFps.join(' or ')} fps` });
      }
    }
    if (audioChannels !== undefined && props.audioChannels !== audioChannels) {
      violations.push({
        rule: 'audio',
        message: `Audio must have ${audioChannels} channels (stereo); got ${props.audioChannels ?? 'no audio track'}`,
      });
    }
  }

  return violations;
}
