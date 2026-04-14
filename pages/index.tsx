import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  User,
  Bot,
  ArrowUp,
  Mic,
  MicOff,
  BookOpen,
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
import { StudyMode } from "@/components/study-mode";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "accountants-companion-v2";
const RATING_KEY = "accountants-companion-rated";
const RATING_DISMISSED_KEY = "accountants-companion-rating-dismissed";
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

async function fetchFollowups(question: string, answer: string): Promise<string[]> {
  try {
    const res = await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { followups?: string[] };
    return data.followups ?? [];
  } catch {
    return [];
  }
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
  const [currentFollowups, setCurrentFollowups] = useState<string[]>([]);
  const [showStudyMode, setShowStudyMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
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

  // Check if should show rating - only once, after 5 messages, if not rated or dismissed
  useEffect(() => {
    if (!hydrated || ratingShownThisSession) return;
    try {
      const hasRated = localStorage.getItem(RATING_KEY) === "true";
      const hasDismissed = localStorage.getItem(RATING_DISMISSED_KEY) === "true";
      if (hasRated || hasDismissed) return;

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

  const scrollToTop = useCallback(() => {
    bottomRef.current?.parentElement?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t)
      );
      
      if (!mimeType) {
        setToast("Audio recording not supported");
        return;
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        
        if (audioChunksRef.current.length === 0) return;

        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const formData = new FormData();
        // Use correct extension based on mime type
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        formData.append("audio", new File([audioBlob], `recording.${ext}`, { type: mimeType }));

        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              setInput((prev) => prev + (prev ? " " : "") + data.text);
              inputRef.current?.focus();
            }
          } else {
            setToast("Transcription failed");
          }
        } catch {
          setToast("Transcription failed");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(200);
      setIsListening(true);
    } catch (err) {
      setToast("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

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
      scrollToTop();
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
    setCurrentFollowups([]);
    scrollToTop();
    return newConv.id;
  }, [conversations, activeId, scrollToTop]);

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
    return currentFollowups;
  }, [activeConversation, loading, currentFollowups]);

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
    setCurrentFollowups([]);
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

      const finalText = accumulated.trim() || "Sorry, I didn't get that.";
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === botId ? { ...m, content: finalText } : m
                ),
                preview: finalText.slice(0, 50),
                updatedAt: Date.now(),
              }
            : c
        )
      );

      // Fetch AI-generated follow-ups in background
      fetchFollowups(trimmed, finalText).then((followups) => {
        setCurrentFollowups(followups);
      });
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

  return (
    <div className={cn("flex h-screen overflow-hidden", theme === "dark" ? "bg-background" : "bg-neutral-50")}>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
          setCurrentFollowups([]);
        }}
        onNew={startNewChat}
        onRequestDelete={requestDeleteConversation}
      />

      {/* Main content */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className={cn(
            "relative z-10 border-b px-4 py-3 md:px-6",
            theme === "dark" ? "border-border/50 bg-background" : "border-border/40 bg-white"
          )}
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5 pl-12 lg:pl-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground">
                <Sparkles className="h-4 w-4 text-background" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold">The Accountant&apos;s Companion</h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {/* Study Mode */}
              <button
                type="button"
                onClick={() => setShowStudyMode(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Study Mode"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Study</span>
              </button>

              {/* Export dropdown */}
              <div className="relative">
                <button
                  type="button"
                  disabled={!activeConversation || activeConversation.messages.length === 0}
                  onClick={() => setShowExportMenu((v) => !v)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    !activeConversation || activeConversation.messages.length === 0
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title="Export"
                >
                  <Download className="h-4 w-4" />
                </button>
                <AnimatePresence>
                  {showExportMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className={cn(
                        "absolute right-0 top-full z-20 mt-1.5 w-36 overflow-hidden rounded-lg border p-1 shadow-lg",
                        theme === "dark" ? "border-border bg-card" : "border-border/60 bg-white"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          handleExportMarkdown();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleExportPdf();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        PDF
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => setShowRating(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Rate"
              >
                <Star className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Chat area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
              <AnimatePresence mode="wait">
                {chat.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-[60vh] flex-col items-center justify-center pt-8"
                  >
                    <div className="text-center">
                      <h2 className="text-2xl font-semibold tracking-tight">What can I help with?</h2>
                      <p className="mt-2 text-muted-foreground">
                        Ask about accounting standards, journal entries, or CPA exam topics
                      </p>
                    </div>

                    <div className="mt-10 w-full max-w-2xl space-y-6">
                      {TEMPLATES.map((section, sectionIdx) => (
                        <motion.div
                          key={section.category}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + sectionIdx * 0.08 }}
                        >
                          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/60">
                            {section.category}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {section.items.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInput(suggestion)}
                                className={cn(
                                  "group rounded-xl border px-4 py-3 text-left text-sm transition-all",
                                  theme === "dark"
                                    ? "border-border/60 bg-card hover:border-foreground/20 hover:bg-card/80"
                                    : "border-border/50 bg-white hover:border-foreground/20 hover:shadow-md"
                                )}
                              >
                                <span className="text-foreground/80 group-hover:text-foreground">{suggestion}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="chat" className="space-y-6 pb-4">
                    {chat.map((msg, index) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                        className={cn("flex gap-3", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            msg.sender === "user"
                              ? "bg-foreground text-background"
                              : theme === "dark" ? "bg-card border border-border/50" : "bg-muted"
                          )}
                        >
                          {msg.sender === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div
                          className={cn(
                            "group/msg relative max-w-[85%] sm:max-w-[75%]",
                          )}
                        >
                          {/* Action buttons */}
                          {messagePlainText(msg).trim().length > 0 &&
                            !(msg.sender === "bot" && loading && msg.id === activeBotId && !msg.content) && (
                              <div className={cn(
                                "absolute -top-2 z-10 flex gap-1",
                                msg.sender === "user" ? "left-0" : "right-0"
                              )}>
                                <button
                                  type="button"
                                  onClick={() => void copyMessage(msg)}
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground",
                                    "opacity-0 group-hover/msg:opacity-100"
                                  )}
                                  title="Copy"
                                  aria-label="Copy message"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <Check className="h-3 w-3 text-emerald-500" aria-hidden />
                                  ) : (
                                    <Copy className="h-3 w-3" aria-hidden />
                                  )}
                                </button>
                                {msg.sender === "bot" && (
                                  <button
                                    type="button"
                                    onClick={() => toggleBookmark(msg.id)}
                                    className={cn(
                                      "flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground",
                                      "opacity-0 group-hover/msg:opacity-100",
                                      msg.bookmarked && "text-amber-500 opacity-100"
                                    )}
                                    title={msg.bookmarked ? "Remove bookmark" : "Bookmark"}
                                    aria-label={msg.bookmarked ? "Remove bookmark" : "Bookmark"}
                                  >
                                    {msg.bookmarked ? (
                                      <BookmarkCheck className="h-3 w-3" aria-hidden />
                                    ) : (
                                      <Bookmark className="h-3 w-3" aria-hidden />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                              msg.sender === "user"
                                ? "bg-foreground text-background"
                                : cn("border border-border/50", theme === "dark" ? "bg-card" : "bg-white shadow-sm")
                            )}
                          >
                            {msg.sender === "bot" && msg.isHtml ? (
                              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                            ) : msg.sender === "bot" && !msg.content && loading && msg.id === activeBotId ? (
                              <div className="flex items-center gap-1 py-1">
                                {[0, 1, 2].map((i) => (
                                  <motion.div
                                    key={i}
                                    className="h-2 w-2 rounded-full bg-muted-foreground/60"
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{
                                      duration: 0.6,
                                      repeat: Infinity,
                                      delay: i * 0.15,
                                      ease: "easeInOut",
                                    }}
                                  />
                                ))}
                              </div>
                            ) : msg.sender === "user" ? (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            ) : (
                              <MarkdownRenderer content={msg.content} />
                            )}
                          </div>
                          <p
                            className={cn(
                              "mt-1.5 text-[10px] text-muted-foreground/50",
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
            <div className="mx-auto max-w-3xl">
              <div
                className={cn(
                  "flex items-end gap-2 rounded-2xl border p-2 transition-all focus-within:border-foreground/20 focus-within:shadow-lg",
                  theme === "dark" ? "border-border/50 bg-card" : "border-border/60 bg-white shadow-sm"
                )}
              >
                <textarea
                  ref={inputRef}
                  placeholder="Ask an accounting question..."
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() && !loading) {
                        void sendMessage();
                      }
                    }
                  }}
                  disabled={loading}
                  rows={1}
                  className={cn(
                    "flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60",
                    "max-h-[150px] min-h-[40px]"
                  )}
                />
                {/* Voice input */}
                <motion.button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={isTranscribing}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isTranscribing
                      ? "bg-muted text-muted-foreground cursor-wait"
                      : isListening
                        ? "bg-red-500 text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={isTranscribing ? "Transcribing..." : isListening ? "Stop recording" : "Voice input"}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </motion.button>

                {loading ? (
                  <motion.button
                    type="button"
                    onClick={stopGeneration}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Square className="h-4 w-4" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!input.trim()}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                      input.trim()
                        ? "bg-foreground text-background hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                    whileHover={input.trim() ? { scale: 1.05 } : {}}
                    whileTap={input.trim() ? { scale: 0.95 } : {}}
                  >
                    <ArrowUp className="h-5 w-5" />
                  </motion.button>
                )}
              </div>
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
      <RatingModal 
        open={showRating} 
        onOpenChange={(open) => {
          setShowRating(open);
          if (!open) {
            // User dismissed the modal - don't show again
            try { localStorage.setItem(RATING_DISMISSED_KEY, "true"); } catch {}
          }
        }} 
        onComplete={handleRatingComplete} 
      />

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

      {/* Study Mode */}
      <StudyMode isOpen={showStudyMode} onClose={() => setShowStudyMode(false)} theme={theme} />

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
