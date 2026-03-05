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

const RESIZE_HANDLE_SIZE = 12;
const HANDLE_HIT_SIZE = 36;
const ROTATION_SNAP_DEGREES = 15;
const ROTATE_HANDLE_OFFSET = 32;
const TOOLBAR_GAP = 12;
const HANDLE_EDGE_THRESHOLD = 40;
const SLIDE_BASE_WIDTH = 960;
const SLIDE_BASE_HEIGHT = 540;
const MIN_SHAPE_SIZE = 12;
const SNAP_THRESHOLD = 6;
const CONTROL_OVERLAY_Z_INDEX = 10_000;
const TOOLBAR_PORTAL_Z_INDEX = 10_100;

const FONT_OPTIONS = ["Montserrat", "Open Sans", "Noto Sans SC"] as const;
const COLOR_OPTIONS = [
  "rgba(17, 50, 100, 1)",
  "rgba(13, 116, 206, 1)",
  "rgba(239, 95, 0, 1)",
  "rgba(31, 35, 41, 1)",
  "rgba(100, 100, 100, 1)",
] as const;
const THEME_COLOR_OPTIONS = [
  "rgba(13, 116, 206, 1)",
  "rgba(16, 185, 129, 1)",
  "rgba(245, 158, 11, 1)",
  "rgba(239, 68, 68, 1)",
  "rgba(99, 102, 241, 1)",
  "rgba(31, 35, 41, 1)",
] as const;
const ALIGN_OPTIONS = [
  { label: "左对齐", value: "left", icon: AlignLeft },
  { label: "居中对齐", value: "center", icon: AlignCenter },
  { label: "右对齐", value: "right", icon: AlignRight },
] as const;
const LIST_OPTIONS = [
  { label: "无列表", value: "none", icon: List },
  { label: "有序列表", value: "ordered", icon: ListOrdered },
  { label: "无序列表", value: "unordered", icon: List },
] as const;
const SHAPE_FILL_OPTIONS = [
  "rgba(255, 255, 255, 1)",
  "rgba(234, 88, 12, 1)",
  "rgba(37, 99, 235, 1)",
  "rgba(13, 148, 136, 1)",
  "rgba(148, 163, 184, 1)",
  "rgba(31, 41, 55, 1)",
] as const;
const SHAPE_BORDER_OPTIONS = [
  "rgba(17, 24, 39, 1)",
  "rgba(71, 85, 105, 1)",
  "rgba(234, 88, 12, 1)",
  "rgba(37, 99, 235, 1)",
  "rgba(34, 197, 94, 1)",
  "rgba(168, 85, 247, 1)",
] as const;
const BORDER_STYLE_OPTIONS = [
  { label: "实线", value: "solid" },
  { label: "虚线", value: "dashed" },
  { label: "点线", value: "dotted" },
] as const;

