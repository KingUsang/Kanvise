# ADR 0005: One semantic dashboard design system

**Status:** Accepted
**Date:** 2026-10-30
**Owner:** Kanvise engineering and product design

## Context

The dashboard contains a shared token set and page header, but pages still embed
thousands of raw colour occurrences, many radius/shadow recipes, two icon
families, and hand-built dialogs and state panels. Newer Class workspaces improve
task hierarchy while still introducing their own deep-indigo headings and local
primitives. Copying either old pages or every detail of the newest page would
continue the drift.

## Decision

Adopt one semantic token and accessible primitive system for every dashboard
persona. Use the newer Class workspace as an interaction-structure reference,
not as a literal style source. Canonical page/entity titles use foreground text;
brand indigo represents actions/selection and coloured hero variants only.
Feature code composes named primitive variants instead of raw visual values.

## Alternatives considered

- Treat the latest page as the full design source. It contains useful hierarchy
  but also raw values, legacy copy, and accessibility/component debt.
- Preserve persona-specific visual systems. This makes the same control/state
  behave differently and increases design, testing, and maintenance cost.
- Allow page-local Tailwind styling indefinitely. It is fast per page but has
  already produced visible header, spacing, radius, shadow, and feedback drift.

## Consequences and rollout

The product becomes visually predictable and accessible, while primitive work
adds an upfront migration cost. Build/catalog primitives and semantic state
tokens first, then migrate shell/header/state/control patterns before feature
details. Existing pages remain functional during the transition; new/touched UI
must not add raw visual values or new hand-built primitives.
