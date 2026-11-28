# Mobile and tablet layouts: research

Status: written for build step 1 (app shell). Sources were read on 28 November 2026.

## Method

1. Read how real products and design guidance handle phones (360 to 430px) and tablets (768 to 1023px). Pages were fetched directly because search engines are blocked in the build sandbox.
2. Looked at Bobbin's phone and tablet screenshots (read-only captures, 360, 390, 768, 820 and 1023px). The images are not copied into this repo. File names below refer to `step01-bobbin-capture/responsive-research/`.
3. For each pattern, chose what fits Kanvise. Every Kanvise choice cites a source.

Limits:
- Preply, TutorCruncher and My Music Staff publish very little about their phone layouts. Preply's help centre gives one article about its tutor app. TutorCruncher's site describes a single calendar view and nothing about phone navigation. So tutoring-product evidence is thin, and most of the weight comes from guidance and from general dashboard apps.
- Material 3 pages (m3.material.io) are rendered by script and could not be read. The Android developer pages that implement Material 3 were used instead.
- No new Bobbin captures were made. The existing set already covers the pages needed. No Bobbin data was created.

## Sources

| # | Source | What it says (quoted or paraphrased) |
|---|---|---|
| 1 | [NN/g, Hamburger menus](https://www.nngroup.com/articles/hamburger-menus/) | On mobile, people used hidden navigation in 57% of cases and combo navigation (some items visible) in 86% of cases. Visible options are more salient. |
| 2 | [Luke Wroblewski, Obvious always wins](https://www.lukew.com/ff/entry.asp?1945) | Facebook and Redbooth moved from a hamburger menu to a bottom tab bar and usage rose. Zeebox moved from tabs to a drawer and engagement "fell drastically". |
| 3 | [Apple HIG, Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Keep the tab bar visible. "Avoid overflow tabs": a More tab makes hidden content harder to reach. "Don't disable or hide tab bar buttons, even when their content is unavailable," because it makes the app look unstable. |
| 4 | [Apple HIG, Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Cancel on the leading edge, Done on the trailing edge. Back is for steps in a flow, not for dismissing. Support swipe to dismiss, and confirm if there are unsaved changes. Use a sheet only when a modal task needs custom content. |
| 5 | [Apple HIG, Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Respect the safe area so hardware and system bars do not cover content or controls. |
| 6 | [Android, Build adaptive navigation](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation) | Compact windows (phones) use a bottom navigation bar. Expanded windows (tablets) use a rail, because it is easier to reach while holding the left and right sides. |
| 7 | [NN/g, Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/) | Include a visible Close button. Support Back to dismiss. Do not stack sheets. Use sheets only for short interactions. The middle of the screen, not the bottom, is the easiest area to reach for most grips. |
| 8 | [NN/g, Mobile tables](https://www.nngroup.com/articles/mobile-tables/) | Wide tables on phones need sticky headers, a locked first column and a visible sign that the table scrolls sideways. Let people choose what to see. Group data in accordions. Rework the table content for small screens. |
| 9 | [Steven Hoober, How do users really hold mobile devices?](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php) | Observed grips: one hand 49%, cradled 36%, two hands 15%. Two-handed use is common enough to design for. People often hold the phone so they can reach the top. |
| 10 | [web.dev, Accessible tap targets](https://web.dev/articles/accessible-tap-targets) | About 48 device-independent pixels for a touch target, with about 8px between targets. |
| 11 | [WCAG 2.2, Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | At least 24 by 24 CSS pixels, with exceptions for spacing. The enhanced level uses 44 by 44. |
| 12 | [NN/g, Wizards](https://www.nngroup.com/articles/wizards/) | Wizards work well for processes done only occasionally. |
| 13 | [Preply Help, How to manage your calendar in the Preply app](https://help.preply.com/en/articles/6080094-how-to-manage-your-calendar-in-preply-app) | The tutor app has a "Schedule tab" in the lower part of the screen. Tapping a lesson opens a pop-up with Reschedule and Request payment. Only a limited set of functions exists on the phone, and Google Calendar sync may need a desktop check. |
| 14 | [Preply, App page](https://preply.com/en/app) | Preply ships a separate native app. The page is about learners, so it gives no tutor layout detail. |
| 15 | [TutorCruncher](https://tutorcruncher.com/features/) | Describes "a single calendar view" for scheduling and a dashboard of key numbers. Nothing about phone navigation. |
| 16 | [Stripe Docs, Dashboard mobile app](https://docs.stripe.com/dashboard/mobile) | The phone app is a separate, smaller product. It covers metrics, payments, customers and payouts, and leaves the rest to the web dashboard. |
| 17 | [Shopify Help, Shopify admin](https://help.shopify.com/en/manual/shopify-admin/shopify-mobile-app) | The mobile app covers orders, products and analytics. "Some advanced settings require you to be on a desktop." |
| 18 | [Google Calendar on the App Store](https://apps.apple.com/us/app/google-calendar-get-organized/id909319292) | "Quickly switch between month, week, and day views." |

## What Bobbin does on phones and tablets

From `notes.md` section 9 and the screenshots:

- One breakpoint at 1024px. Below it there is no sidebar and no rail. A top bar shows the logo and a hamburger ("Open navigation"). At 768 and 820 the tablet looks like a stretched phone (`bobbin-admin-768-dashboard.png`, `bobbin-admin-820-dashboard.png`).
- The hamburger opens a 245px drawer from the left with the full sidebar. Escape does not close it (`bobbin-admin-390-drawer.png`). Only the X or the scrim does.
- Students and Lessons keep their tables on phones. At 390px the Students table shows Name and a clipped Email column, with the rest off screen (`bobbin-admin-390-students.png`). At 768px the Lessons table is cut at the Status column and the status tabs scroll sideways (`bobbin-admin-768-lessons.png`).
- Page headers put the title on the left and the main action (Add, New lesson) on the right, even at 390px. Subtitles stay under the title (`bobbin-admin-390-students.png`).
- The calendar at 390px works well. It has Day, Week and Month tabs, a month grid, and a "selected day" panel under it with a "Schedule one" link (`bobbin-admin-390-calendar.png`).
- Search opens as a dialog nearly full width with a close X and a "Browse by type" list. The keyboard hints (Navigate, Open, Esc) still show on a phone, where they are no use (`bobbin-admin-390-search.png`).
- Account and help menus open as small popovers above the footer inside the drawer.
- Tap target sizes and positions are in `data/bobbin-*.json`. Most drawer items are under 44px tall.

What to take: the calendar layout, the full-width search dialog and the title plus action header. What to leave: the hamburger, wide tables on phones, keyboard hints on touch screens, a drawer with no Escape, and the stretched phone layout on tablets.

## Pattern table

| Pattern | What real products do | What guidance says | What Bobbin does | Kanvise choice |
|---|---|---|---|---|
| Phone navigation | Preply's tutor app uses a bottom tab for Schedule (13). Facebook and Redbooth moved to bottom tabs (2). | Visible navigation is used far more than hidden (1). Bottom bar on compact windows (6). Keep it visible (3). | Hamburger and drawer. | Bottom bar with Today, Calendar, Students and More. More opens a sheet. No hamburger (owner decision). |
| More tab | Not documented by the tutoring products. | HIG warns More hides content (3). | Not applicable. | Keep it, since the owner chose it. Put the most used pages on the bar and keep the More list short and grouped. |
| Tablet navigation | Not documented. | Rail on expanded windows (6). | Same as phone. | Icon rail from 768px, full sidebar from 1024px. |
| Page header and main action | Preply puts scheduling in its own tab (13). | Cancel and Done sit at the top of a sheet (4). | Title left, action right. | Title with the main action beside it, wrapping under the title only if there is no room. |
| Tables | Stripe and Shopify limit what the phone app shows (16, 17). | Rework the table for small screens. If it must scroll, lock the first column and show it scrolls (8). | Keeps the table, clips columns. | Cards on phones (owner decision). Each card shows name, the one or two facts people scan for, and a status. Tables stay from 768px. |
| Dialogs | Not documented. | Use a sheet for short interactions, with a visible Close (7). Sheet buttons follow Cancel and Done placement (4). | Centred dialogs, even at 390px. | Bottom sheet for short actions, full-screen sheet for long forms, with a Close button and Back support. |
| Wizards and stacked dialogs | Not documented. | Do not stack sheets (7). Wizards suit rare tasks (12). | Stacked dialogs with a third "Discard your changes?" dialog. | On phones, a wizard is one full-screen page per step, with Back. Adding a person inside a wizard becomes the next step, not a second layer. Confirm discard only when there are unsaved changes (4). |
| Sticky actions and keyboard | Not documented. | Respect the safe area (5). | Not tested. | Primary action bar at the bottom of a full-screen sheet, above the safe area. Hide the bottom bar while the keyboard is open (already built). |
| Tap targets | Not documented. | 48px with 8px gaps (10). 24px minimum, 44px enhanced (11). | Many drawer items under 44px. | 44px minimum on touch screens, 8px gaps where targets sit together. Rows may be 40px from 1024px, where a mouse is the main input. |
| Safe areas | Not documented. | Respect the safe area (5). | Not tested. | The bottom bar pads for `env(safe-area-inset-bottom)` (already built). |
| Search | Not documented. | The middle of the screen is easiest to reach (7, 9). | Dialog near the top, keyboard hints shown. | Full-width dialog at the top of the screen, Close button, no keyboard hints on touch screens. |
| Calendar on phones | Google Calendar offers month, week and day (18). TutorCruncher uses one calendar view (15). | Not specific. | Day, Week, Month and a day list under the month grid. | Same shape as Bobbin's phone calendar. Defined in the Calendar step. |
| Tablet list and detail | Not documented. | Rail plus content on expanded windows (6). | Stretched phone layout. | List and detail side by side from 768px for Students and Lessons. Defined in steps 3 and 4. |

## The bottom bar and pages from later steps

What the code does today (`web/src/config/dashboard-navigation.ts`, `getBottomBarTabs`):

- Today is always there.
- Calendar shows only if `/dashboard/schedule` is visible for the person's role.
- Students shows only if `/dashboard/students` is visible.
- More is always there.
- Lessons has no tab. It is hidden until build step 4.
- Agency tutors get Today, Calendar and More until step 3 gives them a Students page.

Calendar and Students point at the existing pages, which work today.

How this lines up with the rules:

- `HANDOFF.md` build order says links to later-step pages are hidden, not disabled. The code follows it. A disabled "Lessons" tab would invite a tap that goes nowhere.
- Apple's guidance says not to hide or disable tab buttons (3). The reason given is that tabs appearing and disappearing makes the app seem unstable. That risk comes from tabs changing during use. Tabs that differ by role, or that grow with a release, do not do this.

Recommendation:

1. Add a tab in the release that ships its page. Never switch a tab on or off inside a session.
2. Choose the set of tabs once per role at sign-in. Do not change it when data loads.
3. Students arrives for agency tutors in step 3. Lessons arrives in step 4. Until then those pages are reachable only if they exist, and nothing disabled is shown.
4. Keep Calendar and Lessons as separate tabs (owner decision). A bar of Today, Calendar, Lessons, Students and More has 5 items, which is the upper limit in Material guidance (6).

Owner question for `pr-summary.md`: when Lessons ships, the bar will have five items for admins and tutors. Should Students move into More, or does the five-item bar stay? This does not change any owner decision today.

## Recommendations for step 1

No code changes were made from this research. The existing shell already matches the sources that apply:

- Bottom bar with safe-area padding, tablet rail and sidebar from 1024px (3, 5, 6).
- 44px tap targets at 360 and 768px (10, 11), verified in the R-09 checks.
- The sheet component has a visible Close button (7).
- The bottom bar hides while the keyboard is open.

## Notes for later steps

- Step 3 (Students, people pages): use cards on phones with name, one or two key facts and a status. Lock the first column and show sideways scroll if a table must stay (8). Use list and detail on tablets.
- Step 4 (Lessons): the status filter row scrolls sideways in Bobbin and is cut mid-label (`bobbin-admin-768-lessons.png`). Use a filter sheet on phones. Lesson cards show date, who and status.
- Step 5 (Calendar): copy the shape of Bobbin's phone calendar: Day, Week and Month, a month grid, and a selected-day list (18).
- Sheets (primitive): support the Back gesture closing a sheet (7). The current `Sheet` does not. This needs history handling, so it is left for a later step. Also add an unsaved-changes confirm when a sheet with a form is swiped away (4).
- Wizards: one step per screen on phones, no second dialog on top (7).
- Real-device check: keyboard behaviour with sticky actions cannot be tested headless.
