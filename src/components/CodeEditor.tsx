import React, { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { PropertyValues, TemplateElement, ViewportScope } from "../types";

interface EditableShape {
  base: PropertyValues;
  overrides: TemplateElement["overrides"];
}

function diffKeys(a: Partial<PropertyValues>, b: Partial<PropertyValues>): (keyof PropertyValues)[] {
  const keys = new Set<keyof PropertyValues>([...(Object.keys(a) as (keyof PropertyValues)[]), ...(Object.keys(b) as (keyof PropertyValues)[])]);
  return Array.from(keys).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

export function CodeEditor() {
  const { template, selectedIds, runCommand } = useStore();
  const [mode, setMode] = useState<"element" | "template">("element");
  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const element = singleId ? template.elements[singleId] : null;

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  useEffect(() => {
    if (element) {
      const shape: EditableShape = { base: element.base, overrides: element.overrides };
      setText(JSON.stringify(shape, null, 2));
      setError(null);
      setOkMessage(null);
    }
  }, [element?.id, element?.revision]);

  function applyCode() {
    if (!element) return;
    let parsed: EditableShape;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}. Last valid state was kept.`);
      setOkMessage(null);
      return;
    }
    if (typeof parsed !== "object" || parsed === null || typeof parsed.base !== "object") {
      setError("Expected an object with a 'base' field. Last valid state was kept.");
      return;
    }

    const scopesToCommit: { scope: ViewportScope; changes: Partial<PropertyValues> }[] = [];
    const baseDiff = diffKeys(element.base, parsed.base ?? {});
    if (baseDiff.length > 0) {
      const changes: Partial<PropertyValues> = {};
      baseDiff.forEach((k) => ((changes as Record<string, unknown>)[k] = (parsed.base as Record<string, unknown>)[k]));
      scopesToCommit.push({ scope: "all", changes });
    }
    (["desktop", "tablet", "mobile"] as const).forEach((vp) => {
      const currentOverride = element.overrides[vp] ?? {};
      const nextOverride = parsed.overrides?.[vp] ?? {};
      const d = diffKeys(currentOverride, nextOverride);
      if (d.length > 0) {
        const changes: Partial<PropertyValues> = {};
        d.forEach((k) => ((changes as Record<string, unknown>)[k] = (nextOverride as Record<string, unknown>)[k]));
        scopesToCommit.push({ scope: vp, changes });
      }
    });

    if (scopesToCommit.length === 0) {
      setOkMessage("No changes detected.");
      setError(null);
      return;
    }

    let anyRejected = false;
    let anyAccepted = false;
    for (const { scope, changes } of scopesToCommit) {
      const results = runCommand({
        source: "code",
        viewportScope: scope,
        authorizedIds: [element.id],
        description: `Code edit (${scope})`,
        elementChanges: [{ elementId: element.id, baseRevision: template.elements[element.id].revision, changes }]
      });
      results.forEach((r) => {
        if (r.status === "accepted") anyAccepted = true;
        else anyRejected = true;
      });
    }

    if (anyRejected && !anyAccepted) {
      setError("Code edit was rejected by validation. Last valid state was kept — check field names and value types against the schema.");
    } else if (anyRejected) {
      setError("Some fields were rejected by validation; valid fields were applied.");
    } else {
      setError(null);
      setOkMessage("Applied.");
    }
  }

  if (mode === "template") {
    return (
      <div>
        <div className="chip-row" style={{ marginBottom: 8 }}>
          <button className="chip active" onClick={() => setMode("template")}>
            Whole template
          </button>
          <button className="chip" onClick={() => setMode("element")}>
            Selected element
          </button>
        </div>
        <p className="empty-note">Read-only view of the canonical state every surface writes to.</p>
        <textarea className="code-editor" readOnly value={JSON.stringify(template, null, 2)} style={{ minHeight: 360 }} />
      </div>
    );
  }

  if (!element) {
    return (
      <div>
        <div className="chip-row" style={{ marginBottom: 8 }}>
          <button className="chip active">Selected element</button>
          <button className="chip" onClick={() => setMode("template")}>
            Whole template
          </button>
        </div>
        <p className="empty-note">Select exactly one element to edit its code. (Code editing is scoped to one element at a time.)</p>
      </div>
    );
  }

  return (
    <div>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        <button className="chip active">Selected element</button>
        <button className="chip" onClick={() => setMode("template")}>
          Whole template
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Editing <strong>{element.id}</strong> ({element.type}) \u2014 revision {element.revision}
      </p>
      <textarea className="code-editor" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Element JSON editor" />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={applyCode}>
          Apply code edit
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            setText(JSON.stringify({ base: element.base, overrides: element.overrides }, null, 2));
            setError(null);
            setOkMessage(null);
          }}
        >
          Revert to current
        </button>
      </div>
      {error && <div className="msg err">{error}</div>}
      {okMessage && !error && <div className="msg ok">{okMessage}</div>}
    </div>
  );
}
