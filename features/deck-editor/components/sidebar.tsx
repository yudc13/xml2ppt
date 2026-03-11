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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Clipboard,
  Copy,
  CopyPlus,
  Loader2,
  Plus,
  PlusCircle,
  Scissors,
  Trash2,
} from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

interface SidebarProps {
  slides: number[];
  slideIdList: string[];
  slideXmlList: string[];
  activeSlide?: number;
  activeSlideId?: string;
  activeSlideRenderXml?: string;
  forceActiveSlideModelRender?: boolean;
  onSlideSelect?: (slideNumber: number) => void;
  onCreateSlide?: (atIndex?: number) => void;
  onCopySlide?: (index: number) => void;
  onCutSlide?: (index: number) => void;
  onPasteSlide?: (atIndex: number) => void;
  onDeleteSlide?: (index: number) => void;
  onDuplicateSlide?: (index: number) => void;
  canPaste?: boolean;
  isLoading?: boolean;
}

export function Sidebar({
  slides,
  slideIdList,
  slideXmlList,
  activeSlide = 1,
  activeSlideId,
  activeSlideRenderXml,
  forceActiveSlideModelRender = false,
  onSlideSelect,
  onCreateSlide,
  onCopySlide,
  onCutSlide,
  onPasteSlide,
  onDeleteSlide,
  onDuplicateSlide,
  canPaste = false,
  isLoading = false,
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
            onClick={() => onCreateSlide?.()}
            className="h-8 flex-1 justify-center gap-1.5 rounded-xl border-slate-200/90 bg-white/95 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-[0_1px_6px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-sky-200 group-data-[collapsible=icon]:hidden"
          >
            <Plus className="h-3.5 w-3.5" />
            新建幻灯片
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative px-3 pb-3">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-4 shadow-lg border border-slate-100">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium text-slate-500">正在同步...</span>
            </div>
          </div>
        )}
        <ScrollArea className="h-full">
          <div className="space-y-3 pr-1">
            {slides.map((slide, index) => (
              <SlideThumbnail
                key={slide}
                number={slide}
                slideIndex={index}
                slideId={slideIdList[index]}
                slideXml={slideXmlList[index]}
                isActive={slide === activeSlide}
                activeSlideId={activeSlideId}
                activeSlideRenderXml={activeSlideRenderXml}
                forceActiveSlideModelRender={forceActiveSlideModelRender}
                onSelect={onSlideSelect}
                onCopy={() => onCopySlide?.(index)}
                onCut={() => onCutSlide?.(index)}
                onPaste={() => onPasteSlide?.(index)}
                onDelete={() => onDeleteSlide?.(index)}
                onDuplicate={() => onDuplicateSlide?.(index)}
                onCreateNew={() => onCreateSlide?.(index)}
                canPaste={canPaste}
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
  onContextMenu,
}: {
  number: number;
  isActive: boolean;
  onSelect?: (slideNumber: number) => void;
  onContextMenu?: () => void;
}) {
  return (
    <ContextMenuTrigger>
      <button
        type="button"
        onClick={() => onSelect?.(number)}
        onContextMenu={(e) => {
          if (!isActive) {
            onContextMenu?.();
          }
        }}
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
    </ContextMenuTrigger>
  );
}

function ExpandedSlideThumbnail({
  number,
  slideIndex,
  slideId,
  slideXml,
  isActive,
  activeSlideId,
  activeSlideRenderXml,
  forceActiveSlideModelRender,
  onSelect,
  onContextMenu,
}: {
  number: number;
  slideIndex: number;
  slideId?: string;
  slideXml?: string;
  isActive: boolean;
  activeSlideId?: string;
  activeSlideRenderXml?: string;
  forceActiveSlideModelRender: boolean;
  onSelect?: (slideNumber: number) => void;
  onContextMenu?: () => void;
}) {
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );
  const currentSlideIndex = useSlideEditorStore((state) => state.currentSlideIndex);
  const storedShapes = useSlideEditorStore((state) => state.shapes);
  const draftShapes = useSlideEditorStore((state) =>
    slideId ? state.slideDrafts[slideId]?.shapes ?? null : null,
  );

  const isActiveDraftSlide = Boolean(slideId && activeSlideId && slideId === activeSlideId);
  const effectiveSlideXml = isActiveDraftSlide && activeSlideRenderXml ? activeSlideRenderXml : slideXml;

  const parsedShapes = useMemo(() => {
    if (!effectiveSlideXml) {
      return [];
    }

    return parseSlideXml(effectiveSlideXml).shapes;
  }, [effectiveSlideXml]);

  const previewShapes = useMemo(() => {
    if (isHydrated && isActive && currentSlideIndex === slideIndex && !forceActiveSlideModelRender) {
      return [...storedShapes].sort((a, b) => a.zIndex - b.zIndex);
    }

    if (draftShapes) {
      return [...draftShapes].sort((a, b) => a.zIndex - b.zIndex);
    }

    return parsedShapes;
  }, [
    currentSlideIndex,
    draftShapes,
    forceActiveSlideModelRender,
    isActive,
    isHydrated,
    parsedShapes,
    slideIndex,
    storedShapes,
  ]);

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
      <ContextMenuTrigger className="flex-1">
        <button
          type="button"
          onClick={() => onSelect?.(number)}
          onContextMenu={(e) => {
            if (!isActive) {
              onContextMenu?.();
            }
          }}
          aria-pressed={isActive}
          className={cn(
            "h-[108px] w-full cursor-pointer rounded-xl border p-2 text-left transition-all duration-200",
            isActive
              ? "border-blue-500 bg-white ring-2 ring-blue-500/10 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
          )}
        >
          <div className="flex h-full items-center justify-center overflow-hidden rounded-md border border-slate-100/50 bg-slate-50 p-1">
            <div className="mx-auto h-auto w-full max-h-full max-w-full [container-type:inline-size] aspect-[16/9]">
              <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-white text-[calc(var(--slide-unit)*16)] leading-normal [--slide-unit:calc(100cqw/960)]">
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
      </ContextMenuTrigger>
    </div>
  );
}

