# 16 · Responsive design (every screen, every role)

Status: draft for owner review. Applies to specs 01–15. If a screen spec
disagrees with this file on phone or tablet behaviour, this file wins.

**Why it matters:** many tutors run their whole teaching day from a phone,
often on mobile data. Students mostly use phones. Admins use laptops more, but
must be able to check things on a phone. Every screen must work at 360px wide
with one thumb.

## R-01 · Breakpoints

| Name | Width | Typical device |
|---|---|---|
| Phone | 360–767px | Android phones (design at 360, check at 320 without breaking) |
| Tablet | 768–1023px | Tablets, small laptops in portrait |
| Desktop | 1024px and up | Laptops and monitors |

Design phone first, then widen. No horizontal page scrolling at any width, ever.

## R-02 · App shell on phones

**Tutors and admins** get a bottom bar, like the student app, instead of only a
hidden drawer. Five items:

| Tab | Goes to |
|---|---|
| Today | Dashboard |
| Calendar | Calendar (agenda view) |
| Lessons | Lessons list |
| Students | Students list |
| More | A sheet showing the full sidebar: the same groups and icons as desktop (Courses, Homework, Quizzes, Recordings, Resources, Team for agencies, Settings, Help), so nothing is in a new place |

- The bar keeps only the four daily items plus More. There is no hamburger menu:
  hidden navigation gets used less, and two menus for the same links would
  confuse. Courses live in More because tutors reach them mostly from a lesson
  or a student.
- The active tab has the orange marker (above the icon) and a bolder label.
- A top bar shows the page title, search (magnifier) and the avatar (account
  menu, help).
- Setup, while unfinished, shows as a slim card at the top of Today, not a tab.
- The bottom bar hides inside the classroom, wizards and the summary editor,
  where the screen is needed for work.
- The bar sits above the phone's gesture area (safe-area padding), a known
  Android problem in today's app (old UX-01).

**Students:** four tabs as in spec 09 (Home, Lessons, Homework, Courses).

**Tablet:** the sidebar is an icon rail that expands on tap. **Desktop:** the
full sidebar (spec 01).

## R-03 · Page headers on phones

- Title on one line (truncate with … if needed; the full title shows on tap).
- The one-line description under the title stays, in smaller text, two lines at
  most.
- The primary action becomes a button under the description (full width) when
  it matters most on that page (for example **Schedule lesson** on Today), or
  a round **+** button at the bottom right above the bar on list pages (**New
  course**, **Add student**). Never both.
- Secondary actions move into **⋯** at the top right.

## R-04 · Tables become cards

Every table (Lessons, Students, Homework, Quizzes, Recordings, Resources, Team)
turns into a list of cards on phones:
- Line 1: the main thing (lesson topic, student name, homework title), bold.
- Line 2: the two most useful details (date and time; course; due date).
- Right side: the status chip.
- The whole card is tappable. Row actions stay on the detail page, not the card.
- Filters collapse into one **Filter** button that opens a bottom sheet with the
  same options and **Show results**. Active filters show as removable chips
  under the search box.
- Status tabs (All, Planned, …) scroll sideways inside their own strip if they
  don't fit, with a fade at the edge, never pushing the page wider (old UX-10).

## R-05 · Dialogs and wizards on phones

- Dialogs become full-screen sheets that slide up, with the title in a top bar,
  **✕** on the left, and the main button fixed at the bottom.
- Wizards keep the segmented progress bar under the title; **Continue** and
  **←** stay fixed at the bottom, above the keyboard.
- When the keyboard opens, the focused field scrolls into view and the bottom
  button rides above the keyboard.
- Small confirmations (Delete, Complete) stay as centred dialogs, at least 320px
  wide, with buttons stacked full width.

## R-06 · Touch and type

- Every tap target is at least 44×44px, with at least 8px between targets.
- Body text is 16px on phones (so iOS doesn't zoom into fields); secondary text
  never below 13px.
- Inputs use the right keyboard: email, phone (`tel`), numbers (`inputmode`),
  dates use the native picker on phones.
- Long-press is never the only way to do something.
- Drag-to-reorder (course plan, quiz questions, resources) has a handle and an
  alternative: **Move up** / **Move down** in the item's **⋯**.

## R-07 · Screen-by-screen rules

| Screen | Phone | Tablet |
|---|---|---|
| Setup (02) | One column; help column moves below the checklist | Two columns if 900px+ |
| Kavi onboarding (02) | Full screen, chips stacked full width | Centred column |
| Dashboard (03) | Order: Next lesson card, Needs attention, Today, This week, Kavi suggests | Two columns |
| Courses list (04) | One card per row | Two per row |
| Course page (04) | Tabs scroll sideways; right-column cards move below the main content | Right column below main if under 900px |
| Course plan (04) | Modules collapsed by default; topic status chips wrap under the topic name; Viewing selector becomes a dropdown | As desktop |
| Starting check preview (04) | Question list becomes a dropdown at the top; editor below | Two panes |
| Calendar (05) | **Agenda** view by default (a list grouped by day), with Day as the alternative; Week and Month hidden | Week view |
| Lesson page (05) | Facts strip wraps into two rows; Join button fixed at the bottom when the lesson is open; right column below | Two columns |
| Students (06) | Cards (R-04); import works, but shows **Easier on a computer** above the matching step | As desktop |
| Student page (06) | Tabs scroll sideways; private notes open as a full sheet | Two columns |
| Classroom (07) | PlugNMeet takes the full screen; Lesson tools opens as a bottom sheet from a **Tools** button; End lesson inside the sheet | Lesson tools as a side drawer |
| Device check (07) | One step per screen | One column |
| Lesson summary (08) | Sections stacked; Complete fixed at the bottom; student tabs scroll sideways for groups | As desktop |
| Student app (09) | The main design target | Same layout, wider cards |
| Homework hand-in (10) | **Take a photo** first; files show as thumbnails | As desktop |
| Marking (10) | Submission on top, marking below; **Save and next** fixed at the bottom; images open full screen with pinch zoom | Side by side |
| Quiz builder (11) | Question list becomes a dropdown; editor full width | Two panes |
| Taking a quiz (11) | One question per screen; options full width; **Next** fixed at the bottom | Same |
| Quiz results (11) | By student and By topic become tabs | Side by side |
| Settings (12) | Section list is the first screen; tapping a section opens it with a back arrow | Two panes |
| Resources (15) | Cards; upload uses the phone's file picker and camera | As desktop |
| Search (01) | Full-screen sheet | Centred palette |

## R-08 · Slow connections

- Skeletons appear within 100ms; real content replaces them as it arrives.
- Lists load 25 items at a time, with more loading on scroll.
- Images use small thumbnails in lists; full size only when opened.
- Uploads show progress and retry by themselves on a dropped signal.
- When offline, a slim banner says **You're offline. We'll update when you're
  back.** Anything typed (summaries, notes, quiz answers) is kept.

## R-09 · How we check it

Every screen PR includes screenshots at 360px, 768px and 1280px, for each role
that can see it, and passes:
- no horizontal scrolling at 320px;
- all tap targets 44px or larger;
- the keyboard never covers the focused field or the main button;
- the bottom bar never covers content.
A real-device check (one low-end Android phone, one iPhone) happens before each
area ships, starting with the classroom and the student app.
