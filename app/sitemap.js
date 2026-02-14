const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hihyou.vercel.app";

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${siteUrl}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/review/new`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];
}
