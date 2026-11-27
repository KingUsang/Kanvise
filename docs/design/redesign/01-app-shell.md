# 01 · App shell and navigation

Status: draft for owner review. Builds on `00-decisions.md`.

The shell is the frame around every signed-in tutor and admin page: the
sidebar, search, the help menu and the account menu. The student app has its
own, simpler shell (spec 09).

State IDs (`SH-xx`) are referenced by later specs.

---

## SH-01 · Layout

| Region | Desktop (≥ 1024px) | Tablet (768–1023px) | Phone (< 768px) |
|---|---|---|---|
| Sidebar | Fixed, 264px, full height, always visible | Collapsed to a 64px icon rail; expands over the page on hover or tap | Replaced by a bottom bar: Today, Calendar, Lessons, Students, More (spec 16, R-02) |
| Top bar | None. The page header sits at the top of the content area | None | 56px bar: page title, search icon, avatar |
| Content | Max width 1200px, 32px side padding | 24px padding | 16px padding |

- The sidebar background runs the full height of the window on every page,
  however long the page is. (Today's Kanvise sidebar stops at 1000px; that bug
  must not survive.)
- The page background is a warm off-white. Cards are white with a 1px border
  and a 16px radius. The sidebar uses the same background as the page, so the
  content stands out.

## SH-02 · Sidebar, top to bottom

### 1. Account card
- **Agency:** the agency's logo or first letter in a rounded square, a small
  label **TUTORING AGENCY**, then the agency name.
- **Independent tutor:** their photo or initials, the label **YOUR TUTORING**,
  then their display name (for example "Alex Thompson Tutoring").
- If the person belongs to more than one account, the card shows a chevron and
  opens the account switcher (SH-07). With one account there is no chevron and
  the card is not clickable.

### 2. Search
- A field reading **Search…** with a **⌘K** hint (**Ctrl K** on Windows).
- Clicking it or pressing the shortcut opens the search palette (SH-05).

### 3. Setup card (only until setup is finished)
- **Set up your account**, a chevron, a progress bar, and **2/5 completed**.
- Links to `/setup`.
- When a step is completed anywhere in the app, the bar fills with a short
  animation and the count updates.
- Disappears, with a fade, once every step is done.

### 4. Navigation

Groups have a small-caps label. Items have an outline icon and a text label.

| Group | Item | Route | Shown to |
|---|---|---|---|
| (none) | Setup | `/setup` | Until setup is finished |
| (none) | Dashboard | `/dashboard` | Everyone |
| (none) | Calendar | `/calendar` | Everyone |
| (none) | Lessons | `/lessons` | Everyone |
| (none) | Courses | `/courses` | Everyone |
| STUDENTS | Students | `/students` | Everyone |
| WORK | Homework | `/homework` | Everyone |
| WORK | Quizzes | `/quizzes` | Everyone |
| LIBRARY | Recordings | `/recordings` | Everyone |
| LIBRARY | Resources | `/resources` | Everyone |
| TEAM | Tutors | `/tutors` | Agencies, admins only |
| TEAM | Admins | `/team` | Agencies, admins only |
| ACCOUNT | Settings | `/settings` | Everyone (tutors see personal settings only) |

- **Active item:** an orange bar on the left edge, a slightly darker
  background, and the label in the strongest text colour. Orange is used for
  "you are here" and nothing else (decisions §11).
- A count badge appears only when it means "something needs you", for example
  **Homework 3** when three submissions are waiting to be marked. It never
  shows totals.
- A tutor in an agency sees the same sidebar without the TEAM group. Visiting a
  team route directly redirects to the dashboard with a toast: "That page is
  for admins."

### 5. User card (bottom)
- Photo or initials, name, and a second line with role and account, for
  example **Admin · Science Students Academy** or **Tutor · Science Students
  Academy**. Independent tutors see only their email.
- Clicking the name opens the account menu (SH-06).
- A **?** icon to the right opens the help menu (SH-04). A small orange dot on
  it means there is something new in What's new that this person hasn't
  opened.

### 6. Collapse button
- At the top right of the sidebar. Collapses to the icon rail on desktop.
  Remembered per device.
- In the collapsed rail, hovering an icon shows its label as a tooltip.

## SH-03 · Page header pattern

Every page uses the same header:

1. **Title** (24px), for example "Courses".
2. **One line under it** that explains the page in plain words, for example
   "A course pairs a student with a tutor over time." Never decorative.
3. **One primary action** on the right, in indigo, for example **New course**.
   Secondary actions are outline buttons to its left. Anything else goes in a
   **⋯** menu.

Detail pages (a course, a lesson, a student) add:
- a colour dot or avatar before the title;
- a status chip after it (for example **Planned**);
- a facts strip under the header (for example Date · Time · Course);
- underline tabs below the header, with the active tab underlined in orange.

## SH-04 · Help menu

Opens upward from the **?** in the user card.

