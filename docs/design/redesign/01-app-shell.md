# 01 · App shell and navigation

Status: draft for owner review. Builds on `00-decisions.md`.

The shell is the frame around every signed-in tutor and admin page: the
sidebar, search, the help menu and the account menu. It also holds the rules
every page shares: toasts, saving, offline, colour and accessibility. The
student app has its own, simpler shell (spec 09), which follows the same
shared rules.

State IDs (`SH-xx`) are referenced by later specs.

---

## SH-01 · Layout

Values come from standard 07 (`docs/engineering/standards/07-ui-design-accessibility.md`).
Where the redesign differs from the standard, the change is listed in
`00-decisions.md` section 18.

| Region | Desktop (≥ 1024px) | Tablet (768–1023px) | Phone (< 768px) |
|---|---|---|---|
| Sidebar | Fixed, 264px, full height, always visible | Collapsed to a 64px icon rail; expands over the page on tap, click or keyboard (SH-02 item 6) | Replaced by the bottom bar (SH-16) |
| Top bar | None. The page header sits at the top of the content area | None | 56px bar: page title, search icon, avatar |
| Content | Max width 1200px, 40px gutters | 16px gutters | 16px gutters |

- **Gutters:** the shell owns the page gutters, 16px on narrow screens (below
  1024px) and 40px at desktop. Pages never add a second outer gutter. Normal
  spacing between sections is 32px. (Standard 07, ledger UI-007.)
- **Radius:** 8px for controls (buttons, inputs, chips that are not pills),
  12px for cards and panels, 16px for dialogs, sheets and the search palette.
  Pills are only for statuses, filters and compact choices. One restrained card
  shadow. (Standard 07 radius tiers.)
- The sidebar background runs the full height of the window on every page,
  however long the page is. (Today's Kanvise sidebar stops at 1000px; that bug
  must not survive.)
- The page background is a warm off-white. Cards are white with a 1px border.
  The sidebar uses the same background as the page, so the content stands out.

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
- Disappears, with a fade, once every step is done or skipped.
- Shown to independent tutors and to the admin who created the agency.
  Invited tutors and admins have no setup checklist (spec 02).

### 4. Navigation

Groups have a small-caps label, as in Bobbin. Items have an outline icon and a
text label. Setup sits above Dashboard while it is unfinished.

| Group | Item | Route | Shown to |
|---|---|---|---|
| (none) | Setup | `/setup` | Independent tutors and the admin who created the agency, until setup is finished |
| (none) | Dashboard | `/dashboard` | Everyone |
| (none) | Calendar | `/calendar` | Everyone |
| (none) | Lessons | `/lessons` | Everyone |
| (none) | Courses | `/courses` | Everyone (agency tutors see only their courses) |
| PEOPLE | Students | `/students` | Everyone (agency tutors get a read-only list of the students on their courses) |
| PEOPLE | Tutors | `/tutors` | Agency admins only (`19-tutors-and-team.md`) |
| PEOPLE | Team | `/team` | Agency admins only: the agency's admins (`19-tutors-and-team.md`) |
| WORK | Homework | `/homework` | Everyone |
| WORK | Quizzes | `/quizzes` | Everyone |
| LIBRARY | Recordings | `/recordings` | Everyone (`17-recordings-and-attendance.md`) |
| LIBRARY | Resources | `/resources` | Everyone |
| ACCOUNT | Settings | `/settings` | Everyone (agency tutors see personal settings only) |

- **PEOPLE** follows Bobbin's group of the same name. An independent tutor and
  an agency tutor see only Students in it, as Bobbin's tutors do.
- **Active item:** an orange bar on the left edge (the "location" token,
  SH-15), a slightly darker background, and the label in the strongest text
  colour. Bobbin fills the active item black; Kanvise keeps its own brand
  (00 section 11).
- A count badge appears only when it means "something needs you", for example
  **Homework 3** when three submissions are waiting to be marked. It never
  shows totals. The badge has an accessible name ("3 to mark").
- Opening a route the person may not see (for example an agency tutor typing
  `/tutors`) shows the Not available page (SH-14). It never redirects with a
  toast.

