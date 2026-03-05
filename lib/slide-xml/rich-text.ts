import type { XmlNode, XmlValue } from "@/lib/slide-xml/types";

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseLineSpacing(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const [mode, size] = value.split(":");
  const numeric = Number(size);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (mode === "multiple") {
    return `${numeric}`;
  }

  if (mode === "fixed") {
    return `calc(var(--slide-unit) * ${numeric})`;
  }

  return null;
}

function toSlideUnit(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return `calc(var(--slide-unit) * ${numeric})`;
}

function toSlideFontUnit(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return `calc(var(--slide-unit) * var(--slide-font-scale, 1) * ${numeric})`;
}

function styleFromAttributes(attributes: Record<string, unknown>, tagName: string): string {
  const styleEntries: string[] = [];

  const color = attributes.color;
  if (typeof color === "string" && color.length > 0) {
    styleEntries.push(`color:${color}`);
  }

  const fontSize = toSlideFontUnit(attributes.fontSize);
  if (fontSize) {
    styleEntries.push(`font-size:${fontSize}`);
  }

  const fontFamily = attributes.fontFamily;
  if (typeof fontFamily === "string" && fontFamily.length > 0) {
    if (fontFamily === "Montserrat") {
      styleEntries.push("font-family:var(--font-montserrat)");
    } else if (fontFamily === "Open Sans") {
      styleEntries.push("font-family:var(--font-open-sans)");
    } else {
      styleEntries.push(`font-family:${JSON.stringify(fontFamily)}`);
    }
  }

  const textAlign = attributes.textAlign;
  if (typeof textAlign === "string" && textAlign.length > 0) {
    styleEntries.push(`text-align:${textAlign}`);
  }

  const paddingTop = toSlideUnit(attributes.paddingTop);
  if (paddingTop) {
    styleEntries.push(`padding-top:${paddingTop}`);
  }

  const paddingRight = toSlideUnit(attributes.paddingRight);
  if (paddingRight) {
    styleEntries.push(`padding-right:${paddingRight}`);
  }

  const paddingBottom = toSlideUnit(attributes.paddingBottom);
  if (paddingBottom) {
    styleEntries.push(`padding-bottom:${paddingBottom}`);
  }

  const paddingLeft = toSlideUnit(attributes.paddingLeft);
  if (paddingLeft) {
    styleEntries.push(`padding-left:${paddingLeft}`);
  }

  const beforeLineSpacing = attributes.beforeLineSpacing;
  if (tagName === "p" && typeof beforeLineSpacing === "string") {
    const [, size] = beforeLineSpacing.split(":");
    const marginTop = toSlideUnit(size);
    if (marginTop) {
      styleEntries.push(`margin-top:${marginTop}`);
    }
  }

  const lineHeight = parseLineSpacing(attributes.lineSpacing);
  if (lineHeight) {
    styleEntries.push(`line-height:${lineHeight}`);
  }

  if (attributes.wrap === "false") {
    styleEntries.push("white-space:nowrap");
  }

  if (tagName === "content") {
    const verticalAlign = attributes.verticalAlign;
    if (verticalAlign === "top") {
      styleEntries.push("display:flex");
      styleEntries.push("flex-direction:column");
      styleEntries.push("justify-content:flex-start");
    } else if (verticalAlign === "middle" || verticalAlign === "center") {
      styleEntries.push("display:flex");
      styleEntries.push("flex-direction:column");
      styleEntries.push("justify-content:center");
    } else if (verticalAlign === "bottom") {
      styleEntries.push("display:flex");
      styleEntries.push("flex-direction:column");
      styleEntries.push("justify-content:flex-end");
    }
  }

  return styleEntries.join(";");
}

function ensureXmlNode(value: XmlValue): XmlNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as XmlNode;
}

function renderXmlTag(tagName: string, input: XmlValue): string {
  if (Array.isArray(input)) {
    return input.map((item) => renderXmlTag(tagName, item)).join("");
  }

  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    const text = escapeHtml(decodeXmlEntities(String(input)));
    return `<${tagName}>${text}</${tagName}>`;
  }

  if (!input || typeof input !== "object") {
    return `<${tagName}></${tagName}>`;
  }

  const node = ensureXmlNode(input);
  const attributes: Record<string, unknown> = {};
  let text = "";
  const children: string[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key === "#text") {
      text = escapeHtml(decodeXmlEntities(String(value)));
      continue;
    }

    if (key.startsWith("@_")) {
      attributes[key.slice(2)] = value;
      continue;
    }

    children.push(renderXmlTag(key, value));
  }

  const style = styleFromAttributes(attributes, tagName);
  const styleAttribute = style.length > 0 ? ` style="${escapeHtml(style)}"` : "";

  return `<${tagName}${styleAttribute}>${text}${children.join("")}</${tagName}>`;
}

export function buildShapeContentHtml(contentNode: XmlValue): string {
  const node = ensureXmlNode(contentNode);
  const rootAttributes: Record<string, unknown> = {};
  const blocks: string[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_")) {
      rootAttributes[key.slice(2)] = value;
    }
  }

  for (const key of ["p", "ul", "ol"]) {
    const value = node[key];
    for (const item of toArray(value as XmlValue)) {
      blocks.push(renderXmlTag(key, item));
    }
  }

  if (blocks.length === 0) {
    const text = node["#text"];
    if (typeof text === "string") {
      blocks.push(`<p>${escapeHtml(decodeXmlEntities(text))}</p>`);
    }
  }

  const contentStyle = styleFromAttributes(rootAttributes, "content");
  const styleAttribute = contentStyle.length > 0 ? ` style="${escapeHtml(contentStyle)}"` : "";

  return `<div${styleAttribute}>${blocks.join("")}</div>`;
}
