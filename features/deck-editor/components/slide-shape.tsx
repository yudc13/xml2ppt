"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BrushCleaning,
  ChevronDown,
  List,
  ListOrdered,
  Minus,
  Palette,
  Plus,
  Sparkles,
} from "lucide-react";

import { useSlideEditorStore } from "@/features/slide-editor/store";
import type { EditableSlideShape } from "@/features/slide-editor/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type { SlideShapeModel, TableModel, XmlNode, XmlValue } from "@/lib/slide-xml/types";
import type { AiShapeContext, AiShapeEditResponse } from "@/lib/ai/types";
import { createId } from "@/lib/utils";

import { ToolbarManager } from "./toolbars/toolbar-manager";
import {
  ALIGN_OPTIONS,
  BORDER_STYLE_OPTIONS,
  COLOR_OPTIONS,
  FONT_OPTIONS,
  LIST_OPTIONS,
  SHAPE_BORDER_OPTIONS,
  SHAPE_FILL_OPTIONS,
  THEME_COLOR_OPTIONS,
} from "./toolbars/types";
import type { TextStyleState } from "./toolbars/types";

const SLIDE_BASE_WIDTH = 960;
const SLIDE_BASE_HEIGHT = 540;
const TOOLBAR_GAP = 12;
const TOOLBAR_PORTAL_Z_INDEX = 50;
const CONTROL_OVERLAY_Z_INDEX = 40;
const ROTATE_HANDLE_OFFSET = 40;
const HANDLE_EDGE_THRESHOLD = 40;
const SNAP_THRESHOLD = 5;
const ROTATION_SNAP_DEGREES = 15;
const MIN_SHAPE_SIZE = 12;
const RESIZE_HANDLE_SIZE = 8;
const HANDLE_HIT_SIZE = 24;

type RotationIndicator = {
  angle: number;
  left: number | string;
  top: number | string;
};

type SlideShapeProps = {
  shape: EditableSlideShape | SlideShapeModel;
  viewportRef?: RefObject<HTMLDivElement | null>;
  interactive?: boolean;
};

function toPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

function toDegrees(radian: number): number {
  return (radian * 180) / Math.PI;
}

function isSameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }

  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function getTopToolbarPortalStyle(params: {
  viewportRect: DOMRect | null;
  shape: { x: number; y: number; width: number };
}): CSSProperties | null {
  const { viewportRect, shape } = params;
  if (!viewportRect) {
    return null;
  }

  const scaleX = viewportRect.width / SLIDE_BASE_WIDTH;
  const scaleY = viewportRect.height / SLIDE_BASE_HEIGHT;

  return {
    position: "fixed",
    left: viewportRect.left + (shape.x + shape.width / 2) * scaleX,
    top: viewportRect.top + shape.y * scaleY - TOOLBAR_GAP,
    transform: "translate(-50%, -100%)",
    zIndex: TOOLBAR_PORTAL_Z_INDEX,
  };
}

function getSelectionToolbarPortalStyle(selectionRect: DOMRect | null): CSSProperties | null {
  if (!selectionRect) {
    return null;
  }

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const targetLeft = selectionRect.left + selectionRect.width / 2;
  const clampedLeft = viewportWidth > 0 ? Math.min(Math.max(targetLeft, 24), viewportWidth - 24) : targetLeft;
  const targetTop = Math.max(12, selectionRect.top - TOOLBAR_GAP);

  return {
    position: "fixed",
    left: clampedLeft,
    top: targetTop,
    transform: "translate(-50%, -100%)",
    zIndex: TOOLBAR_PORTAL_Z_INDEX,
  };
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

function getBorderStyle(shapeNode: XmlNode): "solid" | "dashed" | "dotted" {
  const border = shapeNode.border;
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return "solid";
  }

  const borderNode = border as XmlNode;
  const style = borderNode["@_style"];
  if (style === "dashed" || style === "dotted") {
    return style;
  }

  return "solid";
}

