# Build step 1 screenshots: design system, app shell and message channels

**Captured:** 2026-11-28, Chromium 151, device scale 1, reduced motion on so no frame is caught mid-animation.

These images back the step 1 pull request (specs 01-app-shell, 16-responsive and 18-notifications). They come from dev-only preview pages with sample data, because the sandbox has no database:

- `/design-preview/shell?role=admin|tutor|independent` plus state flags (see `web/src/app/design-preview/shell/page.tsx`)
- `/design-system` (the primitives catalog)
- `/unsubscribe?preview=<state>`

All three are 404 unless the app is built with `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1`.

## People in the sample data

| Role | Person | Account |
|---|---|---|
| `admin` | Chidi Okafor, agency admin | Science Students Academy, and a tutor in Bright Path Tutors (two accounts, so the switcher shows) |
| `tutor` | Michael Chen, agency tutor | Science Students Academy |
| `independent` | Alex Thompson, independent tutor | Alex Thompson Tutoring |
| `student` | (not signed in) | the unsubscribe page a student reaches from an email |

Students see no staff shell in step 1. Their part of this step is the unsubscribe page.

## File names

`<role>-<width>-<state>.png`, widths 360 (phone), 768 (tablet) and 1280 (desktop). Every role has `default`, `whats-new`, `search-browse`, `search-results`, `loading` and `undo-toast` at all three widths. Other states are taken at the widths where they exist: the More sheet and the phone account menu only on phones, the help menu only where the sidebar or rail shows it, the collapsed rail at 1280 and the opened rail at 768.

`compare/` holds side-by-side images, Bobbin on the left and Kanvise on the right. Email addresses visible in the Bobbin screenshots are covered with an "email hidden" box.

## How to make them again

From `web/`, after `NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1 npm run build` with the CI placeholder env vars and `npx next start -p 3125`:

```bash
BASE_URL=http://localhost:3125 node e2e/screenshots/step-01-shell.mjs
BASE_URL=http://localhost:3125 node e2e/screenshots/step-01-checks.mjs
BOBBIN_ATLAS=<bobbin-appatlas folder> BOBBIN_CAPTURE=<step01-bobbin-capture folder> node e2e/screenshots/step-01-compare.mjs
```

The scripts have no `.spec` or `.test` suffix, so `npm test` and the staging Playwright run do not pick them up.

## R-09 checks (16-responsive)

Run with `step-01-checks.mjs` on 12 pages: the shell for each role, long names, the More sheet, search results, offline, the admins-only page, an Undo toast, and three unsubscribe states.

| Check | Result |
|---|---|
| No horizontal scrolling at 320px | Pass on every page (`scrollWidth` 320). |
| Tap targets 44px or larger at 360 and 768 | Pass, with two exceptions that are fine: the skip link measures 32x24 while hidden and about 44px tall once focused, and the toast close button draws at 28x28 but has a 44px hit area. Found and fixed during this check: the rail's account card, search button and account button were 39 to 40px wide at 768, the tablet sidebar's Kanvise logo link was 28px tall, and the unsubscribe page logo link was 40px tall. |
| Desktop sizes at 1280 | Sidebar rows are 40px tall from 1024px, a deliberate mouse density (Bobbin uses 35px). Below 1024px they are 44px. |
| Bottom bar never covers content | Pass: on a long page scrolled to the end, the last item ends 31px above the bottom bar. |
| At most one fixed element above the bottom bar | Pass: none on ordinary pages, one (the toast) while an Undo toast shows. |
| Keyboard never covers the focused field | Not testable in headless Chromium. The bottom bar hides while the on-screen keyboard is open (FEAT-004). Needs the real-device check. |
| Accessibility scan (axe-core 4, WCAG 2.1 A and AA plus best practice) at 360 and 1280 | No violations on any of the 12 pages. |

## Review

See REVIEW.md for the design and wording review. All screenshots and compare/ images were re-shot after the review fixes (36px desktop sidebar rows, stacked dialogs: catalog-360-stacked-dialog.png and catalog-1280-stacked-dialog.png).
