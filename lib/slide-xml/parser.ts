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
const IMAGE_NUMERIC_ATTRIBUTE_KEYS = ["width", "height", "topLeftX", "topLeftY", "rotation"] as const;
const CROP_NUMERIC_ATTRIBUTE_KEYS = [
  "leftOffset",
  "rightOffset",
  "topOffset",
  "bottomOffset",
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
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const MIN_SHAPE_SIZE = 12;

function clampInt(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

function normalizeRotation(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return round2(normalized);
}

function normalizeParsedAttributes(attributes: ShapeAttributes): ShapeAttributes {
  const width = round2(clamp(attributes.width, MIN_SHAPE_SIZE, SLIDE_WIDTH));
  const height = round2(clamp(attributes.height, MIN_SHAPE_SIZE, SLIDE_HEIGHT));

  return {
    ...attributes,
    width,
    height,
    topLeftX: round2(clamp(attributes.topLeftX, 0, SLIDE_WIDTH - width)),
    topLeftY: round2(clamp(attributes.topLeftY, 0, SLIDE_HEIGHT - height)),
    rotation: normalizeRotation(attributes.rotation),
  };
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

function normalizeImageNode(image: XmlNode): XmlNode {
  const nextImage: XmlNode = { ...image };

  for (const key of IMAGE_NUMERIC_ATTRIBUTE_KEYS) {
    const attrKey = `@_${key}`;
    if (attrKey in nextImage) {
      nextImage[attrKey] = toFiniteNumberOrZero(nextImage[attrKey]);
    }
  }

  if ("crop" in nextImage) {
    const cropNode = ensureXmlNode(nextImage.crop);
    const normalizedCrop: XmlNode = { ...cropNode };
    for (const key of CROP_NUMERIC_ATTRIBUTE_KEYS) {
      const attrKey = `@_${key}`;
      if (attrKey in normalizedCrop) {
        normalizedCrop[attrKey] = toFiniteNumberOrZero(normalizedCrop[attrKey]);
      }
    }
    nextImage.crop = normalizedCrop;
  }

  return nextImage;
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
  const normalizedAttributes = normalizeParsedAttributes(buildShapeAttributes(normalizedShape));

  return {
    attributes: normalizedAttributes,
    style: buildShapeStyle(normalizedShape),
    rawNode: {
      ...normalizedShape,
      "@_width": normalizedAttributes.width,
      "@_height": normalizedAttributes.height,
      "@_topLeftX": normalizedAttributes.topLeftX,
      "@_topLeftY": normalizedAttributes.topLeftY,
      "@_rotation": normalizedAttributes.rotation,
    },
  };
}

function parseImage(imageNode: XmlNode): SlideShapeModel {
  const normalizedImage = normalizeImageNode(imageNode);
  const normalizedAttributes = normalizeParsedAttributes({
    id: String(normalizedImage["@_id"] ?? ""),
    type: "image",
    width: toFiniteNumberOrZero(normalizedImage["@_width"]),
    height: toFiniteNumberOrZero(normalizedImage["@_height"]),
    topLeftX: toFiniteNumberOrZero(normalizedImage["@_topLeftX"]),
    topLeftY: toFiniteNumberOrZero(normalizedImage["@_topLeftY"]),
    rotation: toFiniteNumberOrZero(normalizedImage["@_rotation"]),
  });

  return {
    attributes: normalizedAttributes,
    style: {},
    rawNode: {
      ...normalizedImage,
      "@_type": "image",
      "@_width": normalizedAttributes.width,
      "@_height": normalizedAttributes.height,
      "@_topLeftX": normalizedAttributes.topLeftX,
      "@_topLeftY": normalizedAttributes.topLeftY,
      "@_rotation": normalizedAttributes.rotation,
    },
  };
}

function ensureXmlNode(value: unknown): XmlNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as XmlNode;
}

function extractDataElementOrder(xml: string): Array<{ tag: "shape" | "img"; id: string }> {
  const dataMatch = xml.match(/<data[\s\S]*?>([\s\S]*?)<\/data>/i);
  if (!dataMatch) {
    return [];
  }

  const dataContent = dataMatch[1];
  const elementPattern = /<(shape|img)\b[^>]*?\bid="([^"]+)"[^>]*?>/g;
  const ordered: Array<{ tag: "shape" | "img"; id: string }> = [];
  let match: RegExpExecArray | null = elementPattern.exec(dataContent);

  while (match) {
    const tag = match[1];
    const id = match[2];
    if ((tag === "shape" || tag === "img") && id) {
      ordered.push({ tag, id });
    }
    match = elementPattern.exec(dataContent);
  }

  return ordered;
}

export function parseSlideXml(xml: string): SlideDocumentModel {
  const parsed = parser.parse(xml) as { slide?: unknown };
  const rawSlideNode = ensureXmlNode(parsed.slide);
  const normalizedSlideNode = normalizeRgbaInTree(rawSlideNode) as XmlNode;

  const dataNode = ensureXmlNode(normalizedSlideNode.data);
  const shapeNodes = toArray(dataNode.shape as XmlNode | XmlNode[]);
  const imageNodes = toArray(dataNode.img as XmlNode | XmlNode[]);

  const parsedShapes = shapeNodes.map((shapeNode) => parseShape(ensureXmlNode(shapeNode)));
  const parsedImages = imageNodes.map((imageNode) => parseImage(ensureXmlNode(imageNode)));
  const shapeById = new Map(parsedShapes.map((shape) => [shape.attributes.id, shape] as const));
  const imageById = new Map(parsedImages.map((image) => [image.attributes.id, image] as const));
  const orderedElements = extractDataElementOrder(xml);
  const shapes: SlideShapeModel[] = [];
  const consumedIds = new Set<string>();

  for (const element of orderedElements) {
    const key = `${element.tag}:${element.id}`;
    if (consumedIds.has(key)) {
      continue;
    }

    const nextShape =
      element.tag === "shape" ? shapeById.get(element.id) : imageById.get(element.id);
    if (!nextShape) {
      continue;
    }

    shapes.push(nextShape);
    consumedIds.add(key);
  }

  for (const shape of parsedShapes) {
    const key = `shape:${shape.attributes.id}`;
    if (!consumedIds.has(key)) {
      shapes.push(shape);
      consumedIds.add(key);
    }
  }

  for (const image of parsedImages) {
    const key = `img:${image.attributes.id}`;
    if (!consumedIds.has(key)) {
      shapes.push(image);
      consumedIds.add(key);
    }
  }

  dataNode.shape = parsedShapes.map((shape) => shape.rawNode);
  dataNode.img = parsedImages.map((image) => {
    const rawImage = { ...image.rawNode };
    delete rawImage["@_type"];
    return rawImage;
  });
  normalizedSlideNode.data = dataNode;

  return {
    slideId: String(normalizedSlideNode["@_id"] ?? ""),
    rawSlideNode: normalizedSlideNode,
    shapes,
  };
}
