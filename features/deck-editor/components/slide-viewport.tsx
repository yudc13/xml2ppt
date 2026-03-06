"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { SlideShape } from "@/features/deck-editor/components/slide-shape";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { cn } from "@/lib/utils";

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
    () => () => {},
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
        "[data-shape-toolbar='true'], [data-shape-controls='true'], [data-editor-toolbar='true']";

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
    <div className="animate-in fade-in duration-500" style={{ width: `${viewportWidth}px` }}>
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-6 shadow-sm md:p-8">
        <div className="mx-auto w-full max-w-[960px] [container-type:inline-size]">
          <div
            ref={viewportRef}
            className={cn(
              "relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] [--slide-unit:calc(100cqw/960)]",
              pendingInsertion && "cursor-crosshair",
            )}
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
        </div>
      </div>
    </div>
  );
}
