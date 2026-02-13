export default function AdBanner({ position = "TOP" }) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-300 bg-sky-50/60 px-4 py-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">AD SPACE</p>
      <p className="mt-2 text-sm text-slate-600">{position} - Google AdSenseコードをここに挿入</p>
    </div>
  );
}
