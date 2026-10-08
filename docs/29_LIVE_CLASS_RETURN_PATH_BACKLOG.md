# Live class return-path backlog

## Problem

PlugNmeet's `logout_url` is set when the room is created, so it is shared by
every participant in that room. Kanvise currently sends everyone to
`/dashboard`, even when they entered from a calendar, a class page, or another
relevant in-app screen.

## Intended behaviour

1. Before entering a live class, Kanvise stores the user's intended return
   path locally.
2. PlugNmeet's room-level `logout_url` points to a Kanvise exit route rather
   than directly to the dashboard.
3. The exit route reads only an allowlisted, same-origin Kanvise path and
   redirects the user there.
4. If no valid saved path exists, the fallback is the relevant live-class
   detail page; `/dashboard` is the final fallback.
5. A user must never be redirected to an external or malformed URL.

## Constraints

- Do not rely on `history.back()`: it can return a user to an unrelated site or
  an expired authentication route.
- The saved value is per browser/user, not room-wide, because tutors and
  students may have entered the same room from different screens.
- Clear the saved path after it is consumed or after a bounded expiry period.
- Preserve the existing signed PlugNmeet join-token and room-access model.

## Acceptance checks

- A student entering from Calendar returns to Calendar after leaving.
- A tutor entering from a class detail page returns there after ending/leaving.
- A direct room entry falls back safely to the class page.
- Crafted external return paths cannot redirect users off Kanvise.
