# Kavi: your slice

Hi, welcome. This is the piece I'd like you to own end to end: everything in Kanvise
that calls an AI model. We call the assistant Kavi. Please read this as a starting
point and argue with it. The rules in "The rules that can't bend" are fixed. Almost
everything else is yours to decide.

Read `README.md` in this folder first. It explains what Kavi does for tutors.

## Where the specs are

The redesign specs are in `docs/design/redesign/`, and the other design documents are
in `docs/design/`. Start with `docs/design/user-flows/README.md` for how everything
fits together.

## What you own

The Kavi service in the API, every route that starts an AI request, the code that
gathers an account's data for a prompt, the Kavi database tables and their
migrations, and the tests for all of it. I'll do the frontend and the tables that
aren't Kavi's.

## What's in the first version

All of it. That is the twelve things in `README.md`: course plan, tidying a plan,
starting check questions, suggested topic order, lesson plan, summary from the
recording, summary from lesson notes, homework suggestion, homework feedback, quiz
questions, "Ask Kavi" on the student page, and suggestion cards on the dashboard.

Around them: a settings screen (I'll build the screen), a "your draft is ready"
notification, replacing an old recording job, and retiring an old PDF import.

## The rules that can't bend

- **Kavi drafts, a person confirms.** Nothing is pre-ticked, pre-accepted or
  pre-scored.
- **Private notes about a student** (the spec calls them *student notes*) must never
  be sent to any provider, for any feature.
- **Private lesson notes** are sent only to draft that lesson's summary, only when the
  tutor presses **Draft with Kavi**, and never for any other feature.
- No transcript without every student's consent, and not for recordings under five
  minutes.
- Every request is limited to one account and to what the person asking may see.
- Every screen keeps a working manual route for when Kavi is off or fails.
- Failures show an honest message, and what the tutor typed is kept.
- API keys never go in URLs or logs. The model name is configuration, and each request
  records which model ran.
- We record the cost of each request, and we keep thumbs up and down feedback against
  the prompt version.

## Yours to decide

The code structure, which providers, whether to stream, how to run the long recording
job, and how to test without paying. We've sketched one design in
`docs/design/redesign/20-data-model.md` (DM-21 to DM-30). Take it, change it, or ignore
it.

We currently lean on Gemini for writing and Deepgram for transcribing. If you'd rather
use something else, tell me why. A provider has to not train on our data, have written
retention terms, and I have to approve it before real data goes anywhere.

## What's in the repo today

There is no Kavi code. There is a job queue (`api/src/jobs/durable-jobs.ts`) and
`zod`. There is an old recording-to-recap job (`api/src/jobs/live-class-recording.ts`)
that skips the consent check and puts the API key in the URL, and a retired PDF import
(`api/src/domain/mock-pdf-import.ts`). Read them for ideas and don't copy them.

## Where to start

The foundation and the first feature, the course plan draft. It needs no student data
and no audio. Then the text drafts, then recording to summary (it waits for an accuracy
test on Nigerian English and young voices), then the suggestions and "Ask Kavi".

Many features sit on screens that other work is still building, so start with the
service and the API, tested on their own. The screens connect to them as they land. I
suggest you write the first version of the contract with the frontend: the route, the
input, the events it streams back, the error kinds and the draft shapes. Provide a fake
provider so the frontend and the tests don't call the real services.

## A date to know

Google stops serving Gemini 2.5 Flash on 1 December and reroutes those calls to another
model at that model's price. Please make the model a setting from day one.

## What done looks like

The manual route works, the failure messages match the spec, the cost and feedback are
recorded, and there are tests for the privacy rules, including one that shows no other
feature ever sends lesson notes.

## Standards

Please follow `docs/engineering/standards/` 02, 03, 04, 05, 08 and 09. If the code and
the documents disagree, tell me before building on it and note it in
`docs/deviations.md`. Work goes through PRs into `staging`.

## Read in this order

1. `docs/design/redesign/00-decisions.md`: sections 9, 16 and 17.
2. `docs/design/redesign/20-data-model.md`: DM-21 to DM-30.
3. The `### Kavi` part of each feature spec (it lists input, output, failure state, what
   the tutor confirms, and the manual route).
4. `docs/design/redesign/12-settings-and-team.md`: the Kavi settings (CFG-K).
