"use client";

import { useState } from "react";
import { Sparkles, X, Plus, Trash2, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGenerateSlides } from "@/features/deck-editor/hooks/use-ai-api";
import type { AiSlideDSL } from "@/lib/ai/types";
import { Spinner } from "@/components/ui/spinner";

interface AskAiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (slides: AiSlideDSL[]) => void;
}

export function AskAiDialog({ open, onOpenChange, onConfirm }: AskAiDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [generatedSlides, setGeneratedSlides] = useState<AiSlideDSL[]>([]);
  const generateSlides = useGenerateSlides();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      const response = await generateSlides.mutateAsync(prompt);
      setGeneratedSlides(response.slides);
    } catch (error) {
      toast.error("AI 生成失败，请重试");
    }
  };

  const handleEditSlideTitle = (index: number, title: string) => {
    const next = [...generatedSlides];
    next[index] = { ...next[index], title };
    setGeneratedSlides(next);
  };

  const handleRemoveSlide = (index: number) => {
    setGeneratedSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setGeneratedSlides([]);
    setPrompt("");
  };

  const handleConfirm = () => {
    onConfirm(generatedSlides);
    onOpenChange(false);
    handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-xl">
              <Sparkles className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Ask AI</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                描述你的需求，Gemini 将为你生成专业的幻灯片大纲。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
          {generatedSlides.length === 0 ? (
            <div className="space-y-4">
              <Textarea
                placeholder="例如：帮我生成一份关于 2024 年前端技术趋势的 PPT，包含 5 张幻灯片..."
                className="min-h-[150px] resize-none border-slate-200 focus:ring-sky-500 rounded-2xl p-4 text-base"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={generateSlides.isPending}
              />
              <div className="flex flex-wrap gap-2">
                {["年度总结报告", "创业项目计划书", "技术架构分享", "产品发布会"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setPrompt(`生成一份关于${tag}的幻灯片`)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  生成预览 ({generatedSlides.length} 页)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGeneratedSlides([])}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> 重写 Prompt
                </Button>
              </div>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {generatedSlides.map((slide, index) => (
                    <div
                      key={index}
                      className="group relative bg-slate-50 border border-slate-200 p-4 rounded-2xl hover:border-sky-200 hover:bg-sky-50/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <input
                            className="w-full bg-transparent font-bold text-slate-900 focus:outline-none focus:ring-0"
                            value={slide.title}
                            onChange={(e) => handleEditSlideTitle(index, e.target.value)}
                          />
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: slide.primaryColor }}
                            />
                            {slide.layoutType}
                          </div>
                          <ul className="mt-2 space-y-1">
                            {slide.blocks.map((block, bi) => (
                              <li key={bi} className="text-sm text-slate-600 flex items-start gap-2">
                                <span className="text-sky-500 mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" />
                                <span className="line-clamp-2">
                                  {Array.isArray(block.content) ? block.content[0] : block.content}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveSlide(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t border-slate-100 sm:justify-between items-center">
          <div className="hidden sm:block">
            {generateSlides.isPending && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner className="size-3.5" />
                Gemini 正在构思中...
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl px-6">
              取消
            </Button>
            {generatedSlides.length === 0 ? (
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generateSlides.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8 shadow-lg shadow-slate-200 transition-all font-bold"
              >
                {generateSlides.isPending ? "生成中..." : "开始生成"}
              </Button>
            ) : (
              <Button
                onClick={handleConfirm}
                className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 shadow-lg shadow-sky-100 transition-all font-bold"
              >
                确认并批量插入
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
