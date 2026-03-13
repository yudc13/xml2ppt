"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, LayoutTemplate, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TemplatePreviewDialog } from "@/features/template/components/template-preview-dialog";
import { useCreateDeckFromTemplate, useTemplateList } from "@/features/template/hooks/use-template";
import type { TemplateItem } from "@/features/template/types";

function getTemplateTone(index: number) {
  const tones = [
    "from-slate-200 via-zinc-100 to-white",
    "from-stone-200 via-neutral-100 to-white",
    "from-zinc-200 via-slate-100 to-white",
    "from-neutral-200 via-zinc-100 to-white",
  ];
  return tones[index % tones.length];
}

export function TemplateListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scene = searchParams.get("scene") ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);

  const { data, isLoading } = useTemplateList({
    scene,
    page: 1,
    pageSize: 24,
  });
  const createFromTemplate = useCreateDeckFromTemplate();

  const sceneOptions = useMemo(() => ["全部", ...(data?.scenes ?? [])], [data?.scenes]);

  const handleSelectScene = (nextScene: string) => {
    const normalizedScene = nextScene === "全部" ? undefined : nextScene;
    const nextParams = new URLSearchParams(searchParams.toString());
    if (normalizedScene) {
      nextParams.set("scene", normalizedScene);
    } else {
      nextParams.delete("scene");
    }
    const query = nextParams.toString();
    router.replace(`/templates${query ? `?${query}` : ""}`);
  };

  const handleUseTemplate = async (templateId: string) => {
    if (createFromTemplate.isPending) {
      return;
    }

    setError(null);
    setCreatingTemplateId(templateId);

    try {
      const deck = await createFromTemplate.mutateAsync(templateId);
      router.push(`/decks/${deck.id}`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "模板创建失败";
      setError(message);
    } finally {
      setCreatingTemplateId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(15,23,42,0.06),transparent_44%),radial-gradient(circle_at_92%_8%,rgba(51,65,85,0.06),transparent_42%),#f5f6f8] px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-[0_10px_34px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="min-w-[220px]">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Link>
              <span className="text-slate-300">|</span>
              <Link href="/me" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
                个人中心
              </Link>
            </div>
            <h1 className="mt-3 inline-flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <LayoutTemplate className="h-6 w-6 text-sky-600" />
              模板中心
            </h1>
            <p className="mt-2 text-sm text-slate-600">全部为系统预设中文模板，统一 16:9 比例。</p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:sticky lg:top-6">
            <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500">场景筛选</p>
            <div className="grid gap-2">
              {sceneOptions.map((item) => {
                const active = (scene ?? "全部") === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelectScene(item)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-slate-800 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </aside>

          <div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`tpl-list-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <Skeleton className="aspect-[16/9] w-full rounded-xl" />
                  <Skeleton className="mt-3 h-5 w-2/3 rounded-md" />
                  <Skeleton className="mt-2 h-4 w-1/2 rounded-md" />
                  <Skeleton className="mt-4 h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : !data || data.templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-sm text-slate-600">
              当前筛选下暂无模板
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">共 {data.total} 个模板</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.templates.map((template, index) => (
                  <article
                    key={template.id}
                    className="group rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50">
                      {template.coverUrl ? (
                        <Image src={template.coverUrl} alt={template.title} fill className="object-cover" />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${getTemplateTone(index)} p-3`}>
                          <div className="flex h-full flex-col justify-between">
                            <span className="inline-flex w-fit rounded-md border border-slate-300/80 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              16:9
                            </span>
                            <p className="line-clamp-2 text-sm font-semibold text-slate-700">{template.title}</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-x-2 bottom-2 grid grid-cols-2 gap-2 transition md:pointer-events-none md:translate-y-1 md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(template)}
                          className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-300 bg-white/95 px-2 py-1.5 text-xs font-medium text-slate-700 backdrop-blur transition-colors hover:border-slate-400 hover:bg-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          预览
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseTemplate(template.id)}
                          disabled={createFromTemplate.isPending && creatingTemplateId === template.id}
                          className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-300 bg-white/95 px-2 py-1.5 text-xs font-medium text-slate-800 backdrop-blur transition-colors hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {createFromTemplate.isPending && creatingTemplateId === template.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          使用
                        </button>
                      </div>
                    </div>
                    <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-slate-900">{template.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{template.sceneTag}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </section>
      <TemplatePreviewDialog
        template={previewTemplate}
        onOpenChange={(open) => (!open ? setPreviewTemplate(null) : undefined)}
        onUseTemplate={handleUseTemplate}
        isCreating={createFromTemplate.isPending && creatingTemplateId === previewTemplate?.id}
      />
    </main>
  );
}
