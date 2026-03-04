"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSlideEditorStore } from "@/features/slide-editor/store";
import type { EditableSlideShape } from "@/features/slide-editor/store";
import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type { SlideShapeModel, TableModel, XmlNode, XmlValue } from "@/lib/slide-xml/types";

const RESIZE_HANDLE_SIZE = 10;

const FONT_OPTIONS = ["Montserrat", "Open Sans", "Noto Sans SC"] as const;
const COLOR_OPTIONS = [
  "rgba(17, 50, 100, 1)",
  "rgba(13, 116, 206, 1)",
  "rgba(239, 95, 0, 1)",
  "rgba(31, 35, 41, 1)",
  "rgba(100, 100, 100, 1)",
] as const;

type TextStyleState = {
  fontFamily: string;
  fontSize: number;
  color: string;
};

type ToolbarAnchor = {
  left: number;
  top: number;
};

type SlideShapeProps = {
  shape: EditableSlideShape | SlideShapeModel;
  viewportRef?: RefObject<HTMLDivElement | null>;
  interactive?: boolean;
};

function toPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function appendXmlChild(node: XmlNode, key: string, value: XmlValue): void {
  const current = node[key];
  if (current === undefined) {
    node[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    node[key] = [...current, value];
    return;
  }

  node[key] = [current, value];
}

function getFillColor(shapeNode: XmlNode): string | undefined {
  const fill = shapeNode.fill;
  if (!fill || typeof fill !== "object" || Array.isArray(fill)) {
    return undefined;
  }

  const fillNode = fill as XmlNode;
  const fillColor = fillNode.fillColor;
  if (!fillColor || typeof fillColor !== "object" || Array.isArray(fillColor)) {
    return undefined;
  }

  const fillColorNode = fillColor as XmlNode;
  const color = fillColorNode["@_color"];
  return typeof color === "string" ? color : undefined;
}

function getBorderColor(shapeNode: XmlNode): string | undefined {
  const border = shapeNode.border;
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return undefined;
  }

  const borderNode = border as XmlNode;
  const color = borderNode["@_color"];
  return typeof color === "string" ? color : undefined;
}

function getBorderWidth(shapeNode: XmlNode): number {
  const border = shapeNode.border;
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return 2;
  }

  const borderNode = border as XmlNode;
  const width = Number(borderNode["@_width"]);
  return Number.isFinite(width) && width > 0 ? width : 2;
}

function getShapeText(value: XmlValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => getShapeText(item)).join("");
  }

  const node = value as XmlNode;
  const ownText = typeof node["#text"] === "string" ? node["#text"] : "";
  const childrenText = Object.entries(node)
    .filter(([key]) => !key.startsWith("@_") && key !== "#text")
    .map(([, childValue]) => getShapeText(childValue as XmlValue))
    .join("");

  return `${ownText}${childrenText}`.trim();
}

function parseTableModel(contentNode: XmlValue | undefined): TableModel {
  if (!contentNode || typeof contentNode !== "object" || Array.isArray(contentNode)) {
    return { rows: [] };
  }

  const content = contentNode as XmlNode;
  const table = content.table;
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    return { rows: [] };
  }

  const tableNode = table as XmlNode;
  const rows = toArray(tableNode.row as XmlValue | XmlValue[] | undefined);

  const parsedRows = rows
    .map((row, rowIndex) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return null;
      }

      const rowNode = row as XmlNode;
      const cells = toArray(rowNode.cell as XmlValue | XmlValue[] | undefined);
      return {
        id: typeof rowNode["@_id"] === "string" ? rowNode["@_id"] : `row-${rowIndex + 1}`,
        cells: cells.map((cell, cellIndex) => {
          const text = getShapeText(cell).trim();
          if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
            return {
              id: `cell-${rowIndex + 1}-${cellIndex + 1}`,
              text,
            };
          }

          const cellNode = cell as XmlNode;
          return {
            id:
              typeof cellNode["@_id"] === "string"
                ? cellNode["@_id"]
                : `cell-${rowIndex + 1}-${cellIndex + 1}`,
            text,
          };
        }),
      };
    })
    .filter((row): row is TableModel["rows"][number] => Boolean(row && row.cells.length > 0));

  return { rows: parsedRows };
}

function normalizeColor(value: string): string {
  const rgbMatch = value.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, 1)`;
  }

  const rgbaMatch = value.match(/rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\)/i);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${rgbaMatch[4]})`;
  }

  return value;
}

