import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { StudyMode } from "@/components/study-mode";
import { StudyChromeHeader } from "@/components/study-chrome-header";
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

  return (
    <>
      <Head>
        <title>Study Mode — The Accountant&apos;s Companion</title>
      </Head>
      <div
        className={cn(
          "flex h-[100dvh] min-h-0 flex-col overflow-hidden text-foreground",
          theme === "dark" ? "bg-background" : "bg-neutral-50"
        )}
      >
        <StudyChromeHeader theme={theme} onToggleTheme={toggleTheme} />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 md:px-6">
            <StudyMode theme={theme} />
          </div>
        </main>
      </div>
    </>
  );
}
