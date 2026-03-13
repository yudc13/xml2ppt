"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { ArrowUpDown, Clock3, House, LayoutTemplate, Loader2, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCreateDeck, useDeckList } from "@/features/deck-list/hooks/use-deck-list";
import type { DeckItem } from "@/features/deck-list/types";

type SortOption = "updated" | "created";
type TimeFilter = "all" | "7d" | "30d";

function withinDays(dateValue: string, days: number): boolean {
  const targetTime = new Date(dateValue).getTime();
  const fromTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return targetTime >= fromTime;
}

export function PersonalCenterClient({ initialDecks }: { initialDecks: DeckItem[] }) {
  const router = useRouter();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const { data: decks = [], isLoading } = useDeckList(initialDecks);
  const createDeck = useCreateDeck();

  const filteredDecks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const withKeyword = decks.filter((deck) => {
      if (!normalizedKeyword) {
        return true;
      }
      return deck.title.toLowerCase().includes(normalizedKeyword);
    });

    const withTimeFilter = withKeyword.filter((deck) => {
      if (timeFilter === "all") {
        return true;
      }
      if (timeFilter === "7d") {
        return withinDays(deck.updatedAt, 7);
      }
      return withinDays(deck.updatedAt, 30);
    });

    return withTimeFilter.sort((a, b) => {
      if (sortBy === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [decks, keyword, sortBy, timeFilter]);

  const latestUpdatedAt = filteredDecks[0]?.updatedAt ?? null;

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_12%,rgba(15,23,42,0.06),transparent_42%),radial-gradient(circle_at_90%_6%,rgba(71,85,105,0.06),transparent_40%),#f4f6f8] px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
            <div>
              <p className="text-sm font-medium text-slate-600">Personal Center</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">我的 PPT 列表</h1>
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

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              <House className="h-4 w-4" />
              首页
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              <LayoutTemplate className="h-4 w-4" />
              模板中心
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              <UserRound className="h-4 w-4" />
              个人中心
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索文稿标题..."
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-sky-300"
            >
              <option value="updated">按最近修改排序</option>
              <option value="created">按创建时间排序</option>
            </select>
            <select
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-sky-300"
            >
              <option value="all">全部时间</option>
              <option value="7d">近 7 天</option>
              <option value="30d">近 30 天</option>
            </select>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <p className="inline-flex items-center gap-1">
                <ArrowUpDown className="h-4 w-4" />
                当前结果：{filteredDecks.length}
              </p>
              <p className="inline-flex items-center gap-1">
                <Clock3 className="h-4 w-4" />
                最近更新：{latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleString() : "暂无"}
              </p>
            </div>
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
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </header>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`me-skeleton-${index}`}
                className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
              >
                <Skeleton className="h-5 w-1/2 rounded-md" />
                <Skeleton className="mt-4 h-8 w-4/5 rounded-md" />
                <Skeleton className="mt-2 h-4 w-2/3 rounded-md" />
                <Skeleton className="mt-6 h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredDecks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 p-16 text-center">
            <p className="text-sm text-slate-600">没有匹配的文稿，试试调整搜索词或筛选条件。</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDecks.map((deck) => (
              <article
                key={deck.id}
                className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_10px_26px_rgba(2,132,199,0.16)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">我的文稿</span>
                  <span className="text-xs text-slate-400">{new Date(deck.updatedAt).toLocaleDateString()}</span>
                </div>
                <h2 className="mt-4 line-clamp-2 min-h-12 text-lg font-semibold text-slate-900">{deck.title}</h2>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <p>创建时间：{new Date(deck.createdAt).toLocaleString()}</p>
                  <p>更新时间：{new Date(deck.updatedAt).toLocaleString()}</p>
                </div>
                <Link
                  href={`/decks/${deck.id}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                >
                  进入编辑器
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
