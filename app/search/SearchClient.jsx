"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { searchProducts } from "../review/actions";

function formatNumber(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toUrlFromPlatformId(text) {
  const direct = /^\s*(fanza|fantia)\s*:\s*([a-z0-9]+)\s*$/i.exec(text);
  if (!direct) return text;
  const platform = direct[1].toLowerCase();
  const id = direct[2].toLowerCase();
  if (platform === "fanza") return `https://video.dmm.co.jp/av/content/?id=${id}`;
  return `https://fantia.jp/posts/${id}`;
}

export default function SearchPage() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [result, setResult] = useState({ query: "", parsed: null, items: [], selected: null, error: null });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const initial = params.get("q") ?? "";
    if (!initial) return;
    startTransition(async () => {
      const r = await searchProducts(toUrlFromPlatformId(initial));
      setResult(r);
    });
  }, [params]);

  async function onSubmit(e) {
    e.preventDefault();
    startTransition(async () => {
      const r = await searchProducts(toUrlFromPlatformId(query));
      setResult(r);
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel-gold p-6">
        <h1 className="text-2xl font-bold text-amber-200">作品検索</h1>
        <p className="mt-2 text-sm text-slate-300">URL または作品ID/名前で検索できます（例: sora00368, fanza:ssis001）。</p>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="https://video.dmm.co.jp/av/content/?id=sora00368" className="w-full rounded-md border border-amber-400/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-300" />
          <button type="submit" className="btn-cyan md:w-40">検索</button>
        </form>
      </section>

      {isPending && <p className="text-sm text-slate-400">searching...</p>}
      {result.error && <p className="panel p-4 text-sm text-rose-300">{result.error}</p>}

      {result.selected && (
        <section className="panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">{result.selected.platform} / {result.selected.productId}</p>
              <h2 className="text-xl font-semibold text-slate-100">{result.selected.productName || result.selected.productId}</h2>
            </div>
            <Link href={`/title/${result.selected.platform}/${result.selected.productId}`} className="btn-gold">作品ページへ</Link>
          </div>
        </section>
      )}

      {!result.selected && result.query && (
        <section className="panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-cyan-200">候補</h2>
          {result.items.length === 0 && <p className="text-sm text-slate-400">結果なし</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item) => (
              <Link key={`${item.platform}-${item.productId}`} href={`/title/${item.platform}/${item.productId}`} className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4 text-left transition hover:border-cyan-300/50">
                <p className="text-xs uppercase tracking-wider text-cyan-300">{item.platform}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-100">{item.productName}</p>
                <p className="truncate text-xs text-slate-400">{item.productId}</p>
                <p className="mt-2 text-xs text-slate-400">平均 {formatNumber(item.average)} / 中央値 {formatNumber(item.median)} / {item.total}件</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}