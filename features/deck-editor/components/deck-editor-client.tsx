"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  Palette,
  RotateCcw,
  Shapes,
  Sparkles,
  Table2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Header } from "@/features/deck-editor/components/header";
import { Sidebar } from "@/features/deck-editor/components/sidebar";
import { SlideViewport } from "@/features/deck-editor/components/slide-viewport";
import {
  ApiRequestError,
  useCreateSlide,
  useGetRevision,
  useLoadRevisions,
  useRollbackSlide,
  useSaveSlide,
  useUpdateDeckTitle,
} from "@/features/deck-editor/hooks/use-deck-editor-api";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import type { DeckEntity, PersistedSlide, SaveStatus, SlideRevisionEntity } from "@/features/deck-editor/types";
import { serializeSlideDocument } from "@/lib/slide-xml/serializer";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const INITIAL_ACTIVE_SLIDE_INDEX = 0;
const DEFAULT_ZOOM = 65;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 5;

export function DeckEditorClient({
  deckId,
  initialDeck,
  initialSlides,
}: {
  deckId: string;
  initialDeck: DeckEntity;
  initialSlides: PersistedSlide[];
}) {
  const buildSlideDocumentModel = useSlideEditorStore((state) => state.buildSlideDocumentModel);
  const currentSlideIndexInStore = useSlideEditorStore((state) => state.currentSlideIndex);
  const storeShapes = useSlideEditorStore((state) => state.shapes);
  const setPreviewMode = useSlideEditorStore((state) => state.setPreviewMode);
  const isPreviewMode = useSlideEditorStore((state) => state.isPreviewMode);
  const updateDeckTitle = useUpdateDeckTitle(deckId);
  const createSlide = useCreateSlide(deckId);
  const saveSlide = useSaveSlide();
  const loadRevisions = useLoadRevisions();
  const getRevision = useGetRevision();
  const rollbackSlide = useRollbackSlide();

  const [deckTitle, setDeckTitle] = useState(initialDeck.title);
  const [slides, setSlides] = useState<PersistedSlide[]>(initialSlides);
  const [activeSlideIndex, setActiveSlideIndex] = useState(INITIAL_ACTIVE_SLIDE_INDEX);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<SlideRevisionEntity[]>([]);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [previewRevisionVersion, setPreviewRevisionVersion] = useState<number | null>(null);
  const [previewRevisionXml, setPreviewRevisionXml] = useState<string | null>(null);
  const saveStatusTimeoutRef = useRef<number | null>(null);

  const activeSlide = slides[activeSlideIndex] ?? null;
  const currentSlideXml = previewRevisionXml ?? activeSlide?.xmlContent;
  const slideNumbers = useMemo(() => slides.map((_, index) => index + 1), [slides]);
  const shapeMutationSignal = useMemo(
    () =>
      storeShapes
        .map(
          (shape) =>
            `${shape.id}:${shape.zIndex}:${shape.attributes.topLeftX}:${shape.attributes.topLeftY}:${shape.attributes.width}:${shape.attributes.height}:${shape.attributes.rotation}:${shape.contentHtml}`,
        )
        .join("|"),
    [storeShapes],
  );

  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPreviewMode(previewRevisionVersion !== null);
  }, [previewRevisionVersion, setPreviewMode]);

  const resetRevisionState = () => {
    setPreviewRevisionVersion(null);
    setPreviewRevisionXml(null);
    setRevisions([]);
    setRevisionError(null);
  };

  const isDirty = useMemo(() => {
    void shapeMutationSignal;

    if (!activeSlide) {
      return false;
    }

    if (currentSlideIndexInStore !== activeSlideIndex) {
      return false;
    }

    const model = buildSlideDocumentModel();
    if (!model) {
      return false;
    }

    const nextXml = serializeSlideDocument(model);
    return nextXml !== activeSlide.xmlContent;
  }, [activeSlide, activeSlideIndex, buildSlideDocumentModel, currentSlideIndexInStore, shapeMutationSignal]);

  const clearSaveStatusLater = () => {
    if (saveStatusTimeoutRef.current) {
      window.clearTimeout(saveStatusTimeoutRef.current);
    }

    saveStatusTimeoutRef.current = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 1500);
  };

  const persistActiveSlide = async (options?: { showStatus?: boolean }) => {
    const showStatus = options?.showStatus ?? false;
    if (!activeSlide || saveSlide.isPending) {
      return !saveSlide.isPending;
    }

    if (previewRevisionVersion !== null) {
      return true;
    }

    const model = buildSlideDocumentModel();
    if (!model) {
      return true;
    }

    const xmlContent = serializeSlideDocument(model);
    if (xmlContent === activeSlide.xmlContent) {
      if (showStatus) {
        setSaveStatus("success");
        clearSaveStatusLater();
      }
      return true;
    }

    if (showStatus) {
      setSaveStatus("idle");
    }

    try {
      const savedSlide = await saveSlide.mutateAsync({
        slideId: activeSlide.id,
        version: activeSlide.version,
        xmlContent,
        reason: showStatus ? "manual_save" : "autosave",
      });

      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id !== activeSlide.id) {
            return slide;
          }

          return savedSlide;
        }),
      );
      setLastSavedAt(savedSlide.updatedAt);

      if (showStatus) {
        setSaveStatus("success");
        clearSaveStatusLater();
      }

      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "SLIDE_VERSION_CONFLICT") {
        setSaveStatus("conflict");
      } else {
        setSaveStatus("error");
      }
      return false;
    }
  };

  const loadRevisionsForActiveSlide = async () => {
    if (!activeSlide) {
      return;
    }

    setRevisionError(null);
    try {
      const nextRevisions = await loadRevisions.mutateAsync(activeSlide.id);
      setRevisions(nextRevisions);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载历史版本失败";
      setRevisionError(message);
    }
  };

  const handleOpenHistory = () => {
    setIsHistoryOpen(true);
    void loadRevisionsForActiveSlide();
  };

  const handlePreviewRevision = async (version: number) => {
    if (!activeSlide) {
      return;
    }

    if (version === activeSlide.version) {
      setPreviewRevisionVersion(null);
      setPreviewRevisionXml(null);
      return;
    }

    const persisted = await persistActiveSlide();
    if (!persisted) {
      return;
    }

    try {
      const revision = await getRevision.mutateAsync({
        slideId: activeSlide.id,
        version,
      });
      setPreviewRevisionVersion(version);
      setPreviewRevisionXml(revision.xmlContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载历史版本内容失败";
      setRevisionError(message);
    }
  };

  const handleRollbackRevision = async (targetVersion: number) => {
    if (!activeSlide || rollbackSlide.isPending) {
      return;
    }

    try {
      const nextSlide = await rollbackSlide.mutateAsync({
        slideId: activeSlide.id,
        targetVersion,
        currentVersion: activeSlide.version,
      });

      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id !== nextSlide.id) {
            return slide;
          }

          return nextSlide;
        }),
      );
      setPreviewRevisionVersion(null);
      setPreviewRevisionXml(null);
      setLastSavedAt(nextSlide.updatedAt);
      setSaveStatus("success");
      clearSaveStatusLater();
      await loadRevisionsForActiveSlide();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "SLIDE_VERSION_CONFLICT") {
        setSaveStatus("conflict");
      } else {
        setSaveStatus("error");
      }
    }
  };

  const handleSelectSlide = (slideNumber: number) => {
    const nextIndex = slideNumber - 1;
    if (nextIndex === activeSlideIndex) {
      return;
    }

    void (async () => {
      const ok = await persistActiveSlide();
      if (!ok) {
        return;
      }

      resetRevisionState();
      setIsHistoryOpen(false);
      setActiveSlideIndex(nextIndex);
    })();
  };

  const handleCreateSlide = () => {
    if (createSlide.isPending || saveSlide.isPending) {
      return;
    }

    void (async () => {
      const ok = await persistActiveSlide();
      if (!ok) {
        return;
      }

      try {
        const created = await createSlide.mutateAsync();

        setSlides((prev) => [...prev, created]);
        resetRevisionState();
        setIsHistoryOpen(false);
        setActiveSlideIndex(slides.length);
      } catch {
        setSaveStatus("error");
      }
    })();
  };

  const handleManualSave = () => {
    void persistActiveSlide({ showStatus: true });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2f4f7] font-sans text-slate-900">
      <Header
        backHref="/"
        showLogo={false}
        title={deckTitle}
        onTitleSave={async (nextTitle) => {
          try {
            const updated = await updateDeckTitle.mutateAsync(nextTitle);
            setDeckTitle(updated.title);
            return true;
          } catch {
            return false;
          }
        }}
        onSave={handleManualSave}
        onOpenHistory={handleOpenHistory}
        onTogglePreview={() => setPreviewMode(!isPreviewMode)}
        isSaving={saveSlide.isPending}
        saveStatus={saveStatus}
        isDirty={isDirty}
        isPreviewMode={isPreviewMode}
        disableSave={previewRevisionVersion !== null}
      />

      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider defaultOpen>
          <Sidebar
            slides={slideNumbers}
            slideXmlList={slides.map((slide) => slide.xmlContent)}
            activeSlide={activeSlideIndex + 1}
            onSlideSelect={handleSelectSlide}
            onCreateSlide={handleCreateSlide}
          />

          <SidebarInset className="flex flex-1 flex-col overflow-auto bg-[#f8fafc]/50 p-8">
            <div className="relative mb-6 flex items-center justify-center">
              <CollapsedSidebarTrigger />
              <Toolbar
                zoom={zoom}
                onZoomChange={setZoom}
                saveStatus={saveStatus}
                isDirty={isDirty}
                lastSavedAt={lastSavedAt}
                isHistoryOpen={isHistoryOpen}
                onHistoryOpenChange={setIsHistoryOpen}
                revisions={revisions}
                isLoadingRevisions={loadRevisions.isPending}
                revisionError={revisionError}
                previewRevisionVersion={previewRevisionVersion}
                activeVersion={activeSlide?.version ?? null}
                onPreviewRevision={handlePreviewRevision}
                onRollbackRevision={handleRollbackRevision}
                isRollingBack={rollbackSlide.isPending}
                isPreviewingRevision={previewRevisionVersion !== null}
              />
            </div>
            <div className="flex flex-1 items-center justify-center">
              <SlideViewport
                slideIndex={activeSlideIndex}
                slideXml={currentSlideXml}
                zoom={zoom}
                forceModelRender={previewRevisionVersion !== null}
              />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}

