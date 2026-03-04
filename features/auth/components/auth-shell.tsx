"use client";

import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_0%_0%,rgba(2,132,199,0.2),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(249,115,22,0.18),transparent_45%),linear-gradient(155deg,#f8fafc_0%,#eff6ff_45%,#fff7ed_100%)] px-5 py-10">
      <div className="pointer-events-none absolute -top-20 -left-16 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-amber-200/50 blur-3xl" />

      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/75 shadow-[0_20px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl md:grid-cols-[1.1fr_0.9fr]">
        <aside className="relative hidden bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#155e75_100%)] p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <p className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs tracking-[0.18em] uppercase">
              PPT Workspace
            </p>
            <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-4 max-w-sm text-sm text-slate-200">{subtitle}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/8 p-4">
            <p className="text-xs text-slate-200">Google / GitHub OAuth enabled</p>
            <p className="mt-1 text-sm text-white">Secure login powered by Clerk</p>
          </div>
          <div className="pointer-events-none absolute top-8 right-8 h-24 w-24 rounded-full border border-white/20" />
          <div className="pointer-events-none absolute right-24 bottom-28 h-14 w-14 rounded-xl border border-white/15" />
        </aside>

        <div className="min-h-[520px] p-5 sm:p-8 md:min-h-[560px] md:p-10">
          {children}
        </div>
      </section>
    </main>
  );
}
