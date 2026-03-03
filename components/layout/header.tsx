import {
  ChevronDown,
  Download,
  Expand,
  Play,
  RefreshCw,
  X,
} from "lucide-react";

export function Header() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-[#fff7f2]">
          <span className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm" />
        </div>
        <p className="text-xl font-medium tracking-tight text-slate-800">
          hwo_charges_analysis
        </p>
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
