import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Moon, Sun, MessageSquare, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export type SiteChromeNav = "chat" | "study" | "tools";

/**
 * Top bar aligned with the chat app header, used on Study and Tools routes.
 */
export function StudyChromeHeader({
  theme,
  onToggleTheme,
  active = "study",
}: {
  theme: Theme;
  onToggleTheme: () => void;
  active?: SiteChromeNav;
}) {
  return (
    <header
      className={cn(
        "relative z-10 shrink-0 border-b px-4 py-3 shadow-sm md:px-6",
        theme === "dark"
          ? "border-white/10 bg-black/35 backdrop-blur-2xl"
          : "border-border/50 bg-background/80 shadow-emerald-950/5 backdrop-blur-2xl"
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <motion.div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
              theme === "dark" ? "bg-white/10 ring-white/15" : "bg-primary/10 ring-primary/20"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className={cn("h-5 w-5", theme === "dark" ? "text-emerald-200" : "text-emerald-800")} />
          </motion.div>
          <div className="hidden min-w-0 sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Study</p>
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              The Accountant&apos;s Companion
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Link
            href="/"
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all",
              active === "chat"
                ? theme === "dark"
                  ? "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/30"
                  : "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/60"
                : theme === "dark"
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "border border-border/60 bg-card text-foreground shadow-sm hover:bg-muted"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </Link>

          <Link
            href="/study"
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all",
              active === "study"
                ? theme === "dark"
                  ? "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/30"
                  : "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/60"
                : theme === "dark"
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "border border-border/60 bg-card text-foreground shadow-sm hover:bg-muted"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Study</span>
          </Link>

          <Link
            href="/tools"
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all",
              active === "tools"
                ? theme === "dark"
                  ? "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/30"
                  : "bg-sky-100 text-sky-900 ring-1 ring-sky-300/60"
                : theme === "dark"
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "border border-border/60 bg-card text-foreground shadow-sm hover:bg-muted"
            )}
          >
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Tools</span>
          </Link>

          <div className={cn("mx-1 hidden h-5 w-px sm:block", theme === "dark" ? "bg-white/10" : "bg-border")} />

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
