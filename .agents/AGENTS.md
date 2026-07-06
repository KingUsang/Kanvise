# Kanvise Agent Rules

## General
- Always use the `search_web` tool to search for official documentation before writing code for external libraries (especially LiveKit, Next.js, and tldraw), to ensure we are not deviating from the official API or using deprecated methods.

## Workflow Rules
- **Commit After Every Feature**: After every feature addition or significant batch of UI tweaks, we MUST prompt the user to make a commit or provide them with the Git commands to do so. This ensures code changes are safely saved in version control step-by-step.
- **Check MD Docs First**: Always check the Markdown documentation files located at the root of the workspace (e.g., `Authentication And authorizations.md`, `Technical Stack Decision.md`, `Multi Tenanacy Arvhitecture.md`, `Api spec.md`) before creating a plan or writing any code. These documents contain critical architectural decisions, security rules, and tech stack constraints that must be followed strictly.
