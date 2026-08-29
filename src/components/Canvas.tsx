import React, { useCallback, useRef, useState } from "react";
import { useStore } from "../state/store";
import { resolveRoots } from "../state/resolve";
import { ElementRenderer } from "./ElementRenderer";
import { Viewport } from "../types";

const VIEWPORTS: { key: Viewport; label: string }[] = [
  { key: "desktop", label: "Desktop \u00b7 1440px" },
  { key: "tablet", label: "Tablet \u00b7 768px" },
  { key: "mobile", label: "Mobile \u00b7 375px" }
];

export function Canvas() {
  const { template, previewViewport, setPreviewViewport, selectedIds, setSelectedIds, toggleSelected, clearSelection } = useStore();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const registerRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const roots = resolveRoots(template, previewViewport);

  function handleBackgroundMouseDown(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return; // only start marquee on empty canvas space
    const rect = frameRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + frameRef.current!.scrollLeft;
    const y = e.clientY - rect.top + frameRef.current!.scrollTop;
    dragStart.current = { x, y };
    setMarquee({ x0: x, y0: y, x1: x, y1: y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragStart.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + frameRef.current.scrollLeft;
    const y = e.clientY - rect.top + frameRef.current.scrollTop;
    setMarquee({ x0: dragStart.current.x, y0: dragStart.current.y, x1: x, y1: y });
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!dragStart.current || !marquee || !frameRef.current) {
      dragStart.current = null;
      return;
    }
    const box = {
      left: Math.min(marquee.x0, marquee.x1),
      right: Math.max(marquee.x0, marquee.x1),
      top: Math.min(marquee.y0, marquee.y1),
      bottom: Math.max(marquee.y0, marquee.y1)
    };
    const moved = Math.abs(marquee.x1 - marquee.x0) > 4 || Math.abs(marquee.y1 - marquee.y0) > 4;
    if (moved) {
      const frameRect = frameRef.current.getBoundingClientRect();
      const hits: string[] = [];
      nodeRefs.current.forEach((node, id) => {
        const r = node.getBoundingClientRect();
        const nodeBox = {
          left: r.left - frameRect.left + frameRef.current!.scrollLeft,
          right: r.right - frameRect.left + frameRef.current!.scrollLeft,
          top: r.top - frameRect.top + frameRef.current!.scrollTop,
          bottom: r.bottom - frameRect.top + frameRef.current!.scrollTop
        };
        const intersects = nodeBox.left < box.right && nodeBox.right > box.left && nodeBox.top < box.bottom && nodeBox.bottom > box.top;
        if (intersects) hits.push(id);
      });
      setSelectedIds(hits);
    } else {
      clearSelection();
    }
    dragStart.current = null;
    setMarquee(null);
  }

  return (
    <div className="canvas-area">
      <div className="viewport-switcher" role="tablist" aria-label="Preview viewport">
        {VIEWPORTS.map((v) => (
          <button key={v.key} role="tab" aria-pressed={previewViewport === v.key} onClick={() => setPreviewViewport(v.key)}>
            {v.label}
          </button>
        ))}
      </div>
      <div
        ref={frameRef}
        className={`canvas-frame ${previewViewport}`}
        style={{ height: 640 }}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {roots.map((root) => (
          <ElementRenderer
            key={root.id}
            element={root}
            template={template}
            viewport={previewViewport}
            selectedIds={selectedIds}
            onSelect={toggleSelected}
            registerRef={registerRef}
          />
        ))}
        {marquee && (
          <div
            className="marquee-box"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0)
            }}
          />
        )}
      </div>
      <div className="canvas-frame-label">
        {selectedIds.length === 0 ? "Click an element to select it. Shift/Cmd-click or drag to select a group." : `${selectedIds.length} element(s) selected`}
      </div>
    </div>
  );
}
