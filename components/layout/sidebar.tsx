import { Button } from "@/components/ui/button";
import { SlideShape } from "@/components/editor/slide-shape";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { slides as mockSlides } from "@/mock/slides";

interface SidebarProps {
  slides: number[];
  activeSlide?: number;
  onSlideSelect?: (slideNumber: number) => void;
}

export function Sidebar({
  slides,
  activeSlide = 1,
  onSlideSelect,
}: SidebarProps) {
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
          {slides.map((slide, index) => (
            <SlideThumbnail
              key={slide}
              number={slide}
              slideIndex={index}
              isActive={slide === activeSlide}
              onSelect={onSlideSelect}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function SlideThumbnail({
  number,
  slideIndex,
  isActive,
  onSelect,
}: {
  number: number;
  slideIndex: number;
  isActive: boolean;
  onSelect?: (slideNumber: number) => void;
}) {
  const slideXml = mockSlides[slideIndex];
  const model = slideXml ? parseSlideXml(slideXml) : null;

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
        onClick={() => onSelect?.(number)}
        aria-pressed={isActive}
        className={cn(
          "h-[72px] flex-1 cursor-pointer rounded-xl border p-1.5 text-left transition-all duration-200",
          isActive
            ? "border-blue-500 bg-white ring-2 ring-blue-500/10 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        )}
      >
        <div className="h-full overflow-hidden rounded-md border border-slate-100/50 bg-slate-50 p-0.5">
          <div className="h-full [container-type:inline-size]">
            <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-white [--slide-unit:calc((100cqw/960)*0.58)]">
              {model?.shapes.map((shape) => (
                <SlideShape key={shape.attributes.id} shape={shape} />
              ))}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
