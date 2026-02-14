"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { searchProducts } from "../review/actions";

const TAG_OPTIONS = ["3P??", "????", "SM", "??", "???", "???", "??", "??", "??", "????", "??"];

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
  const [characterQuery, setCharacterQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [result, setResult] = useState({ query: "", parsed: null, items: [], selected: null, error: null });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const initial = params.get("q") ?? "";
    if (!initial) return;
    startTransition(async () => {
      const r = await searchProducts(toUrlFromPlatformId(initial), selectedTags, characterQuery);
      setResult(r);
    });
  }, [params]);

  async function runSearch(nextQuery = query, nextTags = selectedTags, nextCharacterQuery = characterQuery) {
    startTransition(async () => {
      const r = await searchProducts(toUrlFromPlatformId(nextQuery), nextTags, nextCharacterQuery);
      setResult(r);
    });
  }

  function toggleTag(tag) {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setSelectedTags(next);
    runSearch(query, next, characterQuery);
  }

  async function onSubmit(e) {
    e.preventDefault();
    runSearch(query, selectedTags, characterQuery);
  }

  return (
    <div className="space-y-6">
      <section className="panel-gold p-6">
        <h1 className="text-2xl font-bold text-amber-200">作品検索</h1>
        <p className="mt-2 text-sm text-slate-300">URL / 作品ID / タイトル / コメント / キャラ名で検索できます。</p>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_10rem]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="https://video.dmm.co.jp/av/content/?id=sora00368"
            className="w-full rounded-md border border-amber-400/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-300"
          />
          <input
            value={characterQuery}
            onChange={(e) => setCharacterQuery(e.target.value)}
            placeholder="キャラ名で絞り込み"
            className="w-full rounded-md border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
          />
          <button type="submit" className="btn-cyan">検索</button>
        </form>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded border px-2 py-1 text-xs ${selectedTags.includes(tag) ? "border-cyan-300 bg-cyan-500/20 text-cyan-200" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}
            >
              {tag}
            </button>
          ))}
        </div>
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

      {!result.selected && (
        <section className="panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-cyan-200">検索結果</h2>
          {result.items.length === 0 && <p className="text-sm text-slate-400">該当なし</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item) => (
              <Link key={`${item.platform}-${item.productId}`} href={`/title/${item.platform}/${item.productId}`} className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4 text-left transition hover:border-cyan-300/50">
                <p className="text-xs uppercase tracking-wider text-cyan-300">{item.platform}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-100">{item.productName}</p>
                <p className="truncate text-xs text-slate-400">{item.productId}</p>
                <p className="mt-2 text-xs text-slate-400">平均 {formatNumber(item.average)} / 中央値 {formatNumber(item.median)} / {item.total}件</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.tags ?? []).slice(0, 5).map((tag) => (
                    <span key={`${item.productId}-${tag}`} className="rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">#{tag}</span>
                  ))}
                </div>
                {!!(item.characters ?? []).length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(item.characters ?? []).slice(0, 3).map((c) => (
                      <span key={`${item.productId}-c-${c}`} className="rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-200">{c}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
