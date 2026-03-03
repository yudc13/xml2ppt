"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";

import { useSlideEditorStore } from "@/features/slide-editor/store";
import type { EditableSlideShape } from "@/features/slide-editor/store";
import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type { SlideShapeModel, XmlNode } from "@/lib/slide-xml/types";

const RESIZE_HANDLE_SIZE = 10;

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

type SlideShapeProps = {
  shape: EditableSlideShape | SlideShapeModel;
  viewportRef?: RefObject<HTMLDivElement | null>;
  interactive?: boolean;
};

export function SlideShape({ shape, viewportRef, interactive = false }: SlideShapeProps) {
  const selectedShapeId = useSlideEditorStore((state) => state.selectedShapeId);
  const editingShapeId = useSlideEditorStore((state) => state.editingShapeId);
  const selectShape = useSlideEditorStore((state) => state.selectShape);
  const setEditingShape = useSlideEditorStore((state) => state.setEditingShape);
  const updateShapePosition = useSlideEditorStore((state) => state.updateShapePosition);
  const updateShapeSize = useSlideEditorStore((state) => state.updateShapeSize);
  const updateShapeContentHtml = useSlideEditorStore((state) => state.updateShapeContentHtml);

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
            onBlur={() => {
              if (!isInteractive) {
                return;
              }
              const content = editableRef.current?.innerHTML ?? "";
              updateShapeContentHtml(shapeId, content);
              setEditingShape(null);
            }}
          />
        ) : null}
      </div>

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
