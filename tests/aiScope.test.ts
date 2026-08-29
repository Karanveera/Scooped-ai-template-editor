import { describe, it, expect } from "vitest";
import { createDefaultTemplate } from "../src/template/defaultTemplate";
import { commitEditCommand } from "../src/state/editPipeline";
import { runScenario } from "../src/ai/scenarioEngine";

describe("AI scope validation", () => {
  it("only ever proposes changes for the elements that were selected", () => {
    const template = createDefaultTemplate();
    const selected = [template.elements.hero_heading];
    const outcome = runScenario({ instruction: "make the text blue", selected, viewportScope: "all" });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const touchedIds = outcome.match.proposals.map((p) => p.elementId);
      expect(touchedIds).toEqual(["hero_heading"]);
    }
  });

  it("rejects an edit command that targets an id outside the authorized selection", () => {
    const template = createDefaultTemplate();
    // Simulate a malformed/malicious command that tries to sneak in an id
    // that was never part of the authorized selection.
    const result = commitEditCommand(template, {
      source: "ai",
      viewportScope: "all",
      authorizedIds: ["hero_heading"],
      description: "attempted scope escape",
      elementChanges: [
        { elementId: "hero_heading", baseRevision: 0, changes: { textColor: "#2563eb" } },
        { elementId: "cta_heading", baseRevision: 0, changes: { textColor: "#2563eb" } }
      ]
    });
    const heroResult = result.results.find((r) => r.elementId === "hero_heading");
    const ctaResult = result.results.find((r) => r.elementId === "cta_heading");
    expect(heroResult?.status).toBe("accepted");
    expect(ctaResult?.status).toBe("rejected");
    expect(ctaResult?.reason).toMatch(/not part of the authorized selection/);
    // Unauthorized element must be completely untouched.
    expect(result.templateAfter.elements.cta_heading).toEqual(template.elements.cta_heading);
  });

  it("rejects a field that is not in the element's schema (forbidden field)", () => {
    const template = createDefaultTemplate();
    const result = commitEditCommand(template, {
      source: "ai",
      viewportScope: "all",
      authorizedIds: ["hero_heading"],
      description: "forbidden field attempt",
      elementChanges: [{ elementId: "hero_heading", baseRevision: 0, changes: { href: "https://example.com" } as any }]
    });
    expect(result.results[0].status).toBe("invalid");
    expect(result.templateAfter.elements.hero_heading.base).toEqual(template.elements.hero_heading.base);
  });

  it("respects the chosen viewport scope: a mobile-scoped AI edit only writes the mobile override", () => {
    const template = createDefaultTemplate();
    const result = commitEditCommand(template, {
      source: "ai",
      viewportScope: "mobile",
      authorizedIds: ["hero_heading"],
      description: "responsive AI edit",
      elementChanges: [{ elementId: "hero_heading", baseRevision: 0, changes: { fontSize: 22 } }]
    });
    const updated = result.templateAfter.elements.hero_heading;
    expect(updated.overrides.mobile?.fontSize).toBe(22);
    expect(updated.base.fontSize).toBe(template.elements.hero_heading.base.fontSize);
    expect(updated.overrides.desktop?.fontSize).toBeUndefined();
  });

  it("produces a safe failure for an unsupported / forbidden instruction instead of guessing", () => {
    const template = createDefaultTemplate();
    const outcome = runScenario({ instruction: "rotate it in 3d", selected: [template.elements.hero_heading], viewportScope: "all" });
    expect(outcome.ok).toBe(false);
  });

  it("produces a safe failure when nothing is selected", () => {
    const outcome = runScenario({ instruction: "make it bigger", selected: [], viewportScope: "all" });
    expect(outcome.ok).toBe(false);
  });
});