### 5. User card (bottom)
- Photo or initials, name, and a second line with role and account, for
  example **Admin · Science Students Academy** or **Tutor · Science Students
  Academy**. Independent tutors see only their email.
- Clicking the name opens the account menu (SH-06).
- A **?** icon button to the right opens the help menu (SH-04). A small blue
  dot on it (the information colour, never orange) means there is something new
  in What's new that this person hasn't opened. The button's accessible name
  says so: "Help, new updates".

### 6. Collapse button
- At the top right of the sidebar. Collapses to the icon rail on desktop.
  Remembered per device.
- It is a real button (`aria-expanded`), reachable with Tab and toggled with
  Enter or Space. On tablets the same button expands and collapses the rail.
  Nothing depends on hover.
- In the collapsed rail, each icon shows its label as a tooltip on hover and on
  keyboard focus; the icon link always has the label as its accessible name.

## SH-03 · Page header pattern

Every page uses the same header:

1. **Title**, 24px on phones and 30px on desktop, in the foreground colour
   (standard 07 page title). One `h1` per page.
2. **One line under it** that explains the page in plain words, for example
   "A course pairs a student with a tutor over time." Never decorative.
3. **One primary action** on the right, in indigo, for example **New course**.
   Secondary actions are outline buttons to its left. Anything else goes in a
   **⋯** menu.

Detail pages (a course, a lesson, a student) add:
- the course colour swatch (SH-15) or the person's avatar before the title;
- a status chip after it (for example **Planned**);
- a facts strip under the header (for example Date · Time · Course);
- underline tabs below the header, with the active tab underlined in orange.

## SH-04 · Help menu

Opens upward from the **?** in the user card. Matches Bobbin's help menu.

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
  feature, 1 fix**, and expand on click. A **Read earlier** divider separates
  them, and **See the full changelog** sits at the bottom, as in Bobbin.
