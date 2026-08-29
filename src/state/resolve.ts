import { PropertyValues, TemplateElement, TemplateModel, Viewport } from "../types";

/**
 * Resolution order (documented in PRODUCT_NOTES.md):
 *   resolved = { ...base, ...overrides[viewport] }
 * A key only changes for one viewport if that viewport's override object
 * explicitly contains that key. Everything else silently falls through to
 * the shared base value, so editing one viewport can never mutate another.
 */
export function resolveElement(element: TemplateElement, viewport: Viewport): PropertyValues {
  const override = element.overrides[viewport] ?? {};
  return { ...element.base, ...override };
}

export function resolveChildren(template: TemplateModel, parentId: string | null, viewport: Viewport): TemplateElement[] {
  const children = Object.values(template.elements).filter((elem) => elem.parentId === parentId);
  return children
    .filter((elem) => !resolveElement(elem, viewport).hidden)
    .sort((a, b) => {
      const orderA = resolveElement(a, viewport).order ?? 0;
      const orderB = resolveElement(b, viewport).order ?? 0;
      return orderA - orderB;
    });
}

export function resolveRoots(template: TemplateModel, viewport: Viewport): TemplateElement[] {
  return resolveChildren(template, null, viewport);
}
