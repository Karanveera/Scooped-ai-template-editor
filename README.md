# Scoped AI Template Editor

A browser-based, single-page website builder prototype. It loads one responsive
template, lets a non-technical owner edit it through a canvas or a code
surface, runs a **deterministic** (no live model) text-to-edit AI demo scoped
to the current selection and viewport, and lets every manual or accepted AI
change be reviewed, applied, and independently recovered per element and
per viewport.

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production bundle to dist/
npm run test      # runs the automated test suite (vitest)
```

Requires Node 18+. No environment variables or API keys are needed — the AI
demo is a local, deterministic rules engine (see `src/ai/scenarioEngine.ts`),
not a call to a real model.

The editor is a single page; there is nothing to deploy besides the static
`dist/` output of `npm run build` (works on any static host — Vercel,
Netlify, GitHub Pages, etc.).

## Chosen template

The starting content ("Corner & Co. Coffee Roasters") is an **original,
one-page layout authored for this exercise** — a hero section, a
features/offerings section, and a call-to-action footer — built directly out
of the editor's own element types (`section`, `heading`, `paragraph`,
`button`, `image`). It is not a third-party template; it exists so the
editor has real, editable, responsive content on first load. See
`src/template/defaultTemplate.ts`. The single feature image is loaded from
Unsplash (royalty-free) purely as a placeholder image URL.

## Required journey → where it lives

| # | Requirement | Implementation |
|---|---|---|
| 1 | Load one responsive template | `template/defaultTemplate.ts`, loaded into the store on first run (or restored from `localStorage`) |
| 2 | Desktop/tablet/mobile preview | `components/Canvas.tsx` viewport switcher; `state/resolve.ts` resolves each element per viewport |
| 3 | Click / additive / marquee selection | `components/Canvas.tsx` (`handleBackgroundMouseDown/Move/Up`), `components/ElementRenderer.tsx` (click + `Enter`/`Space` keyboard selection) |
| 4 | Manual canvas editing | `components/Inspector.tsx` — content, style, position/width, order, visibility |
| 5 | Code editing surface | `components/CodeEditor.tsx` — edits a selected element's JSON; invalid JSON or invalid fields are rejected with an inline error and the last valid state is kept |
| 6 | Responsive scope (All / Desktop / Tablet / Mobile) | Scope picker in `Inspector.tsx` and `AIDemoPanel.tsx`; resolution order documented in `PRODUCT_NOTES.md` and enforced in `state/editPipeline.ts` |
| 7 | AI demo edit request | `components/AIDemoPanel.tsx` + `ai/scenarioEngine.ts` — deterministic, selection- and viewport-scoped |
| 8 | Review & apply per element | `AIDemoPanel.tsx` proposal cards — accept/reject independently, nothing commits until accepted |
| 9 | Per-element/per-viewport recovery | `components/HistoryPanel.tsx` + `state/restore.ts` — restore is itself just another commit through the same pipeline |
| 10 | Persistence + reset + documented demo examples | `state/store.tsx` persists template + history to `localStorage`; "Reset template" button in the top bar; example instructions listed in the AI panel |

## Architecture

```
src/
  types.ts                 Template/element/history/edit-command types + the
                            per-element-type field whitelist (ELEMENT_SCHEMAS)
  template/defaultTemplate.ts   The starting content
  state/
    resolve.ts              base + viewport-override resolution (read path)
    validation.ts            field whitelist + type/range checks
    editPipeline.ts          the ONE commit path every surface uses (write path)
    restore.ts               builds a restore EditCommand from a history entry
    store.tsx                React context: template, selection, history,
                              localStorage persistence
  ai/scenarioEngine.ts       deterministic instruction -> proposal rules
  components/
    Canvas.tsx, ElementRenderer.tsx   rendering + selection
    Inspector.tsx                    manual property editing
    CodeEditor.tsx                   JSON editing surface
    AIDemoPanel.tsx                  AI instruction input + proposal review
    HistoryPanel.tsx                 per-element history + restore
tests/                       vitest specs against the state layer
```

### The commit boundary (canvas / code / AI / restore all converge here)

Every surface produces the same `EditCommand` shape — `source`,
`viewportScope`, `authorizedIds`, and a list of `{ elementId, baseRevision,
changes }` — and hands it to `commitEditCommand()` in `state/editPipeline.ts`.
That single function is where:

- unknown element ids are rejected,
- ids outside the command's `authorizedIds` are rejected (this is what keeps
  an AI proposal from ever touching an element outside the selection it was
  generated for),
- a stale `baseRevision` (the element moved since the change was authored) is
  rejected instead of silently overwritten,
- fields not in that element type's schema are rejected ("forbidden fields"),
- and only *then* is the template updated — per element, independently, so
  one bad element in a five-element AI result never blocks the other four.

**Trade-off:** commands are evaluated element-by-element inside one
`EditCommand`, not per-field-per-viewport as separate transactions. That
keeps the mental model simple (one accept/reject per element) but means a
single element's command can only target one viewport scope at a time — to
set both a shared value and a mobile override in one user action, the UI
issues two sequential commands (see `CodeEditor.tsx`'s diff-and-split logic).

## Deterministic AI demo — how to try it

Select one or more elements on the canvas, then in the right-hand panel:

- **Content rewrite** — select a heading/paragraph, instruction: `make this shorter`
- **Style change** — select any text or button, instruction: `make the text blue`
- **Move/resize/reorder** — select anything, instruction: `make it bigger`
- **Single-viewport responsive** — set scope to **Mobile**, instruction: `stack full width on mobile`
- **Multi-element edit** — select two+ elements, instruction: `align these`
- **Safe failure (forbidden field)** — instruction: `rotate it in 3d`
- **Safe failure (stale revision)** — run any AI proposal, then before
  accepting it, manually edit the same element in the Inspector, then try to
  accept the (now stale) proposal.
- **Safe failure (unselected target)** — clear selection, then Run.

The same instruction + same current state always produces the same
proposal — there is no model call and no randomness.

## Frontend quality bar

- React + TypeScript throughout; strict mode enabled.
- Usable at 1280px; canvas frame widths simulate ~1440/768/375px viewports.
- Selection, editing, viewport switching, and proposal review are keyboard
  operable (elements are focusable + `Enter`/`Space` selects; all inputs have
  `<label>`s; focus rings are visible via `:focus-visible`).
- `npm run test` runs 15 focused tests covering AI scope/field/viewport
  validation, canvas/code state convergence, viewport isolation, and
  independent per-element/per-viewport recovery.

## What's out of scope (see PRODUCT_NOTES.md for the full list)

No drag-to-reposition (position is expressed via width/order/align, not
free x/y placement), no undo/redo keyboard shortcuts (recovery is done via
the History panel), no multi-page routing, no real AI model integration.