function parseFontSize(styleValue: string): number | null {
  const calcMatch = styleValue.match(/calc\(var\(--slide-unit\)\s*\*\s*([\d.]+)\)/);
  if (calcMatch) {
    return Number(calcMatch[1]);
  }

  const pxMatch = styleValue.match(/([\d.]+)px/);
  if (pxMatch) {
    return Number(pxMatch[1]);
  }

  const numeric = Number(styleValue);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractFontFamily(value: string): string {
  const primary = value.split(",")[0]?.trim().replace(/^['\"]|['\"]$/g, "");
  if (!primary) {
    return FONT_OPTIONS[0];
  }

  if (FONT_OPTIONS.includes(primary as (typeof FONT_OPTIONS)[number])) {
    return primary;
  }

  return primary;
}

function readSelectionTextStyle(editableElement: HTMLDivElement): TextStyleState {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return {
      fontFamily: FONT_OPTIONS[0],
      fontSize: 16,
      color: "rgba(31, 35, 41, 1)",
    };
  }

  const range = selection.getRangeAt(0);
  if (!editableElement.contains(range.commonAncestorContainer)) {
    return {
      fontFamily: FONT_OPTIONS[0],
      fontSize: 16,
      color: "rgba(31, 35, 41, 1)",
    };
  }

  const element =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement ?? editableElement;

  const computed = window.getComputedStyle(element as Element);
  const parsedFontSize = Number.isFinite(Number(computed.fontSize.replace("px", "")))
    ? Number(computed.fontSize.replace("px", ""))
    : 16;

  return {
    fontFamily: extractFontFamily(computed.fontFamily),
    fontSize: Math.max(8, Math.round(parsedFontSize)),
    color: normalizeColor(computed.color),
  };
}

function applyStyleToSelection(
  editableElement: HTMLDivElement,
  apply: (style: CSSStyleDeclaration) => void,
): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  if (!editableElement.contains(range.commonAncestorContainer) || range.collapsed) {
    return false;
  }

  const span = document.createElement("span");
  apply(span.style);

  const fragment = range.extractContents();
  if (!fragment.hasChildNodes()) {
    return false;
  }

  span.appendChild(fragment);
  range.insertNode(span);

  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  selection.addRange(nextRange);

  return true;
}

function hasExpandedSelectionInside(editableElement: HTMLDivElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return editableElement.contains(range.commonAncestorContainer) && !range.collapsed;
}

function isCollapsedSelectionInside(editableElement: HTMLDivElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return editableElement.contains(range.commonAncestorContainer) && range.collapsed;
}

function restoreCollapsedSelection(
  editableElement: HTMLDivElement,
  savedRange: Range | null,
): boolean {
  if (!savedRange) {
    return false;
  }

  const container = savedRange.commonAncestorContainer;
  if (!editableElement.contains(container)) {
    return false;
  }

  const nextRange = savedRange.cloneRange();
  nextRange.collapse(true);
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  editableElement.focus();
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
}

function applyStyleToEntireContent(
  editableElement: HTMLDivElement,
  apply: (style: CSSStyleDeclaration) => void,
): void {
  apply(editableElement.style);
  const allDescendants = editableElement.querySelectorAll<HTMLElement>("*");
  for (const element of allDescendants) {
    apply(element.style);
  }
}

function insertStyledTextAtCaret(
  editableElement: HTMLDivElement,
  text: string,
  styleState: TextStyleState,
): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  if (!editableElement.contains(range.commonAncestorContainer) || !range.collapsed) {
    return false;
  }

  const span = document.createElement("span");
  span.style.fontFamily = styleState.fontFamily;
  span.style.fontSize = `calc(var(--slide-unit) * ${styleState.fontSize})`;
  span.style.color = styleState.color;
  span.textContent = text;

  range.insertNode(span);
  range.setStartAfter(span);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  return true;
}

function copyContentAttributes(contentNode: XmlValue | undefined): XmlNode {
  if (!contentNode || typeof contentNode !== "object" || Array.isArray(contentNode)) {
    return {};
  }

  const node = contentNode as XmlNode;
  const copied: XmlNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_")) {
      copied[key] = value;
    }
  }

  return copied;
}

function applyStyleAttributes(target: XmlNode, element: HTMLElement): void {
  if (element.style.color) {
    target["@_color"] = normalizeColor(element.style.color);
  }

  if (element.style.fontFamily) {
    target["@_fontFamily"] = extractFontFamily(element.style.fontFamily);
  }

  if (element.style.fontSize) {
    const parsed = parseFontSize(element.style.fontSize);
    if (parsed !== null) {
      target["@_fontSize"] = parsed;
    }
  }

  if (element.style.textAlign) {
    target["@_textAlign"] = element.style.textAlign;
  }
}

