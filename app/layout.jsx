import "@/app/globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const siteName = "みんなのおすすめAV";
const siteDescription = "AV・Fantiaレビューの投稿、検索、統計をまとめたレビューサイト";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hihyou.vercel.app";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: siteName,
    description: siteDescription,
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className="app-body antialiased">
        <div className="app-backdrop" />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