function SlideThumbnail({
  number,
  slideIndex,
  slideId,
  slideXml,
  isActive,
  activeSlideId,
  activeSlideRenderXml,
  forceActiveSlideModelRender,
  onSelect,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onDuplicate,
  onCreateNew,
  canPaste,
}: {
  number: number;
  slideIndex: number;
  slideId?: string;
  slideXml?: string;
  isActive: boolean;
  activeSlideId?: string;
  activeSlideRenderXml?: string;
  forceActiveSlideModelRender: boolean;
  onSelect?: (slideNumber: number) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCreateNew?: () => void;
  canPaste?: boolean;
}) {
  const handleActivateByContextMenu = () => {
    if (!isActive) {
      onSelect?.(number);
    }
  };

  return (
    <ContextMenu onOpenChange={(open) => {
      if (open && !isActive) {
        onSelect?.(number);
      }
    }}>
      <div className="group/menu-item">
        <CollapsedSlideButton
          number={number}
          isActive={isActive}
          onSelect={onSelect}
          onContextMenu={handleActivateByContextMenu}
        />
        <ExpandedSlideThumbnail
          number={number}
          slideIndex={slideIndex}
          slideId={slideId}
          slideXml={slideXml}
          isActive={isActive}
          activeSlideId={activeSlideId}
          activeSlideRenderXml={activeSlideRenderXml}
          forceActiveSlideModelRender={forceActiveSlideModelRender}
          onSelect={onSelect}
          onContextMenu={handleActivateByContextMenu}
        />
      </div>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onCut}>
          <Scissors className="mr-2 h-4 w-4" />
          <span>剪切</span>
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />
          <span>复制</span>
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onPaste} disabled={!canPaste}>
          <Clipboard className="mr-2 h-4 w-4" />
          <span>粘贴</span>
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCreateNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          <span>新建幻灯片</span>
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <CopyPlus className="mr-2 h-4 w-4" />
          <span>复制幻灯片</span>
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDelete}
          className="text-red-600 focus:bg-red-50 focus:text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>删除幻灯片</span>
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
