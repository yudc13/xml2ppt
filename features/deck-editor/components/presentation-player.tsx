"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { SlideShape } from "@/features/deck-editor/components/slide-shape";
import { parseSlideXml } from "@/lib/slide-xml/parser";

type PresentationPlayerProps = {
  open: boolean;
  slideXmlList: string[];
  onClose: () => void;
};

export function PresentationPlayer({ open, slideXmlList, onClose }: PresentationPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const totalSlides = slideXmlList.length;
  const currentSlideXml = slideXmlList[activeIndex] ?? "";
  const currentModel = useMemo(() => parseSlideXml(currentSlideXml), [currentSlideXml]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(totalSlides - 1, prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, totalSlides]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[12000] flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-5 py-4 text-white">
        <div className="text-sm font-medium">
          第 {Math.min(activeIndex + 1, totalSlides)} / {totalSlides || 1} 页
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 text-white transition-colors hover:bg-white/10"
          aria-label="退出播放"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 pb-10">
        <button
          type="button"
          onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
          disabled={activeIndex <= 0}
          className="absolute left-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="上一页"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="w-full max-w-[min(94vw,170.666svh)] [container-type:inline-size]">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-white [--slide-unit:calc(100cqw/960)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            {currentModel.shapes.map((shape) => (
              <SlideShape key={shape.attributes.id} shape={shape} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveIndex((prev) => Math.min(totalSlides - 1, prev + 1))}
          disabled={activeIndex >= totalSlides - 1}
          className="absolute right-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="下一页"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
