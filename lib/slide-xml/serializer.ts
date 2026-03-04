import { XMLBuilder } from "fast-xml-parser";

import { normalizeRgbaColor } from "@/lib/slide-xml/parser";
import type { SlideDocumentModel, SlideShapeModel, XmlNode, XmlValue } from "@/lib/slide-xml/types";

const SHAPE_NUMERIC_ATTRIBUTE_KEYS = [
  "width",
  "height",
  "topLeftX",
  "topLeftY",
  "rotation",
  "presetHandlers",
] as const;

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: false,
  suppressEmptyNode: false,
});

function stringifyNumber(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return `${value}`;
}

function cloneXmlNode(node: XmlNode): XmlNode {
  return structuredClone(node);
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

function ensureXmlNode(value: unknown): XmlNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as XmlNode;
}

function shapeToXmlNode(shape: SlideShapeModel): XmlNode {
  const shapeNode = cloneXmlNode(shape.rawNode);

  shapeNode["@_id"] = shape.attributes.id;
  shapeNode["@_type"] = shape.attributes.type;

  for (const key of SHAPE_NUMERIC_ATTRIBUTE_KEYS) {
    const attributeKey = `@_${key}`;
    if (!(attributeKey in shapeNode)) {
      continue;
    }

    const rawValue = shapeNode[attributeKey];
    if (typeof rawValue === "number") {
      shapeNode[attributeKey] = stringifyNumber(rawValue);
    }
  }

  shapeNode["@_width"] = stringifyNumber(shape.attributes.width);
  shapeNode["@_height"] = stringifyNumber(shape.attributes.height);
  shapeNode["@_topLeftX"] = stringifyNumber(shape.attributes.topLeftX);
  shapeNode["@_topLeftY"] = stringifyNumber(shape.attributes.topLeftY);
  shapeNode["@_rotation"] = stringifyNumber(shape.attributes.rotation);

  return normalizeRgbaInTree(shapeNode) as XmlNode;
}

export function serializeSlideDocument(model: SlideDocumentModel): string {
  const slideNode = cloneXmlNode(model.rawSlideNode);
  const dataNode = ensureXmlNode(slideNode.data);

  dataNode.shape = model.shapes.map((shape) => shapeToXmlNode(shape));
  slideNode.data = dataNode;

  const normalizedSlideNode = normalizeRgbaInTree(slideNode) as XmlNode;

  return builder.build({
    slide: normalizedSlideNode,
  });
}
