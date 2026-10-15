<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project module handoff

Before adding a business module, read `docs/PROJECT_STATUS.md` and `docs/MODULES.md`.
Develop only the module requested by the user; additional modules and final integration remain separate work.
Email authentication lives in `src/modules/auth/`; its documented server/client entries and contracts are the integration surface.
Keep the shared database connection and migration history, and never reset existing local user data for a refactor.
Record each completed module's scope, public interfaces, configuration, validation, and integration limits in its README and the module registry.
