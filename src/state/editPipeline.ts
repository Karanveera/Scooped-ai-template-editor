import {
  CommitResult,
  ElementChange,
  ElementCommitResult,
  EditCommand,
  ELEMENT_SCHEMAS,
  HistoryEntry,
  PropertyKey,
  PropertyValues,
  TemplateModel,
  Viewport
} from "../types";
import { validateFieldsForElement } from "./validation";
import { makeId } from "../utils/id";

const VIEWPORTS: Viewport[] = ["desktop", "tablet", "mobile"];

function snapshotScope(template: TemplateModel, elementId: string, viewportScope: EditCommand["viewportScope"], fields: PropertyKey[]): Partial<PropertyValues> | null {
  const element = template.elements[elementId];
  if (!element) return null;
  const source: Partial<PropertyValues> = viewportScope === "all" ? element.base : element.overrides[viewportScope] ?? {};
  const snap: Partial<PropertyValues> = {};
  for (const f of fields) {
    if (f in source) (snap as Record<string, unknown>)[f] = (source as Record<string, unknown>)[f];
  }
  return snap;
}

/**
 * Validates and applies one EditCommand. Every element in the command is
 * evaluated independently: unknown ids, forbidden fields, invalid values,
 * and stale base revisions cause that ELEMENT (or that field) to be
 * rejected without blocking the other elements in the same multi-element
 * command. Nothing is mutated until an element has fully passed
 * validation, so a rejected element leaves current state untouched.
 */
export function commitEditCommand(template: TemplateModel, command: EditCommand): CommitResult {
  const results: ElementCommitResult[] = [];
  let nextTemplate: TemplateModel = template;
  const historyEntries: HistoryEntry[] = [];

  for (const change of command.elementChanges) {
    const outcome = applyOneElement(nextTemplate, command, change);
    results.push(outcome.result);
    if (outcome.nextTemplate) {
      nextTemplate = outcome.nextTemplate;
    }
    if (outcome.historyEntry) {
      historyEntries.push(outcome.historyEntry);
    }
  }

  if (historyEntries.length > 0) {
    nextTemplate = {
      ...nextTemplate,
      revision: nextTemplate.revision + 1
    };
  }

  return { results, templateAfter: nextTemplate, historyEntries };
}

function applyOneElement(
  template: TemplateModel,
  command: EditCommand,
  change: ElementChange
): { result: ElementCommitResult; nextTemplate: TemplateModel | null; historyEntry: HistoryEntry | null } {
  const element = template.elements[change.elementId];

  // 1. Unknown id.
  if (!element) {
    return {
      result: { elementId: change.elementId, status: "rejected", reason: "unknown element id", appliedFields: [] },
      nextTemplate: null,
      historyEntry: null
    };
  }

  // 2. Authorization: the id must be one the author was scoped to touch.
  // This is what keeps an AI proposal (or a stray code edit) from ever
  // reaching outside the selection it was generated for.
  if (!command.authorizedIds.includes(change.elementId)) {
    return {
      result: { elementId: change.elementId, status: "rejected", reason: "element was not part of the authorized selection", appliedFields: [] },
      nextTemplate: null,
      historyEntry: null
    };
  }

  // 3. Stale revision: someone else committed to this element since this
  // change was authored.
  if (change.baseRevision !== element.revision) {
    return {
      result: {
        elementId: change.elementId,
        status: "stale",
        reason: `element has moved to revision ${element.revision} since this change was authored at revision ${change.baseRevision}`,
        appliedFields: []
      },
      nextTemplate: null,
      historyEntry: null
    };
  }

  // 4. Field-level validation (whitelist + type/range checks). A value of
  // `null` is a special "clear this override, go back to inheriting base"
  // instruction -- only meaningful for a single-viewport scope, since the
  // shared base has no further fallback to inherit from.
  const rawChanges = change.changes as Record<string, unknown>;
  const nullFieldNames = (Object.keys(rawChanges) as PropertyKey[]).filter((f) => rawChanges[f] === null);
  const nonNullChanges: Partial<PropertyValues> = {};
  (Object.keys(rawChanges) as PropertyKey[]).forEach((f) => {
    if (rawChanges[f] !== null) (nonNullChanges as Record<string, unknown>)[f] = rawChanges[f];
  });

  const fieldResults = validateFieldsForElement(element, nonNullChanges);
  const validFields = fieldResults.filter((f) => f.ok).map((f) => f.field);
  const invalidFields = fieldResults.filter((f) => !f.ok);

  const schemaAllowed = new Set(ELEMENT_SCHEMAS[element.type]);
  const clearFields: PropertyKey[] = [];
  const invalidClearFields: PropertyKey[] = [];
  for (const f of nullFieldNames) {
    if (command.viewportScope === "all") {
      invalidClearFields.push(f);
    } else if (!schemaAllowed.has(f)) {
      invalidClearFields.push(f);
    } else {
      clearFields.push(f);
    }
  }

  const allInvalid = [...invalidFields, ...invalidClearFields.map((f) => ({ field: f, ok: false as const, reason: "cannot clear this field in the current scope" }))];

  if (validFields.length === 0 && clearFields.length === 0) {
    return {
      result: {
        elementId: change.elementId,
        status: "invalid",
        reason: allInvalid.map((f) => `${f.field}: ${f.reason}`).join("; ") || "no valid fields submitted",
        appliedFields: []
      },
      nextTemplate: null,
      historyEntry: null
    };
  }

  const validChanges: Partial<PropertyValues> = {};
  for (const f of validFields) {
    (validChanges as Record<string, unknown>)[f] = (nonNullChanges as Record<string, unknown>)[f];
  }

  const affectedFields = [...validFields, ...clearFields];
  const before = snapshotScope(template, element.id, command.viewportScope, affectedFields);

  let updatedElement: typeof element;
  if (command.viewportScope === "all") {
    updatedElement = { ...element, base: { ...element.base, ...validChanges }, revision: element.revision + 1 };
  } else {
    const nextOverride = { ...(element.overrides[command.viewportScope] ?? {}), ...validChanges } as Record<string, unknown>;
    for (const f of clearFields) delete nextOverride[f];
    updatedElement = {
      ...element,
      overrides: { ...element.overrides, [command.viewportScope]: nextOverride as Partial<PropertyValues> },
      revision: element.revision + 1
    };
  }

  const nextTemplate: TemplateModel = {
    ...template,
    elements: { ...template.elements, [element.id]: updatedElement }
  };

  const after: Partial<PropertyValues> = { ...validChanges };
  for (const f of clearFields) (after as Record<string, unknown>)[f] = null;

  const historyEntry: HistoryEntry = {
    historyId: makeId("hist"),
    timestamp: Date.now(),
    elementId: element.id,
    viewportScope: command.viewportScope,
    source: command.source,
    description: command.description,
    before,
    after,
    revisionAfter: updatedElement.revision
  };

  const rejectedCount = invalidFields.length + invalidClearFields.length;
  const status = rejectedCount > 0 ? "invalid" : "accepted";
  const appliedFields = [...validFields, ...clearFields];

  return {
    result: {
      elementId: element.id,
      status,
      reason:
        rejectedCount > 0
          ? `applied ${appliedFields.join(", ") || "none"}; rejected ${[...invalidFields.map((f) => f.field), ...invalidClearFields].join(", ")}`
          : undefined,
      appliedFields
    },
    nextTemplate,
    historyEntry
  };
}
