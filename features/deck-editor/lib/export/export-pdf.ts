"use client";

import { jsPDF } from "jspdf";

import { parseSlideXml } from "@/lib/slide-xml/parser";
import type { SlideShapeModel } from "@/lib/slide-xml/types";
import {
  extractText,
  getBorderColor,
  getBorderWidth,
  getFillColor,
  getTextStyle,
  parseColor,
  parseTable,
} from "@/features/deck-editor/lib/export/shared";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const PDF_RENDER_SCALE = 2;
const PDF_CANVAS_WIDTH = SLIDE_WIDTH * PDF_RENDER_SCALE;
const PDF_CANVAS_HEIGHT = SLIDE_HEIGHT * PDF_RENDER_SCALE;
const PDF_SCALE_RATIO = PDF_RENDER_SCALE;

function setFill(ctx: CanvasRenderingContext2D, shape: SlideShapeModel) {
  const fill = parseColor(getFillColor(shape));
  ctx.fillStyle = `rgba(${parseInt(fill.hex.slice(0, 2), 16)}, ${parseInt(fill.hex.slice(2, 4), 16)}, ${parseInt(fill.hex.slice(4, 6), 16)}, ${fill.alpha})`;
  return fill.alpha;
}

function setStroke(ctx: CanvasRenderingContext2D, shape: SlideShapeModel) {
  const stroke = parseColor(getBorderColor(shape));
  ctx.strokeStyle = `rgba(${parseInt(stroke.hex.slice(0, 2), 16)}, ${parseInt(stroke.hex.slice(2, 4), 16)}, ${parseInt(stroke.hex.slice(4, 6), 16)}, ${stroke.alpha})`;
  ctx.lineWidth = Math.max(0.5, getBorderWidth(shape)) * PDF_SCALE_RATIO;
}

function wrapTextByWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) {
    return [""];
  }

  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const ch of paragraph) {
      const next = current + ch;
      if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
        current = next;
      } else {
        lines.push(current);
        current = ch;
      }
    }
    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: boolean,
  stroke: boolean,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function drawShape(ctx: CanvasRenderingContext2D, shape: SlideShapeModel): Promise<void> {
  const { attributes } = shape;
  const x = attributes.topLeftX * PDF_SCALE_RATIO;
  const y = attributes.topLeftY * PDF_SCALE_RATIO;
  const w = attributes.width * PDF_SCALE_RATIO;
  const h = attributes.height * PDF_SCALE_RATIO;

  if (attributes.type === "text") {
    const text = extractText(shape.rawNode.content).trim();
    const style = getTextStyle(shape);
    const color = parseColor(style.color);
    ctx.fillStyle = `rgba(${parseInt(color.hex.slice(0, 2), 16)}, ${parseInt(color.hex.slice(2, 4), 16)}, ${parseInt(color.hex.slice(4, 6), 16)}, ${color.alpha})`;
    ctx.textBaseline = "top";
    const fontSize = style.fontSize * PDF_SCALE_RATIO;
    ctx.font = `${fontSize}px "${style.fontFamily}", "Noto Sans SC", "PingFang SC", sans-serif`;
    const lines = wrapTextByWidth(ctx, text || " ", Math.max(8, w - 8));
    const lineHeight = fontSize * 1.3;

    lines.forEach((line, index) => {
      const measured = ctx.measureText(line).width;
      let drawX = x + 4;
      if (style.align === "center") {
        drawX = x + (w - measured) / 2;
      } else if (style.align === "right") {
        drawX = x + w - measured - 4;
      }
      ctx.fillText(line, drawX, y + index * lineHeight);
    });
    return;
  }

  if (attributes.type === "table") {
    const rows = parseTable(shape);
    if (rows.length === 0) {
      return;
    }

    const rowCount = rows.length;
    const colCount = Math.max(...rows.map((row) => row.length));
    const rowHeight = h / rowCount;
    const colWidth = w / colCount;

    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = PDF_SCALE_RATIO;
    ctx.fillStyle = "#334155";
    ctx.font = `${12 * PDF_SCALE_RATIO}px "Noto Sans SC", "PingFang SC", sans-serif`;
    ctx.textBaseline = "middle";

    rows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellX = x + colIndex * colWidth;
        const cellY = y + rowIndex * rowHeight;
        ctx.strokeRect(cellX, cellY, colWidth, rowHeight);
        const clipped = wrapTextByWidth(ctx, cell, Math.max(8, colWidth - 8))[0] ?? "";
        const tw = ctx.measureText(clipped).width;
        ctx.fillText(clipped, cellX + (colWidth - tw) / 2, cellY + rowHeight / 2);
      });
    });
    return;
  }

  if (attributes.type === "image") {
    const src = shape.rawNode["@_src"];
    if (typeof src === "string" && src.length > 0) {
      const image = await loadImage(src);
      if (image) {
        ctx.drawImage(image, x, y, w, h);
      }
    }
    return;
  }

  if (attributes.type === "line" || attributes.type === "arrow") {
    setStroke(ctx, shape);
    const centerY = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(x, centerY);
    ctx.lineTo(x + w, centerY);
    ctx.stroke();

    if (attributes.type === "arrow") {
      const arrowSize = 8 * PDF_SCALE_RATIO;
      ctx.beginPath();
      ctx.moveTo(x + w, centerY);
      ctx.lineTo(x + w - arrowSize, centerY - arrowSize / 2);
      ctx.lineTo(x + w - arrowSize, centerY + arrowSize / 2);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
    return;
  }

  const fillAlpha = setFill(ctx, shape);
  setStroke(ctx, shape);

  const shouldFill = fillAlpha > 0;
  const shouldStroke = getBorderWidth(shape) > 0;
  if (attributes.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (shouldFill) {
      ctx.fill();
    }
    if (shouldStroke) {
      ctx.stroke();
    }
    return;
  }

  if (attributes.type === "round-rect") {
    drawRoundedRect(ctx, x, y, w, h, 8 * PDF_SCALE_RATIO, shouldFill, shouldStroke);
    return;
  }

  if (shouldFill) {
    ctx.fillRect(x, y, w, h);
  }
  if (shouldStroke) {
    ctx.strokeRect(x, y, w, h);
  }
}

async function renderSlideToDataUrl(slideXml: string): Promise<string> {
  const model = parseSlideXml(slideXml);
  const canvas = document.createElement("canvas");
  canvas.width = PDF_CANVAS_WIDTH;
  canvas.height = PDF_CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const shape of model.shapes) {
    await drawShape(ctx, shape);
  }

  return canvas.toDataURL("image/png");
}

export async function exportSlidesToPdf(slideXmlList: string[], fileName: string) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [SLIDE_WIDTH, SLIDE_HEIGHT],
  });

  for (let index = 0; index < slideXmlList.length; index += 1) {
    if (index > 0) {
      doc.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], "landscape");
    }

    const dataUrl = await renderSlideToDataUrl(slideXmlList[index]);
    doc.addImage(dataUrl, "PNG", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  }

  doc.save(`${fileName}.pdf`);
}
