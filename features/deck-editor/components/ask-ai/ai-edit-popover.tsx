"use client";

import { useRef, useState, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Sparkles, SendHorizonal } from "lucide-react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { useEditShape } from "@/features/deck-editor/hooks/use-ai-api";
import type { AiShapeContext, AiShapeEditResponse } from "@/lib/ai/types";

interface AiEditPopoverProps {
  open: boolean;
  onClose: () => void;
  portalStyle: CSSProperties | null;
  shapeContext: AiShapeContext;
  onApplyResult: (result: AiShapeEditResponse) => void;
}

export function AiEditPopover({
  open,
  onClose,
  portalStyle,
  shapeContext,
  onApplyResult,
}: AiEditPopoverProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editShape = useEditShape();

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay to let portal mount
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Delay to avoid closing immediately on the trigger click
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onClose]);

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || editShape.isPending) return;

    try {
      const result = await editShape.mutateAsync({
        prompt: trimmed,
        shapeContext,
      });
      onApplyResult(result);
      setPrompt("");
    } catch {
      toast.error("AI 编辑失败，请重试");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!open || !portalStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={containerRef}
      data-ai-popover="true"
      style={portalStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur">
        <Sparkles className="h-4 w-4 flex-shrink-0 text-sky-500" />
        <input
          ref={inputRef}
          type="text"
          placeholder="输入修改指令..."
          className="min-w-[200px] flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={editShape.isPending}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!prompt.trim() || editShape.isPending}
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-slate-800 text-white transition-colors hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {editShape.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <SendHorizonal className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>,
    document.body,
  );
}
