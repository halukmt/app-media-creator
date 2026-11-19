/**
 * A `headlines.json` result: per locale, one slot per input with variants A and B whose texts name locale, variant
 * and position (e.g. "de-DE B 2"). `longFirst` makes the first A headline longer than the 30-character hint; `claim`
 * puts a text into the first B subline.
 */
export function headlineVariants(inputs: Record<string, string[]>, options: { longFirst?: boolean; claim?: string } = {}): unknown {
  return {
    version: 1,
    locales: Object.fromEntries(
      Object.entries(inputs).map(([locale, list]) => [
        locale,
        {
          slots: list.map((input, index) => ({
            input,
            A: { headline: options.longFirst && index === 0 ? 'Faire Mannschaften in wenigen Sekunden' : `${locale} A ${index + 1}`, subline: '' },
            B: { headline: `${locale} B ${index + 1}`, subline: options.claim && index === 0 ? options.claim : '' },
          })),
        },
      ]),
    ),
  };
}
