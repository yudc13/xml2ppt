import { Button } from "@/components/ui/button";

const TOOLBAR_ITEMS = ["Ask AI", "文本", "图形", "图片", "表格", "格式"];

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

      <div className="hidden flex-1 justify-center lg:flex">
        <Toolbar />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-xl px-4 text-slate-700">
          最新版本
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl px-4 text-slate-700">
          分享
        </Button>
      </div>
    </header>
  );
}

function Toolbar() {
  return (
    <div className="flex items-center divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      {TOOLBAR_ITEMS.map((item) => (
        <button
          key={item}
          className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-[#0d9488]"
          type="button"
        >
          {item}
        </button>
      ))}
      <button
        className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-[#0d9488]"
        type="button"
      >
        98%
      </button>
    </div>
  );
}
