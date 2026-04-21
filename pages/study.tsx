import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { StudyMode } from "@/components/study-mode";
import { AppChromeHeader } from "@/components/app-chrome-header";
import { RatingModal } from "@/components/rating-modal";
import { defaultDescription, getSiteOrigin, siteTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";

const THEME_KEY = "accountants-companion-theme";
const RATING_KEY = "accountants-companion-rated";
const RATING_DISMISSED_KEY = "accountants-companion-rating-dismissed";

type Theme = "light" | "dark";

export default function StudyPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [showRating, setShowRating] = useState(false);

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

  const handleRatingComplete = () => {
    try {
      localStorage.setItem(RATING_KEY, "true");
    } catch {
      /* ignore */
    }
  };

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
        {theme === "dark" ? (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-600/18 to-cyan-600/18 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500/12 to-violet-600/10 blur-3xl" />
          </div>
        ) : (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -right-24 top-16 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />
            <div className="absolute -left-16 bottom-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
            <div className="absolute left-1/3 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-teal-200/20 blur-3xl" />
          </div>
        )}
        <AppChromeHeader
          theme={theme}
          onToggleTheme={toggleTheme}
          exportConversation={null}
          onExportMarkdown={() => {}}
          onExportPdf={() => {}}
          onOpenRating={() => setShowRating(true)}
        />
        <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-3 py-3 sm:px-5 sm:py-5 md:px-6 md:py-6">
            <StudyMode theme={theme} />
          </div>
        </main>
      </div>

      <RatingModal
        open={showRating}
        onOpenChange={(open) => {
          setShowRating(open);
          if (!open) {
            try {
              localStorage.setItem(RATING_DISMISSED_KEY, "true");
            } catch {
              /* ignore */
            }
          }
        }}
        onComplete={handleRatingComplete}
      />
    </>
  );
}
