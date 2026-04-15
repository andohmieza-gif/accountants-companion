import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Moon, Sun, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

/**
 * Top bar aligned with the chat app header — used on the full-page Study route.
 */
export function StudyChromeHeader({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header
      className={cn(
        "relative z-10 shrink-0 px-4 py-2.5 md:px-6",
        theme === "dark" ? "bg-background/80 backdrop-blur-xl" : "bg-background/85 backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <motion.div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              theme === "dark" ? "bg-white/10" : "bg-muted"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className={cn("h-5 w-5", theme === "dark" ? "text-white" : "text-emerald-800")} />
          </motion.div>
          <span className="hidden text-sm font-medium text-muted-foreground sm:block">
            The Accountant&apos;s Companion
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/"
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all",
              theme === "dark"
                ? "bg-white/10 text-white hover:bg-white/15"
                : "border border-border/60 bg-card text-foreground shadow-sm hover:bg-muted"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </Link>

          <div className={cn("mx-1 h-5 w-px", theme === "dark" ? "bg-white/10" : "bg-border")} />

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
