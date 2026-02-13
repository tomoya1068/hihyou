"use client";

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
        <p className="mt-2 text-sm text-slate-300">URL または作品ID/名前で検索できます（例: `sora00368`, `fanza:ssis001`）。</p>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="https://video.dmm.co.jp/av/content/?id=sora00368"
            className="w-full rounded-md border border-amber-400/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-300"
          />
          <button type="submit" className="btn-cyan md:w-40">検索する</button>
        </form>
      </section>

      {isPending && <p className="text-sm text-slate-400">検索中...</p>}
      {result.error && <p className="panel p-4 text-sm text-rose-300">{result.error}</p>}

      {result.selected && (
        <section className="panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">
                {result.selected.parsed.platform} / {result.selected.parsed.productId}
              </p>
              <h2 className="text-xl font-semibold text-slate-100">{result.selected.productName || result.selected.parsed.productId}</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-slate-700/80 px-3 py-2">
                <p className="text-slate-500">平均</p>
                <p className="font-semibold text-amber-200">{formatNumber(result.selected.summary.average)}</p>
              </div>
              <div className="rounded-md border border-slate-700/80 px-3 py-2">
                <p className="text-slate-500">中央値</p>
                <p className="font-semibold text-amber-200">{formatNumber(result.selected.summary.median)}</p>
              </div>
              <div className="rounded-md border border-slate-700/80 px-3 py-2">
                <p className="text-slate-500">件数</p>
                <p className="font-semibold text-amber-200">{result.selected.summary.total}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/60">
            {result.selected.imageUrl ? (
              <img src={result.selected.imageUrl} alt={result.selected.parsed.productId} className="h-56 w-full object-cover" />
            ) : (
              <div className="flex h-56 items-center justify-center text-2xl font-bold tracking-widest text-slate-500">NO IMAGE</div>
            )}
          </div>

          <div className="space-y-3">
            {result.selected.reviews.map((review) => (
              <article key={review.id} className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-200">{review.score} 点</p>
                  <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleString()}</p>
                </div>
                {review.comment && <p className="mt-2 text-sm text-slate-200">{review.comment}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(review.tags ?? []).map((tag) => (
                    <span key={`${review.id}-${tag}`} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">#{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!result.selected && result.query && (
        <section className="panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-cyan-200">検索候補</h2>
          {result.items.length === 0 && <p className="text-sm text-slate-400">候補が見つかりませんでした。</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item) => (
              <button
                type="button"
                key={`${item.platform}-${item.productId}`}
                onClick={() => setQuery(`${item.platform}:${item.productId}`)}
                className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4 text-left transition hover:border-cyan-300/50"
              >
                <p className="text-xs uppercase tracking-wider text-cyan-300">{item.platform}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-100">{item.productName}</p>
                <p className="truncate text-xs text-slate-400">{item.productId}</p>
                <p className="mt-2 text-xs text-slate-400">平均 {formatNumber(item.average)} / 中央値 {formatNumber(item.median)} / {item.total}件</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
