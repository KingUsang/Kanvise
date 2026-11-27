# Lessons and classroom

Routes: `/lessons`, `/lessons/:id/insights`, `/lessons/:id/details`, `/lessons/:id/plan`, `/lessons/:id/notes`, `/space`

## List and status views

The Lessons list has status chips for all, planned, awaiting report, awaiting approval, complete, canceled, and canceled-chargeable states. The seeded sample lesson exercises the completed-record state; the synthetic lesson exercises a planned record.

## New lesson wizard

1. **Course & attendees** preselects the course roster and permits clearing/selecting students and tutors.
2. **Topic & schedule** requires a topic and pre-populates a one-hour slot. Attempting to continue without a topic produces the captured validation state, “Add a lesson topic.”
3. **Review & create** presents topic, course, tutor, student, start, and end before scheduling.

## Lesson detail

The detail surface includes summary/insights, session details, lesson plan, and notes. The seeded completed lesson demonstrates attendance, transcript/chat/analytics headings, structured plan sections, and internal notes. The new lesson demonstrates the empty AI-insights state and activity log.

### Completed AI-output state

The completed sample lesson adds a generated narrative **Lesson summary**, student and tutor performance cards, objectives covered, attendance, session transcript, lesson chat, and conversation analytics. The Share menu is reversible and exposes **Export as PDF** and **Email to clients**. The synthetic lesson does not reach this state: Bobbin explicitly says its sessions were too short to analyze, so no insights can be generated.

## Classroom lifecycle

- An admin clicks **Join classroom**, then receives an explicit “Join as admin?” confirmation. This opens a separate classroom tab.
- Pre-start offers **Start lesson** or **Enter without starting a lesson**.
- Live classroom controls include Invite, participant-specific copy/email links, add-device, lesson plan, last lesson, notes, and End lesson.
- On first entry, an onboarding modal explains camera/mic, individual join links, files, and return of transcript/chat/recording data to Bobbin.
- Ending a lesson requires confirmation and returns the room to the pre-start state. The persisted lesson then shows session lifecycle events while AI insights remain pending.

## Evidence

See `screenshots/` for every list, wizard, validation, review, created-detail, pre-start, live-room, invite, end-confirmation, post-end, and insight-pending state. `join-links.local.txt` retains test-account links locally.
