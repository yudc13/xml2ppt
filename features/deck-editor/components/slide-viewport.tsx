"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { SlideShape } from "@/features/deck-editor/components/slide-shape";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Layers,
  LayoutGrid,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SLIDE_INDEX = 0;
const DEFAULT_ZOOM = 65;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const BASE_VIEWPORT_WIDTH = 1200;

export function SlideViewport({
  slideIndex = DEFAULT_SLIDE_INDEX,
  slideXml,
  zoom = DEFAULT_ZOOM,
  forceModelRender = false,
}: {
  slideIndex?: number;
  slideXml?: string;
  zoom?: number;
  forceModelRender?: boolean;
}) {
  const model = useMemo(() => parseSlideXml(slideXml ?? ""), [slideXml]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  const initializeSlide = useSlideEditorStore((state) => state.initializeSlide);
  const selectShape = useSlideEditorStore((state) => state.selectShape);
  const setEditingShape = useSlideEditorStore((state) => state.setEditingShape);
  const currentSlideIndex = useSlideEditorStore((state) => state.currentSlideIndex);
  const isPreviewMode = useSlideEditorStore((state) => state.isPreviewMode);
  const storedShapes = useSlideEditorStore((state) => state.shapes);
  const snapGuides = useSlideEditorStore((state) => state.snapGuides);
  const pendingInsertion = useSlideEditorStore((state) => state.pendingInsertion);
  const setPendingInsertion = useSlideEditorStore((state) => state.setPendingInsertion);
  const insertShape = useSlideEditorStore((state) => state.insertShape);
  const insertTextPreset = useSlideEditorStore((state) => state.insertTextPreset);
  const insertTable = useSlideEditorStore((state) => state.insertTable);

  const selectedShapeId = useSlideEditorStore((state) => state.selectedShapeId);
  const copySelectedShape = useSlideEditorStore((state) => state.copySelectedShape);
  const cutSelectedShape = useSlideEditorStore((state) => state.cutSelectedShape);
  const pasteCopiedShape = useSlideEditorStore((state) => state.pasteCopiedShape);
  const deleteSelectedShape = useSlideEditorStore((state) => state.deleteSelectedShape);
  const bringToFront = useSlideEditorStore((state) => state.bringToFront);
  const sendToBack = useSlideEditorStore((state) => state.sendToBack);
  const bringForward = useSlideEditorStore((state) => state.bringForward);
  const sendBackward = useSlideEditorStore((state) => state.sendBackward);
  const alignSelectedShape = useSlideEditorStore((state) => state.alignSelectedShape);
  const clipboardShape = useSlideEditorStore((state) => state.clipboardShape);

  const lastContextMenuPos = useRef<{ x: number; y: number } | null>(null);

  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modifierKey = isMac ? "⌘" : "Ctrl";
  const interactiveShapes = useMemo(
    () => [...storedShapes].sort((a, b) => a.zIndex - b.zIndex),
    [storedShapes],
  );
  const safeZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const viewportWidth = (BASE_VIEWPORT_WIDTH * safeZoom) / 100;
  const shouldUseStoreShapes = !forceModelRender && isHydrated && currentSlideIndex === slideIndex;
  const interactiveEnabled = shouldUseStoreShapes && !isPreviewMode && !pendingInsertion;

  useEffect(() => {
    initializeSlide(slideIndex, model, slideXml ?? "");
  }, [initializeSlide, model, slideIndex, slideXml]);

  useEffect(() => {
    const onWindowPointerDown = (event: PointerEvent) => {
      const viewportElement = viewportRef.current;
      const targetNode = event.target as Node | null;
      const preserveSelectionSelectors =
        "[data-shape-toolbar='true'], [data-shape-controls='true'], [data-editor-toolbar='true'], [data-slot^='context-menu']";

      if (!viewportElement || !targetNode) {
        return;
      }

      const isPointerFromPreserveZone = event
        .composedPath()
        .some((node) => node instanceof Element && node.matches(preserveSelectionSelectors));

      if (isPointerFromPreserveZone) {
        return;
      }

      if (!viewportElement.contains(targetNode)) {
        selectShape(null);
        setEditingShape(null);
      }
    };

    window.addEventListener("pointerdown", onWindowPointerDown, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onWindowPointerDown, { capture: true });
    };
  }, [selectShape, setEditingShape]);

  return (
    <ContextMenu>
      <div className="animate-in fade-in duration-500" style={{ width: `${viewportWidth}px` }}>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-6 shadow-sm md:p-8">
          <div className="mx-auto w-full max-w-[960px] [container-type:inline-size]">
            <ContextMenuTrigger asChild>
              <div
                ref={viewportRef}
                className={cn(
                  "relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] [--slide-unit:calc(100cqw/960)]",
                  pendingInsertion && "cursor-crosshair",
                )}
                onContextMenu={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const scaleX = 960 / rect.width;
                  const scaleY = 540 / rect.height;
                  lastContextMenuPos.current = {
                    x: (event.clientX - rect.left) * scaleX,
                    y: (event.clientY - rect.top) * scaleY,
                  };
                }}
                onPointerDown={(event) => {
                  if (pendingInsertion) {
                    event.preventDefault();
                    event.stopPropagation();

                    const rect = event.currentTarget.getBoundingClientRect();
                    const scaleX = 960 / rect.width;
                    const scaleY = 540 / rect.height;
                    const x = (event.clientX - rect.left) * scaleX;
                    const y = (event.clientY - rect.top) * scaleY;

                    const position = { x, y };

                    if (pendingInsertion.type === "shape") {
                      insertShape(pendingInsertion.shapeType, position);
                    } else if (pendingInsertion.type === "text") {
                      insertTextPreset(pendingInsertion.preset, position);
                    } else if (pendingInsertion.type === "table") {
                      insertTable(pendingInsertion.rows, pendingInsertion.columns, position);
                    }

                    setPendingInsertion(null);
                    return;
                  }

                  if (event.target === event.currentTarget) {
                    if (!isPreviewMode) {
                      selectShape(null);
                      setEditingShape(null);
                    }
                  }
                }}
              >
                {shouldUseStoreShapes
                  ? interactiveShapes.map((shape) => (
                    <SlideShape
                      key={shape.id}
                      shape={shape}
                      viewportRef={viewportRef}
                      interactive={interactiveEnabled}
                    />
                  ))
                  : model.shapes.map((shape) => (
                    <SlideShape key={shape.attributes.id} shape={shape} />
                  ))}
                {interactiveEnabled && snapGuides.vertical !== null ? (
                  <div
                    className="pointer-events-none absolute top-0 z-[10020] h-full w-px bg-sky-500/80"
                    style={{ left: `${(snapGuides.vertical / 960) * 100}%` }}
                  />
                ) : null}
                {interactiveEnabled && snapGuides.horizontal !== null ? (
                  <div
                    className="pointer-events-none absolute left-0 z-[10020] h-px w-full bg-sky-500/80"
                    style={{ top: `${(snapGuides.horizontal / 540) * 100}%` }}
                  />
                ) : null}
              </div>
            </ContextMenuTrigger>
          </div>
        </div>
      </div>

      <ContextMenuContent className="w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
        {selectedShapeId ? (
          <>
            <ContextMenuItem
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onClick={() => {
                copySelectedShape();
                toast.success("已复制形状", {
                  icon: <Copy className="h-4 w-4 text-sky-600" />,
                  duration: 2000,
                });
              }}
            >
              <Copy className="h-4 w-4 text-slate-500 group-hover:text-sky-600" />
              <span className="flex-1">复制</span>
              <ContextMenuShortcut className="text-[10px] font-medium text-slate-400">
                {modifierKey}C
              </ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onClick={() => {
                cutSelectedShape();
                toast.success("已剪切形状", {
                  icon: <Scissors className="h-4 w-4 text-sky-600" />,
                  duration: 2000,
                });
              }}
            >
              <Scissors className="h-4 w-4 text-slate-500 group-hover:text-red-500" />
              <span className="flex-1">剪切</span>
              <ContextMenuShortcut className="text-[10px] font-medium text-slate-400">
                {modifierKey}X
              </ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              disabled={!clipboardShape}
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onClick={() => {
                pasteCopiedShape(lastContextMenuPos.current ?? undefined);
                toast.success("已粘贴形状", {
                  icon: <Clipboard className="h-4 w-4 text-sky-600" />,
                  duration: 2000,
                });
              }}
            >
              <Clipboard className="h-4 w-4 text-slate-500 group-hover:text-emerald-600" />
              <span className="flex-1">粘贴</span>
              <ContextMenuShortcut className="text-[10px] font-medium text-slate-400">
                {modifierKey}V
              </ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator className="my-1.5 h-px bg-slate-100" />

            <ContextMenuSub>
              <ContextMenuSubTrigger className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40">
                <Layers className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                <span className="flex-1">层级</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl transition-all">
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={bringToFront}
                >
                  <ArrowUpToLine className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                  <span>置于顶层</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={bringForward}
                >
                  <ArrowUp className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                  <span>上移一层</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={sendBackward}
                >
                  <ArrowDown className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                  <span>下移一层</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={sendToBack}
                >
                  <ArrowDownToLine className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                  <span>置于底层</span>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40">
                <LayoutGrid className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                <span className="flex-1">对齐</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl transition-all">
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={() => alignSelectedShape("left")}
                >
                  <AlignLeft className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                  <span>左对齐</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={() => alignSelectedShape("center")}
                >
                  <AlignCenter className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                  <span>水平居中</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={() => alignSelectedShape("right")}
                >
                  <AlignRight className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                  <span>右对齐</span>
                </ContextMenuItem>
                <ContextMenuSeparator className="my-1.5 h-px bg-slate-100" />
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={() => alignSelectedShape("top")}
                >
                  <AlignStartVertical className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                  <span>顶部对齐</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={() => alignSelectedShape("middle")}
                >
                  <AlignCenterVertical className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                  <span>垂直居中</span>
                </ContextMenuItem>
                <ContextMenuItem
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100"
                  onClick={() => alignSelectedShape("bottom")}
                >
                  <AlignEndVertical className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
                  <span>底部对齐</span>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator className="my-1.5 h-px bg-slate-100" />

            <ContextMenuItem
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-red-50 hover:text-red-600 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onClick={() => {
                deleteSelectedShape();
                toast.success("已删除形状", {
                  icon: <Trash2 className="h-4 w-4 text-red-500" />,
                  duration: 2000,
                });
              }}
            >
              <Trash2 className="h-4 w-4 text-slate-500 group-hover:text-red-600" />
              <span className="flex-1">删除</span>
              <ContextMenuShortcut className="text-[10px] font-medium text-slate-400 group-hover:text-red-400">
                Del
              </ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem
            disabled={!clipboardShape}
            className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
            onClick={() => {
              pasteCopiedShape(lastContextMenuPos.current ?? undefined);
              toast.success("已粘贴形状", {
                icon: <Clipboard className="h-4 w-4 text-sky-600" />,
                duration: 2000,
              });
            }}
          >
            <Clipboard className="h-4 w-4 text-slate-500 group-hover:text-emerald-600" />
            <span className="flex-1">粘贴</span>
            <ContextMenuShortcut className="text-[10px] font-medium text-slate-400">
              {modifierKey}V
            </ContextMenuShortcut>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
