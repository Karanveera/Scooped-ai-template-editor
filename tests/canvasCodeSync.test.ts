import { describe, it, expect } from "vitest";
import { createDefaultTemplate } from "../src/template/defaultTemplate";
import { commitEditCommand } from "../src/state/editPipeline";

describe("Canvas/code state consistency", () => {
  it("a canvas-sourced command and a code-sourced command with identical changes converge to the same template state", () => {
    const templateA = createDefaultTemplate();
    const templateB = createDefaultTemplate();

    const canvasResult = commitEditCommand(templateA, {
      source: "canvas",
      viewportScope: "all",
      authorizedIds: ["feature_1"],
      description: "canvas edit",
      elementChanges: [{ elementId: "feature_1", baseRevision: 0, changes: { content: "Updated via canvas." } }]
    });

    const codeResult = commitEditCommand(templateB, {
      source: "code",
      viewportScope: "all",
      authorizedIds: ["feature_1"],
      description: "code edit",
      elementChanges: [{ elementId: "feature_1", baseRevision: 0, changes: { content: "Updated via canvas." } }]
    });

    expect(canvasResult.templateAfter.elements.feature_1.base.content).toBe(codeResult.templateAfter.elements.feature_1.base.content);
    expect(canvasResult.templateAfter.elements.feature_1.revision).toBe(codeResult.templateAfter.elements.feature_1.revision);
  });

  it("an invalid code edit is rejected and leaves the last valid state untouched", () => {
    const template = createDefaultTemplate();
    const result = commitEditCommand(template, {
      source: "code",
      viewportScope: "all",
      authorizedIds: ["feature_1"],
      description: "invalid code edit",
      elementChanges: [{ elementId: "feature_1", baseRevision: 0, changes: { fontSize: 500 } }] // out of allowed range
    });
    expect(result.results[0].status).toBe("invalid");
    expect(result.templateAfter.elements.feature_1.base.fontSize).toBe(template.elements.feature_1.base.fontSize);
  });

  it("a stale-revision edit (state moved since the edit was authored) is rejected rather than silently overwriting", () => {
    const template = createDefaultTemplate();
    const first = commitEditCommand(template, {
      source: "canvas",
      viewportScope: "all",
      authorizedIds: ["feature_1"],
      description: "first edit",
      elementChanges: [{ elementId: "feature_1", baseRevision: 0, changes: { content: "First change." } }]
    });

    // A second command still believes the element is at revision 0 (e.g. an
    // AI proposal generated before the first edit landed).
    const second = commitEditCommand(first.templateAfter, {
      source: "ai",
      viewportScope: "all",
      authorizedIds: ["feature_1"],
      description: "stale AI proposal",
      elementChanges: [{ elementId: "feature_1", baseRevision: 0, changes: { content: "Stale change." } }]
    });

    expect(second.results[0].status).toBe("stale");
    expect(second.templateAfter.elements.feature_1.base.content).toBe("First change.");
  });
});
