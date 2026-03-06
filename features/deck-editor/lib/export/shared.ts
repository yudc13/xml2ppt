import type { SlideShapeModel, XmlNode, XmlValue } from "@/lib/slide-xml/types";

const PX_PER_INCH = 96;

export function pxToInches(value: number): number {
  return value / PX_PER_INCH;
}

export function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function extractText(value: XmlValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractText(item)).join("");
  }

  const node = value as XmlNode;
  const ownText = typeof node["#text"] === "string" ? node["#text"] : "";
  const childText = Object.entries(node)
    .filter(([key]) => !key.startsWith("@_") && key !== "#text")
    .map(([, child]) => extractText(child as XmlValue))
    .join("");

  return `${ownText}${childText}`;
}

function parseRgbChannels(input: string): { r: number; g: number; b: number; a: number } | null {
  const normalized = input.trim();
  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbaMatch) {
    return null;
  }

  const parts = rgbaMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return null;
  }

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts[3] === undefined ? 1 : Number(parts[3]);
  if (![r, g, b, a].every(Number.isFinite)) {
    return null;
  }

  return {
    r: Math.min(255, Math.max(0, Math.round(r))),
    g: Math.min(255, Math.max(0, Math.round(g))),
    b: Math.min(255, Math.max(0, Math.round(b))),
    a: Math.min(1, Math.max(0, a)),
  };
}

function channelToHex(channel: number): string {
  return channel.toString(16).padStart(2, "0");
}

export function parseColor(input: string | undefined): { hex: string; alpha: number } {
  if (!input) {
    return { hex: "000000", alpha: 1 };
  }

  const color = input.trim();
  if (color.startsWith("#")) {
    const compact = color.slice(1);
    if (/^[\da-fA-F]{3}$/.test(compact)) {
      return {
        hex: compact
          .split("")
          .map((ch) => ch + ch)
          .join("")
          .toUpperCase(),
        alpha: 1,
      };
    }

    if (/^[\da-fA-F]{6}$/.test(compact)) {
      return { hex: compact.toUpperCase(), alpha: 1 };
    }
  }

  const channels = parseRgbChannels(color);
  if (channels) {
    return {
      hex: `${channelToHex(channels.r)}${channelToHex(channels.g)}${channelToHex(channels.b)}`.toUpperCase(),
      alpha: channels.a,
    };
  }

  return { hex: "000000", alpha: 1 };
}

export function getContentNode(shape: SlideShapeModel): XmlNode {
  const content = shape.rawNode.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return {};
  }

  return content as XmlNode;
}

export function getFillColor(shape: SlideShapeModel): string | undefined {
  const fill = shape.rawNode.fill;
  if (!fill || typeof fill !== "object" || Array.isArray(fill)) {
    return undefined;
  }

  const fillNode = fill as XmlNode;
  const fillColor = fillNode.fillColor;
  if (!fillColor || typeof fillColor !== "object" || Array.isArray(fillColor)) {
    return undefined;
  }

  const color = (fillColor as XmlNode)["@_color"];
  return typeof color === "string" ? color : undefined;
}

export function getBorderColor(shape: SlideShapeModel): string | undefined {
  const border = shape.rawNode.border;
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return undefined;
  }

  const color = (border as XmlNode)["@_color"];
  return typeof color === "string" ? color : undefined;
}

export function getBorderWidth(shape: SlideShapeModel): number {
  const border = shape.rawNode.border;
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return 0;
  }

  const width = Number((border as XmlNode)["@_width"]);
  return Number.isFinite(width) ? Math.max(0, width) : 0;
}

export function getTextStyle(shape: SlideShapeModel): {
  fontSize: number;
  fontFamily: string;
  color: string;
  align: "left" | "center" | "right";
} {
  const contentNode = getContentNode(shape);
  const fontSize = Number(contentNode["@_fontSize"]);
  const fontFamily = String(contentNode["@_fontFamily"] ?? "Arial");
  const color = String(contentNode["@_color"] ?? "rgba(31, 35, 41, 1)");
  const textAlignRaw = String(contentNode["@_textAlign"] ?? "left").toLowerCase();
  const align = textAlignRaw === "center" || textAlignRaw === "right" ? textAlignRaw : "left";

  return {
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16,
    fontFamily,
    color,
    align,
  };
}

export function parseTable(shape: SlideShapeModel): string[][] {
  const contentNode = getContentNode(shape);
  const tableValue = contentNode.table;
  if (!tableValue || typeof tableValue !== "object" || Array.isArray(tableValue)) {
    return [];
  }

  const rows = toArray((tableValue as XmlNode).row as XmlValue | XmlValue[] | undefined);
  return rows
    .map((rowValue) => {
      if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) {
        return [];
      }

      const rowNode = rowValue as XmlNode;
      const cells = toArray(rowNode.cell as XmlValue | XmlValue[] | undefined);
      return cells.map((cell) => extractText(cell).trim());
    })
    .filter((row) => row.length > 0);
}

export async function resolveImageData(source: string): Promise<string | null> {
  try {
    const response = await fetch(source);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
