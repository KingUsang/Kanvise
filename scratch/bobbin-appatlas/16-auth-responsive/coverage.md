# Authentication coverage audit

| Surface / state | Desktop | Tablet | Mobile | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| Login default and password visibility | ✅ | ✅ | ✅ | WALKED | Live frontend |
| Invalid credentials | ✅ | ✅ | ✅ | WALKED | Controlled 401, production UI |
| Email-change/reset notices and signup unavailable | ✅ | ✅ | ✅ | WALKED | Live query-driven states |
| Two-factor code, recovery code, invalid code | ✅ | ✅ | ✅ | WALKED | Controlled challenge, production UI |
| Signup default and referral warning | ✅ | ✅ | ✅ | WALKED | Live frontend |
| Signup email-sent outcome | — | — | — | INTENTIONALLY SKIPPED | Would create/send another live signup; downstream confirmation captured |
| Forgot-password standard and client audience | ✅ | ✅ | ✅ | WALKED | Live frontend |
| Reset success and rate limiting | ✅ | ✅ | ✅ | WALKED | Controlled outcomes; no email sent |
| Set-password invalid, form, mismatch | ✅ | ✅ | ✅ | WALKED | Live invalid state + synthetic frontend token |
| Confirm-signup invalid, form, mismatch | ✅ | ✅ | ✅ | WALKED | Live invalid state + synthetic frontend token |
| Invite invalid, pending, password-required, accepted, declined, withdrawn, expired | ✅ | ✅ | ✅ | WALKED | Controlled preview states; no mutation |
| Two-factor reset invalid, confirmation, success | ✅ | ✅ | ✅ | WALKED | Controlled success; no account change |
| Recording consent invalid, request, already-given, success | ✅ | ✅ | ✅ | WALKED | Controlled states; no consent change |
| Protected activation reauthentication | ✅ | ✅ | ✅ | WALKED | Live redirect boundary |
| OAuth authorization reauthentication | ✅ | ✅ | ✅ | WALKED | Live redirect boundary |
| Email-change confirmation reauthentication | ✅ | ✅ | ✅ | WALKED | Live redirect boundary |
| Sign-out and expired/absent session | ✅ | ✅ | ✅ | WALKED | No separate screen: token is cleared/absent and the user returns to the captured Login surface |
| First-time setup checklist | ✅ | ✅ | ✅ | WALKED | Authorized production UI with controlled incomplete setup read model |
| Setup client/tutor/student/course/lesson forms | ✅ | ✅ | ✅ | WALKED | All five entry forms opened at each viewport; no submission |
| Valid OAuth authorization decision | — | — | — | INTENTIONALLY SKIPPED | Requires a real OAuth client and purpose-bound consent token |
| Valid email-change completion | — | — | — | INTENTIONALLY SKIPPED | Would mutate the live account email and invalidate sessions |
| TutorCruncher authentication | — | — | — | INTENTIONALLY SKIPPED | External product boundary |

Result: every safely reproducible Bobbin-owned authentication/access state identified in the live route manifest is evidenced at all three requested viewport classes. Remaining items are external or require a live identity mutation/purpose-bound external client; none are silently marked as covered.
