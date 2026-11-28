# AI agents in QA, 2026: what is real and what to use here

Researched 28 Nov 2026. Sources are linked inline. Content was rephrased for
compliance with licensing restrictions. Vendor pages are marketing, so claims
from them are marked as such.

## What changed

Testing used to mean people writing scripts, and scripts breaking whenever the
screen changed. In 2026 three things are different:

1. **Agents can explore an app and write a test plan.** Playwright now ships
   three test agents: a **planner** that explores the app and writes a Markdown
   test plan, a **generator** that turns the plan into Playwright tests and
   checks selectors live, and a **healer** that re-runs a failing test, looks
   at the current screen, proposes a fix, and either gets it passing or skips
   the test if it thinks the feature is really broken ([Playwright docs](https://playwright.dev/docs/test-agents)).
   The planner can take a product requirements document as input, which is what
   the flow docs in this folder are for.
2. **AI tools can drive a real browser through a standard protocol (MCP).**
   Microsoft's Playwright MCP server lets an AI model operate the page through
   the accessibility tree (roles and labels) instead of fragile pixel or CSS
   guesses ([overview](https://testdino.com/blog/playwright-ai-ecosystem)).
3. **Commercial platforms bundle authoring, running, healing and triage.**
   Lists of tools that keep appearing include mabl, QA Wolf, Momentic, Testim
   (Tricentis), Applitools, Functionize, testRigor, Katalon, KaneAI, Virtuoso,
   Meticulous and Autify ([MojoAuth roundup](https://mojoauth.com/blog/top-13-ai-software-testing),
   [Rework comparison](https://resources.rework.com/tools/ai-agents/best-ai-agents-for-qa-testing-2026)).
   QA Wolf and Checksum also sell managed QA, where a vendor owns the suite
   ([Fast.io guide](https://about.fast.io/resources/best-ai-qa-testing-tools/)).

## What works and what is still hype

| Works today | Still hype or risky |
|---|---|
| Generating tests from a URL or a written plan | Replacing QA entirely |
| Self-healing broken locators after UI changes | Trustworthy root-cause diagnosis of failures |
| Visual regression with smart filtering | Unsupervised testing of complex business rules |
| Coding agents that verify their own changes by running the app | |

This split is from one 2026 comparison ([Wopee](https://wopee.io/blog/ai-testing-agents/)).
Another notes that agentic tools differ a lot in how much autonomy they take and
how much human review each needs, so a long feature list does not tell you the
real workload ([Katalon](https://katalon.com/resources-center/blog/agentic-qa-tools)).

**The main risk is a healer that hides a real bug.** A test that "heals" by
loosening its check can pass while the product is broken. Playwright's healer
skips a test when it thinks the feature is broken, but a human still has to
look at every skip and every patch.

## What Kanvise already has

Seen in the repo on `design/redesign-spec`:

- **Playwright** (`web/e2e/`), including real staging journeys
  (`web/e2e/staging/*.journey.spec.ts`), a BrowserStack real-device spec, and
  a PWA spec.
- **Vitest** unit and API tests (`api/src/**/*.test.ts`) and pgTAP database tests.
- **Safety scripts for staging runs** (`scripts/staging-e2e-safety.mjs`,
  preflight, cleanup, orphan cleanup) and a script that rejects flaky Playwright
  reports.
- A workflow that runs staging journeys only against a commit already on
  `staging`.

So the cheapest way in is Playwright's own agents. No new vendor is needed to
start, and the tests stay in code the team can read and own.

## Recommended approach

### 1. Use the flow docs as the source of truth

Feed `01-user-flows.md`, `02-state-machines.md` and the test plan in
`01-qa-test-plan.md` to the planner as its requirements document. Every test
carries its case ID in the title (for example `TC-LSN-004 reschedule with undo`)
so a failing test points back to a spec ID and a flow.

### 2. Run the planner, generator and healer loop with guardrails

```
npx playwright init-agents --loop=vscode
```

The Playwright docs show this command, with tabs for VS Code, Claude Code,
Codex and OpenCode. Pick the variant for the tool the team uses. It writes agent
definitions, a `specs/` folder for plans and a seed test. Regenerate the
definitions after each Playwright upgrade, as the docs advise.

Guardrails for this team:

- **Humans review every generated plan and every healer patch** in a pull request.
  A patch that edits an assertion, not a locator, is rejected by default.
- **The healer never edits the expected result** of a P0 test. It may only fix
  locators and waits.
- **Skipped tests count as failures** in the release gate until someone has
  looked at them.
- **Keep the seed test and fixtures in the repo.** They create test accounts and
  data through the existing staging safety scripts, never against production.
- **Flake policy:** keep the existing flaky-report rejection script. Retrying is
  not a fix.

### 3. Use Playwright MCP for exploratory testing

Before a release, ask an AI session with Playwright MCP to walk each role's flow
and report anything odd: broken links, text cut off at 360 px, missing empty
states, wrong wording. Treat the output as bug leads, not as results. Log each
real find as a new case in the plan.

### 4. Keep the pyramid, do not turn everything into end-to-end

Most cases belong lower down. See "Level" in the test plan:

- **DB (pgTAP):** permissions and row-level security, held-message rules,
  attendance statuses, retention jobs.
- **API/unit (Vitest):** status rules, time zones, quiz and check scoring,
  token rules, rate limits, webhook signatures.
- **E2E (Playwright):** the P0 journeys and the multi-role hand-offs.
- **Real devices:** a small set on BrowserStack (Android on slow networks,
  iPhone Safari, installed PWA).

### 5. Add visual and accessibility checks

- Screenshot comparison per role at 360, 768 and 1280 px (R-09 already asks for
  these screenshots). A tool with smart filtering helps avoid noise from fonts
  and animations.
- Automated accessibility scans (for example axe) in the Playwright run, plus a
  manual screen reader pass on onboarding, the classroom entry and the student
  quiz.

### 6. Consider a vendor only after the above is in place

Reasons to buy: no one on the team has time to own the suite, or you want real
device and browser coverage managed for you. Questions to ask any vendor:

- Can I export the tests as code I own?
- How are healed changes shown to me, and can I block them?
- Where do my test accounts and data live, and is anything sent to a model?
- How do they handle two roles in one test (tutor and student at the same time)?
- Pricing as the suite grows.

Kanvise's classroom runs inside PlugNMeet, so any tool also needs to cope with
audio and video permissions in a headless browser. Plan to test that with
Chromium fake-media flags, and keep a short manual checklist for real
microphones and cameras.

## Test data and safety

- Use a separate staging project and seeded accounts: one independent tutor, one
  agency (admin, two tutors), students with and without email.
- Email and push are the hard part of this product. Use an inbox the tests can
  read (a mail-capture service or a test mailbox API) to check what was sent,
  and when. Control the clock in API tests for 72-hour, 24-hour, 14-day and
  7-day rules.
- Never run AI-driven exploratory sessions against production, and never give an
  agent real student data.

## A suggested first month

1. Week 1: add `init-agents`, a seed test and the first 10 P0 cases
   (`TC-AUTH-001`, `TC-INV-001`, `TC-CRS-001`, `TC-LSN-001`, `TC-CLS-001`,
   `TC-SUM-001`, `TC-HW-001`, `TC-QZ-002`, `TC-NTF-001`, `TC-TM-002`).
2. Week 2: planner output for onboarding and scheduling, reviewed by a human.
3. Week 3: healer in CI on a branch, patch review rule in place.
4. Week 4: visual and accessibility checks, and the first Playwright MCP
   exploratory pass on the whole tutor flow.

Measure: time to write a case, number of flaky tests, escaped bugs per release,
and share of healer patches a reviewer accepted. If the healer's patches are
mostly rejected, stop using it.
