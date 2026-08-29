import React, { useState } from "react";
import { useStore } from "../state/store";
import { EXAMPLE_INSTRUCTIONS, runScenario, ScenarioProposal } from "../ai/scenarioEngine";
import { PropertyValues, ViewportScope } from "../types";
import { resolveElement } from "../state/resolve";

type ProposalStatus = "pending" | "accepted" | "rejected" | "stale" | "invalid";

interface ReviewItem extends ScenarioProposal {
  status: ProposalStatus;
  reason?: string;
  baseRevision: number;
  before: Partial<PropertyValues>;
}

const SCOPES: ViewportScope[] = ["all", "desktop", "tablet", "mobile"];

export function AIDemoPanel() {
  const { template, selectedIds, previewViewport, runCommand } = useStore();
  const [instruction, setInstruction] = useState("");
  const [scope, setScope] = useState<ViewportScope>("all");
  const [failure, setFailure] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [authorizedIds, setAuthorizedIds] = useState<string[]>([]);

  function runDemo() {
    const selectedElements = selectedIds.map((id) => template.elements[id]).filter(Boolean);
    const outcome = runScenario({ instruction, selected: selectedElements, viewportScope: scope });
    if (!outcome.ok) {
      setFailure(outcome.reason);
      setLabel(null);
      setItems([]);
      return;
    }
    setFailure(null);
    setLabel(outcome.match.label);
    setAuthorizedIds(selectedElements.map((e) => e.id));
    const fallbackVp = scope === "all" ? previewViewport : scope;
    setItems(
      outcome.match.proposals.map((p) => {
        const el = template.elements[p.elementId];
        const resolved = resolveElement(el, fallbackVp);
        const before: Partial<PropertyValues> = {};
        (Object.keys(p.changes) as (keyof PropertyValues)[]).forEach((k) => {
          (before as Record<string, unknown>)[k] = (resolved as Record<string, unknown>)[k];
        });
        return { ...p, status: "pending", baseRevision: el.revision, before };
      })
    );
  }

  function decide(index: number, decision: "accept" | "reject") {
    setItems((prev) => {
      const item = prev[index];
      if (decision === "reject") {
        return prev.map((it, i) => (i === index ? { ...it, status: "rejected" } : it));
      }
      const results = runCommand({
        source: "ai",
        viewportScope: scope,
        authorizedIds,
        description: `AI demo: ${label ?? "proposal"} \u2014 "${instruction}"`,
        elementChanges: [{ elementId: item.elementId, baseRevision: item.baseRevision, changes: item.changes }]
      });
      const result = results[0];
      const status: ProposalStatus = (result?.status as ProposalStatus) ?? "invalid";
      return prev.map((it, i) => (i === index ? { ...it, status, reason: result?.reason } : it));
    });
  }

  function acceptAll() {
    items.forEach((item, i) => {
      if (item.status === "pending") decide(i, "accept");
    });
  }

  return (
    <div>
      <h2>AI demo (deterministic)</h2>
      <div className="field-row">
        <label htmlFor="ai-instruction">Instruction</label>
        <textarea
          id="ai-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. make the text blue"
          rows={2}
        />
      </div>
      <div className="scope-picker" role="radiogroup" aria-label="AI edit viewport scope">
        {SCOPES.map((s) => (
          <button key={s} role="radio" aria-pressed={scope === s} onClick={() => setScope(s)}>
            {s === "all" ? "All views" : s}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>
        {selectedIds.length === 0 ? "No elements selected." : `Targets: ${selectedIds.join(", ")}`}
      </p>
      <button className="btn accent" onClick={runDemo} disabled={instruction.trim().length === 0}>
        Run AI demo
      </button>

      {failure && <div className="msg err">{failure}</div>}

      {items.length > 0 && (
        <>
          <h2>{label}</h2>
          {items.map((item, i) => (
            <div key={item.elementId} className={`proposal-card status-${item.status === "pending" ? "pending" : item.status === "accepted" ? "accepted" : "rejected"}`}>
              <strong style={{ fontSize: 12 }}>{item.elementId}</strong>
              <div className="diff">
                <span className="before">{JSON.stringify(item.before)}</span>
                <span>\u2192</span>
                <span className="after">{JSON.stringify(item.changes)}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.explanation}</div>
              {item.status === "pending" && (
                <div className="actions">
                  <button className="btn small" onClick={() => decide(i, "accept")}>
                    Accept
                  </button>
                  <button className="btn small secondary" onClick={() => decide(i, "reject")}>
                    Reject
                  </button>
                </div>
              )}
              {item.status !== "pending" && (
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                  {item.status === "accepted" && "Accepted \u2713"}
                  {item.status === "rejected" && "Rejected"}
                  {item.status === "stale" && `Stale \u2014 ${item.reason}`}
                  {item.status === "invalid" && `Invalid \u2014 ${item.reason}`}
                </div>
              )}
            </div>
          ))}
          {items.some((it) => it.status === "pending") && (
            <button className="btn small" onClick={acceptAll}>
              Accept all pending
            </button>
          )}
        </>
      )}

      <h2>Example instructions</h2>
      {EXAMPLE_INSTRUCTIONS.map((ex) => (
        <button
          key={ex.instruction}
          className="example-instruction"
          onClick={() => {
            setInstruction(ex.instruction);
          }}
        >
          <strong>{ex.label}:</strong> "{ex.instruction}"
          <span className="hint">{ex.hint}</span>
        </button>
      ))}
    </div>
  );
}
