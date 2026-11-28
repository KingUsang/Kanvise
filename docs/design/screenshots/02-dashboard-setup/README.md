# Build step 2 screenshots: dashboard, onboarding and setup

**Captured:** 2026-11-28, Chromium (Playwright), device scale 1, viewports 360x780, 768x1024 and 1280x900, reduced motion on so no frame is caught mid-animation. Shots are the visible window, not the whole page: a full-page shot draws the fixed phone bars in the middle of the page. The `-end` shots are scrolled to the bottom.

These images back the step 2 pull request (specs 03-dashboard and 02-onboarding-and-setup). The sandbox has no database or staging login, so they come from dev-only preview pages with sample data:

- `/design-preview/dashboard?role=independent|tutor|admin&data=populated|empty|quiet-today|loading` (plus `setup=1` for the sidebar setup card, `mine=1` for Mine only)
- `/design-preview/setup?role=independent|admin&state=fresh|some|skipped|done` (plus `banner=1`, `loading=1`). The fixture shows every row by raising the shipped step to 5. The real `SETUP_SHIPPED_STEP` stays 2.
- `/design-preview/onboarding` (the Kavi chat; saving has no API behind it, so the last answer shows the "couldn't save" state)

All preview pages are 404 unless the app is built with `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1`. A production build without the flag was checked: `/design-preview/dashboard`, `/setup`, `/onboarding` and `/shell` all return 404.

## How to retake them

From `web/`, after `npm run build` and `npx next start -p 3126` with `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1`:

```
BASE_URL=http://localhost:3126 node e2e/screenshots/step-02-dashboard-setup.mjs
BASE_URL=http://localhost:3126 node e2e/screenshots/step-02-motion-audit.mjs
BOBBIN_ATLAS=<path to bobbin-appatlas> node e2e/screenshots/step-02-compare.mjs
```

## People in the sample data

Names follow 00-decisions section 13.

| Role | Person | Account |
|---|---|---|
| `admin` | Chidi Okafor, agency admin who also teaches | Science Students Academy |
| `tutor` | Michael Chen, invited agency tutor | Science Students Academy |
| `independent` | Alex Thompson, independent tutor (the step 1 shell fixture) | Alex Thompson Tutoring |

The sample day is Wednesday 25 November 2026, 10:50 in Lagos, so lessons appear later in the week and the 11:00 lesson reads Starting soon.

## Files

`<area>-<role>-<state>-<width>.png`. Side-by-side images with Bobbin are in `compare/`.
