# Step 1 design and wording review

Reviewed against Bobbin (atlas and live captures), specs 01, 16, 18 and 00-decisions sections 11 to 13a. Every screenshot in this folder was re-shot after the fixes below.

## Design findings

| Screenshot | Issue | Status |
| --- | --- | --- |
| admin-1280-default, tutor-1280-default | Sidebar rows were 40px, so the admin sidebar scrolled and Payments was cut off at 1280x900 (Bobbin fits 14 items at about 35px). | Fixed. Rows are 36px on desktop (`lg:min-h-9`, sidebar.tsx). Phone and tablet rows stay 44px. All items now fit at 900px high. |
| catalog-1280-stacked-dialog, catalog-360-stacked-dialog | A dialog opened over another showed two scrims and two panels, darkening the page twice. | Fixed. See "Stacked dialogs". |
| admin-1280-feedback-empty | Disabled Send is faded indigo, Bobbin's is grey. | Deferred. The faded button still reads as disabled with the spec's grey-out rule (00 section 11 states). Revisit in the step 2 button pass. |
| admin-1280-search-browse | Palette sits about 60px from the top, Bobbin about 21px. | Deliberate. 60px keeps the palette clear of the browser chrome on tablets. |
| Phone top bar | Says "Today" while the page title says "Dashboard" in the preview. | Deferred to step 2, where the real dashboard page sets its title. |
| admin loading states | The whole nav is skeletoned on a cold load, Bobbin keeps the nav. | Deferred. Only appears while capabilities load, and a skeleton avoids showing items that then vanish. |
| Opened-on-load overlays | A focus ring shows on the first item. | Not an issue. Focus is moved programmatically in the preview. |
| Tutor sidebar | No Students or Settings. | Deferred. Students for tutors ships in step 3. Hidden, not disabled. |

Checked and fine: spacing rhythm (4px grid), type scale (page title 24/30px bold, section headings 18px, nav labels medium, active semibold, small-caps group labels, secondary text at least 13px), icon size (Lucide, 16 to 20px, one stroke width), radius tiers (control, panel, dialog), one card shadow, SH-15 colour rule (orange only on the active-item bar, indigo primary buttons).

### Deliberate differences from Bobbin

Orange left bar with grey fill instead of black fill. WORK group. No Clients, TO REVIEW or trial banner. Kanvise brand colours. Setup, Lessons, Team and Recordings hidden until their steps. Tablet rail and phone bottom bar with More sheet instead of top bar and drawer. Account switcher (Bobbin has none). Browse by type adds Homework, Quizzes and Resources.

## Stacked dialogs

What the Bobbin atlas shows: the Add students dialog (tutor course page) has an "Add a student" link that opens the full Add student form. In the captured state only the Add student form is visible, centred, 480px wide, over the page behind one 40% dark, blurred scrim. The Add students dialog is not drawn next to it. The client picker is a menu inside the Add student dialog, not a third dialog. The wizard People step (new-course--step-2-roster.png) has the same "Add a student" and "Add a tutor" links. The atlas has no capture of closing the top dialog, so how Bobbin restores the first dialog's data is not known. Kanvise keeps it by design.

What Kanvise does now (`dialog.tsx`):

- One scrim: only the top dialog draws a scrim and panel. Dialogs underneath stay mounted but get `data-covered` (hidden, transparent, no blur), so the typed data and wizard step are kept.
- Escape, the X and a backdrop click close only the top dialog.
- Underneath dialogs are inert while covered. When the top one closes, the one below is shown again, made interactive, and focus returns to the control that opened the top one.
- Phone sheets stack the same way: the top full-screen sheet covers the one below.

Tests: `dialog.stack.test.tsx` (top-only Escape, covered and inert state, input value kept). Demo: Wizard dialog, then "Add a student", in `/design-system`. Screenshots: catalog-360-stacked-dialog.png, catalog-1280-stacked-dialog.png.

## Placement review

- Account switcher: the account card at the top of the sidebar matches Bobbin's ORGANIZATION card. On tablets it is the first button in the rail. On phones it is the first row of the More sheet. Kept.
- Share feedback: in the help menu behind the ? in the user card, as in Bobbin. On phones the user card is in the More sheet, so it is two taps. Kept. Moving it would add a top-level item and clutter the bar.

## Typography and colour

Poppins everywhere in the shell. No raw hex colours in the shell, ui, unsubscribe or design-preview files (grep clean). The old dark indigo sidebar is gone. Raw hex remains in `components/account/account-picker.tsx` (legacy account picker page, outside step 1; deferred to the step that touches it).

## Wording

Checked every user-facing string in components/shell, app/unsubscribe, ui/save-status, offline banner and conflict banner against 00 section 13 and 13a. Spec copy was not reworded.

| Check | Result |
| --- | --- |
| Banned words (learner, class, session, assignment, parent) | None in step 1 user-facing text. Internal identifiers such as the `learner` role value and `/dashboard/classes` route stay, since they are not shown. |
| Jargon (request failed, error code, invalid, unauthorised, resource, payload, sync) | None shown. `aria-invalid` is an attribute only. |
| Errors | All say what happened and what to do: "We couldn't send that. Try again in a moment.", "We couldn't sign you out. Try again.", "We couldn't search right now.", "We couldn't update this." |
| Em dashes, exclamation marks | None. |
| Ellipsis | Always the single character (Search…, Sending…, Signing out…, Unsubscribing…). |

No wording changes were needed, so there is no before and after table.

## States checked

Sidebar, rail, bottom bar, More sheet, account menu, switcher, help menu, What's new, Share feedback (empty, typed, error, sending), search palette (browse, results, no results, error, offline, loading), Not available (both), signed-out dialog, sign-out confirm, offline banner, reconnecting line, saving and conflict, toast with Undo, unsubscribe page (loading, confirm, success, undone, expired, error). Loading: skeletons and the top progress line. Empty: no results and empty feedback. Disabled: Send, rail items in offline.
