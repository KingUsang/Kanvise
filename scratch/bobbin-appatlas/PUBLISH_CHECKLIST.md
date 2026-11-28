# Publish checklist

The local atlas is the full-fidelity research copy. Before committing or pushing a cloud-safe copy:

- Exclude `03-lessons/join-links.local.txt` and `03-lessons/lesson-created.json`; they contain live test classroom join credentials.
- Exclude the two tutor login diagnostic screenshots; they are not atlas records and add no product coverage.
- Replace or omit screenshots that visibly render classroom join URLs, especially the lesson detail and open classroom-invite states.
- Rebuild `_artifact/atlas.html` only after the publish-safe screenshots are in place. The current local HTML embeds the full-fidelity images and must not be committed as the sanitized artifact.
- Re-run the 392-record structural validator, viewer card-count smoke test, search test, detail-sheet test, flow-surface test, and console-error check.
- Keep `16-auth-responsive/` capture scripts credential-free. The authenticated setup harness reads credentials only from standard input and writes no storage state; verify the section and rebuilt HTML contain no credential/session patterns before publication.
- Stage only `scratch/bobbin-appatlas/` publish-safe files. The wider Kanvise worktree contains unrelated pre-existing changes and must not be included.
- Commit and push only after the repository owner explicitly requests those external actions.

The complete local atlas remains the evidence source. A publish-safe copy must preserve screen titles, specs, tags, links, coverage verdicts, and non-sensitive UI evidence while removing only credential-bearing material.
