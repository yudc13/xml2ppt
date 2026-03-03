import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type { SlideShapeModel, XmlNode } from "@/lib/slide-xml/types";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

function toPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
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

export function SlideShape({ shape }: { shape: SlideShapeModel }) {
  const { attributes, style, rawNode } = shape;
  const contentNode = rawNode.content;
  const hasContent = Boolean(contentNode);
  const backgroundColor = getFillColor(rawNode);
  const borderColor = getBorderColor(rawNode);

  const html = hasContent ? buildShapeContentHtml(contentNode) : "";

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: toPercent(attributes.topLeftX, SLIDE_WIDTH),
        top: toPercent(attributes.topLeftY, SLIDE_HEIGHT),
        width: toPercent(attributes.width, SLIDE_WIDTH),
        height: toPercent(attributes.height, SLIDE_HEIGHT),
        background: backgroundColor,
        borderRadius: style.borderRadius,
        border: borderColor ? `1px solid ${borderColor}` : undefined,
      }}
    >
      {hasContent ? (
        <div
          className="h-full w-full"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
    </div>
  );
}