function elementToXmlNode(element: HTMLElement): XmlNode {
  const node: XmlNode = {};
  applyStyleAttributes(node, element);

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length > 0) {
        const currentText = node["#text"];
        node["#text"] = `${typeof currentText === "string" ? currentText : ""}${text}`;
      }
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const childElement = child as HTMLElement;
    const tagName = childElement.tagName.toLowerCase();

    if (tagName === "br") {
      const currentText = node["#text"];
      node["#text"] = `${typeof currentText === "string" ? currentText : ""}\n`;
      continue;
    }

    if (!["p", "span", "strong", "em", "u", "ul", "ol", "li"].includes(tagName)) {
      const flattened = elementToXmlNode(childElement);
      for (const [nestedKey, nestedValue] of Object.entries(flattened)) {
        appendXmlChild(node, nestedKey, nestedValue as XmlValue);
      }
      continue;
    }

    appendXmlChild(node, tagName, elementToXmlNode(childElement));
  }

  return node;
}

function contentHtmlToXmlNode(html: string, previousContent: XmlValue | undefined): XmlNode {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const wrapper = documentNode.body.firstElementChild as HTMLElement | null;

  const contentNode = copyContentAttributes(previousContent);
  if (!wrapper) {
    return contentNode;
  }

  const root =
    wrapper.childElementCount === 1 && wrapper.firstElementChild?.tagName.toLowerCase() === "div"
      ? (wrapper.firstElementChild as HTMLElement)
      : wrapper;

  applyStyleAttributes(contentNode, root);

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (!text) {
        continue;
      }

      appendXmlChild(contentNode, "p", { "#text": text });
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const childElement = child as HTMLElement;
    const tagName = childElement.tagName.toLowerCase();

    if (["p", "ul", "ol"].includes(tagName)) {
      appendXmlChild(contentNode, tagName, elementToXmlNode(childElement));
      continue;
    }

    const paragraphNode: XmlNode = {};
    appendXmlChild(paragraphNode, tagName, elementToXmlNode(childElement));
    appendXmlChild(contentNode, "p", paragraphNode);
  }

  if (toArray(contentNode.p as XmlValue | XmlValue[] | undefined).length === 0) {
    const fallbackText = root.textContent?.trim();
    if (fallbackText) {
      contentNode.p = { "#text": fallbackText };
    }
  }

  return contentNode;
}

