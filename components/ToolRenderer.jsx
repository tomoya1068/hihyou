"use client";

import { useMemo, useState } from "react";

function OjisanConverter() {
  const [input, setInput] = useState("");
  const output = useMemo(() => (input.trim() ? `${input} だよ〜！😊✨` : "ここに変換結果が表示されます。"), [input]);

  return (
    <div className="space-y-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={5}
        className="w-full rounded-xl border border-sky-200 p-3 text-sm"
        placeholder="例: 今日もよろしくお願いします。"
      />
      <div className="rounded-xl bg-sky-50 p-3 text-sm text-slate-700">{output}</div>
    </div>
  );
}

function LolShindanTool() {
  const [aggression, setAggression] = useState(3);
  const role = aggression >= 4 ? "Jungle / Mid" : aggression <= 2 ? "Support" : "Top / ADC";

  return (
    <div className="space-y-4">
      <input type="range" min="1" max="5" value={aggression} onChange={(e) => setAggression(Number(e.target.value))} className="w-full accent-teal-600" />
      <div className="rounded-xl border border-sky-200 bg-white p-4">
        <p className="text-sm text-slate-500">おすすめロール</p>
        <p className="mt-1 text-lg font-semibold">{role}</p>
      </div>
    </div>
  );
}

function FocusTimer() {
  const [minutes, setMinutes] = useState(25);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setMinutes((prev) => Math.max(5, prev - 5))} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm">-5</button>
        <div className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">{minutes} 分</div>
        <button type="button" onClick={() => setMinutes((prev) => Math.min(90, prev + 5))} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm">+5</button>
      </div>
      <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">スタート</button>
    </div>
  );
}

export default function ToolRenderer({ slug }) {
  if (slug === "ojisan-converter") return <OjisanConverter />;
  if (slug === "lol-shindan") return <LolShindanTool />;
  if (slug === "focus-timer") return <FocusTimer />;
  return <p className="text-sm text-slate-500">このツールは準備中です。</p>;
}
