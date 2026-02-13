"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Share2 } from "lucide-react";
import AdBanner from "@/components/AdBanner";
import ToolRenderer from "@/components/ToolRenderer";
import { getToolBySlug } from "@/data/tools";

function buildShareUrl(tool) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.vercel.app";
  const url = `${siteUrl}/tools/${tool.slug}`;
  const text = `${tool.title} を使ってみた`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export default function ToolDetailPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return (
      <section className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">ページが見つかりません</h1>
        <Link href="/" className="mt-5 inline-flex rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white">トップへ戻る</Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <AdBanner position="TOP" />
      <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/" className="text-sm text-teal-700 hover:underline">← ツール一覧に戻る</Link>
            <h1 className="mt-2 text-2xl font-bold">{tool.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{tool.description}</p>
          </div>
          <a href={buildShareUrl(tool)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            <Share2 className="h-4 w-4" />
            Xでシェア
          </a>
        </div>
        <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 md:p-6">
          <ToolRenderer slug={tool.slug} />
        </div>
      </section>
      <AdBanner position="BOTTOM" />
    </div>
  );
}
