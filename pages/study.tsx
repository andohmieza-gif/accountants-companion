import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { StudyMode } from "@/components/study-mode";
import { StudyChromeHeader } from "@/components/study-chrome-header";
import { defaultDescription, getSiteOrigin, siteTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";

const THEME_KEY = "accountants-companion-theme";

type Theme = "light" | "dark";

export default function StudyPage() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        document.documentElement.classList.toggle("dark", saved === "dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const studyTitle = `Study Mode · ${siteTitle}`;
  const studyUrl = `${getSiteOrigin()}/study`;
  const ogImageUrl = `${getSiteOrigin()}/og.png`;

  return (
    <>
      <Head>
        <title>{studyTitle}</title>
        <meta property="og:title" content={studyTitle} />
        <meta property="og:url" content={studyUrl} />
        <meta name="twitter:title" content={studyTitle} />
        <meta property="og:description" content={defaultDescription} />
        <meta name="twitter:description" content={defaultDescription} />
        <meta property="og:image" content={ogImageUrl} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>
      <div
        className={cn(
          "relative flex h-[100dvh] min-h-0 flex-col overflow-hidden text-foreground transition-colors",
          theme === "dark"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            : "bg-gradient-to-b from-background via-background to-emerald-50/25"
        )}
      >
        {theme === "dark" && (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-600/18 to-cyan-600/18 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500/12 to-violet-600/10 blur-3xl" />
          </div>
        )}
        <StudyChromeHeader theme={theme} onToggleTheme={toggleTheme} />
        <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 md:px-6">
            <StudyMode theme={theme} />
          </div>
        </main>
      </div>
    </>
  );
}
