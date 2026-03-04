import { XMLParser } from "fast-xml-parser";

import type {
  ShapeAttributes,
  ShapeStyle,
  SlideDocumentModel,
  SlideShapeModel,
  XmlNode,
  XmlValue,
} from "@/lib/slide-xml/types";

const SHAPE_NUMERIC_ATTRIBUTE_KEYS = [
  "width",
  "height",
  "topLeftX",
  "topLeftY",
  "rotation",
  "presetHandlers",
] as const;

const RGBA_REGEX =
  /^rgba\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/i;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
});

const SHAPE_TYPE_ROUND_RECT = "round-rect";

function clampInt(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(3))));
}

function formatAlpha(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toString();
}

export function normalizeRgbaColor(value: string): string {
  const match = RGBA_REGEX.exec(value);
  if (!match) {
    return value;
  }

  const red = clampInt(Number(match[1]));
  const green = clampInt(Number(match[2]));
  const blue = clampInt(Number(match[3]));
  const alpha = clampAlpha(Number(match[4]));

  return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
}

function normalizeRgbaInTree(node: XmlValue): XmlValue {
  if (typeof node === "string") {
    return normalizeRgbaColor(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => normalizeRgbaInTree(item));
  }

  if (!node || typeof node !== "object") {
    return node;
  }

  const normalized: XmlNode = {};
  for (const [key, value] of Object.entries(node)) {
    normalized[key] = normalizeRgbaInTree(value as XmlValue);
  }

  return normalized;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toFiniteNumberOrZero(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShapeAttributes(shape: XmlNode): XmlNode {
  const nextShape: XmlNode = { ...shape };

  for (const key of SHAPE_NUMERIC_ATTRIBUTE_KEYS) {
    const attrKey = `@_${key}`;
    if (attrKey in nextShape) {
      nextShape[attrKey] = toFiniteNumberOrZero(nextShape[attrKey]);
    }
  }

  return nextShape;
}

function buildShapeAttributes(shape: XmlNode): ShapeAttributes {
  return {
    id: String(shape["@_id"] ?? ""),
    type: String(shape["@_type"] ?? "rect"),
    width: toFiniteNumberOrZero(shape["@_width"]),
    height: toFiniteNumberOrZero(shape["@_height"]),
    topLeftX: toFiniteNumberOrZero(shape["@_topLeftX"]),
    topLeftY: toFiniteNumberOrZero(shape["@_topLeftY"]),
    rotation: toFiniteNumberOrZero(shape["@_rotation"]),
  };
}

function buildShapeStyle(shape: XmlNode): ShapeStyle {
  if (shape["@_type"] === SHAPE_TYPE_ROUND_RECT) {
    return { borderRadius: "calc(var(--slide-unit) * 8)" };
  }

  return {};
}

function parseShape(shapeNode: XmlNode): SlideShapeModel {
  const normalizedShape = normalizeShapeAttributes(shapeNode);

  return {
    attributes: buildShapeAttributes(normalizedShape),
    style: buildShapeStyle(normalizedShape),
    rawNode: normalizedShape,
  };
}

function ensureXmlNode(value: unknown): XmlNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as XmlNode;
}

export function parseSlideXml(xml: string): SlideDocumentModel {
  const parsed = parser.parse(xml) as { slide?: unknown };
  const rawSlideNode = ensureXmlNode(parsed.slide);
  const normalizedSlideNode = normalizeRgbaInTree(rawSlideNode) as XmlNode;

  const dataNode = ensureXmlNode(normalizedSlideNode.data);
  const shapeNodes = toArray(dataNode.shape as XmlNode | XmlNode[]);
  const shapes = shapeNodes.map((shapeNode) => parseShape(ensureXmlNode(shapeNode)));

  dataNode.shape = shapes.map((shape) => shape.rawNode);
  normalizedSlideNode.data = dataNode;

  return {
    slideId: String(normalizedSlideNode["@_id"] ?? ""),
    rawSlideNode: normalizedSlideNode,
    shapes,
  };
}
