import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SidebarProps {
  slides: number[];
  activeSlide?: number;
}

export function Sidebar({ slides, activeSlide = 4 }: SidebarProps) {
  return (
    <aside className="w-[260px] flex flex-col border-r border-slate-200 bg-[#f8fafc]">
      <div className="p-4">
        <Button
          variant="outline"
          className="w-full justify-center rounded-xl bg-white py-6 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        >
          + 新建幻灯片
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="space-y-3 pr-2">
          {slides.map((slide) => (
            <SlideThumbnail
              key={slide}
              number={slide}
              isActive={slide === activeSlide}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function SlideThumbnail({ number, isActive }: { number: number; isActive: boolean }) {
  return (
    <div className="flex items-start gap-2 group">
      <span className={cn(
        "w-5 pt-2 text-xs font-medium transition-colors",
        isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
      )}>
        {number}
      </span>
      <button
        type="button"
        className={cn(
          "h-[90px] flex-1 cursor-pointer rounded-xl border p-2 text-left transition-all duration-200",
          isActive
            ? "border-blue-500 bg-white ring-2 ring-blue-500/10 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        )}
      >
        <p className={cn(
          "line-clamp-2 text-[10px] font-semibold leading-tight",
          isActive ? "text-blue-900" : "text-slate-600"
        )}>
          {number === 4
            ? "Total Charges by Borough"
            : "NYC Handyman Work Orders"}
        </p>
        <div className="mt-2 h-12 rounded-md bg-gradient-to-br from-slate-50 to-slate-200 border border-slate-100/50" />
      </button>
    </div>
  );
}
