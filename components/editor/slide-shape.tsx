"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  AlignLeft,
  Bold,
  ChevronDown,
  Link2,
  List,
  Minus,
  Pilcrow,
  Plus,
  Sparkles,
  Type,
  WandSparkles,
} from "lucide-react";

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
        hasContent ? (
          <TextFormatToolbar />
        ) : null
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

function TextFormatToolbar() {
  return (
    <div
      className="absolute bottom-full left-1/2 z-40 mb-3 -translate-x-1/2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-max items-center rounded-2xl border border-slate-300 bg-white px-2 py-1.5 shadow-[0_4px_18px_rgba(15,23,42,0.12)]">
        <ToolbarItem icon={<Sparkles className="h-4 w-4" />} label="Ask AI" highlighted />
        <Divider />
        <ToolbarItem label="正文" icon={<ChevronDown className="h-4 w-4" />} />
        <Divider />
        <ToolbarItem label="Montserrat" icon={<ChevronDown className="h-4 w-4" />} />
        <StepperControl />
        <ToolbarItem icon={<AlignLeft className="h-4 w-4" />} />
        <ToolbarItem icon={<List className="h-4 w-4" />} />
        <ToolbarItem icon={<Bold className="h-4 w-4" />} />
        <ToolbarItem icon={<Link2 className="h-4 w-4" />} />
        <ToolbarItem icon={<Type className="h-4 w-4" />} label="字体" />
        <Divider />
        <ToolbarItem icon={<Pilcrow className="h-4 w-4" />} label="段落" />
        <ToolbarItem icon={<WandSparkles className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-2 h-8 w-px bg-slate-200" />;
}

function IconButton({ icon, active = false }: { icon: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-700 transition-colors duration-200 hover:bg-slate-100 ${
        active ? "bg-blue-50 text-blue-600" : ""
      }`}
    >
      {icon}
    </button>
  );
}

function ToolbarItem({
  icon,
  label,
  highlighted = false,
}: {
  icon?: ReactNode;
  label?: string;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 ${
        highlighted ? "text-slate-900" : "text-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StepperControl() {
  return (
    <div className="flex h-8 items-center rounded-xl border border-slate-300">
      <IconButton icon={<Minus className="h-4 w-4" />} />
      <span className="w-10 text-center text-sm font-medium text-slate-800">36</span>
      <IconButton icon={<Plus className="h-4 w-4" />} />
    </div>
  );
}
