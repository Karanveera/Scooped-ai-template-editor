import { describe, it, expect } from "vitest";
import { createDefaultTemplate } from "../src/template/defaultTemplate";
import { commitEditCommand } from "../src/state/editPipeline";
import { buildRestoreCommand } from "../src/state/restore";

describe("Independent element recovery", () => {
  it("restoring one element's edit does not affect a sibling element that was edited in the same batch", () => {
    let template = createDefaultTemplate();

    const batch = commitEditCommand(template, {
      source: "ai",
      viewportScope: "all",
      authorizedIds: ["hero_heading", "hero_sub"],
      description: "multi-element AI edit",
      elementChanges: [
        { elementId: "hero_heading", baseRevision: 0, changes: { textColor: "#2563eb" } },
        { elementId: "hero_sub", baseRevision: 0, changes: { textColor: "#2563eb" } }
      ]
    });
    template = batch.templateAfter;
    expect(template.elements.hero_heading.base.textColor).toBe("#2563eb");
    expect(template.elements.hero_sub.base.textColor).toBe("#2563eb");

    const headingEntry = batch.historyEntries.find((h) => h.elementId === "hero_heading")!;
    const restoreCommand = buildRestoreCommand(template, headingEntry)!;
    const restored = commitEditCommand(template, restoreCommand);

    expect(restored.templateAfter.elements.hero_heading.base.textColor).toBe("#f5efe6"); // original value
    // The sibling element accepted in the same original batch is untouched.
    expect(restored.templateAfter.elements.hero_sub.base.textColor).toBe("#2563eb");
  });

  it("restoring a mobile-scoped edit does not touch the desktop value for the same element", () => {
    let template = createDefaultTemplate();

    const edit = commitEditCommand(template, {
      source: "canvas",
      viewportScope: "mobile",
      authorizedIds: ["feature_2"],
      description: "mobile-only edit",
      elementChanges: [{ elementId: "feature_2", baseRevision: 0, changes: { fontSize: 12 } }]
    });
    template = edit.templateAfter;
    expect(template.elements.feature_2.overrides.mobile?.fontSize).toBe(12);

    const entry = edit.historyEntries[0];
    const restoreCommand = buildRestoreCommand(template, entry)!;
    const restored = commitEditCommand(template, restoreCommand);

    // Mobile override is gone/reverted; desktop base was never part of this
    // scope and remains whatever it already was.
    expect(restored.templateAfter.elements.feature_2.base.fontSize).toBe(template.elements.feature_2.base.fontSize);
    expect(restored.templateAfter.elements.feature_2.overrides.mobile?.fontSize).not.toBe(12);
  });

  it("each restore creates a new history entry rather than deleting prior history", () => {
    let template = createDefaultTemplate();
    const edit = commitEditCommand(template, {
      source: "canvas",
      viewportScope: "all",
      authorizedIds: ["hero_cta"],
      description: "edit cta",
      elementChanges: [{ elementId: "hero_cta", baseRevision: 0, changes: { content: "Buy now" } }]
    });
    template = edit.templateAfter;
    const restoreCommand = buildRestoreCommand(template, edit.historyEntries[0])!;
    const restored = commitEditCommand(template, restoreCommand);

    expect(restored.historyEntries.length).toBe(1);
    expect(restored.historyEntries[0].source).toBe("restore");
  });
});
