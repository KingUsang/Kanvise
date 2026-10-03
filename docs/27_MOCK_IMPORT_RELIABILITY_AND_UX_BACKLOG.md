# Mock import reliability and UX backlog

Status: planned, not part of the class-workspace implementation.

## Problem

Creating a multi-subject mock from one master document currently exposes too
much importer state to the tutor. Subject switching can feel like an implicit
step change, Gemini/provider errors can surface without useful recovery, and
browser-only progress cannot truthfully represent queued or retried work.

## Intended experience

1. Create one assessment and upload a master source document.
2. The server creates a durable import job and reports clear states: queued,
   extracting, structuring, validating, ready for review, failed, or cancelled.
3. The tutor sees one review workspace with a subject sidebar and per-subject
   counts/statuses. Moving between subjects never advances a hidden wizard.
4. A failed source file preserves the draft and its earlier valid subjects;
   recovery explains what failed, whether retry is safe, and what to do next.
5. Publishing remains impossible until every selected subject has a valid,
   reviewable question set.

## Work required

- Finish and review the existing import-job migrations before applying them.
- Add server job ownership, idempotency, retry limits, cancellation, and
  provider-error classification.
- Persist structured per-subject extraction results and validation errors.
- Replace duplicate add/import controls with one deliberate source workflow.
- Add end-to-end coverage for master DOCX/PDF import, partial failure, retry,
  duplicate subjects, navigation, and publish validation.
- Add observability for provider latency, rate limits, parse failures, and
  job completion rate.

## Guardrails

- A master file must never silently replace previously reviewed questions.
- Raw provider messages must not be shown to tutors.
- Question, successful-import, and validation state are scoped to each
  subject; no state leaks when switching subjects.
- The public/mock delivery model stays separate from authoring state.
