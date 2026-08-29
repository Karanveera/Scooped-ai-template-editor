import React from "react";
import { TemplateElement, TemplateModel, Viewport } from "../types";
import { resolveChildren, resolveElement } from "../state/resolve";

interface Props {
  element: TemplateElement;
  template: TemplateModel;
  viewport: Viewport;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  registerRef: (id: string, node: HTMLElement | null) => void;
}

export function ElementRenderer({ element, template, viewport, selectedIds, onSelect, registerRef }: Props) {
  const values = resolveElement(element, viewport);
  const isSelected = selectedIds.includes(element.id);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect(element.id, e.shiftKey || e.metaKey || e.ctrlKey);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(element.id, e.shiftKey);
    }
  }

  const wrapStyle: React.CSSProperties = {
    width: values.width ? `${values.width}%` : undefined
  };

  const commonProps = {
    className: `el-wrap${isSelected ? " selected" : ""}`,
    style: wrapStyle,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    tabIndex: 0,
    role: "button" as const,
    "aria-pressed": isSelected,
    "aria-label": `${element.type} element ${element.id}`,
    "data-el-label": `${element.type} \u00b7 ${element.id}`,
    ref: (node: HTMLElement | null) => registerRef(element.id, node)
  };

  if (element.type === "section") {
    const children = resolveChildren(template, element.id, viewport);
    return (
      <div
        {...commonProps}
        style={{ ...wrapStyle, backgroundColor: values.backgroundColor, padding: values.padding ?? 24 }}
      >
        {children.map((child) => (
          <ElementRenderer
            key={child.id}
            element={child}
            template={template}
            viewport={viewport}
            selectedIds={selectedIds}
            onSelect={onSelect}
            registerRef={registerRef}
          />
        ))}
      </div>
    );
  }

  if (element.type === "heading") {
    return (
      <h2
        {...commonProps}
        style={{
          ...wrapStyle,
          color: values.textColor,
          fontSize: values.fontSize,
          fontWeight: values.fontWeight === "bold" ? 700 : 400,
          textAlign: values.align,
          margin: "0 0 12px"
        }}
      >
        {values.content}
      </h2>
    );
  }

  if (element.type === "paragraph") {
    return (
      <p
        {...commonProps}
        style={{
          ...wrapStyle,
          color: values.textColor,
          fontSize: values.fontSize,
          textAlign: values.align,
          margin: "0 0 12px",
          lineHeight: 1.5
        }}
      >
        {values.content}
      </p>
    );
  }

  if (element.type === "button") {
    return (
      <div {...commonProps} style={{ ...wrapStyle, textAlign: values.align, margin: "0 0 12px" }}>
        <a
          href={values.href ?? "#"}
          onClick={(e) => e.preventDefault()}
          style={{
            display: "inline-block",
            color: values.textColor,
            backgroundColor: values.backgroundColor,
            fontSize: values.fontSize,
            padding: "10px 20px",
            borderRadius: 4,
            textDecoration: "none",
            fontWeight: 600
          }}
        >
          {values.content}
        </a>
      </div>
    );
  }

  if (element.type === "image") {
    return (
      <div {...commonProps} style={{ ...wrapStyle, textAlign: values.align, margin: "0 0 12px" }}>
        <img src={values.src} alt={values.alt ?? ""} style={{ width: "100%", borderRadius: 6, display: "block", margin: values.align === "center" ? "0 auto" : undefined }} />
      </div>
    );
  }

  return null;
}
