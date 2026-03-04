"use client";

import { Button } from "@/components/ui/button";
import { SlideShape } from "@/features/deck-editor/components/slide-shape";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

interface SidebarProps {
  slides: number[];
  slideXmlList: string[];
  activeSlide?: number;
  onSlideSelect?: (slideNumber: number) => void;
  onCreateSlide?: () => void;
}

export function Sidebar({
  slides,
  slideXmlList,
  activeSlide = 1,
  onSlideSelect,
  onCreateSlide,
}: SidebarProps) {
  return (
    <UiSidebar
      collapsible="offcanvas"
      className="top-20 h-[calc(100svh-5rem)] border-r border-slate-200 bg-[#f8fafc] [&_[data-sidebar=sidebar]]:bg-[#f8fafc]"
    >
      <SidebarHeader className="gap-0 p-3">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <SidebarTrigger className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100/80" />
          <Button
            variant="outline"
            onClick={onCreateSlide}
            className="h-8 flex-1 justify-center gap-1.5 rounded-xl border-slate-200/90 bg-white/95 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-[0_1px_6px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-sky-200 group-data-[collapsible=icon]:hidden"
          >
            <Plus className="h-3.5 w-3.5" />
            新建幻灯片
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pb-3">
        <ScrollArea className="h-full">
          <div className="space-y-3 pr-1">
            {slides.map((slide, index) => (
              <SlideThumbnail
                key={slide}
                number={slide}
                slideIndex={index}
                slideXml={slideXmlList[index]}
                isActive={slide === activeSlide}
                onSelect={onSlideSelect}
              />
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>
      <SidebarRail />
    </UiSidebar>
  );
}

function CollapsedSlideButton({
  number,
  isActive,
  onSelect,
}: {
  number: number;
  isActive: boolean;
  onSelect?: (slideNumber: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(number)}
      aria-pressed={isActive}
      className={cn(
        "hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-[11px] font-medium transition-colors duration-200 group-data-[collapsible=icon]:flex",
        isActive
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100/80"
      )}
    >
      {number}
    </button>
  );
}

function ExpandedSlideThumbnail({
  number,
  slideIndex,
  slideXml,
  isActive,
  onSelect,
}: {
  number: number;
  slideIndex: number;
  slideXml?: string;
  isActive: boolean;
  onSelect?: (slideNumber: number) => void;
}) {
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const currentSlideIndex = useSlideEditorStore((state) => state.currentSlideIndex);
  const storedShapes = useSlideEditorStore((state) => state.shapes);

  const parsedShapes = useMemo(() => {
    if (!slideXml) {
      return [];
    }

    return parseSlideXml(slideXml).shapes;
  }, [slideXml]);

  const previewShapes = useMemo(() => {
    if (isHydrated && isActive && currentSlideIndex === slideIndex) {
      return [...storedShapes].sort((a, b) => a.zIndex - b.zIndex);
    }

    return parsedShapes;
  }, [currentSlideIndex, isActive, isHydrated, parsedShapes, slideIndex, storedShapes]);

  return (
    <div className="flex items-start gap-2 group-data-[collapsible=icon]:hidden">
      <span
        className={cn(
          "w-5 pt-2 text-xs font-medium transition-colors",
          isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
        )}
      >
        {number}
      </span>
      <button
        type="button"
        onClick={() => onSelect?.(number)}
        aria-pressed={isActive}
        className={cn(
          "h-[108px] flex-1 cursor-pointer rounded-xl border p-2 text-left transition-all duration-200",
          isActive
            ? "border-blue-500 bg-white ring-2 ring-blue-500/10 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        )}
      >
        <div className="flex h-full items-center justify-center overflow-hidden rounded-md border border-slate-100/50 bg-slate-50 p-1">
          <div className="h-full max-w-full [container-type:inline-size] aspect-[16/9]">
            <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-white [--slide-unit:calc((100cqw/960)*0.7)]">
              {previewShapes.map((shape) => (
                <SlideShape
                  key={("id" in shape ? shape.id : shape.attributes.id) as string}
                  shape={shape}
                />
              ))}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function SlideThumbnail({
  number,
  slideIndex,
  slideXml,
  isActive,
  onSelect,
}: {
  number: number;
  slideIndex: number;
  slideXml?: string;
  isActive: boolean;
  onSelect?: (slideNumber: number) => void;
}) {
  return (
    <div className="group/menu-item">
      <CollapsedSlideButton number={number} isActive={isActive} onSelect={onSelect} />
      <ExpandedSlideThumbnail
        number={number}
        slideIndex={slideIndex}
        slideXml={slideXml}
        isActive={isActive}
        onSelect={onSelect}
      />
    </div>
  );
}