function getImageSource(shapeNode: XmlNode): string | null {
  const src = shapeNode["@_src"];
  return typeof src === "string" && src.length > 0 ? src : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getImageCrop(shapeNode: XmlNode): {
  type: string;
  leftOffset: number;
  rightOffset: number;
  topOffset: number;
  bottomOffset: number;
  presetHandlers: number;
} {
  const cropValue = shapeNode.crop;
  if (!cropValue || typeof cropValue !== "object" || Array.isArray(cropValue)) {
    return {
      type: "none",
      leftOffset: 0,
      rightOffset: 0,
      topOffset: 0,
      bottomOffset: 0,
      presetHandlers: 0,
    };
  }

  const cropNode = cropValue as XmlNode;
  return {
    type: typeof cropNode["@_type"] === "string" ? cropNode["@_type"] : "none",
    leftOffset: toFiniteNumber(cropNode["@_leftOffset"]),
    rightOffset: toFiniteNumber(cropNode["@_rightOffset"]),
    topOffset: toFiniteNumber(cropNode["@_topOffset"]),
    bottomOffset: toFiniteNumber(cropNode["@_bottomOffset"]),
    presetHandlers: toFiniteNumber(cropNode["@_presetHandlers"]),
  };
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

function buildTableContentNode(table: TableModel): XmlNode {
  return {
    table: {
      row: table.rows.map((row) => ({
        "@_id": row.id,
        cell: row.cells.map((cell) => ({
          "@_id": cell.id,
          "#text": cell.text,
        })),
      })),
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTableContextHtml(table: TableModel): string {
  if (!table.rows.length) {
    return "";
  }

  const rows = table.rows
    .map((row) => `<tr>${row.cells.map((cell) => `<td>${escapeHtml(cell.text)}</td>`).join("")}</tr>`)
    .join("");

  return `<table>${rows}</table>`;
}

function buildTableModelFromAi(
  tableData: AiShapeEditResponse["tableData"],
  previous: TableModel,
): TableModel | null {
  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    return null;
  }

  const rows = tableData.rows.map((row, rowIndex) => {
    const previousRow = previous.rows[rowIndex];
    const rowId = previousRow?.id ?? createId(`row-${rowIndex + 1}`);
    const cells = row.cells.map((cellText, cellIndex) => {
      const previousCell = previousRow?.cells[cellIndex];
      return {
        id: previousCell?.id ?? createId(`cell-${rowIndex + 1}-${cellIndex + 1}`),
        text: cellText,
      };
    });

    return { id: rowId, cells };
  });

  return { rows };
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
  const scaledCalcMatch = styleValue.match(
    /calc\(var\(--slide-unit\)\s*\*\s*var\(--slide-font-scale,\s*[\d.]+\)\s*\*\s*([\d.]+)\)/,
  );
  if (scaledCalcMatch) {
    return Number(scaledCalcMatch[1]);
  }

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

function parsePixelValue(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLineHeightPx(computed: CSSStyleDeclaration): number {
  const parsedLineHeight = parsePixelValue(computed.lineHeight);
  if (parsedLineHeight && parsedLineHeight > 0) {
    return parsedLineHeight;
  }

  const parsedFontSize = parsePixelValue(computed.fontSize);
  if (parsedFontSize && parsedFontSize > 0) {
    return parsedFontSize * 1.25;
  }

  return 20;
}

function extractFontFamily(value: string): string {
  const primary = value.split(",")[0]?.trim().replace(/^['\"]|['\"]$/g, "");
  if (!primary) {
    return FONT_OPTIONS[0];
  }

  // Handle CSS variables from Next.js fonts
  if (primary === "var(--font-montserrat)") return "Montserrat";
  if (primary === "var(--font-open-sans)") return "Open Sans";

  if (FONT_OPTIONS.includes(primary as (typeof FONT_OPTIONS)[number])) {
    return primary;
  }

  return primary;
}

function toTextStyleFromComputedStyle(computed: CSSStyleDeclaration, slideUnitPx: number): TextStyleState {
  const parsedFontSize = Number.isFinite(Number(computed.fontSize.replace("px", "")))
    ? Number(computed.fontSize.replace("px", ""))
    : 16;
  const safeSlideUnit = Number.isFinite(slideUnitPx) && slideUnitPx > 0 ? slideUnitPx : 1;
  const computedAlign = computed.textAlign.toLowerCase();
  const textAlign: TextStyleState["textAlign"] =
    computedAlign === "center" ? "center" : computedAlign === "right" || computedAlign === "end" ? "right" : "left";

  return {
    fontFamily: extractFontFamily(computed.fontFamily),
    fontSize: Math.max(8, Math.round(parsedFontSize / safeSlideUnit)),
    color: normalizeColor(computed.color),
    textAlign,
    listType: "none",
  };
}

function resolveSelectionAnchor(editableElement: HTMLDivElement): Element {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return editableElement;
  }

  const range = selection.getRangeAt(0);
  if (!editableElement.contains(range.commonAncestorContainer)) {
    return editableElement;
  }

  if (range.startContainer instanceof Element) {
    return range.startContainer;
  }

  return range.startContainer.parentElement ?? editableElement;
}

function readListType(editableElement: HTMLDivElement): TextStyleState["listType"] {
  const anchor = resolveSelectionAnchor(editableElement);
  const listParent = anchor.closest("ol, ul");
  if (!listParent || !editableElement.contains(listParent)) {
    return "none";
  }

  return listParent.tagName.toLowerCase() === "ol" ? "ordered" : "unordered";
}

function resolveTextStyleTarget(editableElement: HTMLDivElement): Element {
  const styledTarget = editableElement.querySelector<HTMLElement>("[style*='font-size']");
  if (styledTarget) {
    return styledTarget;
  }

  return editableElement.querySelector("span, strong, em, p, li, div") ?? editableElement.firstElementChild ?? editableElement;
}

function resolveTextStyleTargetFromAnchor(anchor: Element, editableElement: HTMLDivElement): Element {
  const anchorElement = anchor as HTMLElement;
  if (anchorElement.style?.fontSize) {
    return anchorElement;
  }

  const descendantWithFontSize = anchorElement.querySelector<HTMLElement>("[style*='font-size']");
  if (descendantWithFontSize) {
    return descendantWithFontSize;
  }

  const ancestorWithFontSize = anchorElement.closest("[style*='font-size']");
  if (ancestorWithFontSize && editableElement.contains(ancestorWithFontSize)) {
    return ancestorWithFontSize;
  }

  return resolveTextStyleTarget(editableElement);
}

function readSelectionTextStyle(editableElement: HTMLDivElement, slideUnitPx = 1): TextStyleState {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    const computed = window.getComputedStyle(resolveTextStyleTarget(editableElement));
    return {
      ...toTextStyleFromComputedStyle(computed, slideUnitPx),
      listType: readListType(editableElement),
    };
  }

  const range = selection.getRangeAt(0);
  if (!editableElement.contains(range.commonAncestorContainer)) {
    const computed = window.getComputedStyle(resolveTextStyleTarget(editableElement));
    return {
      ...toTextStyleFromComputedStyle(computed, slideUnitPx),
      listType: readListType(editableElement),
    };
  }

  const element =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement ?? editableElement;

  const targetElement = resolveTextStyleTargetFromAnchor(element as Element, editableElement);
  const computed = window.getComputedStyle(targetElement);
  return {
    ...toTextStyleFromComputedStyle(computed, slideUnitPx),
    listType: readListType(editableElement),
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

function executeTextCommand(editableElement: HTMLDivElement, command: string): boolean {
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  if (!selection.rangeCount || !editableElement.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    editableElement.focus();
  }

  return document.execCommand(command);
}

function placeCaretAtEnd(editableElement: HTMLDivElement): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editableElement);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
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
  span.style.fontSize = `calc(var(--slide-unit) * var(--slide-font-scale, 1) * ${styleState.fontSize})`;
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

function normalizePlainText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractPlainTextFromHtml(html: string): string {
  if (!html) {
    return "";
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const wrapper = documentNode.body.firstElementChild as HTMLElement | null;
  if (!wrapper) {
    return "";
  }

  return normalizePlainText(wrapper.textContent ?? "");
}

function stripTrailingEmptyNodes(container: HTMLElement): void {
  let node: ChildNode | null = container.lastChild;

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent || node.textContent.trim().length === 0) {
        const prev = node.previousSibling;
        node.remove();
        node = prev;
        continue;
      }
      break;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const text = element.textContent?.trim() ?? "";
      const hasNonTextChild = Boolean(element.querySelector("img, table, svg, video"));
      const isEmptyBlock = text.length === 0 && !hasNonTextChild;

      if (isEmptyBlock && (tag === "br" || tag === "div" || tag === "p" || tag === "span")) {
        const prev = node.previousSibling;
        element.remove();
        node = prev;
        continue;
      }
    }

    break;
  }
}

function hasTrailingEmptyBlock(container: HTMLElement): boolean {
  let node: ChildNode | null = container.lastChild;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent || node.textContent.trim().length === 0) {
        node = node.previousSibling;
        continue;
      }
      return false;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const text = element.textContent?.trim() ?? "";
      const hasNonTextChild = Boolean(element.querySelector("img, table, svg, video"));
      const isEmptyBlock = text.length === 0 && !hasNonTextChild;
      const hasOnlyBr = element.childElementCount === 1 && element.firstElementChild?.tagName.toLowerCase() === "br";

      if (isEmptyBlock && (tag === "div" || tag === "p" || tag === "span" || hasOnlyBr)) {
        return true;
      }
      return false;
    }

    return false;
  }

  return false;
}

export function SlideShape({ shape, viewportRef, interactive = false }: SlideShapeProps) {
  const isMobile = useIsMobile();
  const selectedShapeId = useSlideEditorStore((state) => state.selectedShapeId);
  const editingShapeId = useSlideEditorStore((state) => state.editingShapeId);
  const selectShape = useSlideEditorStore((state) => state.selectShape);
  const setEditingShape = useSlideEditorStore((state) => state.setEditingShape);
  const updateShapePosition = useSlideEditorStore((state) => state.updateShapePosition);
  const updateShapeSize = useSlideEditorStore((state) => state.updateShapeSize);
  const updateShapeRotation = useSlideEditorStore((state) => state.updateShapeRotation);
  const updateShapeContent = useSlideEditorStore((state) => state.updateShapeContent);
  const updateShapeFillColor = useSlideEditorStore((state) => state.updateShapeFillColor);
  const updateShapeBorderStyle = useSlideEditorStore((state) => state.updateShapeBorderStyle);
  const updateShapeBorderColor = useSlideEditorStore((state) => state.updateShapeBorderColor);
  const updateShapeBorderWidth = useSlideEditorStore((state) => state.updateShapeBorderWidth);
  const updateTableCell = useSlideEditorStore((state) => state.updateTableCell);
  const insertTableRowAt = useSlideEditorStore((state) => state.insertTableRowAt);
  const removeTableRowAt = useSlideEditorStore((state) => state.removeTableRowAt);
  const insertTableColumnAt = useSlideEditorStore((state) => state.insertTableColumnAt);
  const removeTableColumnAt = useSlideEditorStore((state) => state.removeTableColumnAt);
  const captureHistorySnapshot = useSlideEditorStore((state) => state.captureHistorySnapshot);
  const allShapes = useSlideEditorStore((state) => state.shapes);
  const setSnapGuides = useSlideEditorStore((state) => state.setSnapGuides);
  const clearSnapGuides = useSlideEditorStore((state) => state.clearSnapGuides);

  const editableRef = useRef<HTMLDivElement | null>(null);
  const shapeRef = useRef<HTMLDivElement | null>(null);

  const backgroundColor = useMemo(() => getFillColor(shape.rawNode), [shape.rawNode]);
  const borderColor = useMemo(() => getBorderColor(shape.rawNode), [shape.rawNode]);
  const borderWidth = useMemo(() => getBorderWidth(shape.rawNode), [shape.rawNode]);
  const borderStyle = useMemo(() => getBorderStyle(shape.rawNode), [shape.rawNode]);

  const isInteractive = interactive;
  const shapeId = "id" in shape ? shape.id : shape.attributes.id;
  const shapeType = shape.attributes.type;
  const isTextShape = shapeType === "text";
  const isTableShape = shapeType === "table";
  const isEllipseShape = shapeType === "ellipse";
  const isLineShape = shapeType === "line";
  const isArrowShape = shapeType === "arrow";
  const isImageShape = shapeType === "image";
  const isLineLikeShape = isLineShape || isArrowShape;
  const imageSource = useMemo(() => getImageSource(shape.rawNode), [shape.rawNode]);
  const imageCrop = useMemo(() => getImageCrop(shape.rawNode), [shape.rawNode]);
  const imageFrameRadius = useMemo(() => {
    if (imageCrop.type !== "round-rect") {
      return undefined;
    }

    const maxRadius = Math.min(shape.attributes.width, shape.attributes.height) / 2;
    const radius = Math.min(Math.max(0, imageCrop.presetHandlers), maxRadius);
    return `calc(var(--slide-unit) * ${radius})`;
  }, [imageCrop.presetHandlers, imageCrop.type, shape.attributes.height, shape.attributes.width]);
  const imageOffsetX = imageCrop.leftOffset;
  const imageOffsetY = imageCrop.topOffset;
  const imageScaleWidth = imageCrop.leftOffset + imageCrop.rightOffset;
  const imageScaleHeight = imageCrop.topOffset + imageCrop.bottomOffset;
  const contentHtml =
    "contentHtml" in shape
      ? shape.contentHtml
      : shape.rawNode.content
        ? buildShapeContentHtml(shape.rawNode.content)
        : "";
  const hasRichTextContent = !isTableShape && contentHtml.length > 0;
  const isShapeStyleTarget = !hasRichTextContent && !isTableShape;
  const tableModel = useMemo(() => parseTableModel(shape.rawNode.content), [shape.rawNode.content]);
  const tableContextHtml = useMemo(
    () => (isTableShape ? buildTableContextHtml(tableModel) : ""),
    [isTableShape, tableModel],
  );
  const shapeContext = useMemo<AiShapeContext>(
    () => ({
      shapeType,
      contentHtml: isTableShape ? tableContextHtml : contentHtml,
      fillColor: backgroundColor ?? undefined,
      borderColor: borderColor ?? undefined,
      borderWidth: borderWidth ?? undefined,
      borderStyle: borderStyle ?? undefined,
    }),
    [backgroundColor, borderColor, borderStyle, borderWidth, contentHtml, isTableShape, shapeType, tableContextHtml],
  );
  const arrowMarkerId = useMemo(
    () => `shape-arrow-${shapeId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [shapeId],
  );
  const isSelected = isInteractive && selectedShapeId === shapeId;
  const isEditing = isInteractive && editingShapeId === shapeId;
  const isDraggableTextShape = isInteractive && hasRichTextContent && isSelected && !isEditing;
  const [textStyle, setTextStyle] = useState<TextStyleState>({
    fontFamily: "Montserrat",
    fontSize: 16,
    color: "rgba(31, 35, 41, 1)",
    textAlign: "left",
    listType: "none",
  });
  const [rotationIndicator, setRotationIndicator] = useState<RotationIndicator | null>(null);
  const [viewportRect, setViewportRect] = useState<DOMRect | null>(null);
  const [selectionToolbarRect, setSelectionToolbarRect] = useState<DOMRect | null>(null);
  const draftTextStyleRef = useRef<TextStyleState | null>(null);
  const savedCollapsedRangeRef = useRef<Range | null>(null);
  const tableCellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const composingTableCellIdRef = useRef<string | null>(null);
  const [activeTableCell, setActiveTableCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const hasActiveTableCell = activeTableCell !== null;
  const [hoverTableCell, setHoverTableCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const tableRowCount = tableModel?.rows.length ?? 1;
  const tableColCount = tableModel?.rows[0]?.cells.length ?? 1;
  const activeRowIndex = Math.min(activeTableCell?.rowIndex ?? 0, Math.max(0, tableRowCount - 1));
  const activeColIndex = Math.min(activeTableCell?.colIndex ?? 0, Math.max(0, tableColCount - 1));
  const hoverRowIndex = Math.min(hoverTableCell?.rowIndex ?? -1, Math.max(0, tableRowCount - 1));
  const hoverColIndex = Math.min(hoverTableCell?.colIndex ?? -1, Math.max(0, tableColCount - 1));
  const currentRotation = shape.attributes.rotation ?? 0;
  const rotateHandleOnTop = useMemo(() => {
    const spaceAbove = shape.attributes.topLeftY;
    const spaceBelow = SLIDE_BASE_HEIGHT - (shape.attributes.topLeftY + shape.attributes.height);
    return spaceBelow < HANDLE_EDGE_THRESHOLD && spaceAbove > spaceBelow;
  }, [shape.attributes.height, shape.attributes.topLeftY]);
  const rotateHandleStyle = useMemo<CSSProperties>(
    () =>
      rotateHandleOnTop
        ? {
          left: "50%",
          top: -ROTATE_HANDLE_OFFSET,
          transform: "translate(-50%, -50%)",
        }
        : {
          left: "50%",
          top: `calc(100% + ${ROTATE_HANDLE_OFFSET}px)`,
          transform: "translate(-50%, -50%)",
        },
    [rotateHandleOnTop],
  );
  const rotateHandleLineStyle = useMemo<CSSProperties>(
    () =>
      rotateHandleOnTop
        ? {
          left: "50%",
          top: -ROTATE_HANDLE_OFFSET + 10,
          height: ROTATE_HANDLE_OFFSET - 10,
          transform: "translateX(-50%)",
        }
        : {
          left: "50%",
          top: "100%",
          height: ROTATE_HANDLE_OFFSET - 10,
          transform: "translateX(-50%)",
        },
    [rotateHandleOnTop],
  );
  const toolbarPortalStyle = useMemo(
    () =>
      getTopToolbarPortalStyle({
        viewportRect,
        shape: {
          x: shape.attributes.topLeftX,
          y: shape.attributes.topLeftY,
          width: shape.attributes.width,
        },
      }),
    [shape.attributes.topLeftX, shape.attributes.topLeftY, shape.attributes.width, viewportRect],
  );
  const textToolbarPortalStyle = useMemo(() => {
    if (isEditing) {
      return getSelectionToolbarPortalStyle(selectionToolbarRect);
    }
    return toolbarPortalStyle;
  }, [isEditing, selectionToolbarRect, toolbarPortalStyle]);
  const controlOverlayStyle = useMemo<CSSProperties | null>(() => {
    if (!viewportRect) {
      return null;
    }

    const scaleX = viewportRect.width / SLIDE_BASE_WIDTH;
    const scaleY = viewportRect.height / SLIDE_BASE_HEIGHT;

    return {
      position: "fixed",
      left: viewportRect.left + shape.attributes.topLeftX * scaleX,
      top: viewportRect.top + shape.attributes.topLeftY * scaleY,
      width: shape.attributes.width * scaleX,
      height: shape.attributes.height * scaleY,
      zIndex: CONTROL_OVERLAY_Z_INDEX,
    };
  }, [
    shape.attributes.height,
    shape.attributes.topLeftX,
    shape.attributes.topLeftY,
    shape.attributes.width,
    viewportRect,
  ]);
  const shapeZIndex =
    "zIndex" in shape ? Math.max(0, Number.isFinite(shape.zIndex) ? shape.zIndex : 0) : undefined;
  const slideUnitPx = useMemo(() => {
    if (viewportRect && viewportRect.width > 0) {
      return viewportRect.width / SLIDE_BASE_WIDTH;
    }
    return 1;
  }, [viewportRect]);
  const syncViewportRect = useCallback(() => {
    const element = viewportRef?.current;
    const nextRect = element ? element.getBoundingClientRect() : null;
    setViewportRect((prevRect) => (isSameRect(prevRect, nextRect) ? prevRect : nextRect));
  }, [viewportRef]);

  const resizeTextShapeToContent = useCallback(
    (mode: "single-line" | "content") => {
      if (!hasRichTextContent) {
        return;
      }

      const element = editableRef.current;
      if (!element) {
        return;
      }

      const computed = window.getComputedStyle(element);
      const lineHeightPx = getLineHeightPx(computed);

      if (mode === "content") {
        const trailingEmptyLine = hasTrailingEmptyBlock(element) ? lineHeightPx : 0;
        const measuredHeightPx = Math.max(0, element.scrollHeight - trailingEmptyLine);
        const safeUnit = Number.isFinite(slideUnitPx) && slideUnitPx > 0 ? slideUnitPx : 1;
        const heightInSlide = Math.max(MIN_SHAPE_SIZE, measuredHeightPx / safeUnit);
        updateShapeSize(shapeId, shape.attributes.width, heightInSlide);
        return;
      }

      const clone = element.cloneNode(true) as HTMLDivElement;
      clone.contentEditable = "false";
      clone.style.position = "fixed";
      clone.style.left = "-9999px";
      clone.style.top = "-9999px";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      const shouldLockWidth = false;
      const widthPx =
        shouldLockWidth && element.clientWidth > 0
          ? element.clientWidth
          : element.scrollWidth || element.clientWidth;
      clone.style.width = shouldLockWidth ? `${widthPx}px` : "max-content";
      clone.style.height = "auto";
      clone.style.minWidth = "0";
      clone.style.maxWidth = "none";
      clone.style.whiteSpace = shouldLockWidth ? "normal" : "pre";
      clone.style.overflow = "visible";
      stripTrailingEmptyNodes(clone);

      const computedElement = window.getComputedStyle(element);
      const slideUnitValue = computedElement.getPropertyValue("--slide-unit");
      if (slideUnitValue) {
        clone.style.setProperty("--slide-unit", slideUnitValue);
      }
      const slideFontScaleValue = computedElement.getPropertyValue("--slide-font-scale");
      if (slideFontScaleValue) {
        clone.style.setProperty("--slide-font-scale", slideFontScaleValue);
      }

      document.body.appendChild(clone);
      const measuredWidthPx = clone.scrollWidth;
      const measuredHeightPx = clone.scrollHeight;
      clone.remove();

      const safeUnit = Number.isFinite(slideUnitPx) && slideUnitPx > 0 ? slideUnitPx : 1;
      const widthInSlide = Math.max(MIN_SHAPE_SIZE, measuredWidthPx / safeUnit);
      const contentHeightPx = mode === "single-line" ? lineHeightPx : measuredHeightPx;
      const heightInSlide = Math.max(MIN_SHAPE_SIZE, contentHeightPx / safeUnit);

      if (mode === "single-line") {
        updateShapeSize(shapeId, widthInSlide, heightInSlide);
      } else {
        updateShapeSize(shapeId, shape.attributes.width, heightInSlide);
      }
    },
    [hasRichTextContent, shape.attributes.width, shapeId, slideUnitPx, updateShapeSize],
  );

  const adjustTextShapeSizeAfterStyleChange = useCallback(() => {
    const element = editableRef.current;
    if (!element) {
      return;
    }

    const { clientHeight, clientWidth, scrollHeight, scrollWidth } = element;
    if (clientHeight <= 0 || clientWidth <= 0) {
      return;
    }

    const isOverflowing =
      scrollHeight - clientHeight > 1 || scrollWidth - clientWidth > 1;
    if (!isOverflowing) {
      return;
    }

    const computed = window.getComputedStyle(element);
    const lineHeightPx = getLineHeightPx(computed);
    const isSingleLine = scrollHeight <= lineHeightPx * 1.2;

    resizeTextShapeToContent(isSingleLine ? "single-line" : "content");
  }, [resizeTextShapeToContent]);

  useEffect(() => {
    if (!viewportRef) {
      return;
    }

    const viewportElement = viewportRef.current;
    const resizeObserver =
      viewportElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
          syncViewportRect();
        })
        : null;

    if (viewportElement && resizeObserver) {
      resizeObserver.observe(viewportElement);
    }

    const initialFrameId = window.requestAnimationFrame(syncViewportRect);
    window.addEventListener("resize", syncViewportRect);
    window.addEventListener("scroll", syncViewportRect, true);
    return () => {
      window.cancelAnimationFrame(initialFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncViewportRect);
      window.removeEventListener("scroll", syncViewportRect, true);
    };
  }, [syncViewportRect, viewportRef]);

  useLayoutEffect(() => {
    if (!viewportRef || !isSelected) {
      return;
    }

    let frameId2 = 0;
    const frameId1 = window.requestAnimationFrame(() => {
      syncViewportRect();
      frameId2 = window.requestAnimationFrame(syncViewportRect);
    });
    return () => {
      window.cancelAnimationFrame(frameId1);
      if (frameId2) {
        window.cancelAnimationFrame(frameId2);
      }
    };
  }, [
    currentRotation,
    isSelected,
    shape.attributes.height,
    shape.attributes.topLeftX,
    shape.attributes.topLeftY,
    shape.attributes.width,
    syncViewportRect,
    viewportRef,
  ]);

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
    if (!isInteractive || !isEditing || !hasRichTextContent) {
      return;
    }

    const element = editableRef.current;
    if (!element) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      element.focus();
      placeCaretAtEnd(element);
      resizeTextShapeToContent("content");
      setTextStyle(readSelectionTextStyle(element, slideUnitPx));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [hasRichTextContent, isEditing, isInteractive, resizeTextShapeToContent, slideUnitPx]);

  useEffect(() => {
    if (!isInteractive || !isEditing) {
      return;
    }

    const onSelectionChange = () => {
      const element = editableRef.current;
      if (!element) {
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const isInside = element.contains(range.commonAncestorContainer);
        if (isInside && range.collapsed) {
          savedCollapsedRangeRef.current = range.cloneRange();
        }

        if (isInside && !range.collapsed) {
          const measuredRect = range.getBoundingClientRect();
          const fallbackRect = range.getClientRects().item(0);
          const nextRect =
            measuredRect.width > 0 || measuredRect.height > 0
              ? measuredRect
              : fallbackRect && (fallbackRect.width > 0 || fallbackRect.height > 0)
                ? fallbackRect
                : null;
          setSelectionToolbarRect((prevRect) => (isSameRect(prevRect, nextRect) ? prevRect : nextRect));
        } else {
          setSelectionToolbarRect((prevRect) => (prevRect ? null : prevRect));
        }
      } else {
        setSelectionToolbarRect((prevRect) => (prevRect ? null : prevRect));
      }

      setTextStyle(readSelectionTextStyle(element, slideUnitPx));
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [isEditing, isInteractive, slideUnitPx]);

  useEffect(() => {
    if (!isInteractive || !isSelected || !hasRichTextContent) {
      return;
    }

    const element = editableRef.current;
    if (!element) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setTextStyle(readSelectionTextStyle(element, slideUnitPx));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [contentHtml, hasRichTextContent, isInteractive, isSelected, slideUnitPx]);

  const applyTextStyle = useCallback(
    (apply: (style: CSSStyleDeclaration) => void) => {
      const element = editableRef.current;
      if (!element) {
        return;
      }

      if (hasExpandedSelectionInside(element) && applyStyleToSelection(element, apply)) {
        setTextStyle(readSelectionTextStyle(element, slideUnitPx));
        draftTextStyleRef.current = null;
        syncShapeContentFromDom();
        adjustTextShapeSizeAfterStyleChange();
        return;
      }

      const draft = {
        fontFamily: textStyle.fontFamily,
        fontSize: textStyle.fontSize,
        color: textStyle.color,
        textAlign: textStyle.textAlign,
        listType: textStyle.listType,
      };

      const styleTarget = document.createElement("span").style;
      if (draft.fontFamily === "Montserrat") {
        styleTarget.fontFamily = "var(--font-montserrat)";
      } else if (draft.fontFamily === "Open Sans") {
        styleTarget.fontFamily = "var(--font-open-sans)";
      } else {
        styleTarget.fontFamily = draft.fontFamily;
      }
      styleTarget.fontSize = `calc(var(--slide-unit) * var(--slide-font-scale, 1) * ${draft.fontSize})`;
      styleTarget.color = draft.color;
      apply(styleTarget);

      const nextDraft: TextStyleState = {
        fontFamily: styleTarget.fontFamily ? extractFontFamily(styleTarget.fontFamily) : draft.fontFamily,
        fontSize: styleTarget.fontSize ? parseFontSize(styleTarget.fontSize) ?? draft.fontSize : draft.fontSize,
        color: styleTarget.color ? normalizeColor(styleTarget.color) : draft.color,
        textAlign:
          styleTarget.textAlign === "center"
            ? "center"
            : styleTarget.textAlign === "right" || styleTarget.textAlign === "end"
              ? "right"
              : draft.textAlign,
        listType: draft.listType,
      };

      if (!isCollapsedSelectionInside(element)) {
        restoreCollapsedSelection(element, savedCollapsedRangeRef.current);
      }

      applyStyleToEntireContent(element, apply);
      syncShapeContentFromDom();
      adjustTextShapeSizeAfterStyleChange();
      draftTextStyleRef.current = nextDraft;
      setTextStyle(nextDraft);
    },
    [
      adjustTextShapeSizeAfterStyleChange,
      syncShapeContentFromDom,
      textStyle.color,
      textStyle.fontFamily,
      textStyle.fontSize,
      textStyle.listType,
      textStyle.textAlign,
      resizeTextShapeToContent,
      slideUnitPx,
    ],
  );

  const applyTextAlignment = useCallback(
    (align: TextStyleState["textAlign"]) => {
      const element = editableRef.current;
      if (!element) {
        return;
      }

      if (!hasExpandedSelectionInside(element) && !isCollapsedSelectionInside(element)) {
        restoreCollapsedSelection(element, savedCollapsedRangeRef.current);
      }

      const command = align === "left" ? "justifyLeft" : align === "center" ? "justifyCenter" : "justifyRight";
      const didApply = executeTextCommand(element, command);
      if (!didApply) {
        applyStyleToEntireContent(element, (style) => {
          style.textAlign = align;
        });
      }

      syncShapeContentFromDom();
      setTextStyle(readSelectionTextStyle(element, slideUnitPx));
      adjustTextShapeSizeAfterStyleChange();
    },
    [adjustTextShapeSizeAfterStyleChange, slideUnitPx, syncShapeContentFromDom],
  );

  const applyListType = useCallback(
    (listType: TextStyleState["listType"]) => {
      const element = editableRef.current;
      if (!element) {
        return;
      }

      if (!hasExpandedSelectionInside(element) && !isCollapsedSelectionInside(element)) {
        restoreCollapsedSelection(element, savedCollapsedRangeRef.current);
      }

      const current = readListType(element);
      if (listType === "none") {
        if (current === "ordered") {
          executeTextCommand(element, "insertOrderedList");
        } else if (current === "unordered") {
          executeTextCommand(element, "insertUnorderedList");
        }
      } else if (listType === "ordered") {
        if (current === "unordered") {
          executeTextCommand(element, "insertUnorderedList");
        }
        executeTextCommand(element, "insertOrderedList");
      } else {
        if (current === "ordered") {
          executeTextCommand(element, "insertOrderedList");
        }
        executeTextCommand(element, "insertUnorderedList");
      }

      syncShapeContentFromDom();
      setTextStyle(readSelectionTextStyle(element, slideUnitPx));
      adjustTextShapeSizeAfterStyleChange();
    },
    [adjustTextShapeSizeAfterStyleChange, slideUnitPx, syncShapeContentFromDom],
  );

  const applyAiEditResult = useCallback(
    (result: AiShapeEditResponse) => {
      const hasContentHtml = typeof result.contentHtml === "string";
      const hasTableData = Boolean(result.tableData?.rows?.length);
      const hasFillColor = typeof result.fillColor === "string";
      const hasBorderColor = typeof result.borderColor === "string";
      const hasBorderWidth = Number.isFinite(result.borderWidth);
      const hasBorderStyle =
        result.borderStyle === "solid" || result.borderStyle === "dashed" || result.borderStyle === "dotted";

      if (!hasContentHtml && !hasTableData && !hasFillColor && !hasBorderColor && !hasBorderWidth && !hasBorderStyle) {
        return;
      }

      captureHistorySnapshot();

      if (isTableShape && hasTableData) {
        const nextTableModel = buildTableModelFromAi(result.tableData, tableModel);
        if (nextTableModel) {
          updateShapeContent(shapeId, "", buildTableContentNode(nextTableModel));
        }
      } else if (isTextShape && hasContentHtml) {
        const nextHtml = result.contentHtml ?? "";
        const beforeText = extractPlainTextFromHtml(contentHtml);
        const afterText = extractPlainTextFromHtml(nextHtml);
        const isStyleOnlyChange = beforeText === afterText;
        const contentNode = contentHtmlToXmlNode(nextHtml, shape.rawNode.content);
        updateShapeContent(shapeId, nextHtml, contentNode);
        const element = editableRef.current;
        if (isEditing && element) {
          element.innerHTML = nextHtml;
          if (isStyleOnlyChange) {
            adjustTextShapeSizeAfterStyleChange();
          } else {
            resizeTextShapeToContent("content");
          }
          setTextStyle(readSelectionTextStyle(element, slideUnitPx));
        }
      }

      if (hasFillColor && result.fillColor) {
        updateShapeFillColor(shapeId, result.fillColor);
      }
      if (hasBorderStyle && result.borderStyle) {
        updateShapeBorderStyle(
          shapeId,
          result.borderStyle as "solid" | "dashed" | "dotted",
        );
      }
      if (hasBorderColor && result.borderColor) {
        updateShapeBorderColor(shapeId, result.borderColor);
      }
      if (hasBorderWidth) {
        updateShapeBorderWidth(shapeId, result.borderWidth ?? borderWidth);
      }
    },
    [
      borderWidth,
      captureHistorySnapshot,
      contentHtml,
      isTextShape,
      isEditing,
      isTableShape,
      resizeTextShapeToContent,
      adjustTextShapeSizeAfterStyleChange,
      shape.rawNode.content,
      shapeId,
      slideUnitPx,
      tableModel,
      updateShapeBorderColor,
      updateShapeBorderStyle,
      updateShapeBorderWidth,
      updateShapeContent,
      updateShapeFillColor,
    ],
  );

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    captureHistorySnapshot();
    setEditingShape(null);
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
    const movingWidth = shape.attributes.width;
    const movingHeight = shape.attributes.height;
    const otherShapes = allShapes.filter((item) => item.id !== shapeId);
    clearSnapGuides();

    const getSnappedAxis = (
      proposedStart: number,
      size: number,
      targets: number[],
    ): { position: number; guide: number | null } => {
      const movingPoints = [
        { offset: 0, value: proposedStart },
        { offset: size / 2, value: proposedStart + size / 2 },
        { offset: size, value: proposedStart + size },
      ];

      let bestDiff = Number.POSITIVE_INFINITY;
      let snappedPosition = proposedStart;
      let guide: number | null = null;

      for (const target of targets) {
        for (const point of movingPoints) {
          const diff = target - point.value;
          const distance = Math.abs(diff);
          if (distance <= SNAP_THRESHOLD && distance < bestDiff) {
            bestDiff = distance;
            snappedPosition = proposedStart + diff;
            guide = target;
          }
        }
      }

      return { position: snappedPosition, guide };
    };

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - originX) / rect.width) * 960;
      const deltaY = ((moveEvent.clientY - originY) / rect.height) * 540;
      const proposedX = startX + deltaX;
      const proposedY = startY + deltaY;

      const verticalTargets = otherShapes.flatMap((item) => [
        item.attributes.topLeftX,
        item.attributes.topLeftX + item.attributes.width / 2,
        item.attributes.topLeftX + item.attributes.width,
      ]);
      const horizontalTargets = otherShapes.flatMap((item) => [
        item.attributes.topLeftY,
        item.attributes.topLeftY + item.attributes.height / 2,
        item.attributes.topLeftY + item.attributes.height,
      ]);

      const snappedX = getSnappedAxis(proposedX, movingWidth, verticalTargets);
      const snappedY = getSnappedAxis(proposedY, movingHeight, horizontalTargets);

      setSnapGuides({
        vertical: snappedX.guide,
        horizontal: snappedY.guide,
      });
      updateShapePosition(shapeId, snappedX.position, snappedY.position);
    };

    const onUp = () => {
      clearSnapGuides();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const beginResize = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    captureHistorySnapshot();
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

  const beginRotate = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    captureHistorySnapshot();
    selectShape(shapeId);

    const viewportElement = viewportRef?.current;
    if (!viewportElement) {
      return;
    }

    const rect = viewportElement.getBoundingClientRect();
    const centerX = rect.left + ((shape.attributes.topLeftX + shape.attributes.width / 2) / 960) * rect.width;
    const centerY = rect.top + ((shape.attributes.topLeftY + shape.attributes.height / 2) / 540) * rect.height;
    const startPointerAngle = toDegrees(Math.atan2(event.clientY - centerY, event.clientX - centerX));
    const startRotation = currentRotation;

    const onMove = (moveEvent: PointerEvent) => {
      const pointerAngle = toDegrees(Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX));
      const deltaAngle = pointerAngle - startPointerAngle;
      let nextRotation = normalizeRotation(startRotation + deltaAngle);

      if (!moveEvent.shiftKey) {
        nextRotation = Math.round(nextRotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES;
        nextRotation = normalizeRotation(nextRotation);
      }

      updateShapeRotation(shapeId, nextRotation);
      setRotationIndicator({
        angle: nextRotation,
        left: "50%",
        top: rotateHandleOnTop
          ? -ROTATE_HANDLE_OFFSET - 18
          : `calc(100% + ${ROTATE_HANDLE_OFFSET + 16}px)`,
      });
    };

    const onUp = () => {
      setRotationIndicator(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <>
      <div
        ref={shapeRef}
        className="absolute overflow-visible"
        style={{
          left: toPercent(shape.attributes.topLeftX, 960),
          top: toPercent(shape.attributes.topLeftY, 540),
          width: toPercent(shape.attributes.width, 960),
          height: toPercent(shape.attributes.height, 540),
          zIndex: shapeZIndex,
          cursor: isDraggableTextShape ? "move" : undefined,
        }}
        onPointerDown={isInteractive && !isEditing ? beginDrag : undefined}
      >
        <div
          className="h-full w-full overflow-hidden"
          style={{
            transform: `rotate(${currentRotation}deg)`,
            transformOrigin: "center center",
            background: isLineLikeShape ? undefined : backgroundColor,
            borderRadius: isImageShape ? imageFrameRadius : isEllipseShape ? "9999px" : shape.style.borderRadius,
            border:
              !isLineLikeShape && borderColor && borderWidth > 0
                ? `${borderWidth}px ${borderStyle} ${borderColor}`
                : undefined,
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
                stroke={borderWidth <= 0 ? "transparent" : (borderColor ?? "rgba(13, 116, 206, 1)")}
                strokeWidth={Math.max(0, borderWidth)}
                strokeDasharray={
                  borderStyle === "dashed" ? "8 6" : borderStyle === "dotted" ? "2 5" : undefined
                }
                markerEnd={isArrowShape ? `url(#${arrowMarkerId})` : undefined}
              />
            </svg>
          ) : isTableShape ? (
            <div
              className="h-full w-full rounded-[calc(var(--slide-unit)*6)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-[calc(var(--slide-unit)*4)]"
              onPointerDown={(event) => {
                if (!isInteractive) {
                  return;
                }
                if (isEditing) {
                  event.stopPropagation();
                }
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
              <table
                className="h-full w-full table-fixed overflow-hidden rounded-[calc(var(--slide-unit)*4)] border border-slate-300/90 border-separate border-spacing-0 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                onPointerLeave={() => {
                  setHoverTableCell(null);
                }}
              >
                <tbody>
                  {tableModel.rows.map((row, rowIndex) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, cellIndex) => (
                        (() => {
                          const isActiveRow = isSelected && hasActiveTableCell && rowIndex === activeRowIndex;
                          const isActiveCol = isSelected && hasActiveTableCell && cellIndex === activeColIndex;
                          const isActiveCell = isActiveRow && isActiveCol;
                          const isHoverRow = hoverTableCell !== null && rowIndex === hoverRowIndex;
                          const isHoverCol = hoverTableCell !== null && cellIndex === hoverColIndex;
                          const isHoverCell = isHoverRow && isHoverCol;
                          const baseCellClass =
                            rowIndex === 0
                              ? "bg-[linear-gradient(180deg,#f8fbff_0%,#f1f5f9_100%)] font-semibold text-slate-800"
                              : rowIndex % 2 === 0
                                ? "bg-slate-50/30"
                                : "bg-white";
                          const hoverClass =
                            !isActiveCell && (isHoverRow || isHoverCol)
                              ? isHoverCell
                                ? "bg-indigo-100/80"
                                : isHoverRow
                                  ? "bg-indigo-50/60"
                                  : "bg-violet-50/60"
                              : "";
                          const activeClass = isActiveCell
                            ? "bg-cyan-100/95 shadow-[inset_0_0_0_1px_rgba(14,116,244,0.7)]"
                            : isActiveRow
                              ? "bg-sky-100/80"
                              : isActiveCol
                                ? "bg-amber-100/75"
                                : "";

                          return (
                            <td
                              key={cell.id}
                              className={`relative overflow-hidden border-b border-r border-slate-300/80 align-middle text-center text-[calc(var(--slide-unit)*14)] text-slate-700 transition-colors duration-150 ${baseCellClass} ${hoverClass} ${activeClass}`}
                              style={{
                                borderRightWidth: cellIndex === row.cells.length - 1 ? 0 : undefined,
                                borderBottomWidth: rowIndex === tableModel.rows.length - 1 ? 0 : undefined,
                              }}
                              onPointerEnter={() => {
                                setHoverTableCell({ rowIndex, colIndex: cellIndex });
                              }}
                              onPointerDown={() => {
                                setActiveTableCell({ rowIndex, colIndex: cellIndex });
                              }}
                            >
                              {isSelected && hasActiveTableCell && rowIndex === activeRowIndex && cellIndex === 0 ? (
                                <div className="pointer-events-none absolute top-0 left-0 h-full w-[calc(var(--slide-unit)*2.5)] bg-sky-600/85" />
                              ) : null}
                              {isSelected && hasActiveTableCell && rowIndex === 0 && cellIndex === activeColIndex ? (
                                <div className="pointer-events-none absolute top-0 left-0 h-[calc(var(--slide-unit)*2.5)] w-full bg-amber-500/85" />
                              ) : null}
                              {hoverTableCell !== null && rowIndex === hoverRowIndex && cellIndex === 0 ? (
                                <div className="pointer-events-none absolute top-0 left-0 h-full w-[calc(var(--slide-unit)*1.5)] bg-indigo-400/55" />
                              ) : null}
                              {hoverTableCell !== null && rowIndex === 0 && cellIndex === hoverColIndex ? (
                                <div className="pointer-events-none absolute top-0 left-0 h-[calc(var(--slide-unit)*1.5)] w-full bg-violet-400/60" />
                              ) : null}
                              {isInteractive && isEditing ? (
                                <div
                                  ref={(element) => {
                                    tableCellRefs.current[cell.id] = element;
                                    if (!element) {
                                      return;
                                    }

                                    const isFocused = document.activeElement === element;
                                    if (!isFocused && element.textContent !== cell.text) {
                                      element.textContent = cell.text;
                                    }
                                  }}
                                  className="flex h-full min-h-[calc(var(--slide-unit)*28)] w-full items-center justify-center rounded-[calc(var(--slide-unit)*2)] bg-transparent px-2 py-1 text-center text-[calc(var(--slide-unit)*14)] text-slate-700 outline-none ring-inset transition-shadow focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(14,116,244,0.5)]"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onFocus={() => {
                                    setActiveTableCell({ rowIndex, colIndex: cellIndex });
                                  }}
                                  onCompositionStart={() => {
                                    composingTableCellIdRef.current = cell.id;
                                  }}
                                  onCompositionEnd={(event) => {
                                    composingTableCellIdRef.current = null;
                                    updateTableCell(shapeId, rowIndex, cellIndex, event.currentTarget.textContent ?? "");
                                  }}
                                  onInput={(event) => {
                                    if (composingTableCellIdRef.current === cell.id) {
                                      return;
                                    }
                                    updateTableCell(shapeId, rowIndex, cellIndex, event.currentTarget.textContent ?? "");
                                  }}
                                  onBlur={(event) => {
                                    updateTableCell(shapeId, rowIndex, cellIndex, event.currentTarget.textContent ?? "");
                                  }}
                                />
                              ) : (
                                <div className="flex min-h-[calc(var(--slide-unit)*28)] items-center justify-center px-2 py-1 leading-tight">
                                  {cell.text || "\u00A0"}
                                </div>
                              )}
                            </td>
                          );
                        })()
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isImageShape ? (
            imageSource ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSource}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  left: `calc(var(--slide-unit) * ${-imageOffsetX})`,
                  top: `calc(var(--slide-unit) * ${-imageOffsetY})`,
                  width: `calc(100% + (var(--slide-unit) * ${imageScaleWidth}))`,
                  height: `calc(100% + (var(--slide-unit) * ${imageScaleHeight}))`,
                  objectFit: "cover",
                  borderRadius: imageFrameRadius,
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-100 text-[calc(var(--slide-unit)*12)] text-slate-500">
                图片缺失
              </div>
            )
          ) : hasRichTextContent ? (
            <div
              ref={editableRef}
              className="h-full w-full [&_ol]:ml-[calc(var(--slide-unit)*24)] [&_ol]:list-decimal [&_ol]:pl-[calc(var(--slide-unit)*8)] [&_ul]:ml-[calc(var(--slide-unit)*24)] [&_ul]:list-disc [&_ul]:pl-[calc(var(--slide-unit)*8)] [&_li]:leading-[1.5]"
              contentEditable={isInteractive && isEditing}
              style={{ cursor: isDraggableTextShape ? "move" : undefined }}
              suppressContentEditableWarning
              onPointerDown={(event) => {
                if (!isInteractive) {
                  return;
                }
                if (isEditing) {
                  event.stopPropagation();
                  selectShape(shapeId);
                  return;
                }

                beginDrag(event);
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
                resizeTextShapeToContent("content");
              }}
              onBeforeInput={(event) => {
                if (!isInteractive || !isEditing) {
                  return;
                }

                const nativeEvent = event.nativeEvent as InputEvent;
                const draftStyle = draftTextStyleRef.current;
                if (!draftStyle) {
                  return;
                }

                if (nativeEvent.inputType !== "insertText" || !nativeEvent.data) {
                  return;
                }

                const element = editableRef.current;
                if (!element) {
                  return;
                }

                if (!isCollapsedSelectionInside(element)) {
                  restoreCollapsedSelection(element, savedCollapsedRangeRef.current);
                }

                if (!insertStyledTextAtCaret(element, nativeEvent.data, draftStyle)) {
                  return;
                }

                event.preventDefault();
                syncShapeContentFromDom();
                resizeTextShapeToContent("content");
              }}
              onBlur={() => {
                if (!isInteractive) {
                  return;
                }
                syncShapeContentFromDom();
                draftTextStyleRef.current = null;
                savedCollapsedRangeRef.current = null;
                setSelectionToolbarRect(null);
                setEditingShape(null);
              }}
            />
          ) : null}
        </div>

        <ToolbarManager
          shapeContext={shapeContext}
          context={{
            isMobile,
            isSelected,
            isEditing,
            hasRichTextContent,
            isTableShape,
            isShapeStyleTarget,
            isLineLikeShape,
            portalStyle: toolbarPortalStyle,
            textToolbarPortalStyle,
          }}
          state={{
            textStyle,
            activeRowIndex,
            activeColIndex,
            rowCount: tableRowCount,
            colCount: tableColCount,
            backgroundColor: backgroundColor ?? "rgba(255, 255, 255, 1)",
            borderColor: borderColor ?? "rgba(31, 35, 41, 1)",
            borderWidth,
            borderStyle,
          }}
          actions={{
            onApplyTextStyle: applyTextStyle,
            onApplyTextAlignment: applyTextAlignment,
            onApplyListType: applyListType,
            onInsertTableRowAt: (index, pos) => insertTableRowAt(shapeId, index, pos),
            onRemoveTableRowAt: (index) => removeTableRowAt(shapeId, index),
            onInsertTableColumnAt: (index, pos) => insertTableColumnAt(shapeId, index, pos),
            onRemoveTableColumnAt: (index) => removeTableColumnAt(shapeId, index),
            onUpdateShapeFillColor: (color) => {
              captureHistorySnapshot();
              updateShapeFillColor(shapeId, color);
            },
            onUpdateShapeBorderStyle: (style) => {
              captureHistorySnapshot();
              updateShapeBorderStyle(shapeId, style);
            },
            onUpdateShapeBorderColor: (color) => {
              captureHistorySnapshot();
              updateShapeBorderColor(shapeId, color);
            },
            onUpdateShapeBorderWidth: (width) => {
              captureHistorySnapshot();
              updateShapeBorderWidth(shapeId, width);
            },
            onApplyAiEditResult: applyAiEditResult,
          }}
        />

      </div>
      {isSelected && !isEditing && controlOverlayStyle && typeof document !== "undefined"
        ? createPortal(
          <div data-shape-controls="true" className="pointer-events-none absolute overflow-visible" style={controlOverlayStyle}>
            <div
              className="pointer-events-none absolute inset-0 overflow-visible"
              style={{
                transform: `rotate(${currentRotation}deg)`,
                transformOrigin: "center center",
              }}
            >
              <div
                className="pointer-events-none absolute w-px bg-gradient-to-b from-sky-400/80 to-sky-600/80"
                style={rotateHandleLineStyle}
              />
              <button
                type="button"
                aria-label="旋转形状"
                className="group pointer-events-auto absolute rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-white active:scale-95"
                style={{
                  ...rotateHandleStyle,
                  width: HANDLE_HIT_SIZE,
                  height: HANDLE_HIT_SIZE,
                  cursor: "grab",
                }}
                onPointerDown={beginRotate}
              >
                <div
                  className="absolute rounded-full border-2 border-white bg-sky-500 shadow-[0_8px_18px_rgba(14,116,244,0.35),0_0_0_1px_rgba(14,116,244,0.7)] transition-transform duration-150 group-hover:scale-105"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: RESIZE_HANDLE_SIZE,
                    height: RESIZE_HANDLE_SIZE,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </button>
              {rotationIndicator ? (
                <div
                  className="pointer-events-none absolute z-40 -translate-x-1/2 rounded-md border border-slate-700/70 bg-slate-950/90 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_4px_14px_rgba(2,6,23,0.35)]"
                  style={{
                    left: rotationIndicator.left,
                    top: rotationIndicator.top,
                  }}
                >
                  {Math.round(rotationIndicator.angle)}°
                </div>
              ) : null}
              <button
                type="button"
                aria-label="缩放形状"
                className="pointer-events-auto absolute rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-white active:scale-95"
                style={{
                  right: -(HANDLE_HIT_SIZE / 2),
                  bottom: -(HANDLE_HIT_SIZE / 2),
                  width: HANDLE_HIT_SIZE,
                  height: HANDLE_HIT_SIZE,
                  cursor: "nwse-resize",
                }}
                onPointerDown={beginResize}
              >
                <div
                  className="absolute rounded-[4px] border-2 border-white bg-sky-500 shadow-[0_8px_18px_rgba(14,116,244,0.35),0_0_0_1px_rgba(14,116,244,0.7)]"
                  style={{
                    right: (HANDLE_HIT_SIZE - RESIZE_HANDLE_SIZE) / 2,
                    bottom: (HANDLE_HIT_SIZE - RESIZE_HANDLE_SIZE) / 2,
                    width: RESIZE_HANDLE_SIZE,
                    height: RESIZE_HANDLE_SIZE,
                  }}
                />
              </button>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
