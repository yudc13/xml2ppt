"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { SlideShape } from "@/components/editor/slide-shape";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import { parseSlideXml } from "@/lib/slide-xml/parser";

const DEFAULT_SLIDE_INDEX = 0;
const DEFAULT_ZOOM = 65;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const BASE_VIEWPORT_WIDTH = 1200;

export function SlideViewport({
  slideIndex = DEFAULT_SLIDE_INDEX,
  slideXml,
  zoom = DEFAULT_ZOOM,
}: {
  slideIndex?: number;
  slideXml?: string;
  zoom?: number;
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
  const interactiveShapes = useMemo(
    () => [...storedShapes].sort((a, b) => a.zIndex - b.zIndex),
    [storedShapes],
  );
  const safeZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const viewportWidth = (BASE_VIEWPORT_WIDTH * safeZoom) / 100;
  const shouldUseStoreShapes = isHydrated && currentSlideIndex === slideIndex;
  const interactiveEnabled = shouldUseStoreShapes && !isPreviewMode;

  useEffect(() => {
    initializeSlide(slideIndex, model);
  }, [initializeSlide, model, slideIndex]);

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
            className="relative aspect-[16/9] w-full overflow-visible rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] [--slide-unit:calc(100cqw/960)]"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                if (!isPreviewMode) {
                  selectShape(null);
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
          </div>
        </div>
      </div>
    </div>
  );
}