type TextStyleState = {
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
  listType: "none" | "ordered" | "unordered";
};

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
  const arrowMarkerId = useMemo(
    () => `shape-arrow-${shapeId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [shapeId],
  );
  const isSelected = isInteractive && selectedShapeId === shapeId;
  const isEditing = isInteractive && editingShapeId === shapeId;
  const isDraggableTextShape = isInteractive && hasRichTextContent && isSelected && !isEditing;
  const [textStyle, setTextStyle] = useState<TextStyleState>({
    fontFamily: FONT_OPTIONS[0],
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

      const clone = element.cloneNode(true) as HTMLDivElement;
      clone.contentEditable = "false";
      clone.style.position = "fixed";
      clone.style.left = "-9999px";
      clone.style.top = "-9999px";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.width = "max-content";
      clone.style.height = "auto";
      clone.style.minWidth = "0";
      clone.style.maxWidth = "none";
      clone.style.whiteSpace = "pre";
      clone.style.overflow = "visible";

      document.body.appendChild(clone);
      const measuredWidthPx = clone.scrollWidth;
      const measuredHeightPx = clone.scrollHeight;
      clone.remove();

      const safeUnit = Number.isFinite(slideUnitPx) && slideUnitPx > 0 ? slideUnitPx : 1;
      const widthInSlide = Math.max(MIN_SHAPE_SIZE, measuredWidthPx / safeUnit);
      const contentHeightPx = mode === "single-line" ? lineHeightPx : measuredHeightPx;
      const heightInSlide = Math.max(MIN_SHAPE_SIZE, contentHeightPx / safeUnit);

      updateShapeSize(shapeId, widthInSlide, heightInSlide);
    },
    [hasRichTextContent, shapeId, slideUnitPx, updateShapeSize],
  );

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
      styleTarget.fontFamily = draft.fontFamily;
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
      resizeTextShapeToContent("content");
      draftTextStyleRef.current = nextDraft;
      setTextStyle(nextDraft);
    },
    [
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
    },
    [slideUnitPx, syncShapeContentFromDom],
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
    },
    [slideUnitPx, syncShapeContentFromDom],
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
            className="h-full w-full [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:pl-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:pl-2 [&_li]:leading-[1.5]"
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

      {isSelected && hasRichTextContent && (!isEditing || selectionToolbarRect) ? (
        <TextFormatToolbar
          isMobile={isMobile}
          portalStyle={textToolbarPortalStyle}
          textStyle={textStyle}
          onApplyAlign={applyTextAlignment}
          onApplyListType={applyListType}
          onApplyFont={(fontFamily) => {
            applyTextStyle((style) => {
              style.fontFamily = fontFamily;
            });
          }}
          onApplyFontSize={(fontSize) => {
            applyTextStyle((style) => {
              style.fontSize = `calc(var(--slide-unit) * var(--slide-font-scale, 1) * ${fontSize})`;
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
        <TableToolbar
          isMobile={isMobile}
          portalStyle={toolbarPortalStyle}
          activeRowIndex={activeRowIndex}
          activeColIndex={activeColIndex}
          rowCount={tableRowCount}
          colCount={tableColCount}
          onInsertRowAbove={() => insertTableRowAt(shapeId, activeRowIndex, "before")}
          onInsertRowBelow={() => insertTableRowAt(shapeId, activeRowIndex, "after")}
          onDeleteCurrentRow={() => removeTableRowAt(shapeId, activeRowIndex)}
          onInsertColLeft={() => insertTableColumnAt(shapeId, activeColIndex, "before")}
          onInsertColRight={() => insertTableColumnAt(shapeId, activeColIndex, "after")}
          onDeleteCurrentCol={() => removeTableColumnAt(shapeId, activeColIndex)}
        />
      ) : null}

      {isSelected && isShapeStyleTarget ? (
        <ShapeStyleToolbar
          isMobile={isMobile}
          portalStyle={toolbarPortalStyle}
          isLineLikeShape={isLineLikeShape}
          fillColor={backgroundColor ?? "rgba(255, 255, 255, 1)"}
          borderColor={borderColor ?? "rgba(31, 35, 41, 1)"}
          borderWidth={borderWidth}
          borderStyle={borderStyle}
          onFillColorChange={(color) => {
            captureHistorySnapshot();
            updateShapeFillColor(shapeId, color);
          }}
          onBorderStyleChange={(style) => {
            captureHistorySnapshot();
            updateShapeBorderStyle(shapeId, style);
          }}
          onBorderColorChange={(color) => {
            captureHistorySnapshot();
            updateShapeBorderColor(shapeId, color);
          }}
          onBorderWidthChange={(width) => {
            captureHistorySnapshot();
            updateShapeBorderWidth(shapeId, width);
          }}
        />
      ) : null}

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

type TextFormatToolbarProps = {
  isMobile: boolean;
  portalStyle: CSSProperties | null;
  textStyle: TextStyleState;
  onApplyAlign: (align: TextStyleState["textAlign"]) => void;
  onApplyListType: (listType: TextStyleState["listType"]) => void;
  onApplyFont: (fontFamily: string) => void;
  onApplyFontSize: (fontSize: number) => void;
  onApplyColor: (color: string) => void;
};

function TextFormatToolbar({
  isMobile,
  portalStyle,
  textStyle,
  onApplyAlign,
  onApplyListType,
  onApplyFont,
  onApplyFontSize,
  onApplyColor,
}: TextFormatToolbarProps) {
  const [activePanel, setActivePanel] = useState<"align" | "list" | "font" | "color" | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDownOutside = (event: PointerEvent) => {
      if (!toolbarRef.current) {
        return;
      }
      if (!toolbarRef.current.contains(event.target as Node)) {
        setActivePanel(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownOutside);
    };
  }, []);

  const alignLabel = useMemo(() => {
    const option = ALIGN_OPTIONS.find((item) => item.value === textStyle.textAlign);
    return option?.label ?? "左对齐";
  }, [textStyle.textAlign]);

  const listLabel = useMemo(() => {
    const option = LIST_OPTIONS.find((item) => item.value === textStyle.listType);
    return option?.label ?? "无列表";
  }, [textStyle.listType]);

  const handleColorApply = useCallback(
    (color: string) => {
      onApplyColor(color);
      setRecentColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 8));
      setActivePanel(null);
    },
    [onApplyColor],
  );

  if (!portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-shape-toolbar="true"
      style={portalStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div ref={toolbarRef} className="relative">
        <div
          className={`flex items-center rounded-2xl border border-slate-300 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] ${isMobile ? "gap-1 px-1.5 py-1" : "min-w-max gap-2 px-2 py-1.5"}`}
        >
          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "align" ? null : "align"))}
            >
              {alignLabel}
              <ChevronDown className={`h-4 w-4 transition-transform ${activePanel === "align" ? "rotate-180" : ""}`} />
            </button>
            {activePanel === "align" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-44 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {ALIGN_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        textStyle.textAlign === option.value
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                      onClick={() => {
                        onApplyAlign(option.value);
                        setActivePanel(null);
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setActivePanel((current) => (current === "list" ? null : "list"))}
            >
              {listLabel}
              <ChevronDown className={`h-4 w-4 transition-transform ${activePanel === "list" ? "rotate-180" : ""}`} />
            </button>
            {activePanel === "list" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-44 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {LIST_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        textStyle.listType === option.value
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onApplyListType(option.value);
                        setActivePanel(null);
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "font" ? null : "font"))}
            >
              <span className="max-w-[120px] truncate">{textStyle.fontFamily}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${activePanel === "font" ? "rotate-180" : ""}`} />
            </button>
            {activePanel === "font" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-48 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font}
                    type="button"
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      textStyle.fontFamily === font
                        ? "bg-sky-50 text-sky-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    style={{ fontFamily: font }}
                    onClick={() => {
                      onApplyFont(font);
                      setActivePanel(null);
                    }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex h-8 items-center rounded-xl border border-slate-300 bg-white p-0.5">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyFontSize(Math.max(8, textStyle.fontSize - 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            >
              -
            </button>
            <span className="w-9 text-center text-sm font-medium text-slate-800">{textStyle.fontSize}</span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyFontSize(Math.min(96, textStyle.fontSize + 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            >
              +
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "color" ? null : "color"))}
            >
              <span className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: textStyle.color }} />
              <span>颜色</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${activePanel === "color" ? "rotate-180" : ""}`} />
            </button>
            {activePanel === "color" ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[260px] rounded-xl border border-slate-300 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                <p className="mb-2 text-xs font-medium text-slate-500">主题色</p>
                <div className="mb-3 grid grid-cols-6 gap-2">
                  {THEME_COLOR_OPTIONS.map((color) => (
                    <button
                      key={`theme-${color}`}
                      type="button"
                      className="h-7 w-7 rounded-full border border-slate-200"
                      style={{
                        backgroundColor: color,
                        boxShadow: textStyle.color === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                      }}
                      onClick={() => handleColorApply(color)}
                    />
                  ))}
                </div>

                <p className="mb-2 text-xs font-medium text-slate-500">最近使用颜色</p>
                <div className="mb-3 grid min-h-8 grid-cols-6 gap-2">
                  {recentColors.length > 0 ? (
                    recentColors.map((color) => (
                      <button
                        key={`recent-${color}`}
                        type="button"
                        className="h-7 w-7 rounded-full border border-slate-200"
                        style={{
                          backgroundColor: color,
                          boxShadow: textStyle.color === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                        }}
                        onClick={() => handleColorApply(color)}
                      />
                    ))
                  ) : (
                    <span className="col-span-6 text-[11px] text-slate-400">暂无最近使用</span>
                  )}
                </div>

                <p className="mb-2 text-xs font-medium text-slate-500">预设色板</p>
                <div className="grid grid-cols-6 gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={`preset-${color}`}
                      type="button"
                      className="h-7 w-7 rounded-full border border-slate-200"
                      style={{
                        backgroundColor: color,
                        boxShadow: textStyle.color === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                      }}
                      onClick={() => handleColorApply(color)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type TableToolbarProps = {
  isMobile: boolean;
  portalStyle: CSSProperties | null;
  activeRowIndex: number;
  activeColIndex: number;
  rowCount: number;
  colCount: number;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteCurrentRow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onDeleteCurrentCol: () => void;
};

function TableToolbar({
  isMobile,
  portalStyle,
  activeRowIndex,
  activeColIndex,
  rowCount,
  colCount,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteCurrentRow,
  onInsertColLeft,
  onInsertColRight,
  onDeleteCurrentCol,
}: TableToolbarProps) {
  if (!portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div data-shape-toolbar="true" style={portalStyle} onPointerDown={(event) => event.stopPropagation()}>
      <div
        className={`flex max-w-[min(92vw,860px)] flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] ${isMobile ? "px-1.5 py-1" : "px-2 py-1"}`}
      >
        <div className="flex items-center gap-1">
          <span
            className={`whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 text-sky-700 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          >
            行 {activeRowIndex + 1}
          </span>
          <span
            className={`whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 text-amber-700 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          >
            列 {activeColIndex + 1}
          </span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          onClick={onInsertRowAbove}
        >
          上插行
        </button>
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          onClick={onInsertRowBelow}
        >
          下插行
        </button>
        <button
          type="button"
          disabled={rowCount <= 1}
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          onClick={onDeleteCurrentRow}
        >
          删当前行
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          onClick={onInsertColLeft}
        >
          左插列
        </button>
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          onClick={onInsertColRight}
        >
          右插列
        </button>
        <button
          type="button"
          disabled={colCount <= 1}
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
          onClick={onDeleteCurrentCol}
        >
          删当前列
        </button>
      </div>
    </div>,
    document.body,
  );
}

type ShapeStyleToolbarProps = {
  isMobile: boolean;
  portalStyle: CSSProperties | null;
  isLineLikeShape: boolean;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
  onFillColorChange: (color: string) => void;
  onBorderStyleChange: (style: "solid" | "dashed" | "dotted") => void;
  onBorderColorChange: (color: string) => void;
  onBorderWidthChange: (width: number) => void;
};

function ShapeStyleToolbar({
  isMobile,
  portalStyle,
  isLineLikeShape,
  fillColor,
  borderColor,
  borderWidth,
  borderStyle,
  onFillColorChange,
  onBorderStyleChange,
  onBorderColorChange,
  onBorderWidthChange,
}: ShapeStyleToolbarProps) {
  const [activePanel, setActivePanel] = useState<"fill" | "border" | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDownOutside = (event: PointerEvent) => {
      if (!toolbarRef.current) {
        return;
      }

      if (!toolbarRef.current.contains(event.target as Node)) {
        setActivePanel(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownOutside);
    };
  }, []);

  if (!portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div data-shape-toolbar="true" style={portalStyle} onPointerDown={(event) => event.stopPropagation()}>
      <div ref={toolbarRef} className="relative">
        <div
          className={`flex items-center rounded-2xl border border-slate-300 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] ${isMobile ? "gap-1 px-1.5 py-1" : "min-w-max gap-2 px-2 py-1.5"}`}
        >
          <button
            type="button"
            className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-100"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            Ask AI
          </button>
          <div className="h-6 w-px bg-slate-200" />

          {!isLineLikeShape ? (
            <div className="relative">
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-slate-700 transition-colors duration-200 hover:bg-slate-100"
                onClick={() => setActivePanel((current) => (current === "fill" ? null : "fill"))}
                aria-label="填充颜色"
              >
                <span
                  className="h-5 w-5 rounded-full border border-slate-300"
                  style={{ backgroundColor: fillColor }}
                />
                <ChevronDown
                  className={`h-4 w-4 text-slate-600 transition-transform ${activePanel === "fill" ? "rotate-180" : ""}`}
                />
              </button>

              {activePanel === "fill" ? (
                <div className="absolute left-0 top-[calc(100%+12px)] z-30 w-[252px] rounded-2xl border border-slate-300 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                  <p className="mb-2 text-xs font-medium text-slate-500">填充颜色</p>
                  <div className="grid grid-cols-6 gap-2">
                    {SHAPE_FILL_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-8 w-8 rounded-full border border-slate-200"
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            color === fillColor ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                        }}
                        onClick={() => onFillColorChange(color)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-slate-700 transition-colors duration-200 hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "border" ? null : "border"))}
              aria-label="边框样式"
            >
              <AlignJustify className="h-4 w-4" />
              <ChevronDown
                className={`h-4 w-4 text-slate-600 transition-transform ${activePanel === "border" ? "rotate-180" : ""}`}
              />
            </button>

            {activePanel === "border" ? (
              <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[320px] rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                <p className="mb-3 text-sm font-medium text-slate-700">边框</p>

                <div className="mb-3 grid grid-cols-3 gap-2">
                  {BORDER_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        borderStyle === option.value
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                      onClick={() => onBorderStyleChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">粗细</span>
                  <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-1">
                    <button
                      type="button"
                      className="grid h-6 w-6 place-items-center rounded-md text-slate-600 transition-colors duration-200 hover:bg-slate-100"
                      onClick={() => onBorderWidthChange(Math.max(0, borderWidth - 1))}
                      aria-label="减小边框粗细"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-8 text-center text-xs font-semibold text-slate-800">
                      {borderWidth}
                    </span>
                    <button
                      type="button"
                      className="grid h-6 w-6 place-items-center rounded-md text-slate-600 transition-colors duration-200 hover:bg-slate-100"
                      onClick={() => onBorderWidthChange(Math.min(24, borderWidth + 1))}
                      aria-label="增加边框粗细"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mb-2 text-sm text-slate-500">边框颜色</p>
                <div className="grid grid-cols-6 gap-2">
                  {SHAPE_BORDER_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-8 w-8 rounded-full border border-slate-200"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          color === borderColor ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                      }}
                      onClick={() => onBorderColorChange(color)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="h-6 w-px bg-slate-200" />
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-700 transition-colors duration-200 hover:bg-slate-100"
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-700 transition-colors duration-200 hover:bg-slate-100"
          >
            <BrushCleaning className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
