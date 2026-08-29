import { describe, it, expect } from "vitest";
import { createDefaultTemplate } from "../src/template/defaultTemplate";
import { commitEditCommand } from "../src/state/editPipeline";
import { resolveElement } from "../src/state/resolve";

describe("Viewport isolation", () => {
  it("a desktop-only edit does not change tablet or mobile resolution", () => {
    const template = createDefaultTemplate();
    const before = {
      tablet: resolveElement(template.elements.hero_sub, "tablet"),
      mobile: resolveElement(template.elements.hero_sub, "mobile")
    };

    const result = commitEditCommand(template, {
      source: "canvas",
      viewportScope: "desktop",
      authorizedIds: ["hero_sub"],
      description: "desktop-only tweak",
      elementChanges: [{ elementId: "hero_sub", baseRevision: 0, changes: { fontSize: 30 } }]
    });

    const updated = result.templateAfter.elements.hero_sub;
    expect(resolveElement(updated, "desktop").fontSize).toBe(30);
    expect(resolveElement(updated, "tablet")).toEqual(before.tablet);
    expect(resolveElement(updated, "mobile")).toEqual(before.mobile);
  });

  it("an 'all views' edit updates the shared base and is visible on every viewport that has no override", () => {
    const template = createDefaultTemplate();
    const result = commitEditCommand(template, {
      source: "canvas",
      viewportScope: "all",
      authorizedIds: ["cta_heading"],
      description: "shared edit",
      elementChanges: [{ elementId: "cta_heading", baseRevision: 0, changes: { textColor: "#000000" } }]
    });
    const updated = result.templateAfter.elements.cta_heading;
    expect(resolveElement(updated, "desktop").textColor).toBe("#000000");
    expect(resolveElement(updated, "tablet").textColor).toBe("#000000");
    expect(resolveElement(updated, "mobile").textColor).toBe("#000000");
  });

  it("an existing per-viewport override still wins over a later 'all views' edit to the same field", () => {
    const template = createDefaultTemplate();
    // hero_heading already ships with a mobile fontSize override (28).
    expect(template.elements.hero_heading.overrides.mobile?.fontSize).toBe(28);

    const result = commitEditCommand(template, {
      source: "canvas",
      viewportScope: "all",
      authorizedIds: ["hero_heading"],
      description: "shared font size change",
      elementChanges: [{ elementId: "hero_heading", baseRevision: 0, changes: { fontSize: 44 } }]
    });
    const updated = result.templateAfter.elements.hero_heading;
    expect(resolveElement(updated, "desktop").fontSize).toBe(44);
    // Mobile keeps its explicit override rather than inheriting the new base.
    expect(resolveElement(updated, "mobile").fontSize).toBe(28);
  });
});
