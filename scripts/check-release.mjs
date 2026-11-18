// Release gate for main: the CHANGELOG has a dated version and no pending [Unreleased] entries,
// and package.json has the same version.
// Run: npm run check:release                    checks (PR to main, release.yml)
//      node scripts/check-release.mjs --version  prints the version (for release.yml)
//      node scripts/check-release.mjs --notes    prints the CHANGELOG section of that version
import { readFileSync } from 'node:fs';

const UNRELEASED_HEADING = /^## \[unreleased\]/i;
const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/;
const ENTRY_LINE = /^\s*(?:[-*+]|\d+\.)\s+\S/;

/** Splits the CHANGELOG into its "## [...]" sections: heading line and body lines. */
function sections(changelog) {
  const result = [];
  for (const line of changelog.split(/\r?\n/)) {
    if (line.startsWith('## [')) result.push({ heading: line.trim(), body: [] });
    else if (result.length > 0) result[result.length - 1].body.push(line);
  }
  return result;
}

export function unreleasedEntries(changelog) {
  const unreleased = sections(changelog).find((section) => UNRELEASED_HEADING.test(section.heading));
  return unreleased ? unreleased.body.filter((line) => ENTRY_LINE.test(line)) : [];
}

export function latestVersion(changelog) {
  for (const section of sections(changelog)) {
    const match = VERSION_HEADING.exec(section.heading);
    if (match) return { version: match[1], date: match[2] };
  }
  return undefined;
}

export function releaseNotes(changelog, version) {
  const section = sections(changelog).find((candidate) => VERSION_HEADING.exec(candidate.heading)?.[1] === version);
  if (!section) throw new Error(`No section for ${version} in CHANGELOG`);
  return section.body
    .filter((line) => !/^\[[^\]]+\]: https?:\/\//.test(line))
    .join('\n')
    .trim();
}

export function checkChangelog(changelog, packageVersion) {
  const problems = [];
  const pending = unreleasedEntries(changelog);
  if (pending.length > 0) {
    problems.push(`CHANGELOG: ${pending.length} entries under [Unreleased]. Turn them into a version with /release.`);
  }
  const latest = latestVersion(changelog);
  if (!latest) {
    problems.push('CHANGELOG: no version of the form "## [X.Y.Z] - YYYY-MM-DD"');
  } else if (latest.version !== packageVersion) {
    problems.push(`Version mismatch: CHANGELOG ${latest.version}, package.json ${packageVersion}`);
  }
  return problems;
}

if (process.argv[1]?.endsWith('check-release.mjs')) {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const latest = latestVersion(changelog);

  if (process.argv.includes('--version')) {
    if (!latest) process.exit(1);
    console.log(latest.version);
  } else if (process.argv.includes('--notes')) {
    if (!latest) process.exit(1);
    console.log(releaseNotes(changelog, latest.version));
  } else {
    const problems = checkChangelog(changelog, packageVersion);
    if (problems.length > 0) {
      console.error(`Release check failed:\n- ${problems.join('\n- ')}`);
      process.exit(1);
    }
    console.log(`Release check passed for ${latest.version}`);
  }
}
