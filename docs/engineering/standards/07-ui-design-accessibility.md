# UI, design system, and accessibility

**Status:** Current
**Owner:** Kanvise engineering and product design
**Approved:** 2026-10-30

This standard governs product UI hierarchy, visual tokens, shared primitives,
responsive behavior, content, interaction feedback, and accessibility. It
applies to Admin, Tutor, Learner, public, auth, and live-class experiences.

## Design authority and current direction

Product behavior and language come from the approved domain and feature
standards. The repository design tokens and shared primitives are the visual
implementation authority. Stitch/screenshots are reference material, not a
license to paste generated markup, invent behavior, or create page-local design
systems.

The newer Class workspace is the structural direction for authenticated entity
workspaces: an object-focused header, clear breadcrumb/back path, contextual
primary action, task-oriented tabs, coherent panels, panel-level loading/retry,
and responsive drawer/sheet interactions. Preserve those interaction ideas when
useful. Its raw hex values, legacy Centre copy, ad hoc controls, and oversized
component are deviations rather than patterns to copy.

The current login/register experience is the visual direction for authentication:
a calm warm background, focused card composition, clear brand/heading hierarchy,
restrained illustration, generous form rhythm, and one obvious action. Preserve
that character while consolidating the several auth implementations into shared
AuthShell, AuthCard, Field, PasswordField, Alert, and submit-button primitives.
Legacy tutorial-centre copy, raw colours, and inconsistent recovery/invitation
screens are not part of the reference.

Admin and Tutor share one dashboard system. Learner navigation may be adapted to
its simpler tasks and mobile use, but it uses the same semantic colors,
typography, controls, states, and accessibility primitives. A prominent coloured
hero is an intentional component variant; it is not permission for arbitrary
page-header colours.

## Semantic visual language

Poppins is the product typeface with system fallbacks. Components use semantic
Tailwind tokens; raw hex/RGB values belong only in the token definition. A new
visual value requires a named role and evidence that an existing role cannot
represent it.

Core roles are:

- page and surface backgrounds;
- primary and muted foreground text;
- outline/divider;
- primary action/active navigation;
- accent/eyebrow;
- success, warning, danger, and information, each with surface, border, text,
  and icon roles; and
- focus ring, disabled, scrim, and selected states.

Colour communicates emphasis but never carries meaning alone. The canonical
dashboard page/entity title uses `dashboard-foreground` (near black). Brand
indigo is for primary actions, selected navigation, links, and intentional hero
surfaces—not an alternate page-title colour. Accent brown is for restrained
eyebrows/highlights, not competing primary buttons. This resolves the current
black-versus-blue header drift.

Use one spacing scale and let the dashboard shell own page gutters: 16px on
narrow screens and 40px at desktop unless the shell standard changes. Pages do
not add a second outer gutter. Normal section spacing is 32px. Dense data views
may use a documented compact variant rather than arbitrary page-local spacing.

Use three radius tiers: 8px controls, 12px normal cards/panels, and 16px for
large dialogs, sheets, or intentionally prominent containers. Pills are reserved
for statuses, filters, and compact categorical choices. Use one restrained card
shadow; hierarchy comes primarily from spacing, typography, surface, and border,
not a collection of shadow recipes.

## Typography and page hierarchy

Each route has one `h1`. Standard dashboard pages use the shared page header:

- optional breadcrumb or short eyebrow;
- 24px mobile / 30px desktop page title in foreground colour;
- one concise description when it helps the task; and
- primary/secondary actions that wrap safely on narrow screens.

Entity workspaces may use the same hierarchy in a workspace header variant, not
hand-pick another title size/colour. Section headings follow a smaller documented
scale. Labels, helper text, status text, and table headings use semantic text
styles rather than arbitrary `text-[Npx]` combinations. Heading levels reflect
document structure and are not selected for appearance.

## Shared primitives and variants

Build and use a small accessible primitive layer. At minimum it owns:

- Button and IconButton;
- LinkButton;
- Input, Textarea, Select, Checkbox, Radio, and Field/Error;
- PageHeader and WorkspaceHeader;
- Card/Panel and MetricCard;
- Badge/Status;
- Tabs;
- Dialog, AlertDialog, Sheet, and Menu;
- Toast/inline Alert;
- Skeleton/Progress;
- EmptyState and ErrorState;
- Table/DataList/Pagination; and
- Avatar and Tooltip.

Each primitive exposes named semantic variants and sizes. Feature code composes
primitives; it does not copy long class strings to simulate them. Avoid universal
components with unrelated booleans. Icons use Lucide consistently unless a
specialized product surface has an approved reason; do not mix icon families on
one product surface.

