"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Clock3,
  Eye,
  FilePlus2,
  FolderClock,
  House,
  LayoutTemplate,
  Loader2,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateDeck, useDeckList } from "@/features/deck-list/hooks/use-deck-list";
import type { DeckItem } from "@/features/deck-list/types";
import { TemplatePreviewDialog } from "@/features/template/components/template-preview-dialog";
import { useCreateDeckFromTemplate, useHomeTemplates } from "@/features/template/hooks/use-template";
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

export function DeckListClient({
  initialDecks,
  initialHomeTemplates,
}: {
  initialDecks: DeckItem[];
  initialHomeTemplates: TemplateItem[];
}) {
  const router = useRouter();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const { data: decks = [], isLoading } = useDeckList(initialDecks);
  const { data: homeTemplates = [], isLoading: isLoadingTemplates } = useHomeTemplates(initialHomeTemplates);
  const createDeck = useCreateDeck();
  const createFromTemplate = useCreateDeckFromTemplate();

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [decks],
  );
  const recentDecks = useMemo(() => sortedDecks.slice(0, 6), [sortedDecks]);
  const myTemplateDecks = useMemo(() => sortedDecks.slice(0, 4), [sortedDecks]);
  const latestUpdatedAt = sortedDecks[0]?.updatedAt ?? null;

  const handleCreateDeck = async () => {
    if (createDeck.isPending) {
      return;
    }

    setError(null);

    try {
      const deck = await createDeck.mutateAsync(`未命名演示文稿 ${new Date().toLocaleDateString()}`);
      router.push(`/decks/${deck.id}`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "创建失败";
      setError(message);
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    if (createFromTemplate.isPending) {
      return;
    }

    setTemplateError(null);
    setCreatingTemplateId(templateId);

    try {
      const deck = await createFromTemplate.mutateAsync(templateId);
      router.push(`/decks/${deck.id}`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "模板创建失败";
      setTemplateError(message);
    } finally {
      setCreatingTemplateId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_12%,rgba(15,23,42,0.06),transparent_42%),radial-gradient(circle_at_88%_6%,rgba(71,85,105,0.06),transparent_40%),#f5f6f8] px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.08)]">
                <Image src="/logo.svg" alt="PPT Logo" width={24} height={24} className="h-6 w-6" priority />
              </div>
              <div>
                <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  PPT Workspace
                </p>
                <p className="text-sm font-medium text-slate-700">你的演示文稿工作区</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
              <div className="hidden text-right sm:block">
                <p className="max-w-[200px] truncate text-sm font-medium text-slate-800">{user?.fullName ?? "已登录用户"}</p>
                <p className="max-w-[200px] truncate text-xs text-slate-500">
                  {user?.primaryEmailAddress?.emailAddress ?? "Google / GitHub"}
                </p>
              </div>
              <UserButton />
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              <House className="h-4 w-4" />
              首页
            </span>
            <Link
              href="/templates"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              <LayoutTemplate className="h-4 w-4" />
              模板中心
            </Link>
            <Link
              href="/me"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              <UserRound className="h-4 w-4" />
              个人中心
            </Link>
          </nav>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">工作台首页</h1>
              <p className="mt-2 text-sm text-slate-600">先处理最近修改文稿，再从模板快速启动新项目。</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <FolderClock className="h-3.5 w-3.5" />
                    文稿总数
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">{sortedDecks.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    最近更新
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleString() : "暂无"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateDeck}
                disabled={createDeck.isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createDeck.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                新建 PPT
              </button>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </header>

        <section className="mb-8 rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div className="min-w-[220px]">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-900">
                <Clock3 className="h-5 w-5 text-sky-600" />
                最近修改
              </h2>
              <p className="mt-1 text-sm text-slate-600">保留最近 6 份文稿，快速回到上一次工作现场。</p>
            </div>
            <Link
              href="/me"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              查看全部
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`recent-skeleton-${index}`}
                  className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <Skeleton className="h-6 w-16 rounded-lg" />
                    <Skeleton className="h-4 w-20 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-4/5 rounded-md" />
                  <Skeleton className="mt-2 h-6 w-3/5 rounded-md" />
                  <Skeleton className="mt-6 h-4 w-2/3 rounded-md" />
                </div>
              ))}
            </div>
          ) : recentDecks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 p-16 text-center">
              <FilePlus2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">还没有文稿，点击上方“新建 PPT”开始。</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recentDecks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_10px_26px_rgba(2,132,199,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">最近编辑</span>
                    <span className="text-xs text-slate-400">{new Date(deck.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="line-clamp-2 min-h-12 text-lg font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                    {deck.title}
                  </h3>
                  <p className="mt-4 text-xs text-slate-500">最近编辑：{new Date(deck.updatedAt).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8 rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div className="min-w-[220px]">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-900">
                <LayoutTemplate className="h-5 w-5 text-sky-600" />
                模板库
              </h2>
              <p className="mt-1 text-sm text-slate-600">将“我的模板”和“系统模板”分开展示，避免混淆。</p>
            </div>
            <Link
              href="/templates"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              更多
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {templateError ? <p className="mb-4 text-sm text-rose-600">{templateError}</p> : null}

          <Tabs defaultValue={myTemplateDecks.length > 0 ? "mine" : "system"} className="gap-4">
            <TabsList className="w-full justify-start bg-slate-100/80 p-1 sm:w-fit">
              <TabsTrigger value="mine" className="px-3">
                我的模板 ({myTemplateDecks.length})
              </TabsTrigger>
              <TabsTrigger value="system" className="px-3">
                系统模板 ({homeTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mine">
              {myTemplateDecks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  暂无我的模板，先创建并编辑一个 PPT 即可出现在这里。
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {myTemplateDecks.map((deck) => (
                    <Link
                      key={deck.id}
                      href={`/decks/${deck.id}`}
                      className="group rounded-2xl border border-sky-200/90 bg-sky-50/60 p-4 shadow-[0_4px_12px_rgba(2,132,199,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_10px_22px_rgba(2,132,199,0.16)]"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span className="inline-flex rounded-md border border-sky-200 bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                          我的模板
                        </span>
                        <span className="text-xs text-sky-800/70">{new Date(deck.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="line-clamp-2 min-h-12 text-base font-semibold text-slate-900">{deck.title}</h3>
                      <p className="mt-3 text-xs text-slate-600">最近编辑：{new Date(deck.updatedAt).toLocaleString()}</p>
                      <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-700 transition-colors group-hover:text-sky-800">
                        继续编辑
                        <ArrowRight className="h-4 w-4" />
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="system">
              {isLoadingTemplates ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={`template-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
                      <Skeleton className="mt-3 h-5 w-2/3 rounded-md" />
                      <Skeleton className="mt-2 h-4 w-1/2 rounded-md" />
                      <Skeleton className="mt-4 h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : homeTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  暂无可用模板
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {homeTemplates.map((template, index) => (
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
                        <span className="absolute left-2 top-2 inline-flex rounded-md border border-slate-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          官方模板
                        </span>
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
              )}
            </TabsContent>
          </Tabs>
        </section>
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
