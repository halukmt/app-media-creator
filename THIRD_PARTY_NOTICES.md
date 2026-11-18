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

The complete licence audit before the first public release is tracked in issue #25.
