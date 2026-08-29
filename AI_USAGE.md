# AI Usage

## Tools/models used

- **Claude (Anthropic, chat + agentic coding tool use)** — used for the
  entire build: reading the assignment, planning the data model and commit
  pipeline, scaffolding the Vite/React/TypeScript project, writing all
  source files, writing the automated tests, running `tsc`/`vite build`/
  `vitest` in a sandboxed shell to self-verify, and drafting this
  documentation set.

No other AI tools or models were used. No real/live AI model is called by
the shipped product itself — the AI demo is a deterministic, local rules
engine (`src/ai/scenarioEngine.ts`); this is a spec requirement, not a
limitation of the workflow.

## Example 1 — planning / product-framing interaction (redacted)

> **Prompt (paraphrased):** "Design the template/element/history model so
> canvas, code, and an AI demo can all write through one commit path. It
> needs stable ids, base + per-viewport overrides, a whitelist of editable
> fields per element type, and revision numbers for stale-edit detection.
> Walk through the resolution order before writing code."
>
> **Response (summarized):** proposed `TemplateElement { id, type, parentId,
> base, overrides, revision }`, a `resolved = { ...base, ...overrides[vp] }`
> read path, and a single `EditCommand -> commitEditCommand()` write path
> that every surface (canvas/code/AI/restore) would call, with per-element
> (not per-command) accept/reject so one bad element in a batch can't block
> the rest. This became `types.ts`, `state/resolve.ts`, and
> `state/editPipeline.ts`.

## Example 2 — implementation / test interaction (redacted)

> **Prompt (paraphrased):** "Write vitest specs for: AI proposals staying
> inside the selected ids and allowed fields, viewport isolation, canvas/
> code convergence, and independent per-element recovery. Then run them."
>
> **Response (summarized):** wrote `tests/aiScope.test.ts`,
> `viewportIsolation.test.ts`, `canvasCodeSync.test.ts`, `recovery.test.ts`,
> then ran `npx vitest run`. The recovery suite initially failed one case
> (see "rejected suggestion" below), which led to a real fix in
> `editPipeline.ts` and `restore.ts` before all 15 tests passed.

## An AI suggestion that was rejected / materially corrected

The first version of "restore an element back to before an edit" fell back
to *"re-resolve the element's current value for that viewport"* whenever a
history entry's `before` snapshot had no prior explicit value (i.e. this was
the very first override ever written for that field). That is wrong: at
restore time, "current value" already **includes** the edit being undone, so
the fallback silently restored the edit to itself — a no-op disguised as a
successful restore.

**Why it was wrong:** it was caught by writing the recovery test first
("restoring a mobile-scoped edit does not touch desktop, and actually
reverts mobile") and running it — the assertion that the mobile override no
longer equalled the edited value failed.

**Resulting change:** replaced the "resolve now" fallback with an explicit
`null` = *"clear this override, go back to inheriting from the shared
base"* instruction, handled inside `commitEditCommand()` itself (so
clearing goes through the same validation/authorization/history path as
every other change, rather than being a special-cased mutation). Re-ran the
suite; all cases passed afterward.

## How the generated code was checked

- `npx tsc -b` — strict-mode type check, run after every non-trivial file
  change, not just at the end.
- `npx vite build` — full production bundle, confirms no runtime-only
  import/bundling issues beyond what `tsc` catches.
- `npx vitest run` — 15 focused tests against the state layer (the part of
  the app where a silent bug would be most dangerous: scope leaks, stale
  overwrites, forbidden fields, broken recovery). All pass.
- Manual scenarios exercised in a local preview server (`vite preview`):
  loading the default template, switching viewports, clicking/shift-
  clicking/marquee-selecting elements, editing via the Inspector, editing
  the same element via the code JSON view, running each of the six
  documented AI example instructions, accepting/rejecting proposals, and
  restoring from history.
- Dependencies reviewed: only `react`, `react-dom` at runtime; `vite`,
  `@vitejs/plugin-react`, `typescript`, `vitest`, and `@types/*` as dev
  dependencies. No dependency reaches out to the network or handles
  secrets/credentials.
- **Remaining uncertainty:** the marquee-selection hit-testing uses
  `getBoundingClientRect()` on live DOM nodes captured via refs; it was
  exercised manually in the local preview but does not have an automated
  (jsdom/RTL) test in this submission — see "limitation" below.

## One limitation in this AI workflow, and what to change next time

The test suite covers the state/logic layer thoroughly but has **no
component-level tests** (React Testing Library / jsdom) for the interactive
canvas — selection click/shift-click/marquee, keyboard operability, and the
code editor's error banner were only checked by manually running the app,
not by an automated test that would catch a future regression. Next time,
I'd ask the AI to scaffold `@testing-library/react` alongside vitest from
the start and write at least a handful of component tests (click-to-select,
shift-click adds to selection, invalid JSON in the code editor shows the
error and doesn't change state) in the same pass as the logic tests, rather
than treating UI verification as "run it and look."

## Privacy note

No API keys, employer/client material, private repository content, or
unrelated personal prompts are included above; both examples are
paraphrased/summarized rather than pasted verbatim.
