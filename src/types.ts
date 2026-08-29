// ---------------------------------------------------------------------------
// Core domain types for the Scoped AI Template Editor.
//
// The template model is the single source of truth. Canvas edits, code
// edits, and accepted AI proposals all funnel through the same
// EditCommand -> validate -> commit pipeline defined in state/editPipeline.ts
// so that every surface obeys identical rules.
// ---------------------------------------------------------------------------

export type ElementType = "section" | "heading" | "paragraph" | "button" | "image";

export type Viewport = "desktop" | "tablet" | "mobile";

// "all" means "write to the shared base value". A concrete viewport means
// "write only to that viewport's override", leaving the other two untouched.
export type ViewportScope = "all" | Viewport;

// The full set of properties an element could theoretically carry. Which
// keys are actually legal for a given element type is defined by
// ELEMENT_SCHEMAS below -- that whitelist is what "forbidden fields" is
// checked against.
export interface PropertyValues {
  content?: string; // text content (heading/paragraph/button)
  href?: string; // button link target
  src?: string; // image source
  alt?: string; // image alt text
  textColor?: string; // hex color
  backgroundColor?: string; // hex color
  fontSize?: number; // px
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  padding?: number; // px, all sides
  width?: number; // percent, 10-100
  order?: number; // sibling order within parent
  hidden?: boolean; // hide this element in a given scope
}

export type PropertyKey = keyof PropertyValues;

// Per-viewport overrides only ever contain a subset of PropertyValues.
export type ViewportOverrides = Partial<Record<Viewport, Partial<PropertyValues>>>;

export interface TemplateElement {
  id: string; // stable, generated once, never reused
  type: ElementType;
  parentId: string | null;
  /** Shared values that apply to every viewport unless overridden. */
  base: PropertyValues;
  /** Per-viewport overrides. Only present keys deviate from base. */
  overrides: ViewportOverrides;
  /** Bumped on every accepted commit that touches this element. Used for
   * optimistic-concurrency / stale-revision detection. */
  revision: number;
}

export interface TemplateModel {
  templateId: string;
  name: string;
  /** Global monotonically increasing counter, bumped on every commit. */
  revision: number;
  elements: Record<string, TemplateElement>;
  /** Root-level element ids, in render order. */
  rootOrder: string[];
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface Selection {
  ids: string[];
}

// ---------------------------------------------------------------------------
// Edit commands -- the single contract every surface (canvas, code, AI,
// restore) must produce to change the template.
// ---------------------------------------------------------------------------

export type EditSource = "canvas" | "code" | "ai" | "restore";

export interface ElementChange {
  elementId: string;
  /** The revision the author believed this element was at when the change
   * was authored. If it no longer matches current state, the change is
   * rejected as stale rather than silently overwriting newer work. */
  baseRevision: number;
  changes: Partial<PropertyValues>;
}

export interface EditCommand {
  source: EditSource;
  viewportScope: ViewportScope;
  /** The full set of ids the author was allowed to touch. For AI commands
   * this must equal the selection that was active when the proposal was
   * generated -- enforced by the caller, re-checked by the pipeline. */
  authorizedIds: string[];
  elementChanges: ElementChange[];
  description: string;
}

export type ElementCommitStatus = "accepted" | "rejected" | "invalid" | "stale";

export interface ElementCommitResult {
  elementId: string;
  status: ElementCommitStatus;
  reason?: string;
  appliedFields: PropertyKey[];
}

export interface CommitResult {
  results: ElementCommitResult[];
  templateAfter: TemplateModel;
  historyEntries: HistoryEntry[];
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  historyId: string;
  timestamp: number;
  elementId: string;
  viewportScope: ViewportScope;
  source: EditSource;
  description: string;
  /** Snapshot of the affected scope's values before this entry, so restore
   * can put exactly this back without touching sibling elements/viewports. */
  before: Partial<PropertyValues> | null;
  after: Partial<PropertyValues>;
  revisionAfter: number;
}

// ---------------------------------------------------------------------------
// Whitelist schema -- also doubles as the "forbidden field" boundary.
// ---------------------------------------------------------------------------

export const ELEMENT_SCHEMAS: Record<ElementType, PropertyKey[]> = {
  section: ["backgroundColor", "padding", "order", "hidden"],
  heading: ["content", "textColor", "fontSize", "fontWeight", "align", "order", "hidden", "width"],
  paragraph: ["content", "textColor", "fontSize", "align", "order", "hidden", "width"],
  button: ["content", "href", "textColor", "backgroundColor", "fontSize", "align", "order", "hidden", "width"],
  image: ["src", "alt", "width", "align", "order", "hidden"]
};
