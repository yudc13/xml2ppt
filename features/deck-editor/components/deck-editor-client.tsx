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
import { PresentationPlayer } from "@/features/deck-editor/components/presentation-player";
import { Sidebar } from "@/features/deck-editor/components/sidebar";
import { SlideViewport } from "@/features/deck-editor/components/slide-viewport";
import {
  ApiRequestError,
  useCreateSlide,
  useDeleteSlide,
  useGetRevision,
  useGetSlides,
  useLoadRevisions,
  useRollbackSlide,
  useSaveSlide,
  useUpdateDeckTitle,
} from "@/features/deck-editor/hooks/use-deck-editor-api";
import { useSlideEditorStore } from "@/features/slide-editor/store";
import { TEXT_PRESET_OPTIONS } from "@/features/slide-editor/text-preset-config";
import type { DeckEntity, PersistedSlide, SaveStatus, SlideRevisionEntity } from "@/features/deck-editor/types";
import { serializeSlideDocument } from "@/lib/slide-xml/serializer";
import { exportSlidesToPdf } from "@/features/deck-editor/lib/export/export-pdf";
import { exportSlidesToPptx } from "@/features/deck-editor/lib/export/export-pptx";
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
import { toast } from "sonner";

const INITIAL_ACTIVE_SLIDE_INDEX = 0;
const DEFAULT_ZOOM = 65;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 5;
const TABLE_GRID_MAX = 10;

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
  const getSlides = useGetSlides(deckId);
  const deleteSlideHook = useDeleteSlide();

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
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerSessionKey, setPlayerSessionKey] = useState(0);
  const [isExporting, setIsExporting] = useState<null | "pdf" | "pptx">(null);
  const [slideClipboardXml, setSlideClipboardXml] = useState<string | null>(null);
  const isSlideOperationPending = createSlide.isPending || deleteSlideHook.isPending || getSlides.isPending;
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

  const sanitizeFileName = (value: string) => {
    const trimmed = value.trim().replace(/[\\/:*?"<>|]/g, "_");
    return trimmed || "deck-export";
  };

  const getFormalSlideXmlList = () => {
    return slides.map((slide, index) => {
      if (index !== activeSlideIndex || previewRevisionVersion !== null) {
        return slide.xmlContent;
      }

      if (currentSlideIndexInStore !== activeSlideIndex) {
        return slide.xmlContent;
      }

      const model = buildSlideDocumentModel();
      if (!model) {
        return slide.xmlContent;
      }

      return serializeSlideDocument(model);
    });
  };

  const ensureExportableState = async () => {
    if (previewRevisionVersion !== null) {
      window.alert("请先退出历史版本预览，再进行播放或导出。");
      return false;
    }

    const persisted = await persistActiveSlide();
    if (!persisted) {
      window.alert("当前页面保存失败，请处理后重试。");
      return false;
    }

    return true;
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

  const fetchAndSyncSlides = async (targetIndex?: number) => {
    try {
      const nextSlides = await getSlides.mutateAsync();
      setSlides(nextSlides);
      if (typeof targetIndex === "number") {
        setActiveSlideIndex(Math.max(0, Math.min(nextSlides.length - 1, targetIndex)));
      }
    } catch {
      setSaveStatus("error");
    }
  };

  const handleCreateSlide = (atIndex?: number) => {
    if (isSlideOperationPending || saveSlide.isPending) {
      return;
    }

    const promise = (async () => {
      const ok = await persistActiveSlide();
      if (!ok) {
        throw new Error("保存当前幻灯片失败");
      }

      try {
        const position = typeof atIndex === "number" ? atIndex + 2 : undefined;
        await createSlide.mutateAsync({ position });

        resetRevisionState();
        setIsHistoryOpen(false);
        await fetchAndSyncSlides(typeof atIndex === "number" ? atIndex + 1 : slides.length);
      } catch (err) {
        throw err;
      }
    })();

    toast.promise(promise, {
      loading: "正在创建幻灯片...",
      success: "幻灯片已创建",
      error: "创建幻灯片失败",
    });
  };

  const handleCopySlide = (index: number) => {
    const slide = slides[index];
    if (slide) {
      setSlideClipboardXml(slide.xmlContent);
      toast.success("已复制到剪贴板");
    }
  };

  const handleCutSlide = (index: number) => {
    const slide = slides[index];
    if (slide) {
      setSlideClipboardXml(slide.xmlContent);
      void handleDeleteSlide(index, true);
    }
  };

  const handlePasteSlide = (atIndex: number) => {
    if (!slideClipboardXml || createSlide.isPending) return;

    const promise = (async () => {
      const ok = await persistActiveSlide();
      if (!ok) throw new Error("保存当前幻灯片失败");

      try {
        await createSlide.mutateAsync({
          xmlContent: slideClipboardXml,
          position: atIndex + 2,
        });
        await fetchAndSyncSlides(atIndex + 1);
      } catch (err) {
        throw err;
      }
    })();

    toast.promise(promise, {
      loading: "正在粘贴幻灯片...",
      success: "已粘贴幻灯片",
      error: "粘贴幻灯片失败",
    });
  };

  const handleDuplicateSlide = (index: number) => {
    const slide = slides[index];
    if (!slide || createSlide.isPending) return;

    const promise = (async () => {
      const ok = await persistActiveSlide();
      if (!ok) throw new Error("保存当前幻灯片失败");

      try {
        await createSlide.mutateAsync({
          xmlContent: slide.xmlContent,
          position: index + 2,
        });
        await fetchAndSyncSlides(index + 1);
      } catch (err) {
        throw err;
      }
    })();

    toast.promise(promise, {
      loading: "正在复制幻灯片...",
      success: "程序已复制幻灯片",
      error: "复制幻灯片失败",
    });
  };

  const handleDeleteSlide = async (index: number, isCut = false) => {
    const slide = slides[index];
    if (!slide || deleteSlideHook.isPending) return;

    if (slides.length <= 1) {
      toast.error("幻灯片数量不能少于 1 张");
      return;
    }

    const promise = (async () => {
      try {
        await deleteSlideHook.mutateAsync(slide.id);

        let nextIndex = activeSlideIndex;
        if (index === activeSlideIndex) {
          nextIndex = index === slides.length - 1 ? index - 1 : index;
        } else if (index < activeSlideIndex) {
          nextIndex = activeSlideIndex - 1;
        }

        await fetchAndSyncSlides(nextIndex);
      } catch (err) {
        throw err;
      }
    })();

    if (!isCut) {
      toast.promise(promise, {
        loading: "正在删除幻灯片...",
        success: "幻灯片已删除",
        error: "删除幻灯片失败",
      });
    }
  };

  const handleManualSave = () => {
    void persistActiveSlide({ showStatus: true });
  };

  const handlePlay = () => {
    void (async () => {
      const ok = await ensureExportableState();
      if (!ok) {
        return;
      }

      setPlayerSessionKey((prev) => prev + 1);
      setIsPlayerOpen(true);
    })();
  };

  const handleExport = (format: "pdf" | "pptx") => {
    if (isExporting) {
      return;
    }

    void (async () => {
      const ok = await ensureExportableState();
      if (!ok) {
        return;
      }

      const fileBaseName = sanitizeFileName(deckTitle);
      const xmlList = getFormalSlideXmlList();
      setIsExporting(format);

      try {
        if (format === "pdf") {
          await exportSlidesToPdf(xmlList, fileBaseName);
        } else {
          await exportSlidesToPptx(xmlList, fileBaseName);
        }
      } catch (error) {
        console.error("Export failed", error);
        window.alert("导出失败，请稍后重试。");
      } finally {
        setIsExporting(null);
      }
    })();
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
        onPlay={handlePlay}
        onExportPdf={() => handleExport("pdf")}
        onExportPptx={() => handleExport("pptx")}
        isSaving={saveSlide.isPending}
        isExporting={isExporting !== null}
        saveStatus={saveStatus}
        isDirty={isDirty}
        isPreviewMode={isPreviewMode}
        disableSave={previewRevisionVersion !== null}
        disablePlay={previewRevisionVersion !== null}
        disableExport={previewRevisionVersion !== null}
      />

      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider defaultOpen>
          <Sidebar
            slides={slideNumbers}
            slideIdList={slides.map((slide) => slide.id)}
            slideXmlList={slides.map((slide) => slide.xmlContent)}
            activeSlide={activeSlideIndex + 1}
            activeSlideId={activeSlide?.id}
            activeSlideRenderXml={currentSlideXml}
            forceActiveSlideModelRender={previewRevisionVersion !== null}
            onSlideSelect={handleSelectSlide}
            onCreateSlide={handleCreateSlide}
            onCopySlide={handleCopySlide}
            onCutSlide={handleCutSlide}
            onPasteSlide={handlePasteSlide}
            onDeleteSlide={handleDeleteSlide}
            onDuplicateSlide={handleDuplicateSlide}
            canPaste={!!slideClipboardXml}
            isLoading={isSlideOperationPending}
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

      <PresentationPlayer
        key={playerSessionKey}
        open={isPlayerOpen}
        slideXmlList={getFormalSlideXmlList()}
        onClose={() => setIsPlayerOpen(false)}
      />
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
  const pendingInsertion = useSlideEditorStore((state) => state.pendingInsertion);
  const setPendingInsertion = useSlideEditorStore((state) => state.setPendingInsertion);
  const bringToFront = useSlideEditorStore((state) => state.bringToFront);
  const sendToBack = useSlideEditorStore((state) => state.sendToBack);
  const bringForward = useSlideEditorStore((state) => state.bringForward);
  const sendBackward = useSlideEditorStore((state) => state.sendBackward);
  const isPreviewMode = useSlideEditorStore((state) => state.isPreviewMode);
  const copySelectedShape = useSlideEditorStore((state) => state.copySelectedShape);
  const cutSelectedShape = useSlideEditorStore((state) => state.cutSelectedShape);
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

      if (event.key === "Escape" && pendingInsertion) {
        event.preventDefault();
        setPendingInsertion(null);
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

      if (isMeta && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelectedShape()
        toast.success('已复制形状')
        return
      }

      if (isMeta && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        cutSelectedShape()
        toast.success('已剪切形状')
        return
      }

      if (isMeta && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteCopiedShape()
        toast.success('已粘贴形状')
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelectedShape()
        toast.success('已删除形状')
        return
      }

      // Layering shortcuts
      if (isMeta && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        bringToFront()
        return
      }
      if (isMeta && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        sendToBack()
        return
      }
      if (isMeta && event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        bringForward()
        return
      }
      if (isMeta && event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        sendBackward()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    copySelectedShape,
    cutSelectedShape,
    deleteSelectedShape,
    isPreviewMode,
    pasteCopiedShape,
    pendingInsertion,
    redo,
    setPendingInsertion,
    undo,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  ])

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
          isActive={pendingInsertion?.type === "text"}
          items={TEXT_PRESET_OPTIONS.map((option) => {
            const previewSize = Math.max(12, Math.min(28, Math.round(option.fontSize * 0.72)));
            const weightLabel = option.bold ? "Bold" : "Regular";

            return {
              key: option.preset,
              label: (
                <div className="flex w-full items-end justify-between gap-2">
                  <span
                    style={{
                      fontFamily: option.fontFamily,
                      fontSize: `${previewSize}px`,
                      fontWeight: option.fontWeight,
                      lineHeight: 1.15,
                    }}
                  >
                    {option.label}
                  </span>
                  <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
                    {option.fontSize}/{weightLabel}
                  </span>
                </div>
              ),
              onClick: () => setPendingInsertion({ type: "text", preset: option.preset }),
            };
          })}
        />
        <ToolbarMenu
          icon={<Shapes className="h-4 w-4" />}
          label="图形"
          disabled={isPreviewMode}
          isActive={pendingInsertion?.type === "shape"}
          items={[
            { key: "rect", label: "矩形", onClick: () => setPendingInsertion({ type: "shape", shapeType: "rect" }) },
            { key: "ellipse", label: "圆", onClick: () => setPendingInsertion({ type: "shape", shapeType: "ellipse" }) },
            { key: "line", label: "直线", onClick: () => setPendingInsertion({ type: "shape", shapeType: "line" }) },
            { key: "arrow", label: "单向箭头", onClick: () => setPendingInsertion({ type: "shape", shapeType: "arrow" }) },
          ]}
        />
        <TableInsertGridMenu
          disabled={isPreviewMode}
          isActive={pendingInsertion?.type === "table"}
          onInsert={(rows, columns) => setPendingInsertion({ type: "table", rows, columns })}
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
                      className={`rounded-xl border p-3 ${isPreview ? "border-sky-300 bg-sky-50/60" : "border-slate-200 bg-white"
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
  isActive,
}: {
  icon: ReactNode;
  label: string;
  items: { key: string; label: ReactNode; onClick: () => void }[];
  disabled?: boolean;
  isActive?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400 ${isActive
            ? "bg-sky-100 text-sky-700 hover:bg-sky-200/80"
            : "text-slate-700 hover:bg-slate-100/80"
            }`}
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
          <DropdownMenuItem key={item.key} onSelect={item.onClick} className="py-2">
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableInsertGridMenu({
  onInsert,
  disabled,
  isActive,
}: {
  onInsert: (rows: number, columns: number) => void;
  disabled?: boolean;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hoverRows, setHoverRows] = useState(1);
  const [hoverColumns, setHoverColumns] = useState(1);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setHoverRows(1);
          setHoverColumns(1);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400 ${isActive
            ? "bg-sky-100 text-sky-700 hover:bg-sky-200/80"
            : "text-slate-700 hover:bg-slate-100/80"
            }`}
        >
          <Table2 className="h-4 w-4" />
          <span className="hidden md:inline">表格</span>
          <ChevronDown className="hidden h-3.5 w-3.5 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px] p-3">
        <div className="mb-2 text-xs font-medium text-slate-700">插入表格</div>
        <div
          className="grid grid-cols-10 gap-1"
          onMouseLeave={() => {
            setHoverRows(1);
            setHoverColumns(1);
          }}
        >
          {Array.from({ length: TABLE_GRID_MAX }).map((_, rowIndex) =>
            Array.from({ length: TABLE_GRID_MAX }).map((__, colIndex) => {
              const rows = rowIndex + 1;
              const columns = colIndex + 1;
              const isSelected = rowIndex < hoverRows && colIndex < hoverColumns;

              return (
                <button
                  key={`table-grid-${rows}-${columns}`}
                  type="button"
                  className={`h-3.5 w-3.5 rounded-[3px] border transition-colors ${isSelected
                    ? "border-sky-500 bg-sky-400/80"
                    : "border-slate-300 bg-slate-100 hover:border-slate-400 hover:bg-slate-200"
                    }`}
                  onMouseEnter={() => {
                    setHoverRows(rows);
                    setHoverColumns(columns);
                  }}
                  onClick={() => {
                    onInsert(rows, columns);
                    setOpen(false);
                  }}
                />
              );
            }),
          )}
        </div>
        <div className="mt-2 text-center text-xs text-slate-500">
          {hoverRows} x {hoverColumns}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
