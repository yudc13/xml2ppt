"use client";

import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Eye, EyeOff, History, Loader2, MonitorPlay, Save, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderProps = {
  title: string;
  onTitleSave?: (nextTitle: string) => Promise<boolean>;
  backHref?: string;
  showLogo?: boolean;
  onSave?: () => void;
  onOpenHistory?: () => void;
  onTogglePreview?: () => void;
  onPlay?: () => void;
  onExportPdf?: () => void;
  onExportPptx?: () => void;
  isSaving?: boolean;
  isExporting?: boolean;
  saveStatus?: "idle" | "success" | "error" | "conflict";
  isDirty?: boolean;
  isPreviewMode?: boolean;
  disableSave?: boolean;
  disablePlay?: boolean;
  disableExport?: boolean;
};

export function Header({
  title,
  onTitleSave,
  backHref,
  showLogo = true,
  onSave,
  onOpenHistory,
  onTogglePreview,
  onPlay,
  onExportPdf,
  onExportPptx,
  isSaving = false,
  isExporting = false,
  saveStatus = "idle",
  isDirty = false,
  isPreviewMode = false,
  disableSave = false,
  disablePlay = false,
  disableExport = false,
}: HeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleSaveStatus, setTitleSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditingTitle || !inputRef.current) {
      return;
    }

    inputRef.current.focus();
    inputRef.current.select();
  }, [isEditingTitle]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const clearStatusLater = () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      setTitleSaveStatus("idle");
    }, 1500);
  };

  const commitTitle = async () => {
    if (!onTitleSave || isSavingTitle) {
      setIsEditingTitle(false);
      return;
    }

    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === title) {
      setDraftTitle(title);
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    const success = await onTitleSave(nextTitle);
    setIsSavingTitle(false);

    if (!success) {
      setDraftTitle(title);
      setTitleSaveStatus("error");
      clearStatusLater();
      setIsEditingTitle(false);
      return;
    }

    setTitleSaveStatus("success");
    clearStatusLater();
    setIsEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setDraftTitle(title);
    setIsEditingTitle(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitTitle();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit();
    }
  };

  const saveStatusPillText =
    saveStatus === "conflict"
      ? "版本冲突"
      : saveStatus === "error"
        ? "保存失败"
        : isSaving
          ? "保存中..."
          : isDirty
            ? "未保存变更"
            : "已同步";

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="返回列表"
            className="group grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-[0_1px_6px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-x-0.5 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          </Link>
        ) : null}
        {showLogo ? (
          <div className={`${backHref ? "ml-1.5" : ""} grid h-10 w-10 place-items-center rounded-xl bg-transparent`}>
            <Image
              src="/logo.svg"
              alt="PPT Logo"
              width={24}
              height={24}
              className="h-6 w-6 opacity-95 transition-opacity duration-200 hover:opacity-100"
              priority
            />
          </div>
        ) : null}
        <div className={`${showLogo ? "ml-3.5" : backHref ? "ml-2.5" : ""} flex items-center gap-2`}>
          {isEditingTitle ? (
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                void commitTitle();
              }}
              className="min-w-[280px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xl font-medium tracking-tight text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(title);
                setIsEditingTitle(true);
              }}
              className="cursor-text rounded-md px-1 text-left text-xl font-medium tracking-tight text-slate-800 hover:bg-slate-100/70"
            >
              {title}
            </button>
          )}
          {isSavingTitle ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
          {!isSavingTitle && titleSaveStatus === "success" ? <Check className="h-4 w-4 text-emerald-600" /> : null}
          {!isSavingTitle && titleSaveStatus === "error" ? <X className="h-4 w-4 text-rose-600" /> : null}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 text-slate-600">
        <div
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            saveStatus === "conflict" || saveStatus === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : saveStatus === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : isDirty
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveStatus === "success" ? (
            <Check className="h-3.5 w-3.5" />
          ) : saveStatus === "error" || saveStatus === "conflict" ? (
            <CircleAlert className="h-3.5 w-3.5" />
          ) : null}
          <span>{saveStatusPillText}</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.05)]">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || disableSave}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <History className="h-3.5 w-3.5" />
            历史版本
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
              isPreviewMode ? "bg-sky-50 text-sky-700 hover:bg-sky-100/80" : "text-slate-700 hover:bg-slate-100/80"
            }`}
          >
            {isPreviewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {isPreviewMode ? "退出预览" : "预览"}
          </button>
          <button
            type="button"
            onClick={onPlay}
            disabled={disablePlay}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            播放
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disableExport || isExporting}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                导出
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={isExporting} onClick={onExportPdf}>
                导出 PDF
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isExporting} onClick={onExportPptx}>
                导出 PPTX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="ml-1 shrink-0 rounded-xl border border-slate-200 bg-white p-0.5 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg">
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}
