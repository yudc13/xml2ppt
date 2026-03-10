"use client";

import { useState, type CSSProperties } from "react";

import { TOOLBAR_REGISTRY } from "../../configs/toolbar-registry";
import { AiEditPopover } from "../ask-ai/ai-edit-popover";
import type { TextStyleState } from "./types";
import type { AiShapeContext, AiShapeEditResponse } from "@/lib/ai/types";
import { Sparkles } from "lucide-react";

interface ToolbarManagerProps {
  shapeContext: AiShapeContext;
  context: {
    isMobile: boolean;
    isSelected: boolean;
    isEditing: boolean;
    hasRichTextContent: boolean;
    isTableShape: boolean;
    isShapeStyleTarget: boolean;
    isLineLikeShape: boolean;
    portalStyle: CSSProperties | null;
    textToolbarPortalStyle: CSSProperties | null;
  };
  state: {
    textStyle: TextStyleState;
    activeRowIndex: number;
    activeColIndex: number;
    rowCount: number;
    colCount: number;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderStyle: "solid" | "dashed" | "dotted";
  };
  actions: {
    onApplyTextStyle: (apply: (style: CSSStyleDeclaration) => void) => void;
    onApplyTextAlignment: (align: TextStyleState["textAlign"]) => void;
    onApplyListType: (listType: TextStyleState["listType"]) => void;
    onInsertTableRowAt: (index: number, position: "before" | "after") => void;
    onRemoveTableRowAt: (index: number) => void;
    onInsertTableColumnAt: (index: number, position: "before" | "after") => void;
    onRemoveTableColumnAt: (index: number) => void;
    onUpdateShapeFillColor: (color: string) => void;
    onUpdateShapeBorderStyle: (style: "solid" | "dashed" | "dotted") => void;
    onUpdateShapeBorderColor: (color: string) => void;
    onUpdateShapeBorderWidth: (width: number) => void;
    onApplyAiEditResult?: (result: AiShapeEditResponse) => void;
  };
}

export function ToolbarManager({ shapeContext, context, state, actions }: ToolbarManagerProps) {
  const [isAiPopoverOpen, setIsAiPopoverOpen] = useState(false);

  if (!context.isSelected) {
    return null;
  }

  // Determine active toolbar based on context
  let activeToolbarType: string | null = null;
  let props: Record<string, unknown> = {};

  if (context.hasRichTextContent && (!context.isEditing || context.textToolbarPortalStyle)) {
    activeToolbarType = "text";
    props = {
      isMobile: context.isMobile,
      portalStyle: context.textToolbarPortalStyle,
      textStyle: state.textStyle,
      onApplyAlign: actions.onApplyTextAlignment,
      onApplyListType: actions.onApplyListType,
      onApplyFont: (fontFamily: string) => {
        actions.onApplyTextStyle((style) => {
          style.fontFamily = fontFamily;
        });
      },
      onApplyFontSize: (fontSize: number) => {
        actions.onApplyTextStyle((style) => {
          style.fontSize = `calc(var(--slide-unit) * var(--slide-font-scale, 1) * ${fontSize})`;
        });
      },
      onApplyColor: (color: string) => {
        actions.onApplyTextStyle((style) => {
          style.color = color;
        });
      },
    };
  } else if (context.isTableShape) {
    activeToolbarType = "table";
    props = {
      isMobile: context.isMobile,
      portalStyle: context.portalStyle,
      activeRowIndex: state.activeRowIndex,
      activeColIndex: state.activeColIndex,
      rowCount: state.rowCount,
      colCount: state.colCount,
      onInsertRowAbove: () => actions.onInsertTableRowAt(state.activeRowIndex, "before"),
      onInsertRowBelow: () => actions.onInsertTableRowAt(state.activeRowIndex, "after"),
      onDeleteCurrentRow: () => actions.onRemoveTableRowAt(state.activeRowIndex),
      onInsertColLeft: () => actions.onInsertTableColumnAt(state.activeColIndex, "before"),
      onInsertColRight: () => actions.onInsertTableColumnAt(state.activeColIndex, "after"),
      onDeleteCurrentCol: () => actions.onRemoveTableColumnAt(state.activeColIndex),
    };
  } else if (context.isShapeStyleTarget) {
    activeToolbarType = "shape";
    props = {
      isMobile: context.isMobile,
      portalStyle: context.portalStyle,
      isLineLikeShape: context.isLineLikeShape,
      fillColor: state.backgroundColor,
      borderColor: state.borderColor,
      borderWidth: state.borderWidth,
      borderStyle: state.borderStyle,
      onFillColorChange: actions.onUpdateShapeFillColor,
      onBorderStyleChange: actions.onUpdateShapeBorderStyle,
      onBorderColorChange: actions.onUpdateShapeBorderColor,
      onBorderWidthChange: actions.onUpdateShapeBorderWidth,
    };
  }

  if (!activeToolbarType) {
    return null;
  }

  const config = TOOLBAR_REGISTRY.find((c) => c.type === activeToolbarType);
  if (!config) {
    return null;
  }

  // Calculate AI popover position (below the toolbar)
  const toolbarPortalStyle = context.textToolbarPortalStyle ?? context.portalStyle;
  const aiPopoverStyle: CSSProperties | null = toolbarPortalStyle
    ? {
      position: "fixed" as const,
      left: typeof toolbarPortalStyle.left === "number" ? toolbarPortalStyle.left : undefined,
      top:
        typeof toolbarPortalStyle.top === "number"
          ? toolbarPortalStyle.top + 48
          : undefined,
      transform: "translate(-50%, 0)",
      zIndex: 60,
    }
    : null;

  const ToolbarComponent = config.component;

  return (
    <>
      <ToolbarComponent
        {...props}
        aiButton={
          <button
            type="button"
            onClick={() => setIsAiPopoverOpen((prev) => !prev)}
            className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${isAiPopoverOpen
                ? "bg-sky-100 text-sky-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            title="Ask AI"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        }
      />
      <AiEditPopover
        open={isAiPopoverOpen}
        onClose={() => setIsAiPopoverOpen(false)}
        portalStyle={aiPopoverStyle}
        shapeContext={shapeContext}
        onApplyResult={(result) => {
          if (actions.onApplyAiEditResult) {
            actions.onApplyAiEditResult(result);
          }
        }}
      />
    </>
  );
}
