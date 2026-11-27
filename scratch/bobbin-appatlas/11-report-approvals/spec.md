# Report approvals

Route: `/report-approvals`

## Purpose

This is an administrator-controlled holding queue for reports from completed lessons. Its page copy defines the intended workflow: review and edit held reports, approve each one, then release them in one batch to clients.

## Observed state

The organization has no queued reports. The empty state reads: “No reports awaiting approval” and explains that reports from completed lessons will appear here for review before they are sent to clients.

## Relationship to AI lesson output

Bobbin's sample completed lesson renders a generated lesson summary, per-student/tutor performance cards, covered objectives, and a Share menu with **Export as PDF** and **Email to clients**. This shows the post-lesson AI output and distribution surfaces. It does not populate the organization queue because the sample lesson is demo data. The synthetic lesson cannot generate insights because its session was too short to analyze; it therefore cannot be used to exercise a populated approval state.

## Evidence

- `screenshots/report-approvals--recheck.png` — verified empty approval queue.
- `../03-lessons/screenshots/sample-insights--recheck.png` — populated AI lesson summary.
- `../03-lessons/screenshots/sample-insights--share-open.png` — distribution menu.

## Populated workflow

The finalized tutor test lesson created one real held report for the synthetic student. The populated queue identified the submitting tutor and exposed lesson navigation, tutor-note editing, pagination, and approval. An administrator saved a clearly labeled research note, staged approval, opened the irreversible “Send to clients” confirmation, and released the single report to the controlled test client. The queue then returned to its empty all-caught-up state. Because the classroom session was too short, the report truthfully contained no generated summary or insights.
