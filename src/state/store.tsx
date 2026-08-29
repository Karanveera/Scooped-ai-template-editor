import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createDefaultTemplate } from "../template/defaultTemplate";
import { commitEditCommand } from "./editPipeline";
import { buildRestoreCommand } from "./restore";
import { EditCommand, ElementCommitResult, HistoryEntry, TemplateModel, Viewport } from "../types";

const STORAGE_KEY = "scoped-ai-template-editor:v1";

interface PersistedShape {
  template: TemplateModel;
  history: HistoryEntry[];
}

function loadPersisted(): PersistedShape | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return null;
  }
}

function savePersisted(shape: PersistedShape) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shape));
  } catch {
    // Persistence is best-effort; the in-memory session still works.
  }
}

interface StoreState {
  template: TemplateModel;
  history: HistoryEntry[];
  selectedIds: string[];
  previewViewport: Viewport;
  lastCommitResults: ElementCommitResult[];
}

interface StoreApi extends StoreState {
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string, additive: boolean) => void;
  clearSelection: () => void;
  setPreviewViewport: (vp: Viewport) => void;
  runCommand: (command: EditCommand) => ElementCommitResult[];
  restoreEntry: (entry: HistoryEntry) => void;
  reset: () => void;
  historyForElement: (elementId: string) => HistoryEntry[];
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(() => {
    const persisted = loadPersisted();
    return {
      template: persisted?.template ?? createDefaultTemplate(),
      history: persisted?.history ?? [],
      selectedIds: [],
      previewViewport: "desktop",
      lastCommitResults: []
    };
  });

  const persist = useCallback((template: TemplateModel, history: HistoryEntry[]) => {
    savePersisted({ template, history });
  }, []);

  const runCommand = useCallback(
    (command: EditCommand): ElementCommitResult[] => {
      let results: ElementCommitResult[] = [];
      setState((prev) => {
        const commit = commitEditCommand(prev.template, command);
        results = commit.results;
        const newHistory = commit.historyEntries.length > 0 ? [...prev.history, ...commit.historyEntries] : prev.history;
        persist(commit.templateAfter, newHistory);
        return { ...prev, template: commit.templateAfter, history: newHistory, lastCommitResults: commit.results };
      });
      return results;
    },
    [persist]
  );

  const restoreEntry = useCallback(
    (entry: HistoryEntry) => {
      setState((prev) => {
        const command = buildRestoreCommand(prev.template, entry);
        if (!command) return prev;
        const commit = commitEditCommand(prev.template, command);
        const newHistory = commit.historyEntries.length > 0 ? [...prev.history, ...commit.historyEntries] : prev.history;
        persist(commit.templateAfter, newHistory);
        return { ...prev, template: commit.templateAfter, history: newHistory, lastCommitResults: commit.results };
      });
    },
    [persist]
  );

  const setSelectedIds = useCallback((ids: string[]) => {
    setState((prev) => ({ ...prev, selectedIds: ids }));
  }, []);

  const toggleSelected = useCallback((id: string, additive: boolean) => {
    setState((prev) => {
      if (!additive) {
        return { ...prev, selectedIds: prev.selectedIds.includes(id) && prev.selectedIds.length === 1 ? [] : [id] };
      }
      const exists = prev.selectedIds.includes(id);
      return { ...prev, selectedIds: exists ? prev.selectedIds.filter((x) => x !== id) : [...prev.selectedIds, id] };
    });
  }, []);

  const clearSelection = useCallback(() => setState((prev) => ({ ...prev, selectedIds: [] })), []);

  const setPreviewViewport = useCallback((vp: Viewport) => setState((prev) => ({ ...prev, previewViewport: vp })), []);

  const reset = useCallback(() => {
    const fresh = createDefaultTemplate();
    persist(fresh, []);
    setState({ template: fresh, history: [], selectedIds: [], previewViewport: "desktop", lastCommitResults: [] });
  }, [persist]);

  const historyForElement = useCallback(
    (elementId: string) => state.history.filter((h) => h.elementId === elementId).sort((a, b) => b.timestamp - a.timestamp),
    [state.history]
  );

  const api = useMemo<StoreApi>(
    () => ({
      ...state,
      setSelectedIds,
      toggleSelected,
      clearSelection,
      setPreviewViewport,
      runCommand,
      restoreEntry,
      reset,
      historyForElement
    }),
    [state, setSelectedIds, toggleSelected, clearSelection, setPreviewViewport, runCommand, restoreEntry, reset, historyForElement]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
