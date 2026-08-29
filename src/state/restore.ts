import { EditCommand, HistoryEntry, PropertyValues, TemplateModel } from "../types";

/**
 * Builds the EditCommand that restores one history entry. Restore goes
 * through the exact same commitEditCommand pipeline as any other edit --
 * it is not a special-cased state mutation -- and it always produces a NEW
 * history entry rather than deleting the ones that came after it, so the
 * full timeline (including the fact that a restore happened) is preserved.
 *
 * If the entry's "before" snapshot has no explicit value for a field (this
 * was the first edit ever made to that element/scope/field), there is
 * nothing to put back except "stop overriding, inherit from base again".
 * The pipeline treats a `null` change value as exactly that instruction
 * for a single-viewport scope. This is documented in PRODUCT_NOTES.md.
 */
export function buildRestoreCommand(template: TemplateModel, entry: HistoryEntry): EditCommand | null {
  const element = template.elements[entry.elementId];
  if (!element) return null;

  const fields = Object.keys(entry.after) as (keyof typeof entry.after)[];
  const before = entry.before;

  const restoredValues: Record<string, unknown> = {};
  for (const field of fields) {
    if (before && field in before) {
      restoredValues[field] = (before as Record<string, unknown>)[field];
    } else {
      // No prior explicit value: clear the override (no-op for 'all' scope,
      // which the pipeline reports as invalid -- there is nothing to
      // restore to on the shared base since it was always populated).
      restoredValues[field] = null;
    }
  }

  return {
    source: "restore",
    viewportScope: entry.viewportScope,
    authorizedIds: [entry.elementId],
    description: `Restore "${entry.elementId}" to before ${new Date(entry.timestamp).toLocaleTimeString()}`,
    elementChanges: [
      {
        elementId: entry.elementId,
        baseRevision: element.revision,
        changes: restoredValues as Partial<PropertyValues>
      }
    ]
  };
}
