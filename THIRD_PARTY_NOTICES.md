# Third-party notices

app-media-creator is MIT-licensed. It uses the following runtime dependencies, installed from npm (not vendored).
Their licences apply to them. The full list including development dependencies is in `package-lock.json`.

| Package | Licence | Notes |
|---|---|---|
| [hono](https://github.com/honojs/hono) | MIT | HTTP framework |
| [@hono/node-server](https://github.com/honojs/node-server) | MIT | Node adapter for Hono |
| [sharp](https://github.com/lovell/sharp) | Apache-2.0 | Image measuring and rendering. Its prebuilt binaries (`@img/sharp-*`) bundle libvips under LGPL-3.0-or-later, linked dynamically. |
| [zod](https://github.com/colinhacks/zod) | MIT | Settings validation |
| [fflate](https://github.com/101arrowz/fflate) | MIT | ZIP export |
| [opentype.js](https://github.com/opentypejs/opentype.js) | MIT | Reads the card font and turns text into SVG paths |
| [@fontsource/inter](https://github.com/fontsource/font-files) | SIL OFL 1.1 | Inter typeface by Rasmus Andersson, used for headline and subline text in generated screenshots. Font software, not code: OFL allows bundling and use in generated images; the font files are not modified or sold on their own. |

The complete licence audit before the first public release is tracked in issue #25.

## Adapted content in the skills

`skills/amc-store-texts/references/humanizer-light.md` adapts the Light mode of
[ste80-humanizer](https://github.com/Dodaios/ste80-humanizer), whose catalogue of AI writing patterns is in turn adapted
from [blader/humanizer](https://github.com/blader/humanizer). Both are MIT-licensed:

```
MIT License

Copyright (c) 2026 Dodaios

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

```
MIT License

Copyright (c) 2025 Siqi Chen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
