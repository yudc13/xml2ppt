import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SlideContent } from "@/components/editor/slide-content";

// Hoist static data outside the component to prevent re-creation on every render
// Reference: rendering-hoist-jsx
const SLIDES = Array.from({ length: 11 }, (_, i) => i + 1);

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-[#f2f4f7] text-slate-900 overflow-hidden font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar slides={SLIDES} activeSlide={4} />

        <main className="flex-1 overflow-auto bg-[#f8fafc]/50 p-8 flex items-center justify-center">
          <section className="w-full max-w-[1300px] animate-in fade-in zoom-in duration-500">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-8 shadow-sm">
              <SlideContent />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
