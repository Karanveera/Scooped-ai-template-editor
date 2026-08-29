import { ElementType, PropertyValues, TemplateElement, ViewportScope } from "../types";

export interface ScenarioContext {
  instruction: string;
  selected: TemplateElement[];
  viewportScope: ViewportScope;
}

export interface ScenarioProposal {
  elementId: string;
  changes: Partial<PropertyValues>;
  explanation: string;
}

export interface ScenarioMatch {
  scenarioId: string;
  label: string;
  proposals: ScenarioProposal[];
}

export interface ScenarioFailure {
  ok: false;
  reason: string;
}

export type ScenarioOutcome = { ok: true; match: ScenarioMatch } | ScenarioFailure;

const COLOR_WORDS: Record<string, string> = {
  blue: "#2563eb",
  navy: "#1e3a5f",
  red: "#c0392b",
  green: "#2f6b3a",
  amber: "#f2b134",
  black: "#1a1a1a",
  white: "#ffffff",
  cream: "#f5efe6",
  charcoal: "#2b2420"
};

function findColorWord(instruction: string): string | null {
  for (const word of Object.keys(COLOR_WORDS)) {
    if (instruction.includes(word)) return word;
  }
  return null;
}

function hasAny(instruction: string, words: string[]): boolean {
  return words.some((w) => instruction.includes(w));
}

function textualElements(selected: TemplateElement[]): TemplateElement[] {
  return selected.filter((e) => e.type === "heading" || e.type === "paragraph" || e.type === "button");
}

/** Deterministic content rewrite: same instruction + same current content
 * always yields the same proposed content. No randomness, no external
 * model call. */
function rewriteContent(current: string, instruction: string): string {
  const trimmed = current.trim().replace(/\s+/g, " ");
  if (hasAny(instruction, ["shorter", "short", "concise"])) {
    const words = trimmed.split(" ");
    return words.slice(0, Math.max(3, Math.ceil(words.length / 2))).join(" ");
  }
  if (hasAny(instruction, ["friendlier", "friendly", "warmer", "warm"])) {
    return `${trimmed.replace(/\.$/, "")} \u2014 come say hi!`;
  }
  if (hasAny(instruction, ["formal", "professional"])) {
    return trimmed.replace(/!$/, ".").replace(/come say hi/i, "we welcome your visit");
  }
  if (hasAny(instruction, ["urgent", "urgency", "limited"])) {
    return `${trimmed.replace(/\.$/, "")} \u2014 this week only.`;
  }
  return `${trimmed} (rewritten)`;
}

/**
 * The scenario engine. Every rule reads only the current selection's
 * resolved values, the instruction text, and the chosen viewport scope --
 * never a fixed page replacement. Rules are checked in order; the first
 * match wins. Returning ok:false represents a documented safe-failure
 * example (unsupported instruction, unselected target, forbidden field).
 */