| Item | Detail | Opens |
|---|---|---|
| What's new | **New** badge while unread | What's new dialog (SH-04a) |
| Help guide | External-link icon | Help site in a new tab |
| Share feedback | | Feedback dialog (SH-04b) |
| Privacy policy | Smaller, grey, external-link icon | `/privacy` in a new tab |

### SH-04a · What's new dialog
- Title **What's new**, subtitle **Recent updates to Kanvise**.
- Newest day first, for example **26 November · Yesterday**.
- Sections with a small icon and small-caps label: **NEW FEATURES &
  IMPROVEMENTS**, **FIXES**, **SPEED IMPROVEMENTS**.
- Each item is a bold name and one sentence on what it does for the reader.
- Older days collapse into rows with a count, for example **25 November · 1
  feature, 1 fix**, and expand on click.
- Opening the dialog clears the orange dot and the **New** badge.
- Content comes from a changelog file in the repo, so writing an update is part
  of shipping a feature.

### SH-04b · Share feedback dialog
- Title **Share feedback**, subtitle **Tell us what's working, what isn't, or
  what you'd like Kanvise to do next.**
- One field, **Message**. **Send** is disabled until something is typed.
- On send: the dialog closes and a toast says **Thanks, we read every
  message.**
- On failure: the dialog stays open with the text kept, and an inline error:
  **We couldn't send that. Try again in a moment.**
- This replaces today's "Report a problem" link.

## SH-05 · Search palette

- Opens centred near the top of the screen, over a dimmed page. Focus goes to
  the field.
- **Empty state:** **Browse by type**, listing Students, Courses, Lessons,
  Homework, Quizzes, Resources and Settings. Each has its entity icon in a
  tinted circle. Agency admins also see Tutors.
- **Typing:** results grouped by type, up to five per group, each showing the
  icon, the name and one detail (for example a lesson's date and course).
- **No results:** **No matches for "xyz".** and **Try a student's name, a
  course or a lesson topic.**
- Footer: **↑ ↓ Navigate · ↵ Open · esc Close**.
- Results respect permissions: a tutor only finds their own courses, lessons
  and students.

Entity icons and tints, used everywhere these things appear (lists, search,
headers, empty states):

| Entity | Icon | Tint |
|---|---|---|
| Student | Mortarboard | Green |
| Tutor | Two people | Blue |
| Course | Bookmarked book | Purple |
| Lesson | Open book | Indigo |
| Homework | Clipboard with tick | Teal |
| Quiz | Question mark in a square | Pink |
| Resource | Folder | Amber |
| Recording | Video camera | Slate |
| Settings | Gear | Grey |
| Kavi | Kavi mark (to be designed) | Brand gradient, used only for Kavi |

## SH-06 · Account menu

Opens upward from the user card.
- The person's name and email at the top (not clickable).
- **My profile** → `/profile`
- **Sign out**. Signs out immediately and returns to `/auth/login`.

## SH-07 · Account switcher

Only for people in more than one account. Opens from the account card.
- One row per account: logo or letter, name, and the person's role there.
- The current account has a tick.
- Choosing another account reloads the dashboard for that account, with a toast
  **Now in Science Students Academy.**

## SH-08 · Toasts

- Bottom right on desktop, bottom centre on phones. They slide in.
- Success: a green tick and one short line, for example **Course created**.
  Disappears after 4 seconds. Never covers the primary action.
- Error: a red icon, one line saying what failed and what to do, and it stays
  until dismissed.
- Toasts stay clickable when a dialog is open.

## SH-09 · Loading, error and empty states (every page)

- **Loading:** skeletons shaped like the real content, with a soft shimmer.
  Never a blank page or a lone spinner for a whole page.
- **Error:** the card that failed shows **We couldn't load this.** and a
  **Try again** button. The rest of the page keeps working. If data was
  already on screen, it stays, with a small warning line instead.
- **Empty:** the entity icon in a tinted circle, a title (**No courses yet**),
  one or two lines that explain the concept, and one primary button.

## SH-10 · Dialogs and wizards

- Dialogs are centred, 480–640px wide, white, 20px radius, over a dimmed and
  slightly blurred page. The page behind cannot be scrolled or clicked.
- Every dialog has a title, a one-line subtitle, and a close **✕**. Escape
  closes it unless something unsaved would be lost, in which case it asks first.
- **Wizards** add:
  - a segmented progress bar under the subtitle, one segment per step, filling
    as you go;
  - **Continue** at the bottom right, and a round **←** back button at the
    bottom left from step 2 onwards;
  - a final **Review** step listing everything before anything is saved;
  - steps sliding left and right as you move.
- Validation happens on **Continue**, with the message under the field in plain
  words (for example **Add a course name.**), and focus moves to that field.

## SH-11 · Motion

- Wizard steps slide; dialogs fade and scale in from 96%; menus fade and drop
  4px; toasts slide in; progress bars fill smoothly.
- Hover lifts cards slightly and darkens buttons; pressing scales buttons to
  98%.
- Kavi's text streams in a few words at a time, with a typing indicator first.
- With reduced motion turned on, everything appears instantly without movement.
