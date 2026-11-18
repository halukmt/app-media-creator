# Skill sources

External skills are installed with `npx skills add <source> -a claude-code --copy` and recorded in
`skills-lock.json`. Update with `npx skills update -p`.

These are **development** skills for working on this repo. Skills shipped to users of the tool live in
the top-level `skills/` folder (added in milestones M3 and M5).

| Skill | Source | Purpose |
|---|---|---|
| `daisyui` | saadeghi/daisyui | Official DaisyUI 5 docs, required before UI work |
| `next-issue` | own (adapted from ki-mal-mit) | Loop: implement the next Ready issue (`/loop /next-issue`) |
| `release` | own (adapted from ki-mal-mit) | Release dev → main with version, tag and GitHub release |
| `openspec-*` | `openspec init --tools claude` (1.13.2) | OpenSpec workflow (`/opsx:*`) |

Candidates for later (not installed): `tailwind-4-docs` (lombiq/tailwind-agent-skills),
`web-design-guidelines` (vercel-labs/agent-skills).
