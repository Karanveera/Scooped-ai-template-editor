import { TemplateModel, TemplateElement } from "../types";

// This starting template ("Corner & Co." - a fictional neighborhood coffee
// roaster one-pager) is original content authored for this exercise, not a
// third-party asset. It exists to give the editor real, editable content:
// a hero section, a features/offerings section, and a call-to-action
// footer, each built from the modular element types the editor supports.

function el(
  id: string,
  type: TemplateElement["type"],
  parentId: string | null,
  base: TemplateElement["base"],
  overrides: TemplateElement["overrides"] = {}
): TemplateElement {
  return { id, type, parentId, base, overrides, revision: 0 };
}

export function createDefaultTemplate(): TemplateModel {
  const elements: Record<string, TemplateElement> = {
    hero: el("hero", "section", null, { backgroundColor: "#2b2420", padding: 64, order: 0 }),
    hero_heading: el(
      "hero_heading",
      "heading",
      "hero",
      { content: "Corner & Co. Coffee Roasters", textColor: "#f5efe6", fontSize: 40, fontWeight: "bold", align: "center", order: 0 },
      { mobile: { fontSize: 28 } }
    ),
    hero_sub: el(
      "hero_sub",
      "paragraph",
      "hero",
      { content: "Small-batch beans, roasted weekly, three blocks from the harbor.", textColor: "#d8cdbd", fontSize: 18, align: "center", order: 1 },
      { mobile: { fontSize: 15 } }
    ),
    hero_cta: el(
      "hero_cta",
      "button",
      "hero",
      { content: "Order online", href: "#order", textColor: "#2b2420", backgroundColor: "#f2b134", fontSize: 16, align: "center", order: 2 }
    ),

    features: el("features", "section", null, { backgroundColor: "#faf6ef", padding: 48, order: 1 }),
    features_heading: el(
      "features_heading",
      "heading",
      "features",
      { content: "Why people come back", textColor: "#2b2420", fontSize: 28, fontWeight: "bold", align: "left", order: 0 }
    ),
    feature_1: el(
      "feature_1",
      "paragraph",
      "features",
      { content: "Single-origin beans sourced directly from three family farms.", textColor: "#4a4038", fontSize: 16, align: "left", order: 1, width: 100 },
      { tablet: { width: 100 }, mobile: { width: 100 } }
    ),
    feature_2: el(
      "feature_2",
      "paragraph",
      "features",
      { content: "Roasted in-house every Tuesday and Friday, never more than five days old.", textColor: "#4a4038", fontSize: 16, align: "left", order: 2, width: 100 }
    ),
    feature_image: el(
      "feature_image",
      "image",
      "features",
      { src: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800", alt: "Coffee beans being roasted", width: 100, align: "center", order: 3 }
    ),

    cta: el("cta", "section", null, { backgroundColor: "#2b2420", padding: 40, order: 2 }),
    cta_heading: el(
      "cta_heading",
      "heading",
      "cta",
      { content: "Stop by this weekend.", textColor: "#f5efe6", fontSize: 24, fontWeight: "bold", align: "center", order: 0 }
    ),
    cta_button: el(
      "cta_button",
      "button",
      "cta",
      { content: "Get directions", href: "#map", textColor: "#f5efe6", backgroundColor: "#6b5b4d", fontSize: 16, align: "center", order: 1 }
    )
  };

  return {
    templateId: "corner-and-co-v1",
    name: "Corner & Co. Coffee Roasters",
    revision: 0,
    elements,
    rootOrder: ["hero", "features", "cta"]
  };
}