- Opening the dialog clears the blue dot and the **New** badge.
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
  icon, the name with the matching text highlighted, and one detail (for
  example a lesson's course and date). Lessons also show their status chip, as
  in Bobbin.
- **No results:** **No matches for "xyz".** and **Try a student's name, a
  course or a lesson topic.**
- Footer: **↑ ↓ Navigate · ↵ Open · esc Close**.
- Results respect permissions: a tutor only finds their own courses, lessons
  and students.
- Keyboard and screen readers: see SH-12 (combobox and listbox).

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

Opens upward from the user card. Matches Bobbin's admin account menu. Bobbin's
tutor menu has only Sign out (tutors reach their profile from Settings);
Kanvise shows the same two items to every role.
- The person's name and email at the top (not clickable).
- **My profile** → `/profile`
- **Sign out**. Signs out immediately and returns to `/auth/login`. If there
  are changes saved on this device that have not uploaded yet (SH-13), it asks
  first: **Some changes haven't uploaded yet. Sign out anyway?** "They'll be
  lost from this device." **Stay signed in** · **Sign out anyway**.

## SH-07 · Account switcher

Only for people in more than one account. Opens from the account card.
- One row per account: logo or letter, name, and the person's role there.
- The current account has a tick.
- Choosing another account reloads the dashboard for that account, with a toast
  **Now in Science Students Academy.**

## SH-08 · Toasts and feedback

These rules apply to every spec. Standard 07: "Toasts acknowledge short-lived
global results; they do not contain essential instructions or replace
persistent errors."

**What a toast is for**
- A toast only acknowledges something that just happened: **Course created**,
  **Lesson moved to Tuesday**. Nothing the person needs to read later or act on
  lives only in a toast.
- Success is also shown where the result matters (the new course appears in
  the list, the lesson shows its new time).

**Failures**
- A failure that needs action is shown as a persistent banner on the page that
  owns the thing, and stays until it is fixed or dismissed. For example, on the
  course page: **The starting check wasn't sent.** with **Send now**.
- A failure inside a form or dialog is an inline error next to the field or
  above the buttons, and the typed input is kept.
- Error copy says what failed, what was kept, and what to do. Never raw server
  text.

**Timing and number**
- One toast at a time. A new toast replaces the current one, except a toast
  with an action, which the new toast waits behind.
- A success toast disappears after 4 seconds. The timer pauses while the
  pointer is over it or it has keyboard focus.
- A toast with an action (for example **Undo**) stays until the person
  dismisses it, presses the action, or the action window closes. The window
  closes when the person leaves the page or after 5 minutes, whichever is
  first.
- A side effect of an undoable action (an email, a push notification, a
  WhatsApp-ready message) is held until the undo window closes. Undo means
  nothing was sent. For example, cancelling a lesson emails the students only
  when the **Undo** toast has gone.

**Look and place**
- Bottom right on desktop. Bottom centre on phones, above the bottom bar and
  above any fixed button (stacking order in spec 16, R-10). They slide in.
- Success: a green tick and one short line. Information: a blue icon.
- Toasts never cover the page's primary action, and stay clickable when a
  dialog is open.
- Toasts are announced through a polite live region (SH-12). Their action
  button is reachable with the keyboard (F6 moves to the toast region, then
  Tab).

## SH-09 · Loading, error and empty states (every page)

- **Loading:** skeletons shaped like the real content, with a soft shimmer.
  Never a blank page or a lone spinner for a whole page. Between pages, a thin
  progress line runs along the top of the content area (Bobbin shows the same
  line while its dashboard loads).
- **Error:** the card that failed shows **We couldn't load this.** and a
  **Try again** button. The rest of the page keeps working. If data was
  already on screen, it stays, with a small warning line instead.
- **Empty:** the entity icon in a tinted circle, a title (**No courses yet**),
  one or two lines that explain the concept, and one primary button.
- **Not available** and **signed out while working:** SH-14.

## SH-10 · Dialogs and wizards

- Dialogs are centred, 480–640px wide, white, 16px radius, over a dimmed and
  slightly blurred page. The page behind cannot be scrolled or clicked.
- Every dialog has a title, a one-line subtitle, and a close **✕**. Escape
  closes it unless something unsaved would be lost, in which case it asks first.
- Focus moves into the dialog when it opens and returns to the button that
  opened it when it closes (SH-12).
- **Wizards** add:
  - a segmented progress bar under the subtitle, one segment per step, filling
    as you go, with the current step in orange;
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
  98%. Hover only adds emphasis; it never reveals something that can't be
  reached by tap or keyboard.
- Kavi's text streams in a few words at a time, with a typing indicator first.
- With reduced motion turned on, everything appears instantly without movement.
- Animation never blocks input: tapping or typing during an animation acts at
  once.

## SH-12 · Accessibility

Kanvise targets WCAG 2.2 AA (standard 07, "Accessibility baseline"). These
rules apply to every screen, including the student app and the classroom
screens Kanvise owns.

**Focus**
- Every control works by keyboard, with a visible 2px focus ring outside the
  control.
- Opening a dialog, sheet, menu or the search palette moves focus inside it.
  Focus is trapped there until it closes, Escape closes it when nothing would
  be lost, and focus then returns to the control that opened it.
- After a wizard step changes, focus moves to the new step's heading.
- Every page has a skip link to the main content and one `h1`.

**Live regions**
- Toasts use a polite live region.
- Kavi's streaming text is not read word by word. The region is marked busy
  while it streams and announces once when the draft is complete, for example
  "Kavi's draft is ready". The typing indicator is hidden from screen readers.
- The scripted onboarding lines (spec 02) are announced once each, when the
  line has finished appearing.
- Saving states (SH-13) are announced only when they change to **Saved on this
  device** or **Couldn't save**, never on every keystroke.

**Status and colour**
- A status is always an icon plus text, never colour or fill alone. For
  example, course plan topic statuses each have their own icon and word (Knows
  it, Needs work, Taught, Next), and lesson statuses show a dot plus the word
  (Planned, Starting soon, Live).
- Orange (the "location" token, SH-15) meets 3:1 contrast against its
  background when used as a bar, underline or outline, and 4.5:1 when it is
  ever used for text. All other text meets 4.5:1, and large text 3:1, including
  hover, disabled and focus states.

**Search palette**
- The field is a combobox (`role="combobox"`, `aria-expanded`,
  `aria-controls`) and the results are a listbox with one group per type, each
  group labelled ("Students").
- ↑ and ↓ move the active option (`aria-activedescendant`), Enter opens it,
  Escape closes the palette and returns focus to the Search field. The number
  of results is announced politely ("5 results").

**Drag and reorder**
- Every drag (course plan topics, quiz questions, resources) has a handle and a
  keyboard and menu alternative: **Move up** and **Move down** in the item's
  **⋯** menu, and arrow keys on a focused handle. The new position is announced
  ("Factorising moved to position 3 of 8").

**Touch and hover**
- Tap targets are at least 44×44px.
- Nothing depends on hover. Tooltips also show on focus and on tap, and never
  hold the only copy of important information. Disabled buttons show their
  reason as text next to or under the button.

## SH-13 · Saving and offline

Every field that saves by itself (lesson summary, lesson notes, student notes,
lesson plan, homework instructions, and in the student app a student's homework
text and quiz answers) shows one honest saving state next to it, or in the
editor's header.

| State | Shown as | When |
|---|---|---|
| Saving | **Saving…** | A change is being sent to the server |
| Saved | **Saved** (the time on focus or tap, for example "Saved at 4:12 PM") | The server confirmed the change |
| Saved on this device | **Saved on this device. It will upload when you're back online.** | There is no connection; the change is stored on the device |
| Couldn't save | **Couldn't save.** with **Retry** | The server refused or kept failing (not a lost connection) |

- **Saved** only appears after the server confirms. A tick never appears for a
  change that only exists on the device.
- **Queue:** every change is written to the device first (IndexedDB, kept per
  person and per account, keyed by the record and field) and then sent. If
  several changes to the same field are waiting, only the latest is sent.
  Changes upload in the order they were made.
- **Retry:** when the connection comes back, the queue uploads straight away.
  While a connection exists but sending fails, it retries after 10 seconds, 30
  seconds and 60 seconds, then every 2 minutes while the page is open. After
  the third failed try with a server error, the field shows **Couldn't save.**
  with **Retry**, and the text stays on the device.
- **Changed elsewhere:** if the same text changed on the server since this
  device last loaded it (for example a co-tutor edited the lesson plan), the
  upload does not overwrite it. A banner above the field says **This changed
  while you were offline.** with **Keep mine** and **Use the newer version**,
  and shows both versions.
- **Offline banner:** a slim banner under the page header (under the top bar on
  phones): **You're offline. Changes are saved on this device and will upload
  when you're back.** When the connection returns: **Back online. Uploading 2
  changes…**, then it disappears once everything has uploaded.
- **Actions that need the server are disabled offline**, with the reason shown
  as text under the button: **Complete**, **Send** (starting checks, homework,
  invitations), **Join classroom** and **Start lesson**, **Schedule**,
  **Cancel lesson**, **Delete**, and **Draft with Kavi**. The reason reads, for
  example, **You're offline. You can complete this summary when you're back
  online.** Nothing is queued for later that would reach a student by itself.
- The queue survives closing the tab and restarting the phone. It is cleared
  only after upload, or when the person signs out and confirms (SH-06).

## SH-14 · Not available and signed out

### SH-14a · Not available

One shared page, inside the normal shell, for every resource the person cannot
open: it belongs to someone else (a tutor opening another tutor's lesson, a
student opening another student's homework), it was deleted, it never existed,
or the page is for admins only.

- Icon in a grey tinted circle, title **We can't show this page**, and the line
  **It may have been removed, or it belongs to someone else. If you think you
  should see it, ask your admin.** (Independent tutors and students see **…or
  it belongs to someone else.** without the admin line.)
- One button: **Go to dashboard** (students: **Go to Home**).
- The same page and the same response (not found) for all these cases, so the
  page never reveals that something exists.
- A route that only admins may use (for example `/tutors` for an agency tutor)
  uses this page too, with the title **This page is for admins**.

### SH-14b · Signed out while working

- When a sign-in expires on any page, the page stays on screen and a dialog
  appears: **You've been signed out** and **For your security, sign-ins end
  after a while. Sign in again to carry on. Anything you typed is kept on this
  device.** with **Sign in again**.
- Signing in returns to the same page and uploads anything saved on the device
  (SH-13).
- In the summary editor and the lesson notes, typing goes on being saved on the
  device while the dialog is open behind a dimmed page.
- In the classroom, the lesson itself keeps running. Lesson tools shows
  **Sign in again to use Lesson tools** with **Sign in again**, which opens the
  sign-in in a dialog without leaving the room (spec 07).

## SH-15 · Colour rule

| Colour | Means | Used for |
|---|---|---|
| Orange, the "location" token | You are here | Active sidebar item's left bar, active tab underline, current wizard step, today on the calendar and the dashboard's day strip, the active phone tab marker. Nothing else. Needs the standard 07 amendment in `00-decisions.md` section 18 |
| Indigo | Primary action, links | Primary buttons (one per region), links |
| Blue dot | Scheduled | **Planned** lessons |
| Amber dot | Starting soon | **Starting soon**: the classroom has opened (CFG-L "Classroom opens", default 15 minutes) and the lesson hasn't started |
| Green pulsing dot | Live | **Live** lessons, **Live now** on the dashboard |
| Blue (information) | Something new | The help **?** dot, **New** badges |
| Red | Danger and failure | Destructive buttons, **Couldn't save**, errors |

- Lesson time colours are never orange.
- Green is reserved for Live and success ticks. A finished lesson uses a
  neutral chip with a tick icon and the word **Complete** (spec 05's status
  table follows this rule).
- A course's own colour is shown as a small rounded square (the course
  swatch), never a round dot, so it can't be mistaken for a status dot.

## SH-16 · Phones

Spec 16 wins on phone behaviour; this is the shell's part of it.

- **Bottom bar:** **Today** (the dashboard), **Calendar**, **Lessons**,
  **Students**, **More**. **More** opens the full sidebar as a sheet, with the
  same groups and icons as desktop. There is no hamburger menu.
- On the dashboard, the phone top bar's title reads **Today**, the same word
  as the tab. The desktop sidebar item keeps Bobbin's word, **Dashboard**.
- The More sheet shows, top to bottom: the account card (and switcher), the
  setup card while unfinished, every navigation group from SH-02 item 4, and
  the user card with the account menu and help menu. Its focus and Escape
  behaviour follow SH-12.
- **Classroom on phones** opens in the same tab, not a new one, so the
  installed app keeps its shell. The pre-entry and after-lesson screens show
  **Back to lesson**, which returns to the lesson page. On desktop the
  classroom opens in a new tab (spec 07, CR-01).

---

Checked against Bobbin (screenshots opened and compared):
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/00-recon/screenshots/post-login.png` (admin sidebar with Setup above Dashboard, setup card, PEOPLE group)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/page--default.png` (loading: thin top progress line, sidebar stays)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/dashboard-account-menu.png` (account menu: name, email, My profile, Sign out)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/dashboard-help-updates.png` (help menu items and New badge)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/dashboard-global-search.png` (Browse by type, footer keys)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-dashboard--default.png` (tutor sidebar: PEOPLE holds Students only, no Setup)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-global-search--results.png` (grouped results, highlighted match, lesson status chip)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-whats-new.png` (What's new layout, Read earlier, full changelog link)
- `/projects/sandbox/atlas/kanvise/admin_dashboard.png`, `/projects/sandbox/atlas/kanvise/admin_dashboard_more.png` (today's Kanvise sidebar and More page being replaced)

Deliberate differences from Bobbin: orange left bar instead of a black filled
active item; a WORK group (Homework, Quizzes) that Bobbin does not have; no
Clients, TO REVIEW or trial banner (00 sections 14 and 15).

Final Bobbin pass (FEAT-009):
- `15-tutor-role/screenshots/tutor-account-menu.png`: Bobbin's tutor account menu has only Sign out; Kanvise keeps My profile for every role (SH-06).
- `15-tutor-role/screenshots/tutor-help-updates--open.png`: tutor help menu (What's new with New, Help guide, Share feedback, Privacy policy) matches SH-04.
