import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  Star,
  Download,
  Copy,
  Check,
  Moon,
  Sun,
  Square,
  RotateCcw,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  FileText,
  ChevronDown,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sidebar, type Conversation, type ChatMessage } from "@/components/sidebar";
import { RatingModal } from "@/components/rating-modal";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { CalculatorWidget } from "@/components/calculator-widget";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "accountants-companion-v2";
const RATING_KEY = "accountants-companion-rated";
const MESSAGE_COUNT_KEY = "accountants-companion-msg-count";
const THEME_KEY = "accountants-companion-theme";

type Theme = "light" | "dark";

const TEMPLATES: { category: string; items: string[] }[] = [
  {
    category: "Fundamentals",
    items: [
      "What is the difference between GAAP and IFRS?",
      "Explain the accounting equation",
      "What are the main financial statements?",
    ],
  },
  {
    category: "Journal Entries",
    items: [
      "How do I record depreciation?",
      "Journal entry for prepaid rent",
      "Record a sale on credit with tax",
    ],
  },
  {
    category: "Audit & Tax",
    items: [
      "What are audit assertions?",
      "Explain deferred tax assets",
      "What is materiality in auditing?",
    ],
  },
  {
    category: "Advanced",
    items: [
      "Explain revenue recognition under ASC 606",
      "How do I account for a lease under IFRS 16?",
      "What is goodwill impairment testing?",
    ],
  },
];

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stripHtmlForApi(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toApiMessages(chatList: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  return chatList
    .filter((m) => m.sender === "user" || m.sender === "bot")
    .map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: m.isHtml ? stripHtmlForApi(m.content) : m.content,
    }))
    .filter((m) => m.content.length > 0);
}

function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.sender === "user");
  if (!firstUserMsg) return "New chat";
  const text = firstUserMsg.content.slice(0, 40);
  return text.length < firstUserMsg.content.length ? `${text}...` : text;
}

function generatePreview(messages: ChatMessage[]): string {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return "";
  const text = lastMsg.isHtml ? stripHtmlForApi(lastMsg.content) : lastMsg.content;
  return text.slice(0, 50);
}

function messagePlainText(msg: ChatMessage): string {
  if (msg.isHtml) return stripHtmlForApi(msg.content);
  return msg.content;
}

