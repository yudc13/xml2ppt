"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTemplatePreview } from "@/features/template/hooks/use-template";
import type { TemplateItem } from "@/features/template/types";

function extractPreviewText(xmlContent: string): string {
  const paragraphs = Array.from(xmlContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g))
    .map((match) => match[1])
    .map((text) => text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 0);

  if (paragraphs.length > 0) {
    return paragraphs.slice(0, 2).join(" · ");
  }

  return "当前页暂无文本预览";
}

type TemplatePreviewDialogProps = {
  template: TemplateItem | null;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (templateId: string) => void;
  isCreating: boolean;
};

export function TemplatePreviewDialog({
  template,
  onOpenChange,
  onUseTemplate,
  isCreating,
}: TemplatePreviewDialogProps) {
  const { data: preview, isLoading } = useTemplatePreview(template?.id ?? null);
  const [previewState, setPreviewState] = useState<{ templateId: string | null; pageIndex: number }>({
    templateId: null,
    pageIndex: 0,
  });

  const slides = preview?.slides ?? [];
  const totalPages = slides.length;
  const currentPageIndex = template?.id && previewState.templateId === template.id ? previewState.pageIndex : 0;
  const currentSlide = slides[currentPageIndex] ?? null;
  const canPrev = currentPageIndex > 0;
  const canNext = currentPageIndex < totalPages - 1;
  const previewText = useMemo(
    () => (currentSlide ? extractPreviewText(currentSlide.xmlContent) : ""),
    [currentSlide],
  );

  return (
    <Dialog open={template !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-slate-200 bg-white p-5 sm:max-w-3xl">
        {template ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">{template.title}</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                场景：{template.sceneTag} · 比例：{template.ratio}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-white">
                {isLoading ? (
                  <div className="flex h-full w-full items-center justify-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : template.coverUrl && currentPageIndex === 0 ? (
                  <Image src={template.coverUrl} alt={template.title} fill className="object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-zinc-200 via-slate-100 to-white p-5">
                    <span className="inline-flex w-fit rounded-md border border-slate-300/80 bg-white/85 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      第 {currentPageIndex + 1} 页
                    </span>
                    <div>
                      <p className="line-clamp-2 text-base font-semibold text-slate-700">{template.title}</p>
                      {previewText ? <p className="mt-2 line-clamp-2 text-xs text-slate-600">{previewText}</p> : null}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  setPreviewState((state) => ({
                    templateId: template.id,
                    pageIndex: Math.max(0, state.templateId === template.id ? state.pageIndex - 1 : 0),
                  }))
                }
                disabled={!canPrev || isLoading}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                上一页
              </button>
              <p className="text-xs text-slate-600">{totalPages > 0 ? `${currentPageIndex + 1} / ${totalPages}` : "- / -"}</p>
              <button
                type="button"
                onClick={() =>
                  setPreviewState((state) => ({
                    templateId: template.id,
                    pageIndex: Math.min(totalPages - 1, (state.templateId === template.id ? state.pageIndex : 0) + 1),
                  }))
                }
                disabled={!canNext || isLoading}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                下一页
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onUseTemplate(template.id)}
              disabled={isCreating}
              className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              使用该模板
            </button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
