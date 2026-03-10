"use client";

import { ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  BORDER_STYLE_OPTIONS,
  SHAPE_BORDER_OPTIONS,
  SHAPE_FILL_OPTIONS,
} from "./types";

export type ShapeStyleToolbarProps = {
  isMobile: boolean;
  portalStyle: CSSProperties | null;
  isLineLikeShape: boolean;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
  aiButton?: ReactNode;
  onFillColorChange: (color: string) => void;
  onBorderStyleChange: (style: "solid" | "dashed" | "dotted") => void;
  onBorderColorChange: (color: string) => void;
  onBorderWidthChange: (width: number) => void;
};

export function ShapeStyleToolbar({
  isMobile,
  portalStyle,
  isLineLikeShape,
  fillColor,
  borderColor,
  borderWidth,
  borderStyle,
  aiButton,
  onFillColorChange,
  onBorderStyleChange,
  onBorderColorChange,
  onBorderWidthChange,
}: ShapeStyleToolbarProps) {
  const [activePanel, setActivePanel] = useState<"fill" | "border" | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDownOutside = (event: PointerEvent) => {
      if (!toolbarRef.current) {
        return;
      }

      if (!toolbarRef.current.contains(event.target as Node)) {
        setActivePanel(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownOutside);
    };
  }, []);

  if (!portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-shape-toolbar="true"
      style={portalStyle}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div ref={toolbarRef} className="relative">
        <div
          className={`flex items-center rounded-2xl border border-slate-300 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] ${isMobile ? "gap-1 px-1.5 py-1" : "min-w-max gap-2 px-2 py-1.5"
            }`}
        >
          {!isLineLikeShape ? (
            <div className="relative">
              <button
                type="button"
                className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
                onClick={() => setActivePanel((current) => (current === "fill" ? null : "fill"))}
              >
                <span
                  className="h-4 w-4 rounded-md border border-slate-200 shadow-sm"
                  style={{ backgroundColor: fillColor }}
                />
                <span>填充</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${activePanel === "fill" ? "rotate-180" : ""
                    }`}
                />
              </button>
              {activePanel === "fill" ? (
                <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[200px] rounded-xl border border-slate-300 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                  <div className="grid grid-cols-5 gap-2">
                    {SHAPE_FILL_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-7 w-7 rounded-full border border-slate-200 transition-transform active:scale-90"
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            fillColor === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                        }}
                        onClick={() => {
                          onFillColorChange(color);
                          setActivePanel(null);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "border" ? null : "border"))}
            >
              <span
                className="h-4 w-4 rounded-md border border-slate-200 shadow-sm"
                style={{ backgroundColor: borderColor }}
              />
              <span>描边</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${activePanel === "border" ? "rotate-180" : ""
                  }`}
              />
            </button>
            {activePanel === "border" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[240px] rounded-xl border border-slate-300 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  颜色
                </p>
                <div className="mb-4 grid grid-cols-6 gap-2">
                  {SHAPE_BORDER_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-7 w-7 rounded-full border border-slate-200 transition-transform active:scale-90"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          borderColor === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                      }}
                      onClick={() => onBorderColorChange(color)}
                    />
                  ))}
                </div>

                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  样式
                </p>
                <div className="mb-4 flex gap-1.5">
                  {BORDER_STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${borderStyle === style.value
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      onClick={() => onBorderStyleChange(style.value)}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>

                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  粗细
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={borderWidth}
                    onChange={(e) => onBorderWidthChange(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-sky-500"
                  />
                  <span className="min-w-[24px] text-right font-mono text-xs font-bold text-slate-600">
                    {borderWidth}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {aiButton ? <div className="ml-1 flex items-center">{aiButton}</div> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
