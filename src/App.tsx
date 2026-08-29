import React from "react";
import { useStore } from "./state/store";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { CodeEditor } from "./components/CodeEditor";
import { AIDemoPanel } from "./components/AIDemoPanel";
import { HistoryPanel } from "./components/HistoryPanel";

export function App() {
  const { reset, template } = useStore();

  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>Scoped AI Template Editor</h1>
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {template.name} \u00b7 rev {template.revision}
        </span>
        <div className="spacer" />
        <button
          onClick={() => {
            if (window.confirm("Reset the template and clear all history? This cannot be undone.")) reset();
          }}
        >
          Reset template
        </button>
      </div>
      <div className="main-grid">
        <div className="panel">
          <Inspector />
          <h2>Code</h2>
          <CodeEditor />
        </div>
        <Canvas />
        <div className="panel">
          <AIDemoPanel />
          <HistoryPanel />
        </div>
      </div>
    </div>
  );
}
