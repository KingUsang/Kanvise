# AI course plan and minute-control audit

Routes: `/courses/9581`, `/courses/9581/outline`, `/tutors/24857`, `/students/24854`, and shared administrator chrome

Purpose: Close feature-level gaps left by the original course crawl: run one real AI course-plan generation, follow linked roster entities, inspect the generated outline controls, and exercise shared controls that are easy to miss in section-by-section crawling.

## Real AI course-plan generation

The freeform path opens a single large prompt field with an astrophysics example and a disabled **Generate plan** button until text is entered. The submitted test brief requested an eight-week GCSE algebra course covering manipulation, equations, inequalities, simultaneous equations, graphs, quadratics, sequences, practice, retrieval checks, formative milestones, and a final problem-solving project.

Exactly one generation request was made. The in-progress state says **Bobbin is drafting your course plan**, advises that it can take up to a minute and that the user may leave the page, and offers a classroom-word game. Generation runs asynchronously. Returning to the course after completion showed that Bobbin had automatically applied the result; there was no post-generation review/confirmation screen. The resulting plan has **8 modules, 21 topic groups, and 46 objectives**.

## Generated course outline

The outline overview shows progress globally and per module. Its overflow menu contains **History**, **Change template**, and **Describe your own**. Opening a module replaces the overview with a module detail surface containing its rationale, grouped topics, objectives, per-objective **Mark covered** controls, **Edit module**, **Back to plan**, and next-module navigation.

**Edit module** is an inline mode, not a dialog. It exposes editable module title, description and ordering rationale; editable topic titles/descriptions; editable objectives; add-topic/add-objective; remove-objective/topic/module controls; and **Done**. One objective was marked covered to capture the state, then immediately reverted. No generated text was changed or removed.

**Add module** immediately creates a blank module named **New module**, without an intermediate form or route change. Because the overview did not refresh immediately, this initially appeared to do nothing; a later fresh read exposed the ninth module. Its edit mode and remove confirmation were captured, the accidental blank module was removed, and a clean reload verified the generated plan had returned to eight modules.

## Linked tutor and student entities

The roster names on the course summary are real links, not static labels. **Atlas Research Tutor** opens `/tutors/24857`; **Atlas Research Student** opens `/students/24854`. Both destination states are now captured. The adjacent icon-only remove controls were inventoried but not confirmed because their final action removes course membership; the earlier course crawl already captured the roster-management surfaces.

## Shared app chrome and small controls

Global search was opened in both empty and populated states. Its empty state groups discoverability by Students, Tutors, Clients, Courses, Lessons and Settings and documents keyboard navigation. Searching **Atlas** returned the synthetic student, tutor, client, course and completed lesson, each as a navigable result.

The sidebar collapse/expand state, Help and updates launcher, and account menu were opened and captured. A fresh administrator inventory covered 20 routes and 552 visible controls, including course/person/lesson detail routes. It confirmed small controls such as calendar previous/next/today, day/week/month view switches, date cells and per-day add-lesson actions; recording type segments; safeguarding status segments; settings search; and nested Activity log, Webhooks and Data export routes. Those feature families already have walked evidence in the earlier atlas sections; this pass adds shared-chrome and course-plan gaps rather than duplicating every existing screenshot.

## Screenshots

- `ai-course-plan--describe-form.png`, `--brief-filled.png`, `--generating.png`, `--course-after-generation.png` — complete freeform-generation lifecycle.
- `ai-course-plan--outline-inventory.png`, `--actions-menu.png`, `--module-expanded.png`, `--edit-module-dialog.png`, `--objective-covered.png`, `--next-module.png`, `--add-module-dialog.png`, `--remove-blank-module-confirmation.png`, `--blank-module-removed.png` — generated outline, immediate blank-module creation, nested editing, and cleanup states.
- `course-summary--control-inventory.png`, `course-roster--tutor-detail.png`, `course-roster--student-detail.png` — course controls and linked-person destinations.
- `global-search--open.png`, `global-search--results.png`, `global-help-updates--open.png`, `global-sidebar--collapsed.png`, `global-account-menu--open.png` — shared app chrome.

## Mutation and quota record

- One explicitly authorized AI generation was consumed and auto-applied to the synthetic research course.
- One objective coverage toggle was exercised and reverted.
- One blank module created while testing **Add module** was removed; a reload verified cleanup.
- No module/topic/objective text was edited or deleted.
- No roster member was removed and no invitation, billing or payment action was sent from this pass.
