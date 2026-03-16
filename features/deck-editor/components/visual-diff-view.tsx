"use client";

import { useMemo, useState } from "react";

import type { SlideDiffChange, SlideDiffResult } from "@/features/deck-editor/types";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import type { SlideShapeModel } from "@/lib/slide-xml/types";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

type ChangeVisualType = SlideDiffChange["type"] | "base";

function toShapeMap(shapes: SlideShapeModel[]): Map<string, SlideShapeModel> {
  return new Map(shapes.map((shape) => [shape.attributes.id, shape] as const));
}

function getChangeColor(type: ChangeVisualType): string {
  if (type === "added") {
    return "rgba(16, 185, 129, 0.95)";
  }
  if (type === "removed") {
    return "rgba(244, 63, 94, 0.95)";
  }
  if (type === "moved_resized") {
    return "rgba(14, 165, 233, 0.95)";
  }
  if (type === "text_changed") {
    return "rgba(245, 158, 11, 0.95)";
  }
  return "rgba(148, 163, 184, 0.45)";
}

function toPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function ShapeLayer({
  shapes,
  changedShapeTypeById,
  selectedShapeId,
}: {
  shapes: SlideShapeModel[];
  changedShapeTypeById: Map<string, ChangeVisualType>;
  selectedShapeId: string | null;
}) {
  return (
    <div className="absolute inset-0">
      {shapes.map((shape) => {
        const changeType = changedShapeTypeById.get(shape.attributes.id) ?? "base";
        const color = getChangeColor(changeType);
        const isSelected = selectedShapeId === shape.attributes.id;

        return (
          <div
            key={shape.attributes.id}
            className="absolute"
            style={{
              left: toPercent(shape.attributes.topLeftX, SLIDE_WIDTH),
              top: toPercent(shape.attributes.topLeftY, SLIDE_HEIGHT),
              width: toPercent(shape.attributes.width, SLIDE_WIDTH),
              height: toPercent(shape.attributes.height, SLIDE_HEIGHT),
              transform: `rotate(${shape.attributes.rotation}deg)`,
              transformOrigin: "center",
              border: `1px solid ${color}`,
              backgroundColor: isSelected ? `${color}22` : "transparent",
              boxShadow: isSelected ? `0 0 0 2px ${color}` : "none",
              transition: "all 120ms ease",
            }}
          />
        );
      })}
    </div>
  );
}

function typeLabel(type: SlideDiffChange["type"]): string {
  if (type === "added") {
    return "新增";
  }
  if (type === "removed") {
    return "删除";
  }
  if (type === "moved_resized") {
    return "布局变化";
  }
  return "文本变化";
}

export function VisualDiffView({
  diff,
  fromXml,
  toXml,
}: {
  diff: SlideDiffResult;
  fromXml: string;
  toXml: string;
}) {
  const [selectedChangeKey, setSelectedChangeKey] = useState<string | null>(null);

  const fromShapes = useMemo(() => parseSlideXml(fromXml).shapes, [fromXml]);
  const toShapes = useMemo(() => parseSlideXml(toXml).shapes, [toXml]);
  const fromShapeMap = useMemo(() => toShapeMap(fromShapes), [fromShapes]);
  const toShapeMapData = useMemo(() => toShapeMap(toShapes), [toShapes]);

  const selectedChange = useMemo(() => {
    if (!selectedChangeKey) {
      return null;
    }
    return diff.changes.find((change, index) => `${change.type}-${change.shapeId}-${index}` === selectedChangeKey) ?? null;
  }, [diff.changes, selectedChangeKey]);

  const fromHighlightMap = useMemo(() => {
    const map = new Map<string, ChangeVisualType>();
    for (const change of diff.changes) {
      if (change.type === "added") {
        continue;
      }
      if (fromShapeMap.has(change.shapeId)) {
        map.set(change.shapeId, change.type);
      }
    }
    return map;
  }, [diff.changes, fromShapeMap]);

  const toHighlightMap = useMemo(() => {
    const map = new Map<string, ChangeVisualType>();
    for (const change of diff.changes) {
      if (change.type === "removed") {
        continue;
      }
      if (toShapeMapData.has(change.shapeId)) {
        map.set(change.shapeId, change.type);
      }
    }
    return map;
  }, [diff.changes, toShapeMapData]);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-2 text-[11px] text-slate-600">
        可视化对比 v{diff.fromVersion} → v{diff.toVersion}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-medium text-slate-500">旧版本（from）</div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-slate-200 bg-white">
            <ShapeLayer
              shapes={fromShapes}
              changedShapeTypeById={fromHighlightMap}
              selectedShapeId={selectedChange?.shapeId ?? null}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium text-slate-500">当前版本（to）</div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-slate-200 bg-white">
            <ShapeLayer
              shapes={toShapes}
              changedShapeTypeById={toHighlightMap}
              selectedShapeId={selectedChange?.shapeId ?? null}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          新增
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          删除
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
          布局变化
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          文本变化
        </span>
      </div>

      <div className="mt-2 max-h-36 space-y-1 overflow-auto rounded-md border border-slate-200 bg-white p-2">
        {diff.changes.length === 0 ? (
          <div className="text-[11px] text-slate-500">与当前版本无差异</div>
        ) : (
          diff.changes.map((change, index) => {
            const key = `${change.type}-${change.shapeId}-${index}`;
            const isActive = key === selectedChangeKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedChangeKey(isActive ? null : key)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors ${
                  isActive ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>
                  [{typeLabel(change.type)}] {change.shapeId}
                </span>
                <span className="text-[10px] text-slate-400">{change.summary}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
