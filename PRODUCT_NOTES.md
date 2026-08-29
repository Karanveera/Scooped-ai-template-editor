# Product Notes

## Primary user, job, and "safe completed edit"

**Primary user:** a small-business owner adapting an existing one-page site
themselves, with no coding background and no in-house developer.

**Job to be done:** "Let me change what my page says and looks like — by
hand or by describing the change — without ever worrying that I've silently
broken the mobile version, overwritten something I did five minutes ago, or
lost the ability to undo just one part of a bigger change."

**A safe completed template edit** is one where:
1. the change only touched the element(s) and viewport scope the user
   actually selected or approved,
2. nothing changed until the user explicitly accepted it (for AI) or
   directly typed/dragged it (for manual edits),
3. every other element and every other viewport remained exactly as they
   were, and
4. the edit is individually recoverable later without having to roll back
   anything else that happened after it.

## Definitions

- **Element** — one node in the template tree with a stable `id`, a `type`
  (`section`/`heading`/`paragraph`/`button`/`image`), a `base` set of
  property values, and an optional per-viewport `overrides` object. IDs are
  generated once and never re-derived from content, class names, or DOM
  position, so selection and history stay valid across renames, restyles,
  and reorders.
- **Group selection** — a set of element ids (`Selection.ids`), not a single
  merged pseudo-element. Every operation (manual, code, AI) is expressed as
  independent per-element changes, so a "group" is really just "the same
  command author touching several elements in one action" — each one is
  still validated, applied, and recoverable on its own.
- **Committed step** — one accepted `EditCommand` that produced at least one
  `HistoryEntry`. A multi-element AI batch is *one user action* but can
  produce several committed steps (one per accepted element), which is why
  recovery is per element rather than per batch.
- **Viewport scope** — one of `all | desktop | tablet | mobile`, chosen
  explicitly on every edit (manual, code, or AI). `all` writes to the
  shared `base`; a concrete viewport writes only to that viewport's
  `overrides` entry.
- **Editable property boundary** — the whitelist in `ELEMENT_SCHEMAS`
  (`src/types.ts`). A field not in a given element type's list is rejected
  by the validator regardless of which surface (canvas, code, or AI) tried
  to set it — this is the single boundary all three share.

## Canvas/code shared state and override resolution

Canvas and code are both just UIs that build the same `EditCommand` object
and hand it to `commitEditCommand()`. Neither surface mutates the template
directly. The code editor even round-trips through the identical validator
the canvas uses, so a hand-typed `"fontSize": 500` is rejected with the same
message a canvas slider would trigger if it allowed out-of-range input.

Resolution order (used for rendering *and* for what the Inspector/AI panel
shows as the "current value"):

```
resolved(element, viewport) = { ...element.base, ...element.overrides[viewport] }
```

A key only differs per viewport if that viewport's override object
explicitly contains it. This is why editing "Desktop" scope never touches
Tablet/Mobile: those overrides objects are untouched, and if they don't
have that key, they keep resolving from `base`.

## How AI proposals stay inside selection and scope

The AI panel snapshots the current selection (`authorizedIds`) and the
chosen `viewportScope` before generating anything. The scenario engine
(`ai/scenarioEngine.ts`) is a pure function of `(instruction, selected
elements, viewportScope)` — it can only emit proposals for ids that were
passed into it, using only fields already in that element type's schema. On
**accept**, each proposal becomes its own `EditCommand` with
`authorizedIds` pinned to the original selection, so even if the pipeline
were called with a tampered element id it would be rejected as "not part of
the authorized selection" (covered by an automated test).

Invalid or stale output handling:
- **Unsupported instruction** → the engine returns `{ ok: false, reason }`
  before any proposal is shown; nothing to accept/reject.
- **Forbidden field** (e.g. "rotate it in 3D") → engine refuses to propose
  it at all, explaining that the field isn't in the schema.
- **Stale revision** → if the underlying element changed (e.g. the user
  manually edited it) between proposal generation and the accept click, the
  commit pipeline rejects that one element as `stale` with the specific
  revision numbers, and the proposal card shows that status instead of
  silently overwriting the newer edit.
- **Unselected target** → the engine refuses to run at all.

## Review, partial acceptance, and recovery policy

- Every AI proposal renders as its own card with a before → after diff.
- Accept/reject is per element, per card — accepting element A never
  auto-accepts or auto-rejects element B in the same batch.
- A rejected/stale/invalid element never mutates the template; only
  accepted elements do.
- Recovery: the History panel lists entries scoped to the current selection
  (or all elements if nothing is selected). "Restore" replays the *prior*
  scope-and-field state as a brand-new committed step — it does not delete
  or rewrite history, so the fact that a restore happened is itself
  auditable.
- **Trade-off:** if a field's very first edit in a given viewport override
  is restored, there is no earlier explicit value to reapply — the pipeline
  treats this as "clear the override, inherit from base again" (a `null`
  change value), rather than fabricating a value. This only applies to
  single-viewport scopes; there's no equivalent "clear" for `all` scope
  since the shared base is always populated.

## The one added capability

**"Accept all pending" for a multi-element AI batch.** The spec requires
independent per-element accept/reject, which is necessary but tedious when
a five-element AI proposal is genuinely fine as-is — the owner shouldn't
have to click Accept five times to get the same outcome as accepting once.

- **User problem:** reviewing is good friction; re-clicking the same
  decision five times is bad friction.
- **Why this and not something else:** it doesn't weaken the safety
  model — each element is still committed as its own independent
  `EditCommand` and can still individually come back `stale`/`invalid`
  even inside a bulk accept — it just removes repeated identical clicks.
- **How I'd validate it helped:** instrument the AI panel to log, per demo
  session, (a) the size of each returned proposal batch and (b) whether the
  user used "Accept all" vs. individually reviewed each card. If batches of
  3+ elements are accepted via "Accept all" a large majority of the time
  *and* the per-element stale/invalid rejection rate for bulk-accepted
  batches isn't higher than for individually-reviewed ones, the shortcut is
  saving effort without users skipping real review that would have caught
  a problem.

## Cuts, assumptions, and next three priorities

**Cuts / assumptions:**
- Position/layout is expressed through `width`, `order`, and `align`, not
  free-form x/y dragging — a one-page marketing layout doesn't need
  absolute positioning, and it kept the schema (and validator) small enough
  to reason about for this exercise.
- Undo is done through the History panel, not a global `Cmd+Z` stack — this
  matches "recover per element" more directly than a single linear undo
  would.
- The code editor operates on one selected element's JSON at a time rather
  than the whole tree, to keep the diff-and-validate logic tractable; the
  whole-template view is read-only for orientation.
- Persistence is `localStorage`-only (single browser, single user) — there
  is no backend, matching "prototype" scope.

**Next three priorities, in order:**
1. Multi-element **code** editing (right now code editing is single-element;
   canvas already supports group edits) so the two surfaces have fully
   matching capability.
2. A visible per-viewport "this value is inherited from base / this value
   is an explicit override" indicator in the Inspector, so the owner can see
   *why* a field shows the value it does without opening the code view.
3. Free-form position/size (x, y, width, height) for at least the `image`
   and `section` types, since real one-page templates often want a hero
   image or button nudged rather than only resized/reordered.
