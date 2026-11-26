# Kanvise Agent Rules

## General
- Always use the `search_web` tool to search for official documentation before writing code for external libraries (especially PlugNMeet, Next.js, and Supabase), to ensure we are not deviating from the official API or using deprecated methods.

## Workflow Rules
- **Commit After Every Feature**: After every feature addition or significant batch of UI tweaks, we MUST prompt the user to make a commit or provide them with the Git commands to do so. This ensures code changes are safely saved in version control step-by-step.
- **Check Docs First**: Read `docs/engineering/DOCUMENT_AUTHORITY.md` and the standards in `docs/engineering/` before creating a plan or writing code. Documents in `docs/archive/` are superseded or historical and must not be followed. If a document and the code conflict, record the conflict in `docs/deviations.md` rather than guessing.
