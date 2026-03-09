"use client";

import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export type TableToolbarProps = {
  isMobile: boolean;
  portalStyle: CSSProperties | null;
  activeRowIndex: number;
  activeColIndex: number;
  rowCount: number;
  colCount: number;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteCurrentRow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onDeleteCurrentCol: () => void;
};

export function TableToolbar({
  isMobile,
  portalStyle,
  activeRowIndex,
  activeColIndex,
  rowCount,
  colCount,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteCurrentRow,
  onInsertColLeft,
  onInsertColRight,
  onDeleteCurrentCol,
}: TableToolbarProps) {
  if (!portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-shape-toolbar="true"
      style={portalStyle}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className={`flex max-w-[min(92vw,860px)] flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] ${isMobile ? "px-1.5 py-1" : "px-2 py-1"
          }`}
      >
        <div className="flex items-center gap-1">
          <span
            className={`whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 text-sky-700 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
              }`}
          >
            行 {activeRowIndex + 1}
          </span>
          <span
            className={`whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 text-amber-700 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
              }`}
          >
            列 {activeColIndex + 1}
          </span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          onClick={onInsertRowAbove}
        >
          上插行
        </button>
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          onClick={onInsertRowBelow}
        >
          下插行
        </button>
        <button
          type="button"
          disabled={rowCount <= 1}
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          onClick={onDeleteCurrentRow}
        >
          删当前行
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          onClick={onInsertColLeft}
        >
          左插列
        </button>
        <button
          type="button"
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          onClick={onInsertColRight}
        >
          右插列
        </button>
        <button
          type="button"
          disabled={colCount <= 1}
          className={`whitespace-nowrap rounded-md text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 ${isMobile ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          onClick={onDeleteCurrentCol}
        >
          删当前列
        </button>
      </div>
    </div>,
    document.body,
  );
}
