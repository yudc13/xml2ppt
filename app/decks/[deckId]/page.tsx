"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CircleAlert,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  History,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Shapes,
  Sparkles,
  Table2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { SlideViewport } from "@/components/editor/slide-viewport";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useSlideEditorStore } from "@/features/slide-editor/store";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const INITIAL_ACTIVE_SLIDE_INDEX = 0;
const DEFAULT_ZOOM = 65;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 5;

type PersistedSlide = {
  id: string;
  deckId: string;
  position: number;
  xmlContent: string;
  version: number;
  updatedAt: string;
};

type Deck = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type SlideRevision = {
  id: number;
  slideId: string;
  version: number;
  xmlContent: string;
  createdAt: string;
  createdBy: string | null;
  reason: string | null;
};

type SaveStatus = "idle" | "success" | "error" | "conflict";

class ApiRequestError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    code?: string;
  };

  if (!response.ok || payload.ok === false) {
    throw new ApiRequestError(
      payload.message ?? `Request failed with status ${response.status}`,
      payload.code,
      response.status,
    );
  }

  return payload as T;
}

export default function Home() {
  const buildSlideDocumentModel = useSlideEditorStore((state) => state.buildSlideDocumentModel);
  const currentSlideIndexInStore = useSlideEditorStore((state) => state.currentSlideIndex);
  const storeShapes = useSlideEditorStore((state) => state.shapes);
  const setPreviewMode = useSlideEditorStore((state) => state.setPreviewMode);
  const params = useParams<{ deckId: string }>();
  const routeDeckId = typeof params?.deckId === "string" ? params.deckId : "";

  const [deckTitle, setDeckTitle] = useState("未命名演示文稿");
  const [slides, setSlides] = useState<PersistedSlide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(INITIAL_ACTIVE_SLIDE_INDEX);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<SlideRevision[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [previewRevisionVersion, setPreviewRevisionVersion] = useState<number | null>(null);
  const [previewRevisionXml, setPreviewRevisionXml] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
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
    let cancelled = false;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapError(null);

      try {
        if (!routeDeckId) {
          throw new Error("无效的 deckId");
        }

        const loadedDeck = await requestJson<{ ok: true; deck: Deck }>(`/api/decks/${routeDeckId}`);
        setDeckTitle(loadedDeck.deck.title);

        const loadedSlidesResponse = await requestJson<{ ok: true; slides: PersistedSlide[] }>(
          `/api/decks/${routeDeckId}/slides`,
        );
        let nextSlides = loadedSlidesResponse.slides;

        if (nextSlides.length === 0) {
          const createdSlideResponse = await requestJson<{ ok: true; slide: PersistedSlide }>(
            `/api/decks/${routeDeckId}/slides`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          );
          nextSlides = [createdSlideResponse.slide];
        }

        if (cancelled) {
          return;
        }

        setSlides(nextSlides);
        setActiveSlideIndex(INITIAL_ACTIVE_SLIDE_INDEX);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "加载失败";
        setBootstrapError(message);
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [routeDeckId]);

  useEffect(() => {
    setPreviewRevisionVersion(null);
    setPreviewRevisionXml(null);
    setRevisions([]);
    setRevisionError(null);
  }, [activeSlide?.id]);

  useEffect(() => {
    setPreviewMode(previewRevisionVersion !== null);
  }, [previewRevisionVersion, setPreviewMode]);

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
    if (!activeSlide || isSaving) {
      return !isSaving;
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

    setIsSaving(true);
    if (showStatus) {
      setSaveStatus("idle");
    }

    try {
      const saved = await requestJson<{ ok: true; slide: PersistedSlide }>(`/api/slides/${activeSlide.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: activeSlide.version,
          xmlContent,
          reason: showStatus ? "manual_save" : "autosave",
        }),
      });

      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id !== activeSlide.id) {
            return slide;
          }

          return saved.slide;
        }),
      );
      setLastSavedAt(saved.slide.updatedAt);

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
    } finally {
      setIsSaving(false);
    }
  };

  const loadRevisions = async () => {
    if (!activeSlide) {
      return;
    }

    setIsLoadingRevisions(true);
    setRevisionError(null);
    try {
      const response = await requestJson<{ ok: true; revisions: SlideRevision[] }>(
        `/api/slides/${activeSlide.id}/revisions?limit=100`,
      );
      setRevisions(response.revisions);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载历史版本失败";
      setRevisionError(message);
    } finally {
      setIsLoadingRevisions(false);
    }
  };

  const handleOpenHistory = () => {
    setIsHistoryOpen(true);
    void loadRevisions();
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
      const response = await requestJson<{ ok: true; revision: SlideRevision }>(
        `/api/slides/${activeSlide.id}/revisions/${version}`,
      );
      setPreviewRevisionVersion(version);
      setPreviewRevisionXml(response.revision.xmlContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载历史版本内容失败";
      setRevisionError(message);
    }
  };

  const handleRollbackRevision = async (targetVersion: number) => {
    if (!activeSlide || isRollingBack) {
      return;
    }

    setIsRollingBack(true);
    try {
      const result = await requestJson<{ ok: true; slide: PersistedSlide }>(`/api/slides/${activeSlide.id}/rollback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetVersion,
          currentVersion: activeSlide.version,
        }),
      });

      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id !== result.slide.id) {
            return slide;
          }

          return result.slide;
        }),
      );
      setPreviewRevisionVersion(null);
      setPreviewRevisionXml(null);
      setLastSavedAt(result.slide.updatedAt);
      setSaveStatus("success");
      clearSaveStatusLater();
      await loadRevisions();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "SLIDE_VERSION_CONFLICT") {
        setSaveStatus("conflict");
      } else {
        setSaveStatus("error");
      }
    } finally {
      setIsRollingBack(false);
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

      setIsHistoryOpen(false);
      setActiveSlideIndex(nextIndex);
    })();
  };

  const handleCreateSlide = () => {
    if (!routeDeckId || isSaving) {
      return;
    }

    void (async () => {
      const ok = await persistActiveSlide();
      if (!ok) {
        return;
      }

      try {
        const created = await requestJson<{ ok: true; slide: PersistedSlide }>(`/api/decks/${routeDeckId}/slides`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        setSlides((prev) => {
          const nextSlides = [...prev, created.slide];
          setIsHistoryOpen(false);
          setActiveSlideIndex(nextSlides.length - 1);
          return nextSlides;
        });
      } catch {
        setSaveStatus("error");
      }
    })();
  };

  const handleManualSave = () => {
    void persistActiveSlide({ showStatus: true });
  };

  if (isBootstrapping) {
    return <DeckEditorLoadingLayout />;
  }

  if (bootstrapError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f2f4f7] px-6 text-sm text-rose-600">
        数据加载失败：{bootstrapError}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2f4f7] font-sans text-slate-900">
      <Header
        backHref="/"
        showLogo={false}
        title={deckTitle}
        onTitleSave={async (nextTitle) => {
          if (!routeDeckId) {
            return false;
          }

          try {
            const updated = await requestJson<{ ok: true; deck: Deck }>(`/api/decks/${routeDeckId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: nextTitle,
              }),
            });
            setDeckTitle(updated.deck.title);
            return true;
          } catch {
            return false;
          }
        }}
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
                onSave={handleManualSave}
                isSaving={isSaving}
                saveStatus={saveStatus}
                isDirty={isDirty}
                lastSavedAt={lastSavedAt}
                isHistoryOpen={isHistoryOpen}
                onHistoryOpenChange={setIsHistoryOpen}
                onOpenHistory={handleOpenHistory}
                revisions={revisions}
                isLoadingRevisions={isLoadingRevisions}
                revisionError={revisionError}
                previewRevisionVersion={previewRevisionVersion}
                activeVersion={activeSlide?.version ?? null}
                onPreviewRevision={handlePreviewRevision}
                onRollbackRevision={handleRollbackRevision}
                isRollingBack={isRollingBack}
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

function DeckEditorLoadingLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2f4f7]">
      <Header title="正在加载演示文稿..." backHref="/" showLogo={false} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[280px] border-r border-slate-200 bg-[#f8fafc] p-3 md:block">
          <Skeleton className="mb-4 h-9 w-full rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`slide-thumb-skeleton-${index}`} className="rounded-xl border border-slate-200 bg-white p-2">
                <Skeleton className="mb-2 h-3 w-5 rounded-md" />
                <Skeleton className="h-[95px] w-full rounded-lg" />
              </div>
            ))}
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-auto bg-[#f8fafc]/50 p-8">
          <div className="mb-6 flex justify-center">
            <div className="w-full max-w-[980px] rounded-2xl border border-slate-200/90 bg-white/90 p-2">
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: 10 }).map((_, index) => (
                  <Skeleton key={`toolbar-skeleton-${index}`} className="h-8 w-16 rounded-xl" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[980px] rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-6 md:p-8">
              <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            </div>
          </div>
        </main>
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
  onSave,
  isSaving,
  saveStatus,
  isDirty,
  lastSavedAt,
  isHistoryOpen,
  onHistoryOpenChange,
  onOpenHistory,
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
  onSave: () => void;
  isSaving: boolean;
  saveStatus: SaveStatus;
  isDirty: boolean;
  lastSavedAt: string | null;
  isHistoryOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onOpenHistory: () => void;
  revisions: SlideRevision[];
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
  const setPreviewMode = useSlideEditorStore((state) => state.setPreviewMode);
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

  const saveStatusText =
    saveStatus === "conflict"
      ? "版本冲突"
      : saveStatus === "error"
        ? "保存失败"
        : isSaving
          ? "保存中..."
          : saveStatus === "success"
            ? "已保存"
            : "保存";

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
          onClick={onSave}
          disabled={isSaving || isPreviewingRevision}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveStatus === "success" ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : saveStatus === "error" || saveStatus === "conflict" ? (
            <CircleAlert className="h-4 w-4 text-rose-600" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="hidden md:inline">{saveStatusText}</span>
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <History className="h-4 w-4" />
          <span className="hidden md:inline">历史版本</span>
        </button>
        <button
          type="button"
          onClick={() => setPreviewMode(!isPreviewMode)}
          className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
            isPreviewMode
              ? "bg-sky-50 text-sky-700 hover:bg-sky-100/80"
              : "text-slate-700 hover:bg-slate-100/80"
          }`}
        >
          {isPreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="hidden md:inline">{isPreviewMode ? "退出预览" : "预览"}</span>
        </button>
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
                <div className="text-sm text-slate-500">正在加载版本列表...</div>
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
