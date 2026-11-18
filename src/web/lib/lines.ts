/** Converts between a list of short texts (claims) and the one-entry-per-line text of a textarea. */

export function listToLines(list: readonly string[]): string {
  return list.join('\n');
}

/** Trimmed, non-blank lines; Windows and Unix line endings. */
export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
