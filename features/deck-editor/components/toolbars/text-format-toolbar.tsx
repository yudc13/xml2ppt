"use client";

import { ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  ALIGN_OPTIONS,
  COLOR_OPTIONS,
  FONT_OPTIONS,
  LIST_OPTIONS,
  THEME_COLOR_OPTIONS,
} from "./types";
import type { TextStyleState } from "./types";

export type TextFormatToolbarProps = {
  isMobile: boolean;
  portalStyle: CSSProperties | null;
  textStyle: TextStyleState;
  onApplyAlign: (align: TextStyleState["textAlign"]) => void;
  onApplyListType: (listType: TextStyleState["listType"]) => void;
  onApplyFont: (fontFamily: string) => void;
  onApplyFontSize: (fontSize: number) => void;
  onApplyColor: (color: string) => void;
};

export function TextFormatToolbar({
  isMobile,
  portalStyle,
  textStyle,
  onApplyAlign,
  onApplyListType,
  onApplyFont,
  onApplyFontSize,
  onApplyColor,
}: TextFormatToolbarProps) {
  const [activePanel, setActivePanel] = useState<"align" | "list" | "font" | "color" | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
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

  const alignLabel = useMemo(() => {
    const option = ALIGN_OPTIONS.find((item) => item.value === textStyle.textAlign);
    return option?.label ?? "左对齐";
  }, [textStyle.textAlign]);

  const listLabel = useMemo(() => {
    const option = LIST_OPTIONS.find((item) => item.value === textStyle.listType);
    return option?.label ?? "无列表";
  }, [textStyle.listType]);

  const handleColorApply = useCallback(
    (color: string) => {
      onApplyColor(color);
      setRecentColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 8));
      setActivePanel(null);
    },
    [onApplyColor],
  );

  if (!portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-shape-toolbar="true"
      style={portalStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div ref={toolbarRef} className="relative">
        <div
          className={`flex items-center rounded-2xl border border-slate-300 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] ${isMobile ? "gap-1 px-1.5 py-1" : "min-w-max gap-2 px-2 py-1.5"
            }`}
        >
          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "align" ? null : "align"))}
            >
              {alignLabel}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${activePanel === "align" ? "rotate-180" : ""
                  }`}
              />
            </button>
            {activePanel === "align" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-44 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {ALIGN_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${textStyle.textAlign === option.value
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-700 hover:bg-slate-100"
                        }`}
                      onClick={() => {
                        onApplyAlign(option.value);
                        setActivePanel(null);
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setActivePanel((current) => (current === "list" ? null : "list"))}
            >
              {listLabel}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${activePanel === "list" ? "rotate-180" : ""
                  }`}
              />
            </button>
            {activePanel === "list" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-44 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {LIST_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${textStyle.listType === option.value
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-700 hover:bg-slate-100"
                        }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onApplyListType(option.value);
                        setActivePanel(null);
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "font" ? null : "font"))}
            >
              <span className="max-w-[120px] truncate">{textStyle.fontFamily}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${activePanel === "font" ? "rotate-180" : ""
                  }`}
              />
            </button>
            {activePanel === "font" ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-48 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font}
                    type="button"
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors ${textStyle.fontFamily === font
                        ? "bg-sky-50 text-sky-700"
                        : "text-slate-700 hover:bg-slate-100"
                      }`}
                    style={{ fontFamily: font }}
                    onClick={() => {
                      onApplyFont(font);
                      setActivePanel(null);
                    }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex h-8 items-center rounded-xl border border-slate-300 bg-white p-0.5">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyFontSize(Math.max(8, textStyle.fontSize - 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            >
              -
            </button>
            <span className="w-9 text-center text-sm font-medium text-slate-800">
              {textStyle.fontSize}
            </span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyFontSize(Math.min(96, textStyle.fontSize + 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            >
              +
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => setActivePanel((current) => (current === "color" ? null : "color"))}
            >
              <span
                className="h-4 w-4 rounded-full border border-slate-200"
                style={{ backgroundColor: textStyle.color }}
              />
              <span>颜色</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${activePanel === "color" ? "rotate-180" : ""
                  }`}
              />
            </button>
            {activePanel === "color" ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[260px] rounded-xl border border-slate-300 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                <p className="mb-2 text-xs font-medium text-slate-500">主题色</p>
                <div className="mb-3 grid grid-cols-6 gap-2">
                  {THEME_COLOR_OPTIONS.map((color) => (
                    <button
                      key={`theme-${color}`}
                      type="button"
                      className="h-7 w-7 rounded-full border border-slate-200"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          textStyle.color === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                      }}
                      onClick={() => handleColorApply(color)}
                    />
                  ))}
                </div>

                <p className="mb-2 text-xs font-medium text-slate-500">最近使用颜色</p>
                <div className="mb-3 grid min-h-8 grid-cols-6 gap-2">
                  {recentColors.length > 0 ? (
                    recentColors.map((color) => (
                      <button
                        key={`recent-${color}`}
                        type="button"
                        className="h-7 w-7 rounded-full border border-slate-200"
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            textStyle.color === color
                              ? "0 0 0 2px rgba(14,116,244,0.35)"
                              : undefined,
                        }}
                        onClick={() => handleColorApply(color)}
                      />
                    ))
                  ) : (
                    <span className="col-span-6 text-[11px] text-slate-400">暂无最近使用</span>
                  )}
                </div>

                <p className="mb-2 text-xs font-medium text-slate-500">预设色板</p>
                <div className="grid grid-cols-6 gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={`preset-${color}`}
                      type="button"
                      className="h-7 w-7 rounded-full border border-slate-200"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          textStyle.color === color ? "0 0 0 2px rgba(14,116,244,0.35)" : undefined,
                      }}
                      onClick={() => handleColorApply(color)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