Primary actions are limited to one clear action per region. Secondary actions
use outline/quiet variants; danger styling is reserved for destructive actions.
Disabled controls remain legible and are accompanied by explanation when the
reason is not obvious. Icon-only buttons always have an accessible name and a
minimum target size.

Inputs keep the same border width and border token when focused; focus must not
shift layout or create a competing border-plus-ring double edge. Use one crisp,
high-contrast focus indicator outside the control—normally a 2px semantic focus
outline with a small offset—and `:focus-visible` behavior appropriate to the
native control. Error, success, disabled, read-only, hover, and focus are
independent semantic states. Never remove the native outline without supplying
an equally visible replacement.

## Interaction and feedback

Every user action has immediate, truthful feedback:

- preserve stable content during background refresh;
- use layout-matching skeletons for initial loads;
- show field errors near fields and a useful form-level summary;
- show success at the place where the result matters;
- provide retry for transient read failures;
- distinguish no data from failed data;
- prevent duplicate mutations while pending; and
- confirm destructive or high-consequence actions with the affected object and
  consequence.

Toasts acknowledge short-lived global results; they do not contain essential
instructions or replace persistent errors. Error copy states what failed, what
was preserved, and what the user can do. Never show raw transport/provider text.
Loading copy uses an ellipsis character consistently and does not leave blank
panels.

Tabs represent peer views of the same object and support keyboard semantics. Use
links when changing routes/history; use buttons for in-place actions. Clickable
rows/cards use a real link or button rather than `div role=button` where possible.
Back and forward navigation, focus, selection, and scroll position behave
predictably.

## Responsive layout and data density

Design mobile-first at representative narrow, tablet, laptop, and wide viewports.
No control or action may depend on hover. Headers/actions wrap without overlap;
drawers and sheets do not obscure their close mechanism; sticky elements account
for mobile browser and bottom navigation safe areas.

Tables are used when cross-row comparison matters. On narrow screens either keep
the essential columns in an intentionally scrollable region with a visible cue,
or transform rows into labelled data lists/cards. Do not simply hide critical
data. Filters expose their active state and offer a clear reset. Empty states
explain whether the user should create, invite, change a filter, or wait.

## Accessibility baseline

Kanvise targets WCAG 2.2 AA. Accessibility is a definition-of-done requirement,
not a later audit.

- All functionality works by keyboard with a visible semantic focus ring.
- Focus order follows reading order; opening a dialog/sheet moves focus inside,
  traps it, closes with Escape when safe, and restores focus to its trigger.
- Use native elements first. Custom widgets implement the relevant WAI-ARIA
  pattern completely, including keyboard behavior and state.
- Form controls have persistent programmatic labels; errors use `aria-describedby`
  and live announcements where appropriate.
- Text and meaningful UI meet AA contrast, including hover, disabled, focus, and
  status states.
- Normal interactive targets are at least 44×44 CSS pixels where practical and
  never below WCAG's minimum spacing/size requirements.
- Images have meaningful alt text or empty alt when decorative. Icons are hidden
  from assistive technology unless they convey labelled information.
- Page titles, landmarks, heading order, language, and skip navigation are
  present. Status changes use appropriate live regions without noisy repetition.
- Respect reduced motion; animation never blocks input, conveys essential meaning
  alone, flashes dangerously, or auto-plays without control.
- Zoom, reflow, text spacing, 200% text, and landscape mobile remain usable.

## Copy and localization readiness

Use approved product terms: Independent Tutor, Tutoring Agency, Admin, Tutor,
Learner, Class, Subject, Session, Quiz, Assignment, and share-link assignment.
Copy is plain, specific, and action-led. Avoid internal schema/provider names,
technical jargon, unsupported claims, and decorative metrics.

Do not assemble sentences from fragments that make grammar or future translation
impossible. Dates, times, numbers, and money use named `Intl` formatters and show
the relevant timezone/currency where ambiguity affects a decision.

## Verification and governance

Shared primitives and tokens are documented in an in-repository component
catalog with their states. A change to a token or primitive is reviewed against
all consumers and receives a visual regression update, not a page-local override.

Material UI changes verify:

- component behavior and accessible name/role/state;
- automated accessibility checks with no serious/critical findings;
- keyboard-only operation and focus restoration;
- contrast and reduced-motion behavior;
- loading, empty, error, success, disabled, and long-content states;
- mobile, tablet, standard desktop, and wide desktop screenshots; and
- light/current theme consistency across Admin, Tutor, and Learner surfaces.

Automated checks do not replace a short manual screen-reader/keyboard pass for
new dialogs, navigation, forms, tables, live updates, or complex workspaces.