export function SlideShape({ shape, viewportRef, interactive = false }: SlideShapeProps) {
  const selectedShapeId = useSlideEditorStore((state) => state.selectedShapeId);
  const editingShapeId = useSlideEditorStore((state) => state.editingShapeId);
  const selectShape = useSlideEditorStore((state) => state.selectShape);
  const setEditingShape = useSlideEditorStore((state) => state.setEditingShape);
  const updateShapePosition = useSlideEditorStore((state) => state.updateShapePosition);
  const updateShapeSize = useSlideEditorStore((state) => state.updateShapeSize);
  const updateShapeContent = useSlideEditorStore((state) => state.updateShapeContent);
  const updateTableCell = useSlideEditorStore((state) => state.updateTableCell);
  const addTableRow = useSlideEditorStore((state) => state.addTableRow);
  const removeTableRow = useSlideEditorStore((state) => state.removeTableRow);
  const addTableColumn = useSlideEditorStore((state) => state.addTableColumn);
  const removeTableColumn = useSlideEditorStore((state) => state.removeTableColumn);

  const editableRef = useRef<HTMLDivElement | null>(null);
  const shapeRef = useRef<HTMLDivElement | null>(null);

  const backgroundColor = useMemo(() => getFillColor(shape.rawNode), [shape.rawNode]);
  const borderColor = useMemo(() => getBorderColor(shape.rawNode), [shape.rawNode]);
  const borderWidth = useMemo(() => getBorderWidth(shape.rawNode), [shape.rawNode]);

  const isInteractive = interactive;
  const shapeId = "id" in shape ? shape.id : shape.attributes.id;
  const shapeType = shape.attributes.type;
  const isTableShape = shapeType === "table";
  const isEllipseShape = shapeType === "ellipse";
  const isLineShape = shapeType === "line";
  const isArrowShape = shapeType === "arrow";
  const isLineLikeShape = isLineShape || isArrowShape;
  const contentHtml =
    "contentHtml" in shape
      ? shape.contentHtml
      : shape.rawNode.content
        ? buildShapeContentHtml(shape.rawNode.content)
        : "";
  const hasRichTextContent = !isTableShape && contentHtml.length > 0;
  const tableModel = useMemo(() => parseTableModel(shape.rawNode.content), [shape.rawNode.content]);
  const arrowMarkerId = useMemo(
    () => `shape-arrow-${shapeId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [shapeId],
  );
  const isSelected = isInteractive && selectedShapeId === shapeId;
  const isEditing = isInteractive && editingShapeId === shapeId;
  const [textStyle, setTextStyle] = useState<TextStyleState>({
    fontFamily: FONT_OPTIONS[0],
    fontSize: 16,
    color: "rgba(31, 35, 41, 1)",
  });
  const [toolbarAnchor, setToolbarAnchor] = useState<ToolbarAnchor | null>(null);
  const draftTextStyleRef = useRef<TextStyleState | null>(null);
  const savedCollapsedRangeRef = useRef<Range | null>(null);

  const syncShapeContentFromDom = useCallback(() => {
    if (!isInteractive) {
      return;
    }

    const element = editableRef.current;
    if (!element) {
      return;
    }

    const html = element.innerHTML;
    const contentNode = contentHtmlToXmlNode(html, shape.rawNode.content);
    updateShapeContent(shapeId, html, contentNode);
  }, [isInteractive, shape.rawNode.content, shapeId, updateShapeContent]);

  useEffect(() => {
    const element = editableRef.current;
    if (!element) {
      return;
    }

    // When a new shape enters edit mode immediately after insertion, hydrate once.
    const shouldHydrateWhileEditing = isEditing && element.innerHTML.trim().length === 0;
    if (!isEditing || shouldHydrateWhileEditing) {
      element.innerHTML = contentHtml;
    }
  }, [contentHtml, isEditing]);

  useEffect(() => {
    if (!isInteractive || !isEditing) {
      return;
    }

    const onSelectionChange = () => {
      const element = editableRef.current;
      if (!element) {
        return;
      }
      const container = shapeRef.current;
      if (!container) {
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const isInside = element.contains(range.commonAncestorContainer);
        if (isInside && range.collapsed) {
          savedCollapsedRangeRef.current = range.cloneRange();
          setToolbarAnchor(null);
        } else if (isInside && !range.collapsed) {
          const rect = range.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          setToolbarAnchor({
            left: rect.left + rect.width / 2 - containerRect.left,
            top: rect.top - containerRect.top,
          });
        } else {
          setToolbarAnchor(null);
        }
      } else {
        setToolbarAnchor(null);
      }

      setTextStyle(readSelectionTextStyle(element));
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [isEditing, isInteractive]);

  const applyTextStyle = useCallback(
    (apply: (style: CSSStyleDeclaration) => void) => {
      const element = editableRef.current;
      if (!element) {
        return;
      }

      if (hasExpandedSelectionInside(element) && applyStyleToSelection(element, apply)) {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const container = shapeRef.current;
        if (range && container && element.contains(range.commonAncestorContainer)) {
          const rect = range.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          setToolbarAnchor({
            left: rect.left + rect.width / 2 - containerRect.left,
            top: rect.top - containerRect.top,
          });
        }
        setTextStyle(readSelectionTextStyle(element));
        draftTextStyleRef.current = null;
        syncShapeContentFromDom();
        return;
      }

      const draft = {
        fontFamily: textStyle.fontFamily,
        fontSize: textStyle.fontSize,
        color: textStyle.color,
      };

      const styleTarget = document.createElement("span").style;
      styleTarget.fontFamily = draft.fontFamily;
      styleTarget.fontSize = `calc(var(--slide-unit) * ${draft.fontSize})`;
      styleTarget.color = draft.color;
      apply(styleTarget);

      const nextDraft: TextStyleState = {
        fontFamily: styleTarget.fontFamily ? extractFontFamily(styleTarget.fontFamily) : draft.fontFamily,
        fontSize: styleTarget.fontSize ? parseFontSize(styleTarget.fontSize) ?? draft.fontSize : draft.fontSize,
        color: styleTarget.color ? normalizeColor(styleTarget.color) : draft.color,
      };

      if (!isCollapsedSelectionInside(element)) {
        restoreCollapsedSelection(element, savedCollapsedRangeRef.current);
      }

      applyStyleToEntireContent(element, apply);
      setToolbarAnchor(null);
      syncShapeContentFromDom();
      draftTextStyleRef.current = nextDraft;
      setTextStyle(nextDraft);
    },
    [syncShapeContentFromDom, textStyle.color, textStyle.fontFamily, textStyle.fontSize],
  );

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isEditing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectShape(shapeId);

    const viewportElement = viewportRef?.current;
    if (!viewportElement) {
      return;
    }

    const rect = viewportElement.getBoundingClientRect();
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = shape.attributes.topLeftX;
    const startY = shape.attributes.topLeftY;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - originX) / rect.width) * 960;
      const deltaY = ((moveEvent.clientY - originY) / rect.height) * 540;
      updateShapePosition(shapeId, startX + deltaX, startY + deltaY);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    selectShape(shapeId);

    const viewportElement = viewportRef?.current;
    if (!viewportElement) {
      return;
    }

    const rect = viewportElement.getBoundingClientRect();
    const originX = event.clientX;
    const originY = event.clientY;
    const startWidth = shape.attributes.width;
    const startHeight = shape.attributes.height;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaWidth = ((moveEvent.clientX - originX) / rect.width) * 960;
      const deltaHeight = ((moveEvent.clientY - originY) / rect.height) * 540;
      updateShapeSize(shapeId, startWidth + deltaWidth, startHeight + deltaHeight);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={shapeRef}
      className="absolute overflow-visible"
      style={{
        left: toPercent(shape.attributes.topLeftX, 960),
        top: toPercent(shape.attributes.topLeftY, 540),
        width: toPercent(shape.attributes.width, 960),
        height: toPercent(shape.attributes.height, 540),
        zIndex: "zIndex" in shape ? shape.zIndex : undefined,
      }}
      onPointerDown={isInteractive ? beginDrag : undefined}
    >
      <div
        className="h-full w-full overflow-hidden"
        style={{
          background: isLineLikeShape ? undefined : backgroundColor,
          borderRadius: isEllipseShape ? "9999px" : shape.style.borderRadius,
          border: !isLineLikeShape && borderColor ? `${borderWidth}px solid ${borderColor}` : undefined,
          outline: isSelected ? "2px solid rgba(14, 116, 244, 0.7)" : undefined,
          outlineOffset: isSelected ? "-1px" : undefined,
        }}
      >
        {isLineLikeShape ? (
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {isArrowShape ? (
              <defs>
                <marker
                  id={arrowMarkerId}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={borderColor ?? "rgba(13, 116, 206, 1)"} />
                </marker>
              </defs>
            ) : null}
            <line
              x1="2"
              y1="50"
              x2="98"
              y2="50"
              stroke={borderColor ?? "rgba(13, 116, 206, 1)"}
              strokeWidth={Math.max(1, borderWidth)}
              markerEnd={isArrowShape ? `url(#${arrowMarkerId})` : undefined}
            />
          </svg>
        ) : isTableShape ? (
          <div
            className="h-full w-full bg-white"
            onPointerDown={(event) => {
              if (!isInteractive) {
                return;
              }
              event.stopPropagation();
              selectShape(shapeId);
            }}
            onDoubleClick={(event) => {
              if (!isInteractive) {
                return;
              }
              event.stopPropagation();
              setEditingShape(shapeId);
            }}
          >
            <table className="h-full w-full table-fixed border-collapse">
              <tbody>
                {tableModel.rows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, cellIndex) => (
                      <td
                        key={cell.id}
                        className="border border-slate-300 align-top text-[calc(var(--slide-unit)*14)] text-slate-700"
                      >
                        {isInteractive && isEditing ? (
                          <textarea
                            value={cell.text}
                            className="h-full min-h-[calc(var(--slide-unit)*26)] w-full resize-none border-none bg-transparent px-2 py-1 text-[calc(var(--slide-unit)*14)] text-slate-700 outline-none"
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateTableCell(shapeId, rowIndex, cellIndex, event.currentTarget.value)
                            }
                          />
                        ) : (
                          <div className="min-h-[calc(var(--slide-unit)*26)] px-2 py-1">{cell.text || "\u00A0"}</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasRichTextContent ? (
          <div
            ref={editableRef}
            className="h-full w-full"
            contentEditable={isInteractive && isEditing}
            suppressContentEditableWarning
            onPointerDown={(event) => {
              if (!isInteractive) {
                return;
              }
              event.stopPropagation();
              selectShape(shapeId);
            }}
            onClick={(event) => {
              if (!isInteractive) {
                return;
              }
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              if (!isInteractive) {
                return;
              }
              event.stopPropagation();
              setEditingShape(shapeId);
            }}
            onInput={() => {
              if (!isInteractive) {
                return;
              }
              syncShapeContentFromDom();
            }}
            onBeforeInput={(event) => {
              if (!isInteractive || !isEditing) {
                return;
              }

              const draftStyle = draftTextStyleRef.current;
              if (!draftStyle) {
                return;
              }

              if (event.inputType !== "insertText" || !event.data) {
                return;
              }

              const element = editableRef.current;
              if (!element) {
                return;
              }

              if (!isCollapsedSelectionInside(element)) {
                restoreCollapsedSelection(element, savedCollapsedRangeRef.current);
              }

              if (!insertStyledTextAtCaret(element, event.data, draftStyle)) {
                return;
              }

              event.preventDefault();
              syncShapeContentFromDom();
            }}
            onBlur={() => {
              if (!isInteractive) {
                return;
              }
              syncShapeContentFromDom();
              draftTextStyleRef.current = null;
              savedCollapsedRangeRef.current = null;
              setEditingShape(null);
            }}
          />
        ) : null}
      </div>

      {isSelected && hasRichTextContent ? (
        <TextFormatToolbar
          anchor={toolbarAnchor}
          textStyle={textStyle}
          onApplyFont={(fontFamily) => {
            applyTextStyle((style) => {
              style.fontFamily = fontFamily;
            });
          }}
          onApplyFontSize={(fontSize) => {
            applyTextStyle((style) => {
              style.fontSize = `calc(var(--slide-unit) * ${fontSize})`;
            });
          }}
          onApplyColor={(color) => {
            applyTextStyle((style) => {
              style.color = color;
            });
          }}
        />
      ) : null}

      {isSelected && isTableShape ? (
        <div
          className="absolute z-40 -translate-x-1/2 -translate-y-full"
          style={{ left: "50%", top: -12 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-1 rounded-2xl border border-slate-300 bg-white px-2 py-1 shadow-[0_4px_18px_rgba(15,23,42,0.12)]">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => addTableRow(shapeId)}
            >
              + 行
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => removeTableRow(shapeId)}
            >
              - 行
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => addTableColumn(shapeId)}
            >
              + 列
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => removeTableColumn(shapeId)}
            >
              - 列
            </button>
          </div>
        </div>
      ) : null}

      {isSelected ? (
        <div
          className="absolute rounded-sm border border-white bg-sky-500 shadow-[0_0_0_1px_rgba(14,116,244,0.6)]"
          style={{
            right: -(RESIZE_HANDLE_SIZE / 2),
            bottom: -(RESIZE_HANDLE_SIZE / 2),
            width: RESIZE_HANDLE_SIZE,
            height: RESIZE_HANDLE_SIZE,
            cursor: "nwse-resize",
          }}
          onPointerDown={beginResize}
        />
      ) : null}
    </div>
  );
}

type TextFormatToolbarProps = {
  anchor: ToolbarAnchor | null;
  textStyle: TextStyleState;
  onApplyFont: (fontFamily: string) => void;
  onApplyFontSize: (fontSize: number) => void;
  onApplyColor: (color: string) => void;
};

function TextFormatToolbar({
  anchor,
  textStyle,
  onApplyFont,
  onApplyFontSize,
  onApplyColor,
}: TextFormatToolbarProps) {
  return (
    <div
      className="absolute z-40 -translate-x-1/2 -translate-y-full"
      style={
        anchor
          ? {
              left: anchor.left,
              top: anchor.top - 8,
            }
          : {
              left: "50%",
              top: -12,
            }
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-max items-center gap-2 rounded-2xl border border-slate-300 bg-white px-2 py-1.5 shadow-[0_4px_18px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyFont(font)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                textStyle.fontFamily === font
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {font}
            </button>
          ))}
        </div>

        <div className="flex h-8 items-center rounded-xl border border-slate-300">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFontSize(Math.max(8, textStyle.fontSize - 1))}
            className="grid h-8 w-8 place-items-center rounded-l-xl text-slate-700 hover:bg-slate-100"
          >
            -
          </button>
          <span className="w-10 text-center text-sm font-medium text-slate-800">{textStyle.fontSize}</span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFontSize(Math.min(96, textStyle.fontSize + 1))}
            className="grid h-8 w-8 place-items-center rounded-r-xl text-slate-700 hover:bg-slate-100"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyColor(color)}
              className="h-6 w-6 rounded-full border border-slate-200"
              style={{
                backgroundColor: color,
                boxShadow: textStyle.color === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
