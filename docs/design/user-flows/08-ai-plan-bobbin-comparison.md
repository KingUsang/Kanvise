# AI course plan: what Bobbin does, what Kanvise does

Written 28 Nov 2026. Source: atlas folder `18-ai-plan-control-audit` on
`research/bobbin-appatlas` (commit `c49a8fb`), which ran one real AI plan
generation on Bobbin, edited the result, and recorded the controls. Compared with
`04-courses-plan-and-diagnostic.md` (CRS-04, CRS-06).

## What Bobbin does

- **Describe your own:** one big text box with an example, and a **Generate plan**
  button that stays disabled until you type.
- **Asynchronous.** The screen says it is drafting, can take up to a minute, and
  that you may leave the page. It shows a small word game while you wait.
- **Auto-applied.** When it finished, the plan was already on the course. There was
  no review screen. The test result was 8 modules, 21 topic groups and 46 objectives.
- **Outline menu:** History, Change template, Describe your own.
- **Module page:** the reason for the module's place in the order, topic groups,
  objectives with **Mark covered**, **Edit module**, **Back to plan**, and next
  module.
- **Edit module** is inline: edit titles, descriptions and objectives, add or
  remove topics and objectives, then **Done**.
- **Add module** creates a blank module at once. In the test it seemed to do nothing
  until a later refresh (a Bobbin bug).
- **Remove** asks for confirmation.
- The names in the course roster link to the tutor and student pages.
- **Global search** groups results by Students, Tutors, Clients, Courses, Lessons and
  Settings.

## Where Kanvise already differs, on purpose

| Topic | Bobbin | Kanvise (spec 04) | Keep? |
|---|---|---|---|
| After generating | Applied automatically | Saved as **Draft**. Nothing reaches students until the tutor presses **Use this plan** | Yes. The tutor owns the plan (00 section 3) |
| What a tick means | Per objective, **Mark covered** | Per student, per topic status (None, Next, Taught, Needs work, Knows it). Objectives are only a checklist | Yes |
| Starting point without AI | Browse 211 ready-made plans | **Start blank** or **Copy plan from another course** | Yes |
| Regenerating | **Describe your own** again | **Regenerate untouched modules**, keeping any module in use | Yes, safer |
| Word game while waiting | Yes | Modules stream in one by one, with **Stop** | Yes |

## What the audit adds that Kanvise should take

These are small and low risk, so they are applied to the specs (decisions D-24, D-26,
D-27):

1. **Leaving the page while Kavi drafts (D-24).** Bobbin lets you leave. Kanvise's
   dialog streams the draft and says nothing about leaving. On a phone, tutors will
   leave. The spec now says Kavi finishes in the background, saves a Draft and sends
   **Kavi's draft is ready** (NTF-305). If the build cannot continue after the page
   closes, the fallback is a line asking the tutor to stay on the page for about a
   minute.
2. **Why this order (D-26).** Bobbin shows the reason for each module's place. Kanvise's
   drafted modules now carry a one-line **Why this order** that the tutor can edit or
   delete. It helps a tutor judge a draft quickly.
3. **Removing a module or topic (D-27).** Bobbin asks before removing. Kanvise's spec
   did not say what happens when a topic has statuses, linked lessons or quiz
   questions. It now asks first and says what depends on it, and removes unused
   items with an **Undo** toast.

## Noted, not applied

- **Plan history (view and restore earlier versions).** Bobbin's outline menu has
  **History**. Kanvise has history for topic statuses but not for plan edits. With
  Kavi able to redraft modules, an undo of the last change would be useful. It is a
  moderate build, so I suggest **Later** (OQ-14).
- **Per-objective Mark covered.** Not copied, on purpose (above).
- **Add module appearing at once.** Kanvise's **+ Module** must show the new module
  immediately and put the cursor in its name field (CRS-04 already says the cursor
  goes to Module 1 name for a blank plan). Make this a test case (TC-CRS-020).
- **Names in the roster as links.** Check that course student and tutor names link to
  their pages in CRS-03.
- **Quota.** The audit notes one AI generation was "consumed". If Kavi plan drafts
  have a limit per tutor per day, the spec should say so and show how many are left.
  There is a general cost note in `20` DM-26 but no per-tutor limit. Open: OQ-15.
