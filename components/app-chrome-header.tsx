import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Star,
  Download,
  Moon,
  Sun,
  FileText,
  BookOpen,
  Wrench,
  MessageSquare,
} from "lucide-react";
import type { Conversation } from "@/components/sidebar";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export function AppChromeHeader({
  theme,
  onToggleTheme,
  sidebarGutter = false,
  exportConversation,
  onExportMarkdown,
  onExportPdf,
  onOpenRating,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  /** Extra left padding on small screens when a collapsible sidebar overlaps the brand. */
  sidebarGutter?: boolean;
  exportConversation: Conversation | null;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onOpenRating: () => void;
}) {
  const router = useRouter();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const canExport = Boolean(exportConversation && exportConversation.messages.length > 0);
  const onChat = router.pathname === "/";
  const onStudy = router.pathname === "/study";
  const onTools = router.pathname === "/tools";

  /** Chat / Tools: quiet pills so Study reads as the main action. */
  const sectionNavClass = (active: boolean) =>
    cn(
      "flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors sm:px-3.5",
      active
        ? theme === "dark"
          ? "bg-white/[0.12] text-white ring-1 ring-white/15"
          : "bg-muted text-foreground ring-1 ring-border/80"
        : theme === "dark"
          ? "text-white/55 ring-1 ring-transparent hover:bg-white/[0.08] hover:text-white"
          : "text-muted-foreground ring-1 ring-transparent hover:bg-muted/80 hover:text-foreground"
    );

  /** Study: solid brand emerald (matches logo), no teal / primary mismatch. */
  const studyNavClass = (active: boolean) =>
    cn(
      "flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold tracking-tight shadow-sm ring-1 transition-[box-shadow,background-color,transform] sm:px-4",
      theme === "dark"
        ? cn(
            "bg-emerald-600 text-white ring-emerald-400/35 shadow-emerald-950/30 hover:bg-emerald-500",
            active && "z-[1] shadow-md shadow-emerald-950/50 ring-2 ring-emerald-200/55"
          )
        : cn(
            "bg-emerald-600 text-white ring-emerald-800/20 shadow-emerald-900/15 hover:bg-emerald-700",
            active && "z-[1] shadow-md ring-2 ring-emerald-900/35"
          )
    );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setShowExportMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!showExportMenu) return;
    const onClick = () => setShowExportMenu(false);
    const timer = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", onClick);
    };
  }, [showExportMenu]);

  return (
    <header
      className={cn(
        "relative z-10 border-b px-4 py-3 md:px-6",
        theme === "dark"
          ? "border-emerald-500/10 bg-background/80 backdrop-blur-xl"
          : "border-emerald-900/10 bg-background/90 backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href="/"
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
            sidebarGutter && "pl-12 lg:pl-0"
          )}
        >
          <motion.div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
              theme === "dark" ? "bg-white/10 ring-white/15" : "bg-primary/10 ring-primary/20"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles
              className={cn("h-5 w-5", theme === "dark" ? "text-emerald-200" : "text-emerald-800")}
            />
          </motion.div>
          <span className="hidden min-w-0 truncate text-sm font-semibold tracking-tight text-foreground sm:block">
            The Accountant&apos;s Companion
          </span>
        </Link>

        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
          <nav
            className="flex items-center gap-1"
            aria-label="Main sections"
          >
            <Link
              href="/"
              className={sectionNavClass(onChat)}
              aria-current={onChat ? "page" : undefined}
              aria-label="Chat — ask questions and save conversations"
              title="Ask questions and save conversations"
            >
              <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Chat</span>
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-flex">
              <Link
                href="/study"
                className={studyNavClass(onStudy)}
                aria-current={onStudy ? "page" : undefined}
                aria-label="Study — quizzes, flashcards, and practice"
                title="Quizzes, flashcards, case studies, and practice"
              >
                <BookOpen className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                <span className="hidden sm:inline">Study</span>
              </Link>
            </motion.div>
            <Link
              href="/tools"
              className={sectionNavClass(onTools)}
              aria-current={onTools ? "page" : undefined}
              aria-label="Tools — calculators and ratio helpers"
              title="Calculators and quick ratio helpers"
            >
              <Wrench className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Tools</span>
            </Link>
          </nav>

          <div className={cn("mx-0.5 hidden h-5 w-px sm:mx-1 sm:block", theme === "dark" ? "bg-white/10" : "bg-border")} />

          <div className="relative">
            <motion.button
              type="button"
              disabled={!canExport}
              onClick={() => setShowExportMenu((v) => !v)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                !canExport
                  ? "cursor-not-allowed text-muted-foreground/30"
                  : theme === "dark"
                    ? "text-white/60 hover:bg-white/10 hover:text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              whileHover={canExport ? { scale: 1.05 } : {}}
              whileTap={canExport ? { scale: 0.95 } : {}}
              title={
                canExport
                  ? "Export this chat as Markdown or PDF"
                  : "Open Chat and select a conversation to export"
              }
            >
              <Download className="h-4 w-4" />
            </motion.button>
            <AnimatePresence>
              {showExportMenu && canExport && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={cn(
                    "absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-xl border p-1.5 shadow-xl",
                    theme === "dark" ? "border-white/10 bg-card" : "border-border bg-card shadow-md"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onExportMarkdown();
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExportPdf();
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                    PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="button"
            onClick={onOpenRating}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
              theme === "dark"
                ? "text-white/60 hover:bg-white/10 hover:text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Rate"
          >
            <Star className="h-4 w-4" />
          </motion.button>

          <motion.button
            type="button"
            onClick={onToggleTheme}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
              theme === "dark"
                ? "text-white/60 hover:bg-white/10 hover:text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
