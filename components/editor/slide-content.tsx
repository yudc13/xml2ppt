import { BoroughChart } from "./borough-chart";

export function SlideContent() {
  return (
    <div className="h-[720px] w-full rounded-xl bg-white p-10 shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
      <div className="grid h-full grid-cols-1 gap-8 md:grid-cols-2">
        <article>
          <h1 className="mb-8 text-5xl font-semibold tracking-tight text-[#1e3a8a]">
            Total Charges by Borough
          </h1>
          <h2 className="mb-4 text-3xl font-semibold text-[#0d9488]">
            Borough Concentration
          </h2>
          <p className="max-w-[48ch] text-2xl text-slate-600 leading-relaxed">
            Brooklyn and the Bronx consistently account for the majority of work
            order charges. This aligns with building density and long-term
            intervention priorities.
          </p>
        </article>

        <BoroughChart />
      </div>
    </div>
  );
}
