"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Expand,
  Loader2,
  Play,
  RefreshCw,
  X,
} from "lucide-react";

type HeaderProps = {
  title: string;
  onTitleSave?: (nextTitle: string) => Promise<boolean>;
};

export function Header({ title, onTitleSave }: HeaderProps) {
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

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-[#fff7f2]">
          <span className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm" />
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex items-center gap-1.5 text-slate-600">
        <button
          type="button"
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 px-3 text-xs font-medium text-slate-700 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-colors duration-200 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          最新版本
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          aria-label="历史记录"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          aria-label="播放"
        >
          <Play className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          aria-label="下载"
        >
          <Download className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <button
          type="button"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          aria-label="全屏"
        >
          <Expand className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
