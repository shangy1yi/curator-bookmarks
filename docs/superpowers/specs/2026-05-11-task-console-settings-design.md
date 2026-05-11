# Task Console Settings UI Redesign

## Goal

Redesign the Curator Bookmark settings page with a compact black-and-white Task Console style while keeping the current information architecture mostly intact.

The redesign should make the settings page feel like a pragmatic maintenance console for bookmarks: precise, local-first, recoverable, and geek-oriented. It should not become a marketing page or a full developer-tool clone.

## Confirmed Direction

- Use the selected `Task Console` visual direction.
- Preserve the current settings page structure: left grouped navigation, right section panels, existing setting sections, result lists, modals, and workflows.
- Use square block switches: white rectangular track with a black square indicator. The indicator position communicates off/on.
- Keep the UI black and white, with limited green for active command/success signals.
- Use terminal-style affordances for task-oriented sections without turning every label into code.

## Scope

In scope:

- Redesign `src/options/options.css` visual styling for the settings shell.
- Update small HTML class hooks only if needed to support the new visual language.
- Keep existing TypeScript behavior and section routing unchanged unless a class rename requires a tiny compatibility update.
- Apply the style across navigation, panels, buttons, chips, inputs, selects, toggles, metrics, result cards, modals, and empty states.
- Add command-strip styling for task pages where the current markup already exposes clear action/status areas.

Out of scope:

- Reorganizing the settings sections or changing feature flows.
- Rewriting options page runtime logic.
- Introducing a component framework.
- Adding a global command palette; treat it as a separate future feature, not part of this redesign.
- Changing popup or newtab UI.

## Visual System

### Color

The page should use a restrained black-and-white palette:

- Background: pure black or near-black.
- Panels: layered near-black surfaces.
- Borders: thin white lines with low opacity.
- Primary text: warm white.
- Muted text: translucent white.
- Green: active nav marker, command text, success/ready status.
- Amber: warning/pending status.
- Red: destructive or failure status.

Avoid gradients, purple/blue accents, large translucent cards, and soft Apple-style rounded panels.

### Shape

The new shape language is hard-edged:

- Main panels, cards, rows, result cards, buttons, and inputs use 0-2px radius.
- Remove large rounded shells and pill-heavy styling where practical.
- Keep spacing compact but readable.
- Avoid cards inside cards unless the inner surface is a real repeated result item or modal content.

### Typography

Use two typography modes:

- Normal UI text: existing system sans stack for Chinese readability.
- Terminal/status text: monospace for command strips, badges, metric labels, nav badges, code-like status, IDs, URLs, and shortcut hints.

Do not make the whole page monospace. Chinese paragraphs and setting descriptions stay in the sans stack.

## Layout

The existing layout remains:

- Left sidebar grouped into settings, bookmark management, AI, and dashboard entry.
- Right content area shows one section at a time.
- Current section anchors and hash navigation continue to work.
- Mobile keeps the existing responsive strategy: navigation becomes top/stacked, content becomes single-column.

Changes:

- The top-left brand becomes more console-like, using `Curator Bookmark` plus a `curatorctl` style detail where it fits.
- Active nav items use a `>` marker and green text signal.
- Navigation group labels use small monospace uppercase labels.
- Section panels visually become console windows, not rounded cards.

## Component Rules

### Sidebar

- Use a flat black sidebar with thin border.
- Nav links become compact command-list rows.
- Active link shows a leading `>` marker.
- Collapsible groups retain behavior, with caret styled minimally.
- Dashboard entry should look like a command/action block, not a promotional card.

### Section Header

Each section keeps its existing label, `h1`, and description. Styling changes:

- Section label becomes a monospace path-like label where content allows, such as `bookmark.ops / availability`.
- Heading remains readable and not oversized.
- Description stays sans and muted.
- Primary actions stay on the right where current markup supports it.

### Command Strip

Task-oriented pages can use a command-strip treatment around existing action/status rows:

- Availability: `$ curator check --scope selected --preview`
- Duplicates: `$ curator dedupe --strategy recommended --preview`
- Folder cleanup: `$ curator folders scan --preview`
- Recycle: `$ curator trash list --restore-ready`
- AI settings: `$ curator ai test --provider custom`

This is visual copy only unless an existing element already provides equivalent text. Do not add fake controls that imply unsupported behavior.

### Square Switch

All settings switches should adopt the selected square style:

- Track: white rectangle.
- Knob: black square.
- Off: knob on the left.
- On: knob on the right.
- Disabled: lower opacity, same geometry.
- Focus-visible: thin green or white outline outside the switch.

The input remains a real checkbox for accessibility. The visual switch is only the styled track.

### Buttons

- Primary: white background, black text.
- Secondary: black/near-black background, white border, white text.
- Danger: black background, red border/text.
- Buttons use monospace labels only when the label is command-like (`RUN CHECK`, `EXPORT`, `RESTORE`). Longer Chinese labels can stay sans if needed for readability.

### Metrics

Metrics use terminal stat-card styling:

- Thin border.
- Monospace uppercase label.
- Large monospace value.
- No colored top bars except limited status hints if already meaningful.

### Results And Empty States

Result cards should look like console output rows:

- Thin borders.
- Compact title, muted URL/path/detail text.
- Status code or action tag aligned right when available.
- Empty states should be plain and direct, with command-style CTA buttons.

### Forms

Inputs, textareas, selects, custom selects, and modal search fields should:

- Use dark backgrounds and thin borders.
- Use hard edges.
- Preserve readable focus states.
- Keep current custom select behavior.

## Accessibility

- Keep all existing labels and ARIA relationships.
- Do not rely on color alone for active/error states; retain text and shape indicators.
- Preserve keyboard focus visibility.
- Maintain sufficient contrast for muted text.
- Keep real checkbox inputs for switches.
- Ensure mobile nav and controls still have stable hit targets.

## Responsive Behavior

Desktop:

- Sidebar remains fixed-width and scrollable.
- Content max width can stay close to current value.
- Metrics and repeated cards use compact grids.

Tablet/mobile:

- Sidebar stacks above content as it does today.
- Navigation links can wrap into a compact grid.
- Section panels lose decorative outer framing if needed to avoid cramped nested boxes.
- Metrics collapse to two columns, then one column where needed.
- Command strips wrap rather than overflow.

## Testing

Minimum verification after implementation:

- `npm run typecheck`
- `npm run build`
- Open the options page in a browser and check:
  - sidebar navigation
  - general settings switches
  - AI provider form
  - availability results
  - duplicate/folder cleanup/recycle result cards
  - modals
  - mobile viewport around 390px wide

Visual checks:

- No text overlaps.
- Switches clearly show on/off states.
- Focus states are visible.
- Long Chinese labels and URLs wrap or truncate correctly.
- The page reads black/white/geek, not blue/purple or soft rounded dashboard.

## Implementation Notes

- Prefer CSS variable changes and scoped selector updates before HTML edits.
- Avoid changing IDs used by `options-runtime.ts`.
- Add new utility classes only when repeated styling cannot be expressed safely through existing classes.
- Keep unrelated newtab and popup changes untouched.
- The temporary brainstorm files under `.superpowers/` are not part of this spec.
