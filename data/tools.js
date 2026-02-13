export const toolCategories = ["All", "新着", "ゲーム", "便利ツール"];

export const tools = [
  {
    slug: "ojisan-converter",
    title: "おじさん構文変換機",
    description: "通常の文章を、おじさん構文風に変換します。",
    tags: ["新着", "便利ツール"],
    icon: "sparkles"
  },
  {
    slug: "lol-shindan",
    title: "LoL診断ツール",
    description: "プレイ傾向から向いているロールを診断します。",
    tags: ["新着", "ゲーム"],
    icon: "gamepad2"
  },
  {
    slug: "focus-timer",
    title: "集中タイマー",
    description: "シンプルなポモドーロ型タイマーです。",
    tags: ["便利ツール"],
    icon: "flaskConical"
  }
];

export function getToolBySlug(slug) {
  return tools.find((tool) => tool.slug === slug);
}
