import { ELEMENT_SCHEMAS, PropertyKey, PropertyValues, TemplateElement } from "../types";

export interface FieldValidation {
  field: PropertyKey;
  ok: boolean;
  reason?: string;
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function validateValue(field: PropertyKey, value: unknown): string | null {
  switch (field) {
    case "content":
    case "href":
    case "src":
    case "alt":
      return typeof value === "string" ? null : "expected a string";
    case "textColor":
    case "backgroundColor":
      return typeof value === "string" && HEX_COLOR.test(value) ? null : "expected a hex color like #2b2420";
    case "fontSize":
      return typeof value === "number" && value >= 8 && value <= 96 ? null : "expected a number between 8 and 96";
    case "fontWeight":
      return value === "normal" || value === "bold" ? null : "expected 'normal' or 'bold'";
    case "align":
      return value === "left" || value === "center" || value === "right" ? null : "expected 'left' | 'center' | 'right'";
    case "padding":
      return typeof value === "number" && value >= 0 && value <= 200 ? null : "expected a number between 0 and 200";
    case "width":
      return typeof value === "number" && value >= 10 && value <= 100 ? null : "expected a number between 10 and 100";
    case "order":
      return typeof value === "number" ? null : "expected a number";
    case "hidden":
      return typeof value === "boolean" ? null : "expected a boolean";
    default:
      return "unknown field";
  }
}

/**
 * Validates a proposed set of field changes against one element's type
 * schema. Returns one FieldValidation per submitted field so the caller
 * (edit pipeline) can apply only the fields that pass and surface the rest
 * as reasons, rather than rejecting the whole element for one bad field.
 */
export function validateFieldsForElement(element: TemplateElement, changes: Partial<PropertyValues>): FieldValidation[] {
  const allowed = new Set(ELEMENT_SCHEMAS[element.type]);
  return (Object.keys(changes) as PropertyKey[]).map((field) => {
    if (!allowed.has(field)) {
      return { field, ok: false, reason: `'${field}' is not an editable property of a ${element.type} element` };
    }
    const valueError = validateValue(field, (changes as Record<string, unknown>)[field]);
    if (valueError) {
      return { field, ok: false, reason: valueError };
    }
    return { field, ok: true };
  });
}