function CollapsedSidebarTrigger() {
  const { state } = useSidebar();

  if (state !== "collapsed") {
    return null;
  }

  return (
    <SidebarTrigger className="absolute left-0 h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-[0_1px_6px_rgba(15,23,42,0.05)] hover:bg-slate-100/80" />
  );
}

function Toolbar({
  zoom,
  onZoomChange,
  saveStatus,
  isDirty,
  lastSavedAt,
  isHistoryOpen,
  onHistoryOpenChange,
  revisions,
  isLoadingRevisions,
  revisionError,
  previewRevisionVersion,
  activeVersion,
  onPreviewRevision,
  onRollbackRevision,
  isRollingBack,
  isPreviewingRevision,
}: {
  zoom: number;
  onZoomChange: (nextZoom: number) => void;
  saveStatus: SaveStatus;
  isDirty: boolean;
  lastSavedAt: string | null;
  isHistoryOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  revisions: SlideRevisionEntity[];
  isLoadingRevisions: boolean;
  revisionError: string | null;
  previewRevisionVersion: number | null;
  activeVersion: number | null;
  onPreviewRevision: (version: number) => void;
  onRollbackRevision: (version: number) => void;
  isRollingBack: boolean;
  isPreviewingRevision: boolean;
}) {
  const selectedShapeId = useSlideEditorStore((state) => state.selectedShapeId);
  const bringToFront = useSlideEditorStore((state) => state.bringToFront);
  const sendToBack = useSlideEditorStore((state) => state.sendToBack);
  const insertTextPreset = useSlideEditorStore((state) => state.insertTextPreset);
  const insertShape = useSlideEditorStore((state) => state.insertShape);
  const insertTable = useSlideEditorStore((state) => state.insertTable);
  const isPreviewMode = useSlideEditorStore((state) => state.isPreviewMode);
  const copySelectedShape = useSlideEditorStore((state) => state.copySelectedShape);
  const pasteCopiedShape = useSlideEditorStore((state) => state.pasteCopiedShape);
  const deleteSelectedShape = useSlideEditorStore((state) => state.deleteSelectedShape);
  const undo = useSlideEditorStore((state) => state.undo);
  const redo = useSlideEditorStore((state) => state.redo);

  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;

  const updateZoom = (nextZoom: number) => {
    onZoomChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPreviewMode) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        !!target?.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";

      if (isTypingTarget) {
        return;
      }

      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if ((isMeta && event.shiftKey && event.key.toLowerCase() === "z") || (isMeta && event.key.toLowerCase() === "y")) {
        event.preventDefault();
        redo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedShape();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteCopiedShape();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedShape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copySelectedShape, deleteSelectedShape, isPreviewMode, pasteCopiedShape, redo, undo]);

  return (
    <div data-editor-toolbar="true" className="max-w-full overflow-x-auto">
      <div className="mb-2 text-center text-xs text-slate-500">
        {saveStatus === "conflict"
          ? "内容已过期，请刷新后重试"
          : isPreviewingRevision
            ? `正在预览历史版本 v${previewRevisionVersion}`
          : isDirty
            ? "有未保存修改"
            : lastSavedAt
              ? `上次保存：${new Date(lastSavedAt).toLocaleTimeString()}`
              : ""}
      </div>
      <div className="flex min-w-max items-center rounded-2xl border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.05)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="hidden md:inline">Ask AI</span>
        </button>

        <div className="mx-1.5 h-6 w-px bg-slate-200" />

        <ToolbarMenu
          icon={<Type className="h-4 w-4" />}
          label="文本"
          disabled={isPreviewMode}
          items={[
            { label: "大标题", onClick: () => insertTextPreset("display") },
            { label: "标题", onClick: () => insertTextPreset("title") },
            { label: "副标题", onClick: () => insertTextPreset("subtitle") },
            { label: "正文", onClick: () => insertTextPreset("body") },
            { label: "小号正文", onClick: () => insertTextPreset("body-small") },
          ]}
        />
        <ToolbarMenu
          icon={<Shapes className="h-4 w-4" />}
          label="图形"
          disabled={isPreviewMode}
          items={[
            { label: "矩形", onClick: () => insertShape("rect") },
            { label: "圆", onClick: () => insertShape("ellipse") },
            { label: "直线", onClick: () => insertShape("line") },
            { label: "单向箭头", onClick: () => insertShape("arrow") },
          ]}
        />
        <ToolbarMenu
          icon={<Table2 className="h-4 w-4" />}
          label="表格"
          disabled={isPreviewMode}
          items={[{ label: "插入 3 x 3 表格", onClick: () => insertTable(3, 3) }]}
        />

        <div className="mx-1.5 h-6 w-px bg-slate-200" />

        <ToolbarButton icon={<Palette className="h-4 w-4" />} label="格式" />
        <button
          type="button"
          disabled={!selectedShapeId}
          onClick={bringToFront}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <ArrowUpToLine className="h-4 w-4" />
          <span className="hidden md:inline">置顶</span>
        </button>
        <button
          type="button"
          disabled={!selectedShapeId}
          onClick={sendToBack}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <ArrowDownToLine className="h-4 w-4" />
          <span className="hidden md:inline">置底</span>
        </button>

        <div className="mx-1.5 h-6 w-px bg-slate-200" />

        <button
          type="button"
          disabled={!canZoomOut}
          onClick={() => updateZoom(zoom - ZOOM_STEP)}
          className="cursor-pointer rounded-xl p-1.5 text-slate-600 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => updateZoom(DEFAULT_ZOOM)}
          className="hidden cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 md:block"
        >
          {zoom}%
        </button>
        <button
          type="button"
          disabled={!canZoomIn}
          onClick={() => updateZoom(zoom + ZOOM_STEP)}
          className="cursor-pointer rounded-xl p-1.5 text-slate-600 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
      <Sheet open={isHistoryOpen} onOpenChange={onHistoryOpenChange}>
        <SheetContent side="right" className="w-[420px] p-0 sm:max-w-[420px]">
          <SheetHeader className="border-b border-slate-200 bg-white p-4">
            <SheetTitle>历史版本</SheetTitle>
            <SheetDescription>查看版本记录，预览并回滚到指定版本。</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-4">
              {isLoadingRevisions ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`revision-skeleton-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <Skeleton className="h-5 w-10 rounded-md" />
                        <Skeleton className="h-5 w-12 rounded-md" />
                      </div>
                      <Skeleton className="mb-3 h-4 w-40 rounded-md" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-14 rounded-lg" />
                        <Skeleton className="h-7 w-14 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : revisionError ? (
                <div className="text-sm text-rose-600">{revisionError}</div>
              ) : revisions.length === 0 ? (
                <div className="text-sm text-slate-500">暂无历史版本</div>
              ) : (
                revisions.map((revision) => {
                  const isCurrent = revision.version === activeVersion;
                  const isPreview = revision.version === previewRevisionVersion;

                  return (
                    <div
                      key={`${revision.slideId}-${revision.version}`}
                      className={`rounded-xl border p-3 ${
                        isPreview ? "border-sky-300 bg-sky-50/60" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">v{revision.version}</span>
                        {isCurrent ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">当前</span>
                        ) : null}
                      </div>
                      <div className="mb-3 text-xs text-slate-500">
                        {new Date(revision.createdAt).toLocaleString()}
                        {revision.reason ? ` · ${revision.reason}` : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onPreviewRevision(revision.version)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/70"
                        >
                          {isCurrent ? "查看当前" : isPreview ? "退出预览" : "预览"}
                        </button>
                        <button
                          type="button"
                          disabled={isCurrent || isRollingBack}
                          onClick={() => onRollbackRevision(revision.version)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/70 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          回滚
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="border-t border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => onHistoryOpenChange(false)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/70"
            >
              关闭
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ToolbarButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function ToolbarMenu({
  icon,
  label,
  items,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  items: { label: string; onClick: () => void }[];
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {icon}
          <span className="hidden md:inline">{label}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onClick}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
