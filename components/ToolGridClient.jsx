"use client";

import { useMemo, useState } from "react";
import ToolCard from "@/components/ToolCard";
import { toolCategories, tools } from "@/data/tools";

export default function ToolGridClient() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredTools = useMemo(() => {
    if (activeCategory === "All") return tools;
    return tools.filter((tool) => tool.tags.includes(activeCategory));
  }, [activeCategory]);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2">
        {toolCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-full border px-4 py-2 text-sm ${activeCategory === category ? "border-teal-600 bg-teal-600 text-white" : "border-sky-200 bg-white text-slate-600"}`}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
