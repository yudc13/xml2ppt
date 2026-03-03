import { SlideShape } from "@/components/editor/slide-shape";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { slides } from "@/mock/slides";

const DEFAULT_SLIDE_INDEX = 0;

function getSlideXmlByIndex(index: number): string {
  return slides[index] ?? slides[DEFAULT_SLIDE_INDEX];
}

export function SlideViewport({ slideIndex = DEFAULT_SLIDE_INDEX }: { slideIndex?: number }) {
  const xml = getSlideXmlByIndex(slideIndex);
  const model = parseSlideXml(xml);

  return (
    <div className="w-full max-w-[1200px] animate-in fade-in zoom-in duration-500">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-6 shadow-sm md:p-8">
        <div className="mx-auto w-full max-w-[960px] [container-type:inline-size]">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] [--slide-unit:calc(100cqw/960)]">
            {model.shapes.map((shape) => (
              <SlideShape key={shape.attributes.id} shape={shape} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
