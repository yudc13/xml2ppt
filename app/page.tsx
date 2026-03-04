"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CircleAlert,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Palette,
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
import { slides as mockSlides } from "@/mock/slides";
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

const INITIAL_ACTIVE_SLIDE_INDEX = 0;

const SLIDE_NUMBERS = mockSlides.map((_, index) => index + 1);

export default function Home() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(INITIAL_ACTIVE_SLIDE_INDEX);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2f4f7] font-sans text-slate-900">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider defaultOpen>
          <Sidebar
            slides={SLIDE_NUMBERS}
            activeSlide={activeSlideIndex + 1}
            onSlideSelect={(slideNumber) => setActiveSlideIndex(slideNumber - 1)}
          />

          <SidebarInset className="flex flex-1 flex-col overflow-auto bg-[#f8fafc]/50 p-8">
            <div className="relative mb-6 flex items-center justify-center">
              <CollapsedSidebarTrigger />
              <Toolbar slideIndex={activeSlideIndex} />
            </div>
            <div className="flex flex-1 items-center justify-center">
              <SlideViewport slideIndex={activeSlideIndex} />
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

function Toolbar({ slideIndex }: { slideIndex: number }) {
  const selectedShapeId = useSlideEditorStore((state) => state.selectedShapeId);
  const bringToFront = useSlideEditorStore((state) => state.bringToFront);
  const sendToBack = useSlideEditorStore((state) => state.sendToBack);
  const insertTextPreset = useSlideEditorStore((state) => state.insertTextPreset);
  const insertShape = useSlideEditorStore((state) => state.insertShape);
  const insertTable = useSlideEditorStore((state) => state.insertTable);
  const isPreviewMode = useSlideEditorStore((state) => state.isPreviewMode);
  const setPreviewMode = useSlideEditorStore((state) => state.setPreviewMode);
  const buildSlideDocumentModel = useSlideEditorStore((state) => state.buildSlideDocumentModel);
  const copySelectedShape = useSlideEditorStore((state) => state.copySelectedShape);
  const pasteCopiedShape = useSlideEditorStore((state) => state.pasteCopiedShape);
  const deleteSelectedShape = useSlideEditorStore((state) => state.deleteSelectedShape);
  const undo = useSlideEditorStore((state) => state.undo);
  const redo = useSlideEditorStore((state) => state.redo);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

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

  const handleSave = async () => {
    const model = buildSlideDocumentModel();
    if (!model || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const xml = serializeSlideDocument(model);
      const response = await fetch("/api/slides/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideIndex,
          xml,
        }),
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      setSaveStatus("success");
      window.setTimeout(() => setSaveStatus("idle"), 1500);
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-full overflow-x-auto">
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
          onClick={handleSave}
          disabled={isSaving}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveStatus === "success" ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : saveStatus === "error" ? (
            <CircleAlert className="h-4 w-4 text-rose-600" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="hidden md:inline">
            {saveStatus === "error" ? "保存失败" : isSaving ? "保存中..." : saveStatus === "success" ? "已保存" : "保存"}
          </span>
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
          className="cursor-pointer rounded-xl p-1.5 text-slate-600 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="hidden cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 md:block"
        >
          65%
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-xl p-1.5 text-slate-600 transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
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
