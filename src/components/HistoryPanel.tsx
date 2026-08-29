import React from "react";
import { useStore } from "../state/store";

export function HistoryPanel() {
  const { template, selectedIds, history, historyForElement, restoreEntry } = useStore();

  const relevantIds = selectedIds.length > 0 ? selectedIds : Object.keys(template.elements);
  const entries = relevantIds
    .flatMap((id) => historyForElement(id))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 40);

  return (
    <div>
      <h2>{selectedIds.length > 0 ? "History (selected element)" : "History (all elements)"}</h2>
      {entries.length === 0 && <p className="empty-note">No edits recorded yet. Manual and accepted AI edits appear here.</p>}
      {entries.map((entry) => (
        <div key={entry.historyId} className="history-item">
          <div className="meta">
            {new Date(entry.timestamp).toLocaleTimeString()} \u00b7 {entry.source} \u00b7 scope: {entry.viewportScope}
          </div>
          <div>
            <strong>{entry.elementId}</strong> \u2014 {entry.description}
          </div>
          <div style={{ color: "var(--muted)" }}>{JSON.stringify(entry.after)}</div>
          <button className="btn small secondary" style={{ marginTop: 4 }} onClick={() => restoreEntry(entry)}>
            Restore this element to before this edit
          </button>
        </div>
      ))}
      <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>
        Total history entries: {history.length}. Restoring one element/scope never changes other elements or other viewports.
      </p>
    </div>
  );
}
