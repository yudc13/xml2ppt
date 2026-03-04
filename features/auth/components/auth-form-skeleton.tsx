export function AuthFormSkeleton() {
  return (
    <div className="min-h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white p-6 md:min-h-[560px]">
      <div className="h-7 w-40 rounded-md bg-slate-200" />
      <div className="mt-3 h-4 w-64 rounded-md bg-slate-100" />

      <div className="mt-8 space-y-3">
        <div className="h-11 rounded-xl bg-slate-100" />
        <div className="h-11 rounded-xl bg-slate-100" />
      </div>

      <div className="my-8 h-px bg-slate-100" />

      <div className="space-y-3">
        <div className="h-10 rounded-lg bg-slate-100" />
        <div className="h-10 rounded-lg bg-slate-100" />
      </div>

      <div className="mt-8 h-4 w-36 rounded-md bg-slate-100" />
    </div>
  );
}
