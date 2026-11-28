# 13 · Billing (proposal)

Status: **proposal for discussion.** Payments are on hold until the owner's
payments revamp. Nothing here is built until then. Builds on `00-decisions.md`
§14.

**Who:** tutors and agency admins bill; whoever pays receives an invoice link.
**Goal:** get paid for lessons without chasing anyone, using a pattern people
already know (an invoice with a Pay button), without building a second kind of
account for whoever pays.

Research basis: tutoring tools bill students with invoices built from lessons
(TutorBird, Teachworks: per lesson, flat monthly, or prepaid packages), and
Paystack supports invoices sent as a payment link.

## The model in one paragraph

Each student has a **payer**: themselves, or an **other contact** (a name, email
and phone; a contact, not an account).
Each course has a **price** for each student: per lesson, monthly, or a
package of lessons. Completed lessons add up. Kanvise drafts an invoice per
payer at the end of each billing period (or when a package runs low). The
tutor checks it and presses **Send**. The payer gets a link, opens a simple
invoice page, and pays through Paystack. Kanvise marks it **Paid** and sends a
receipt.

## Flow at a glance

```
Settings › Billing › Turn on billing (BL-01)
  → Set a price on a course (BL-02) · set a payer on a student (BL-03)
  → Lessons are completed → invoice drafts appear (BL-04)
  → Tutor reviews and sends (BL-05) → payer pays (BL-06) → Paid, receipt
  → Overdue reminders (BL-07)
```

---

## BL-01 · Turn on billing

Settings › Billing: **Get paid through Kanvise.** "Send invoices for your
lessons. Students, or whoever pays for them, pay by card, bank transfer or
USSD." Steps:
1. **Business details:** name on invoices, address (optional).
2. **Payout account:** bank details, verified through Paystack.
3. **Billing period:** **Monthly** (default) · **Every 2 weeks** · **After each
   lesson**.
4. **Currency:** the account's currency.

## BL-02 · Price on a course

On the course page, **Actions › Pricing** (and step 2 of the course wizard,
once billing is on):
- **How do you charge?** **Per lesson** · **Monthly** · **Package of lessons**.
- **Per lesson:** an amount (for example **₦5,000 per lesson**).
- **Monthly:** an amount per month.
- **Package:** number of lessons and price (for example **8 lessons for
  ₦36,000**). Line: **We'll draft the next invoice when 2 lessons are left.**
- **Different price for some students:** per-student overrides.

## BL-03 · Payer on a student

On the student page and in Add student (spec 06), once billing is on:
- **Who pays?** **The student** · **Other contact**.
- **Other contact:** name, email, phone. Line: **They only get the invoices you
  send. They don't get a login, and Kanvise sends them nothing on its own.**
- One other contact can pay for several students (for example one person paying
  for two students, or a company paying for its staff); invoices combine them.

## BL-04 · Invoice drafts

Route `/billing`. Tabs: **Drafts** · **Sent** · **Paid** · **Overdue**.
- A draft per payer: payer name, students, period, line items (each completed
  lesson with date and topic, or the monthly fee, or the package), total.
- **Edit** a draft: remove a line, add a line (for example a material fee),
  change an amount, add a note.
- Needs attention on the dashboard: **3 invoices ready to send**.

## BL-05 · Send

**Send invoice to Ngozi Okafor?** "They'll get an email with a link to pay
₦20,000." (the student, or the other contact set in BL-03) Optional **Also send on WhatsApp**. **Send**. Status **Sent**.

## BL-06 · The payer's invoice page (no login)

A simple page from the link: the tutor's name or agency logo, invoice number,
the lines, the total, and **Pay ₦20,000** (Paystack: card, transfer, USSD).
After paying: **Paid, thank you.** with **Download receipt**. The tutor gets a
notification: **Casey Davis's invoice was paid: ₦20,000.**

## BL-07 · Overdue

- **Send a reminder** on an overdue invoice, pressed by the tutor. Nothing is
  sent to the payer automatically.
- The invoice shows **Overdue** in red for the tutor.
- **Mark as paid** for payments made outside Kanvise (cash, direct transfer),
  with an optional note.
- **Void** cancels an invoice, with a reason.

### Kavi

No Kavi feature in billing. Invoice drafts are built by rules from completed
lessons and prices, not by Kavi.
- Input: none.
- Output: none.
- Failure state: none.
- What the tutor must confirm: every invoice is sent only when the tutor
  presses **Send** (BL-05); reminders only when they press **Send a reminder**
  (BL-07).
- Without Kavi: billing works as written.

## Open questions for the payments revamp

1. Who pays the Kanvise fee, and how much (DEV-PAY-013)?
2. Refunds and chargebacks (DEV-PAY-008).
3. Charging for late cancellations (left out for now).
4. Whether a public "book a lesson" page is wanted for new students.

## Checked against Bobbin

- `14-settings/screenshots/billing--entry.png`, `billing--loaded.png`,
  `billing--starter-selected.png`: Bobbin's Billing is its own subscription
  (trial hours, Starter / Plus / Pro / Enterprise plans, promotion code,
  Stripe checkout). It is not a way for tutors to bill students, so nothing
  in this proposal copies it.
- `06-clients/screenshots/add-client--step-1.png`, `client-created--detail.png`
  (checked in FEAT-005): Bobbin's clients are the people who pay. Kanvise has
  no clients; the payer is the student or an **other contact** that
  is a contact, not an account, and receives nothing automatically (BL-03).

Final Bobbin pass (FEAT-009):
- `15-tutor-role/screenshots/tutor-lessons-status-canceled-chargeable.png`: Bobbin's "Canceled (chargeable)" lesson status; not copied while billing is on hold (05 has no chargeable status).
- `11-report-approvals/screenshots/report-approvals--populated.png`: the trial banner "Set up billing" across every Bobbin page; Kanvise shows no billing banner.
