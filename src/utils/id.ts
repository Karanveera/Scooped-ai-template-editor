let counter = 0;

/** Generates a stable, human-scannable id. IDs are never reused or
 * re-derived from content/position, so they remain valid selection
 * anchors even after content, class names, or DOM order change. */
export function makeId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${rand}${counter}`;
}
