interface BoroughData {
  name: string;
  height: number;
}

const BOROUGH_DATA: BoroughData[] = [
  { name: "BROOKLYN", height: 92 },
  { name: "BRONX", height: 68 },
  { name: "MANHATTAN", height: 46 },
  { name: "QUEENS", height: 28 },
  { name: "SI", height: 8 },
];

export function BoroughChart() {
  return (
    <div className="flex flex-col justify-end h-full">
      <div className="mb-12 flex items-end gap-5">
        {BOROUGH_DATA.map((item) => (
          <div key={item.name} className="flex flex-col items-center gap-2">
            <div
              className="w-16 rounded-t-md bg-[#2563eb] transition-all duration-500"
              style={{ height: `${item.height * 3}px` }}
            />
            <span className="text-xs font-medium text-slate-500">
              {item.name}
            </span>
          </div>
        ))}
      </div>
      <div className="h-px w-full bg-slate-300" />
      <p className="mt-4 text-center text-sm text-slate-500 font-medium">
        Borough
      </p>
    </div>
  );
}
