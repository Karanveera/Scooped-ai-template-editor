import React, { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { ELEMENT_SCHEMAS, PropertyKey, PropertyValues, ViewportScope } from "../types";
import { resolveElement } from "../state/resolve";

const SCOPES: ViewportScope[] = ["all", "desktop", "tablet", "mobile"];

function unionFields(types: string[]): PropertyKey[] {
  const set = new Set<PropertyKey>();
  types.forEach((t) => ELEMENT_SCHEMAS[t as keyof typeof ELEMENT_SCHEMAS]?.forEach((f) => set.add(f)));
  return Array.from(set);
}

export function Inspector() {
  const { template, selectedIds, runCommand, previewViewport } = useStore();
  const [scope, setScope] = useState<ViewportScope>("all");
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const selectedElements = selectedIds.map((id) => template.elements[id]).filter(Boolean);
  const fields = useMemo(() => unionFields(selectedElements.map((e) => e.type)), [selectedElements]);

  const displayViewport = scope === "all" ? previewViewport : scope;
  const firstResolved = selectedElements[0] ? resolveElement(selectedElements[0], displayViewport) : null;

  function commitField(field: PropertyKey, value: unknown) {
    if (selectedElements.length === 0) return;
    const result = runCommand({
      source: "canvas",
      viewportScope: scope,
      authorizedIds: selectedElements.map((e) => e.id),
      description: `Manual edit: ${field}`,
      elementChanges: selectedElements.map((e) => ({
        elementId: e.id,
        baseRevision: e.revision,
        changes: { [field]: value } as Partial<PropertyValues>
      }))
    });
    const rejected = result.filter((r) => r.status !== "accepted");
    setLastMessage(
      rejected.length === 0
        ? `Applied ${field} to ${result.length} element(s) \u2022 scope: ${scope}`
        : `${result.length - rejected.length} applied, ${rejected.length} rejected: ${rejected.map((r) => r.reason).join("; ")}`
    );
  }

  if (selectedElements.length === 0) {
    return (
      <div>
        <h2>Inspector</h2>
        <p className="empty-note">Select one or more elements on the canvas to edit them manually.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Inspector</h2>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        {selectedElements.length} selected \u00b7 {selectedElements.map((e) => e.type).join(", ")}
      </p>

      <h2>Responsive scope</h2>
      <div className="scope-picker" role="radiogroup" aria-label="Edit viewport scope">
        {SCOPES.map((s) => (
          <button key={s} role="radio" aria-pressed={scope === s} onClick={() => setScope(s)}>
            {s === "all" ? "All views" : s}
          </button>
        ))}
      </div>

      <h2>Properties</h2>
      {fields.includes("content") && (
        <div className="field-row">
          <label htmlFor="f-content">Content</label>
          <textarea
            id="f-content"
            defaultValue={firstResolved?.content ?? ""}
            onBlur={(e) => commitField("content", e.target.value)}
          />
        </div>
      )}
      {fields.includes("href") && (
        <div className="field-row">
          <label htmlFor="f-href">Link (href)</label>
          <input id="f-href" type="text" defaultValue={firstResolved?.href ?? ""} onBlur={(e) => commitField("href", e.target.value)} />
        </div>
      )}
      {fields.includes("src") && (
        <div className="field-row">
          <label htmlFor="f-src">Image source URL</label>
          <input id="f-src" type="text" defaultValue={firstResolved?.src ?? ""} onBlur={(e) => commitField("src", e.target.value)} />
        </div>
      )}
      {fields.includes("alt") && (
        <div className="field-row">
          <label htmlFor="f-alt">Alt text</label>
          <input id="f-alt" type="text" defaultValue={firstResolved?.alt ?? ""} onBlur={(e) => commitField("alt", e.target.value)} />
        </div>
      )}
      {fields.includes("textColor") && (
        <div className="field-row">
          <label htmlFor="f-tc">Text color</label>
          <input id="f-tc" type="text" defaultValue={firstResolved?.textColor ?? "#1c1a17"} onBlur={(e) => commitField("textColor", e.target.value)} />
        </div>
      )}
      {fields.includes("backgroundColor") && (
        <div className="field-row">
          <label htmlFor="f-bg">Background color</label>
          <input id="f-bg" type="text" defaultValue={firstResolved?.backgroundColor ?? "#ffffff"} onBlur={(e) => commitField("backgroundColor", e.target.value)} />
        </div>
      )}
      {fields.includes("fontSize") && (
        <div className="field-row">
          <label htmlFor="f-fs">Font size (px)</label>
          <input id="f-fs" type="number" min={8} max={96} defaultValue={firstResolved?.fontSize ?? 16} onBlur={(e) => commitField("fontSize", Number(e.target.value))} />
        </div>
      )}
      {fields.includes("fontWeight") && (
        <div className="field-row">
          <label htmlFor="f-fw">Font weight</label>
          <select id="f-fw" defaultValue={firstResolved?.fontWeight ?? "normal"} onChange={(e) => commitField("fontWeight", e.target.value)}>
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
      )}
      {fields.includes("align") && (
        <div className="field-row">
          <label htmlFor="f-al">Alignment</label>
          <select id="f-al" defaultValue={firstResolved?.align ?? "left"} onChange={(e) => commitField("align", e.target.value)}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}
      {fields.includes("padding") && (
        <div className="field-row">
          <label htmlFor="f-pad">Padding (px)</label>
          <input id="f-pad" type="number" min={0} max={200} defaultValue={firstResolved?.padding ?? 24} onBlur={(e) => commitField("padding", Number(e.target.value))} />
        </div>
      )}
      {fields.includes("width") && (
        <div className="field-row">
          <label htmlFor="f-w">Width (%)</label>
          <input id="f-w" type="number" min={10} max={100} defaultValue={firstResolved?.width ?? 100} onBlur={(e) => commitField("width", Number(e.target.value))} />
        </div>
      )}
      {fields.includes("order") && (
        <div className="field-row">
          <label htmlFor="f-order">Order (structure)</label>
          <input id="f-order" type="number" defaultValue={firstResolved?.order ?? 0} onBlur={(e) => commitField("order", Number(e.target.value))} />
        </div>
      )}
      {fields.includes("hidden") && (
        <div className="field-row field-row-inline">
          <input
            id="f-hidden"
            type="checkbox"
            defaultChecked={firstResolved?.hidden ?? false}
            onChange={(e) => commitField("hidden", e.target.checked)}
          />
          <label htmlFor="f-hidden">Hidden in this scope</label>
        </div>
      )}

      {lastMessage && <div className={`msg ${lastMessage.includes("rejected") ? "warn" : "ok"}`}>{lastMessage}</div>}
    </div>
  );
}