function exportConversationMarkdown(conv: Conversation): void {
  if (typeof window === "undefined") return;
  const blocks = conv.messages.map((m) => {
    const label = m.sender === "user" ? "You" : "Assistant";
    const body = messagePlainText(m).trim();
    return `## ${label}\n\n${body}\n`;
  });
  const md = `# ${conv.title}\n\n_Exported ${new Date().toLocaleString()}_\n\n${blocks.join("\n")}`;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = conv.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 48) || "chat";
  a.href = url;
  a.download = `${safe}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportConversationPdf(conv: Conversation): void {
  if (typeof window === "undefined") return;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(conv.title, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`Exported ${new Date().toLocaleString()}`, margin, y);
  y += 12;
  doc.setTextColor(0);

  for (const m of conv.messages) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const label = m.sender === "user" ? "You" : "Assistant";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, margin, y);
    y += 6;

    const body = messagePlainText(m).trim();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body, maxWidth);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 8;
  }

  const safe = conv.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 48) || "chat";
  doc.save(`${safe}.pdf`);
}

const FOLLOWUP_DELIMITER = "<<<FOLLOWUPS>>>";

function parseFollowups(content: string): { cleanContent: string; followups: string[] } {
  const idx = content.indexOf(FOLLOWUP_DELIMITER);
  if (idx === -1) {
    return { cleanContent: content, followups: [] };
  }
  const cleanContent = content.slice(0, idx).trim();
  const followupStr = content.slice(idx + FOLLOWUP_DELIMITER.length).trim();
  const followups = followupStr
    .split("|")
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.length < 80);
  return { cleanContent, followups: followups.slice(0, 3) };
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [ratingShownThisSession, setRatingShownThisSession] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const chat = activeConversation?.messages ?? [];

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed as Conversation[]);
          const sorted = [...(parsed as Conversation[])].sort((a, b) => b.updatedAt - a.updatedAt);
          setActiveId(sorted[0]?.id ?? null);
        }
      }
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      /* ignore */
    }
  }, [conversations, hydrated]);

  // Check if should show rating - only once per session, after 5 messages
  useEffect(() => {
    if (!hydrated || ratingShownThisSession) return;
    try {
      const hasRated = localStorage.getItem(RATING_KEY) === "true";
      if (hasRated) return;

      const countRaw = localStorage.getItem(MESSAGE_COUNT_KEY);
      const count = countRaw ? parseInt(countRaw, 10) : 0;

      if (count >= 5) {
        const timer = setTimeout(() => {
          setShowRating(true);
          setRatingShownThisSession(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } catch {
      /* ignore */
    }
  }, [hydrated, ratingShownThisSession]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat, loading, activeBotId, scrollToBottom]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Keyboard shortcuts: "/" to focus input, Escape to close menus
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName ?? "")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowExportMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close export menu on click outside
  useEffect(() => {
    if (!showExportMenu) return;
    const onClick = () => setShowExportMenu(false);
    const timer = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", onClick);
    };
  }, [showExportMenu]);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const handleRatingComplete = () => {
    try {
      localStorage.setItem(RATING_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  const incrementMessageCount = () => {
    try {
      const countRaw = localStorage.getItem(MESSAGE_COUNT_KEY);
      const count = countRaw ? parseInt(countRaw, 10) : 0;
      localStorage.setItem(MESSAGE_COUNT_KEY, String(count + 1));
    } catch {
      /* ignore */
    }
  };

  /** Start a blank chat: reuse current empty thread, or replace other empty drafts with one new row. */
  const startNewChat = useCallback((): string => {
    const active = conversations.find((c) => c.id === activeId);
    if (active && active.messages.length === 0) {
      setSidebarOpen(false);
      setInput("");
      return active.id;
    }

    const newConv: Conversation = {
      id: newId(),
      title: "New chat",
      preview: "",
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => {
      const withoutEmptyDrafts = prev.filter((c) => c.messages.length > 0);
      return [newConv, ...withoutEmptyDrafts];
    });
    setActiveId(newConv.id);
    setInput("");
    setSidebarOpen(false);
    return newConv.id;
  }, [conversations, activeId]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startNewChat]);

  const updateConversation = (id: string, messages: ChatMessage[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              messages,
              title: generateTitle(messages),
              preview: generatePreview(messages),
              updatedAt: Date.now(),
            }
          : c
      )
    );
  };

  const deleteConversation = (id: string) => {
    let nextList: Conversation[] = [];
    setConversations((prev) => {
      nextList = prev.filter((c) => c.id !== id);
      return nextList;
    });
    setActiveId((current) => {
      if (current !== id) return current;
      const sorted = [...nextList].sort((a, b) => b.updatedAt - a.updatedAt);
      return sorted[0]?.id ?? null;
    });
  };

  const requestDeleteConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    setPendingDelete({ id, title: conv?.title ?? "this chat" });
  };

  const confirmDeleteConversation = () => {
    if (!pendingDelete) return;
    deleteConversation(pendingDelete.id);
    setPendingDelete(null);
    setToast("Conversation deleted");
  };

  const copyMessage = async (msg: ChatMessage) => {
    const text = messagePlainText(msg);
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msg.id);
      window.setTimeout(() => setCopiedMessageId((cur) => (cur === msg.id ? null : cur)), 1600);
      setToast("Copied to clipboard");
    } catch {
      setToast("Could not copy");
    }
  };

  const handleExportMarkdown = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    exportConversationMarkdown(activeConversation);
    setToast("Chat exported as Markdown");
  };

  const handleExportPdf = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    exportConversationPdf(activeConversation);
    setToast("Chat exported as PDF");
  };

  const toggleBookmark = (msgId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, bookmarked: !m.bookmarked } : m
              ),
            }
          : c
      )
    );
  };

  const bookmarkedMessages = useMemo(() => {
    return conversations.flatMap((c) =>
      c.messages
        .filter((m) => m.bookmarked)
        .map((m) => ({ ...m, conversationTitle: c.title, conversationId: c.id }))
    );
  }, [conversations]);

  const suggestedFollowups = useMemo(() => {
    if (!activeConversation || loading) return [];
    const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
    if (!lastMsg || lastMsg.sender !== "bot") return [];
    return lastMsg.followups ?? [];
  }, [activeConversation, loading]);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const regenerateLastResponse = () => {
    if (!activeConversation || loading) return;
    const msgs = activeConversation.messages;
    const lastUserIdx = msgs.map((m) => m.sender).lastIndexOf("user");
    if (lastUserIdx === -1) return;
    const lastUserMsg = msgs[lastUserIdx];
    const messagesUpToLastUser = msgs.slice(0, lastUserIdx);
    updateConversation(activeConversation.id, messagesUpToLastUser);
    setInput(lastUserMsg.content);
    setTimeout(() => {
      void sendMessageInternal(lastUserMsg.content, activeConversation.id, messagesUpToLastUser);
    }, 50);
  };

  const sendMessageInternal = async (
    text: string,
    existingConvId: string | null,
    existingMessages: ChatMessage[]
  ) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const hadActive = Boolean(existingConvId);
    const convId = existingConvId ?? newId();
    const time = formatTime();
    const userMsg: ChatMessage = { id: newId(), sender: "user", content: trimmed, time };
    const newMessages = [...existingMessages, userMsg];

    setConversations((prev) => {
      let list = prev;
      if (!hadActive) {
        const newConv: Conversation = {
          id: convId,
          title: "New chat",
          preview: "",
          updatedAt: Date.now(),
          messages: [],
        };
        list = [newConv, ...prev.filter((c) => c.messages.length > 0)];
      }
      return list.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: newMessages,
              title: generateTitle(newMessages),
              preview: generatePreview(newMessages),
              updatedAt: Date.now(),
            }
          : c
      );
    });
    if (!hadActive) setActiveId(convId);

    setInput("");
    setLoading(true);
    incrementMessageCount();

    const question = trimmed.toLowerCase();
    const builderMatch = /who (built|created|made) (this|you|the chatbot)/.test(question);

    if (builderMatch) {
      const html = `This chatbot was built by <a href="https://www.linkedin.com/in/mieza-morkye-andoh" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline underline-offset-4 hover:text-primary/80">Mieza Andoh</a>, an accounting expert with extensive knowledge and experience in accounting, audit, and financial reporting.`;
      updateConversation(convId, [
        ...newMessages,
        { id: newId(), sender: "bot", content: html, time: formatTime(), isHtml: true },
      ]);
      setLoading(false);
      return;
    }

    const botId = newId();
    setActiveBotId(botId);
    updateConversation(convId, [
      ...newMessages,
      { id: botId, sender: "bot", content: "", time: formatTime(), isHtml: false },
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const historyForApi = toApiMessages(newMessages);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: true,
          messages: historyForApi.slice(0, -1),
          message: trimmed,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errText = "Something went wrong.";
        try {
          const errJson = (await res.json()) as { error?: string };
          errText = errJson.error ?? errText;
        } catch {
          /* ignore */
        }
        updateConversation(
          convId,
          newMessages.concat({ id: botId, sender: "bot", content: errText, time: formatTime() })
        );
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        updateConversation(
          convId,
          newMessages.concat({ id: botId, sender: "bot", content: "No response stream.", time: formatTime() })
        );
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) => (m.id === botId ? { ...m, content: accumulated } : m)),
                }
              : c
          )
        );
      }
      accumulated += decoder.decode();

      const { cleanContent, followups } = parseFollowups(accumulated);
      const finalText = cleanContent.trim() || "Sorry, I didn't get that.";
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === botId ? { ...m, content: finalText, followups } : m
                ),
                preview: finalText.slice(0, 50),
                updatedAt: Date.now(),
              }
            : c
        )
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === botId ? { ...m, content: m.content + "\n\n_(stopped)_" } : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          )
        );
        setToast("Generation stopped");
      } else {
        updateConversation(
          convId,
          newMessages.concat({ id: botId, sender: "bot", content: "Oops! Something went wrong.", time: formatTime() })
        );
      }
    } finally {
      setLoading(false);
      setActiveBotId(null);
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const existingMessages = activeId
      ? (conversations.find((c) => c.id === activeId)?.messages ?? [])
      : [];
    await sendMessageInternal(trimmed, activeId, existingMessages);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className={cn("flex h-screen overflow-hidden transition-colors", theme === "dark" ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" : "bg-gradient-to-br from-slate-50 via-white to-slate-100")}>
      {/* Decorative background elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={cn("absolute -left-40 -top-40 h-80 w-80 rounded-full blur-3xl", theme === "dark" ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20" : "bg-gradient-to-br from-blue-500/10 to-purple-500/10")} />
        <div className={cn("absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl", theme === "dark" ? "bg-gradient-to-br from-emerald-600/20 to-cyan-600/20" : "bg-gradient-to-br from-emerald-500/10 to-cyan-500/10")} />
        <div className={cn("absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl", theme === "dark" ? "bg-gradient-to-br from-amber-600/10 to-orange-600/10" : "bg-gradient-to-br from-amber-500/5 to-orange-500/5")} />
      </div>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNew={startNewChat}
        onRequestDelete={requestDeleteConversation}
      />

      {/* Main content */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={cn("relative z-10 border-b border-border/40 px-4 py-4 backdrop-blur-xl md:px-8", theme === "dark" ? "bg-card/60" : "bg-white/60")}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3 pl-12 lg:pl-0">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground shadow-lg shadow-black/20"
              >
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </motion.div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">The Accountant&apos;s Companion</h1>
                <p className="text-xs text-muted-foreground">
                  <span className="hidden sm:inline">Press / to focus · ⌘N new chat</span>
                  <span className="sm:hidden">AI accounting assistant</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* Export dropdown */}
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  disabled={!activeConversation || activeConversation.messages.length === 0}
                  onClick={() => setShowExportMenu((v) => !v)}
                  title="Export conversation"
                >
                  <Download className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <AnimatePresence>
                  {showExportMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border p-1 shadow-xl backdrop-blur-xl",
                        theme === "dark" ? "border-border/60 bg-card/95" : "border-border/40 bg-white/95"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          handleExportMarkdown();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <FileText className="h-4 w-4" />
                        Markdown (.md)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleExportPdf();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Download className="h-4 w-4" />
                        PDF (.pdf)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowRating(true)} title="Rate this app">
                <Star className="h-4 w-4" />
                <span className="hidden lg:inline">Rate</span>
              </Button>

              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Chat area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
              <AnimatePresence mode="wait">
                {chat.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex min-h-[50vh] flex-col items-center justify-center text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                      className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-inner"
                    >
                      <Sparkles className="h-10 w-10 text-muted-foreground" />
                    </motion.div>
                    <h2 className="mb-2 text-xl font-semibold">How can I help you today?</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Ask me anything about GAAP, IFRS, audit procedures, tax regulations, CPA exam prep, journal
                      entries, and more.
                    </p>

                    <div className="mt-8 w-full max-w-2xl space-y-4">
                      {TEMPLATES.map((section, sectionIdx) => (
                        <motion.div
                          key={section.category}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + sectionIdx * 0.1 }}
                        >
                          <p className="mb-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                            {section.category}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {section.items.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInput(suggestion)}
                                className={cn(
                                  "rounded-xl border px-3 py-2.5 text-left text-sm shadow-sm backdrop-blur transition-all hover:shadow-md",
                                  theme === "dark"
                                    ? "border-border/50 bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-card"
                                    : "border-border/60 bg-white/60 text-muted-foreground hover:border-primary/30 hover:bg-white"
                                )}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="chat" className="space-y-4 pb-4">
                    {chat.map((msg, index) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: index === chat.length - 1 ? 0 : 0,
                        }}
                        className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "group/msg relative max-w-[85%] sm:max-w-[75%]",
                            msg.sender === "user" ? "order-2" : "order-1"
                          )}
                        >
                          {/* Action buttons */}
                          {messagePlainText(msg).trim().length > 0 &&
                            !(msg.sender === "bot" && loading && msg.id === activeBotId && !msg.content) && (
                              <div className={cn(
                                "absolute -top-1 z-10 flex gap-1",
                                msg.sender === "user" ? "-left-1" : "-right-1"
                              )}>
                                <button
                                  type="button"
                                  onClick={() => void copyMessage(msg)}
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-all hover:bg-muted hover:text-foreground",
                                    "opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100"
                                  )}
                                  title="Copy message"
                                  aria-label="Copy message"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                </button>
                                {msg.sender === "bot" && (
                                  <button
                                    type="button"
                                    onClick={() => toggleBookmark(msg.id)}
                                    className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-all hover:bg-muted hover:text-foreground",
                                      "opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100",
                                      msg.bookmarked && "text-amber-500 sm:opacity-100"
                                    )}
                                    title={msg.bookmarked ? "Remove bookmark" : "Bookmark this response"}
                                    aria-label={msg.bookmarked ? "Remove bookmark" : "Bookmark"}
                                  >
                                    {msg.bookmarked ? (
                                      <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
                                    ) : (
                                      <Bookmark className="h-3.5 w-3.5" aria-hidden />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          <motion.div
                            whileHover={{ scale: 1.005 }}
                            className={cn(
                              "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                              msg.sender === "user"
                                ? "bg-foreground text-background shadow-sm"
                                : cn("border border-border/40 text-foreground shadow-black/5 backdrop-blur", theme === "dark" ? "bg-card/80" : "bg-white/80")
                            )}
                          >
                            {msg.sender === "bot" && msg.isHtml ? (
                              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                            ) : msg.sender === "bot" && !msg.content && loading && msg.id === activeBotId ? (
                              <span className="inline-flex items-center gap-2 text-muted-foreground">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <Loader2 className="h-4 w-4" />
                                </motion.div>
                                <span className="inline-flex gap-0.5">
                                  Thinking
                                  <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                  >
                                    ...
                                  </motion.span>
                                </span>
                              </span>
                            ) : msg.sender === "user" ? (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            ) : (
                              <MarkdownRenderer content={msg.content} />
                            )}
                          </motion.div>
                          <p
                            className={cn(
                              "mt-1 px-1 text-[10px] text-muted-foreground/60",
                              msg.sender === "user" ? "text-right" : "text-left"
                            )}
                          >
                            {msg.time}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                    {/* Regenerate button and suggested follow-ups after last bot message */}
                    {chat.length >= 2 && !loading && chat[chat.length - 1]?.sender === "bot" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <div className="flex justify-start">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground"
                            onClick={regenerateLastResponse}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Regenerate
                          </Button>
                        </div>

                        {/* Suggested follow-ups */}
                        {suggestedFollowups.length > 0 && (
                          <div className="pl-1">
                            <p className="mb-2 text-xs font-medium text-muted-foreground/70">Follow-up questions</p>
                            <div className="flex flex-wrap gap-2">
                              {suggestedFollowups.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => setInput(suggestion)}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs transition-all hover:shadow-sm",
                                    theme === "dark"
                                      ? "border-border/50 bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground"
                                      : "border-border/60 bg-white/60 text-muted-foreground hover:border-primary/30 hover:bg-white hover:text-foreground"
                                  )}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                    <div ref={bottomRef} className="h-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Input area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn("relative border-t border-border/40 px-4 py-4 backdrop-blur-xl md:px-8", theme === "dark" ? "bg-card/70" : "bg-white/70")}
          >
            <div className="mx-auto flex max-w-3xl gap-3">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  placeholder="Ask an accounting question… (press / to focus)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className={cn("h-12 rounded-xl border-border/60 pr-4 shadow-sm backdrop-blur transition-all focus:border-primary/50 focus:shadow-md focus:ring-primary/20", theme === "dark" ? "bg-card/80" : "bg-white/80")}
                />
              </div>
              {loading ? (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 gap-2 rounded-xl px-6"
                    onClick={stopGeneration}
                  >
                    <Square className="h-4 w-4" />
                    <span className="hidden sm:inline">Stop</span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="button"
                    className="h-12 gap-2 rounded-xl px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                    onClick={() => void sendMessage()}
                    disabled={!input.trim()}
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Footer with disclaimer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-3 space-y-1 text-center text-xs text-muted-foreground"
            >
              <p className="flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>For educational purposes only. Verify with a qualified professional.</span>
              </p>
              <p>
                Built by{" "}
                <a
                  href="https://www.linkedin.com/in/mieza-morkye-andoh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  Mieza Andoh
                </a>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* Rating Modal */}
      <RatingModal open={showRating} onOpenChange={setShowRating} onComplete={handleRatingComplete} />

      {/* Delete confirmation */}
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent onClose={() => setPendingDelete(null)} className="mx-4">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">&ldquo;{pendingDelete?.title}&rdquo;</span> will be
              permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="sm:min-w-[100px]" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="sm:min-w-[100px]" onClick={confirmDeleteConversation}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator Widget */}
      <CalculatorWidget theme={theme} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="pointer-events-none fixed bottom-6 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-full border border-border/60 bg-foreground px-4 py-2.5 text-center text-sm text-background shadow-lg"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
