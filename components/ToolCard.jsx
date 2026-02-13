"use client";

import Link from "next/link";
import { FlaskConical, Gamepad2, Sparkles } from "lucide-react";

const iconMap = {
  sparkles: Sparkles,
  gamepad2: Gamepad2,
  flaskConical: FlaskConical
};

export default function ToolCard({ tool }) {
  const Icon = iconMap[tool.icon] || Sparkles;

  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-teal-300"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-teal-50 p-2 text-teal-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-semibold">{tool.title}</h2>
      </div>
      <p className="mt-4 text-sm text-slate-600">{tool.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tool.tags.map((tag) => (
          <span key={`${tool.slug}-${tag}`} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-slate-600">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
