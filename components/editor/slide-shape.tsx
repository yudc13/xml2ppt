"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSlideEditorStore } from "@/features/slide-editor/store";
import type { EditableSlideShape } from "@/features/slide-editor/store";
import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type { SlideShapeModel, XmlNode, XmlValue } from "@/lib/slide-xml/types";

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

function isCollapsedSelectionInside(editableElement: HTMLDivElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return editableElement.contains(range.commonAncestorContainer) && range.collapsed;
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

  const editableRef = useRef<HTMLDivElement | null>(null);

  const backgroundColor = useMemo(() => getFillColor(shape.rawNode), [shape.rawNode]);
  const borderColor = useMemo(() => getBorderColor(shape.rawNode), [shape.rawNode]);

  const isInteractive = interactive;
  const shapeId = "id" in shape ? shape.id : shape.attributes.id;
  const contentHtml =
    "contentHtml" in shape
      ? shape.contentHtml
      : shape.rawNode.content
        ? buildShapeContentHtml(shape.rawNode.content)
        : "";

  const hasContent = contentHtml.length > 0;
  const isSelected = isInteractive && selectedShapeId === shapeId;
  const isEditing = isInteractive && editingShapeId === shapeId;
  const [textStyle, setTextStyle] = useState<TextStyleState>({
    fontFamily: FONT_OPTIONS[0],
    fontSize: 16,
    color: "rgba(31, 35, 41, 1)",
  });
  const draftTextStyleRef = useRef<TextStyleState | null>(null);

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

    if (isEditing) {
      return;
    }

    if (element.innerHTML !== contentHtml) {
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

      if (applyStyleToSelection(element, apply)) {
        setTextStyle(readSelectionTextStyle(element));
        draftTextStyleRef.current = null;
        syncShapeContentFromDom();
        return;
      }

      if (!isCollapsedSelectionInside(element)) {
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
          background: backgroundColor,
          borderRadius: shape.style.borderRadius,
          border: borderColor ? `1px solid ${borderColor}` : undefined,
          outline: isSelected ? "2px solid rgba(14, 116, 244, 0.7)" : undefined,
          outlineOffset: isSelected ? "-1px" : undefined,
        }}
      >
        {hasContent ? (
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
              if (!isEditing) {
                setEditingShape(shapeId);
              }
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
              setEditingShape(null);
            }}
          />
        ) : null}
      </div>

      {isSelected && hasContent ? (
        <TextFormatToolbar
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
  textStyle: TextStyleState;
  onApplyFont: (fontFamily: string) => void;
  onApplyFontSize: (fontSize: number) => void;
  onApplyColor: (color: string) => void;
};

function TextFormatToolbar({
  textStyle,
  onApplyFont,
  onApplyFontSize,
  onApplyColor,
}: TextFormatToolbarProps) {
  return (
    <div
      className="absolute bottom-full left-1/2 z-40 mb-3 -translate-x-1/2"
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
