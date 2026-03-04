"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { SlideShape } from "@/components/editor/slide-shape";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { slides } from "@/mock/slides";

const DEFAULT_SLIDE_INDEX = 0;

function getSlideXmlByIndex(index: number): string {
  return slides[index] ?? slides[DEFAULT_SLIDE_INDEX];
}

export function SlideViewport({ slideIndex = DEFAULT_SLIDE_INDEX }: { slideIndex?: number }) {
  const xml = getSlideXmlByIndex(slideIndex);
  const model = useMemo(() => parseSlideXml(xml), [xml]);
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
  const shouldUseStoreShapes = isHydrated && currentSlideIndex === slideIndex;
  const interactiveEnabled = shouldUseStoreShapes && !isPreviewMode;

  useEffect(() => {
    initializeSlide(slideIndex, model);
  }, [initializeSlide, model, slideIndex]);

  useEffect(() => {
    const onWindowPointerDown = (event: PointerEvent) => {
      const viewportElement = viewportRef.current;
      const targetNode = event.target as Node | null;
      const targetElement =
        targetNode instanceof Element ? targetNode : targetNode?.parentElement ?? null;

      if (!viewportElement || !targetNode) {
        return;
      }

      if (targetElement?.closest("[data-shape-toolbar='true'], [data-shape-controls='true']")) {
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
    <div className="w-full max-w-[1200px] animate-in fade-in zoom-in duration-500">
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