export function runScenario(ctx: ScenarioContext): ScenarioOutcome {
  const instruction = ctx.instruction.trim().toLowerCase();

  if (ctx.selected.length === 0) {
    return { ok: false, reason: "No elements selected. Select one or more elements before running the AI demo." };
  }

  if (instruction.length === 0) {
    return { ok: false, reason: "Enter an instruction describing the change you want." };
  }

  // --- Safe failure: intentionally unsupported / forbidden property demo.
  if (hasAny(instruction, ["3d", "rotate", "z-index", "animate"])) {
    return {
      ok: false,
      reason: "That would require a 'rotation'/'zIndex' property, which is not part of this element's editable schema. The AI demo only proposes fields the validator already allows."
    };
  }

  // --- Style change: color words.
  const colorWord = findColorWord(instruction);
  if (colorWord && hasAny(instruction, ["color", "background", "make it", colorWord])) {
    const targetsBackground = hasAny(instruction, ["background", "bg"]);
    const proposals: ScenarioProposal[] = ctx.selected.map((el) => ({
      elementId: el.id,
      changes: targetsBackground ? { backgroundColor: COLOR_WORDS[colorWord] } : { textColor: COLOR_WORDS[colorWord] },
      explanation: `${targetsBackground ? "Background" : "Text"} color \u2192 ${colorWord} (${COLOR_WORDS[colorWord]})`
    }));
    return {
      ok: true,
      match: { scenarioId: "style-color", label: `Style change: ${targetsBackground ? "background" : "text"} color \u2192 ${colorWord}`, proposals }
    };
  }

  if (hasAny(instruction, ["bold", "bolder", "emphasize", "emphasis"])) {
    const targets = ctx.selected.filter((e) => e.type === "heading" || e.type === "paragraph" || e.type === "button");
    if (targets.length === 0) {
      return { ok: false, reason: "None of the selected elements support a font-weight change." };
    }
    return {
      ok: true,
      match: {
        scenarioId: "style-bold",
        label: "Style change: bold emphasis",
        proposals: targets.map((el) => ({ elementId: el.id, changes: { fontWeight: "bold" }, explanation: "Font weight \u2192 bold" }))
      }
    };
  }

  // --- Content rewrite.
  if (hasAny(instruction, ["rewrite", "shorter", "short", "friendlier", "friendly", "formal", "urgent", "warmer"])) {
    const targets = textualElements(ctx.selected);
    if (targets.length === 0) {
      return { ok: false, reason: "None of the selected elements have text content to rewrite." };
    }
    return {
      ok: true,
      match: {
        scenarioId: "content-rewrite",
        label: "Content rewrite",
        proposals: targets.map((el) => {
          const current = el.base.content ?? "";
          const next = rewriteContent(current, instruction);
          return { elementId: el.id, changes: { content: next }, explanation: `Content \u2192 "${next}"` };
        })
      }
    };
  }

  // --- Move / resize / reorder.
  if (hasAny(instruction, ["bigger", "larger", "wider"])) {
    return {
      ok: true,
      match: {
        scenarioId: "resize-up",
        label: "Resize: increase width",
        proposals: ctx.selected.map((el) => {
          const current = el.base.width ?? 100;
          const next = Math.min(100, current + 20);
          return { elementId: el.id, changes: { width: next }, explanation: `Width \u2192 ${next}%` };
        })
      }
    };
  }
  if (hasAny(instruction, ["smaller", "narrower"])) {
    return {
      ok: true,
      match: {
        scenarioId: "resize-down",
        label: "Resize: decrease width",
        proposals: ctx.selected.map((el) => {
          const current = el.base.width ?? 100;
          const next = Math.max(20, current - 20);
          return { elementId: el.id, changes: { width: next }, explanation: `Width \u2192 ${next}%` };
        })
      }
    };
  }
  if (hasAny(instruction, ["move up", "reorder up", "up"])) {
    return {
      ok: true,
      match: {
        scenarioId: "reorder-up",
        label: "Reorder: move earlier",
        proposals: ctx.selected.map((el) => {
          const current = el.base.order ?? 0;
          const next = Math.max(0, current - 1);
          return { elementId: el.id, changes: { order: next }, explanation: `Order \u2192 ${next}` };
        })
      }
    };
  }
  if (hasAny(instruction, ["move down", "reorder down", "down"])) {
    return {
      ok: true,
      match: {
        scenarioId: "reorder-down",
        label: "Reorder: move later",
        proposals: ctx.selected.map((el) => {
          const current = el.base.order ?? 0;
          const next = current + 1;
          return { elementId: el.id, changes: { order: next }, explanation: `Order \u2192 ${next}` };
        })
      }
    };
  }

  // --- One-viewport responsive adjustment.
  if (hasAny(instruction, ["stack", "mobile", "tablet", "hide on", "full width"])) {
    if (ctx.viewportScope === "all") {
      return { ok: false, reason: "This instruction targets a single viewport. Choose Desktop, Tablet, or Mobile as the scope before running it." };
    }
    if (hasAny(instruction, ["hide"])) {
      return {
        ok: true,
        match: {
          scenarioId: "responsive-hide",
          label: `Responsive: hide on ${ctx.viewportScope}`,
          proposals: ctx.selected.map((el) => ({ elementId: el.id, changes: { hidden: true }, explanation: `Hidden on ${ctx.viewportScope}` }))
        }
      };
    }
    return {
      ok: true,
      match: {
        scenarioId: "responsive-stack",
        label: `Responsive: full-width stack on ${ctx.viewportScope}`,
        proposals: ctx.selected.map((el) => ({ elementId: el.id, changes: { width: 100 }, explanation: `Width \u2192 100% on ${ctx.viewportScope}` }))
      }
    };
  }

  // --- Multi-element alignment demo.
  if (hasAny(instruction, ["align", "match", "consistent"]) && ctx.selected.length >= 2) {
    return {
      ok: true,
      match: {
        scenarioId: "multi-align",
        label: "Multi-element: align selected",
        proposals: ctx.selected.map((el) => ({ elementId: el.id, changes: { align: "center" }, explanation: "Alignment \u2192 center" }))
      }
    };
  }

  return { ok: false, reason: `No deterministic scenario matches "${ctx.instruction}". Try a documented example instruction from the panel below.` };
}

export const EXAMPLE_INSTRUCTIONS: { label: string; instruction: string; hint: string }[] = [
  { label: "Content rewrite", instruction: "make this shorter", hint: "Select a heading or paragraph, scope All views." },
  { label: "Style change", instruction: "make the text blue", hint: "Select any text or button element." },
  { label: "Move / resize", instruction: "make it bigger", hint: "Select one or more elements, any scope." },
  { label: "Responsive (single viewport)", instruction: "stack full width on mobile", hint: "Set scope to Mobile first." },
  { label: "Multi-element edit", instruction: "align these", hint: "Select two or more elements." },
  { label: "Safe failure: unsupported", instruction: "rotate it in 3d", hint: "Demonstrates a forbidden-field rejection." }
];
