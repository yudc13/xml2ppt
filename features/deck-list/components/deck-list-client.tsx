"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Clock3, FileText, Files, Loader2, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCreateDeck, useDeckList } from "@/features/deck-list/hooks/use-deck-list";
import type { DeckItem } from "@/features/deck-list/types";

export function DeckListClient({ initialDecks }: { initialDecks: DeckItem[] }) {
  const router = useRouter();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const { data: decks = [], isLoading } = useDeckList(initialDecks);
  const createDeck = useCreateDeck();

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [decks],
  );
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_90%_10%,rgba(249,115,22,0.12),transparent_42%),#f8fafc] px-6 py-10 md:px-10">
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

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">演示文稿列表</h1>
              <p className="mt-2 text-sm text-slate-600">点击卡片进入编辑器，支持自动保存和历史版本管理。</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Files className="h-3.5 w-3.5" />
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

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`deck-skeleton-${index}`}
                className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
              >
                <div className="mb-5 flex items-center justify-between">
                  <Skeleton className="h-6 w-12 rounded-lg" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-6 w-4/5 rounded-md" />
                <Skeleton className="mt-2 h-6 w-3/5 rounded-md" />
                <Skeleton className="mt-6 h-4 w-2/3 rounded-md" />
              </div>
            ))}
          </div>
        ) : sortedDecks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 p-16 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600">还没有文稿，点击上方“新建 PPT”开始。</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedDecks.map((deck) => (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_10px_26px_rgba(2,132,199,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">PPT</span>
                  <span className="text-xs text-slate-400">{new Date(deck.updatedAt).toLocaleDateString()}</span>
                </div>
                <h2 className="line-clamp-2 min-h-12 text-lg font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                  {deck.title}
                </h2>
                <p className="mt-4 text-xs text-slate-500">最近编辑：{new Date(deck.updatedAt).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
