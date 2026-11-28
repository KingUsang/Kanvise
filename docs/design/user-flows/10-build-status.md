# What is built, and where the specs and the build differ

Checked 28 Nov 2026 against `origin/staging` (commit `dfe56f4`, PR #79). I read the
commit list, and read the search code (`api/src/lib/global-search.ts`,
`api/src/routes/search.ts`, `web/src/lib/search.ts`, `search-palette.tsx`) in full. For
everything else I only read commit titles, so treat those lines as a guide, not a
review.

## Where things stand

- **PR #78** (`design/redesign-spec`, the redesign specs) is **still open**. The
  specs are not on `staging`; the builders work from that branch.
- **This branch (`docs/user-flows`)** was made from `design/redesign-spec`. Its spec
  edits reach the builders only when they are merged into `design/redesign-spec`.
  I have not opened a PR for that. Say the word and I will, into
  `design/redesign-spec`, not `staging`.
- **Build step 1 (shell) is merged on staging** through PR #79, 16 commits:
  design tokens and shared parts, the app shell (grouped sidebar, phone bottom bar,
  More sheet), the search palette, the save queue and offline banner, held messages,
  notification preferences and the unsubscribe page, 44 px tap targets, and a design
  and wording review.

## Search: built, and how it differs from the spec

| Topic | Spec (SH-05) | Built | Action |
|---|---|---|---|
| Matching | Not stated | Contains, any case, 2 to 100 characters; wildcard characters treated as text | Written into the spec |
| Delay | Not stated | 200 ms after the last key; older answers ignored | Written into the spec |
| Groups per result | Up to five | Up to five | Match |
| What is matched | Not stated | People: first name, last name, email, "first last". Courses: name. Lessons: title only | Written into the spec. Notes and summaries are not searched, as wanted |
| Cancelled lessons | Not stated | Left out | Written into the spec; confirm it is wanted |
| Students group | Agency tutors find their own students | **Admins only.** Tutors get no Students group | **Differs.** Fix in the build (a small change in `searchStudents`), or relax the spec. I kept the spec as it was |
| Tutors group | Agency admins | Agency admins only; hidden for independent accounts (uses `account_type`) | Match |
| Courses, Lessons for tutors | Own only | Courses they teach, and their own lessons | Match |
| Homework, Quizzes, Resources, Settings results | Searched | Not yet. They appear in "Browse by type" if the person sees that page | Expected: they arrive with their steps |
| Lesson status chip | Seven statuses | Four: Planned, Starting soon, Live, Complete | Expected: the rest arrive with the lessons step |
| Classroom opens | Account setting (CFG-L) | Fixed at 15 minutes in code | Fine until settings are built (step 3) |
| Result links | The item's page | The old dashboard pages; a person or tutor result opens the list | Expected until the new pages exist |
| Typo tolerance, recent searches | Not in this version | None | Match |

## Spec changes on this branch that touch what is already built

The shell (step 1) is built, and I have since changed some of its spec text. These
need follow-up code, so the builders should know before they treat step 1 as done:

| Spec | My change | Built today |
|---|---|---|
| 01 SH-02 account card | Tutors and admins always see the chevron, and the card opens the account switcher | Built to the earlier wording (chevron only with more than one account). Not checked in the code |
| 01 SH-02 user card | Second line shows the active role (**Tutor · Agency name**) for someone who holds both | Not built |
| 01 SH-06 account menu | **Switch role** (Admin or Tutor) for an admin who also teaches; links switch role when needed | Not built |
| 01 SH-07 account switcher | **Create another account** at the bottom; always available to tutors and admins | Not built |
| 01 SH-05 search | The matching rules above | Built, except the tutors' Students group |
| 12 settings names | PERSONAL, LESSONS, ACCOUNT groups; **How you teach**; one **General** section | Step 3, not built |
| 18 notifications | Push for **lesson didn't take place** and **recording didn't save**; notice to the old address on email change; student invitation lasts 7 days; concerns exclude the person concerned | Held messages, preferences and unsubscribe are built (NTF-03, NTF-04). The rest arrive with their steps |
| 20 DM-01 | One membership per person per account, plus a `can_teach` flag for admins | Not built. Existing table already has one role per person per account |

Note: I did not check how an independent tutor's membership is stored, so I am
assuming it counts as an admin in the search code (`role === 'admin'`), which the
Students group relies on. The "Not built" cells below mean the wording is new and I
did not search the code for it.

## What I would do next

1. Decide whether to relax the Students group rule for tutors, or ask the builders to
   add it. It is a small change in `searchStudents`.
2. Merge this branch into `design/redesign-spec` so the builders and the specs agree.
3. Re-run this check when the next step lands.
