"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "../actions";

const TAG_OPTIONS = ["3P以上", "コスプレ", "SM", "熟女", "レイプ", "地雷系", "巨乳", "素人", "企画", "ハメ撮り"];

function parseReviewUrl(url) {
  const fanzaCid = /[?&]cid=([a-z0-9]+)/i.exec(url);
  if (fanzaCid?.[1]) return { productId: fanzaCid[1].toLowerCase(), platform: "fanza" };

  const fanzaId = /[?&]id=([a-z0-9]+)/i.exec(url);
  if (fanzaId?.[1]) return { productId: fanzaId[1].toLowerCase(), platform: "fanza" };

  const fantia = /posts\/(\d+)/i.exec(url);
  if (fantia?.[1]) return { productId: fantia[1], platform: "fantia" };

  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return { productId: "external", platform: "external" };
    }
  } catch {
    // no-op
  }

  return null;
}

export default function NewReviewPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [score, setScore] = useState(80);
  const [comment, setComment] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [cosplayCharacter, setCosplayCharacter] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => parseReviewUrl(url), [url]);
  const isCosplay = selectedTag === TAG_OPTIONS[1];
  const needsTitleForExternal = parsed?.platform === "external";

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");

    startTransition(async () => {
      const result = await submitReview({
        url,
        productName,
        score,
        comment,
        tags: selectedTag ? [selectedTag] : [],
        cosplayCharacter,
      });
      setStatus(result.message);
      if (!result.ok) return;
      setComment("");
      setSelectedTag("");
      setCosplayCharacter("");
      router.push("/");
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel-gold p-6">
        <h1 className="text-2xl font-bold text-amber-200">レビュー投稿</h1>
        <p className="mt-2 text-sm text-slate-300">URLから作品IDを自動判定します。</p>
      </section>

      <section className="panel p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm text-slate-300">作品URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://video.dmm.co.jp/av/content/?id=sora00368"
              className="w-full rounded-md border border-amber-400/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-300"
              required
            />
            <p className="mt-2 text-xs text-slate-400">判定: {parsed ? `${parsed.platform} / ${parsed.productId}` : "未判定"}</p>
            {needsTitleForExternal && <p className="mt-1 text-xs text-amber-300">FANZA/Fantia 以外は作品名の入力が必須です。</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">作品名（任意）</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="例: SSIS-001"
              className="w-full rounded-md border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">点数: {score}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="mt-2 w-24 rounded-md border border-amber-400/30 bg-slate-950/70 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-300">タグ（1つまで）</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {TAG_OPTIONS.map((tag) => (
                <label key={tag} className="flex cursor-pointer items-center gap-2 rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1 text-sm hover:border-amber-300/50">
                  <input
                    type="radio"
                    name="review-tag"
                    checked={selectedTag === tag}
                    onChange={() => setSelectedTag(tag)}
                    className="accent-amber-400"
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
            {selectedTag && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTag("");
                  setCosplayCharacter("");
                }}
                className="mt-2 text-xs text-slate-400 underline"
              >
                タグ選択を解除
              </button>
            )}
          </div>

          {isCosplay && (
            <div>
              <label className="mb-1 block text-sm text-slate-300">キャラ名（コスプレ）</label>
              <input
                value={cosplayCharacter}
                onChange={(e) => setCosplayCharacter(e.target.value)}
                placeholder="例: 初音ミク"
                className="w-full rounded-md border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-slate-300">感想（任意）</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-300"
              placeholder="一言レビュー"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !parsed || (needsTitleForExternal && !productName.trim())}
            className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "投稿中..." : "批評を投稿する"}
          </button>
          {status && <p className="text-sm text-amber-200">{status}</p>}
        </form>
      </section>
    </div>
  );
}
