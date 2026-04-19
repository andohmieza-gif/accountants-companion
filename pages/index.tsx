import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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
  User,
  ArrowUp,
  Mic,
  MicOff,
  BookOpen,
  Wrench,
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
import { readChatStudyContext } from "@/lib/study-extras";

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
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [ratingShownThisSession, setRatingShownThisSession] = useState(false);
  const [currentFollowups, setCurrentFollowups] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  /** Must be disconnected before closing context so mobile OS releases the mic promptly. */
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  /** Active getUserMedia stream; tracks stopped in onstop (and on error paths). */
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  /** Radix ScrollArea viewport (the node that actually scrolls). */
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
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
    const el = chatViewportRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const releaseCaptureHardware = useCallback(async () => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setAudioLevel(0);
    setRecordingTime(0);

    try {
      mediaStreamSourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    mediaStreamSourceRef.current = null;

    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());

    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t)
      );

      if (!mimeType) {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setToast("Audio recording not supported");
        return;
      }

      // Set up audio analysis for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;
      source.connect(analyser);
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Animate audio levels (stops once analyserRef is cleared in stopRecording / releaseCaptureHardware)
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      // Recording timer
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Release mic and WebAudio first so mobile OS clears the indicator before network work
        await releaseCaptureHardware();

        if (audioChunksRef.current.length === 0) return;

        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const formData = new FormData();
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
    } catch {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setToast("Microphone access denied");
    }
  }, [releaseCaptureHardware]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && (rec.state === "recording" || rec.state === "paused")) {
      rec.stop();
    } else {
      void releaseCaptureHardware();
    }
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsListening(false);
    setAudioLevel(0);
  }, [releaseCaptureHardware]);

  // Global mouse/touch up to stop recording (for press-and-hold UX)
  // Only stops if held for more than 500ms (otherwise treat as tap-to-toggle)
  const recordingStartTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (isListening) {
      recordingStartTimeRef.current = Date.now();
    }
  }, [isListening]);
  
  useEffect(() => {
    if (!isListening) return;
    
    const handleGlobalRelease = () => {
      const holdDuration = recordingStartTimeRef.current 
        ? Date.now() - recordingStartTimeRef.current 
        : 0;
      // Only stop on release if held for more than 500ms
      if (holdDuration > 500) {
        stopRecording();
      }
    };
    
    window.addEventListener("mouseup", handleGlobalRelease);
    window.addEventListener("touchend", handleGlobalRelease);
    
    return () => {
      window.removeEventListener("mouseup", handleGlobalRelease);
      window.removeEventListener("touchend", handleGlobalRelease);
    };
  }, [isListening, stopRecording]);

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
    const builderMatch = /who (built|created|made) (this|you|the (app|chatbot|site))/.test(question);

    if (builderMatch) {
      const html = `Mieza Andoh built this app. She is an accounting expert with deep experience in accounting, audit, and financial reporting. <a href="https://www.linkedin.com/in/mieza-morkye-andoh" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline underline-offset-4 hover:text-primary/80">Connect on LinkedIn</a>.`;
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

      const studyContext = typeof window !== "undefined" ? readChatStudyContext() : null;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: true,
          messages: historyForApi.slice(0, -1),
          message: trimmed,
          ...(studyContext ? { studyContext } : {}),
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

      // Fetch follow-up suggestions in the background
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
        setToast("Reply stopped");
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
    <div
      className={cn(
        "relative flex h-screen overflow-hidden transition-colors",
        theme === "dark"
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
          : "bg-gradient-to-b from-background via-background to-emerald-50/25"
      )}
    >
      {/* Dark: soft blue / cyan ambient (restored from earlier design) */}
      {theme === "dark" && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-600/18 to-cyan-600/18 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500/12 to-violet-600/10 blur-3xl" />
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
          setCurrentFollowups([]);
        }}
        onNew={startNewChat}
        onRequestDelete={requestDeleteConversation}
      />

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Modern Header */}
        <header
          className={cn(
            "relative z-10 border-b px-4 py-3 md:px-6",
            theme === "dark"
              ? "border-emerald-500/10 bg-background/80 backdrop-blur-xl"
              : "border-emerald-900/10 bg-background/90 backdrop-blur-xl"
          )}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 pl-12 lg:pl-0">
              <motion.div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                  theme === "dark"
                    ? "bg-white/10 ring-white/15"
                    : "bg-primary/10 ring-primary/20"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles
                  className={cn("h-5 w-5", theme === "dark" ? "text-emerald-200" : "text-emerald-800")}
                />
              </motion.div>
              <span className="hidden truncate text-sm font-semibold tracking-tight text-foreground sm:block">
                The Accountant&apos;s Companion
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-1">
              {/* Study Mode: primary CTA (distinct from icon-only header actions) */}
              <motion.button
                type="button"
                onClick={() => router.push("/study")}
                className={cn(
                  "relative flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-md ring-1 transition-all",
                  theme === "dark"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950/50 ring-emerald-400/35 hover:brightness-110 hover:ring-emerald-300/50"
                    : "bg-primary text-primary-foreground shadow-primary/30 ring-primary/40 hover:bg-primary/92 hover:shadow-lg"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="Open Study Mode: quizzes, case studies, flashcards, and practice"
              >
                <BookOpen className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                <span className="pr-0.5">Study</span>
              </motion.button>

              <Link
                href="/tools"
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold ring-1 transition-colors sm:px-4",
                  theme === "dark"
                    ? "bg-white/10 text-white ring-white/15 hover:bg-white/15"
                    : "border border-border/60 bg-card text-foreground shadow-sm ring-black/[0.04] hover:bg-muted"
                )}
                title="Calculators and quick utilities"
              >
                <Wrench className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden pr-0.5 sm:inline">Tools</span>
              </Link>

              {/* Divider */}
              <div className={cn("mx-1 h-5 w-px", theme === "dark" ? "bg-white/10" : "bg-border")} />

              {/* Export dropdown */}
              <div className="relative">
                <motion.button
                  type="button"
                  disabled={!activeConversation || activeConversation.messages.length === 0}
                  onClick={() => setShowExportMenu((v) => !v)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                    !activeConversation || activeConversation.messages.length === 0
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : theme === "dark"
                        ? "text-white/60 hover:bg-white/10 hover:text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  whileHover={activeConversation?.messages.length ? { scale: 1.05 } : {}}
                  whileTap={activeConversation?.messages.length ? { scale: 0.95 } : {}}
                  title="Export"
                >
                  <Download className="h-4 w-4" />
                </motion.button>
                <AnimatePresence>
                  {showExportMenu && (
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
                          handleExportMarkdown();
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
                          handleExportPdf();
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
                onClick={() => setShowRating(true)}
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
                onClick={toggleTheme}
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

        {/* Chat area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1" viewportRef={chatViewportRef}>
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
              <AnimatePresence mode="wait">
                {chat.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-auto flex min-h-[58vh] w-full max-w-4xl flex-col items-start pt-4 md:pt-8"
                  >
                    <div className="max-w-2xl border-b border-border/50 pb-8 md:pb-10">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                        Getting started
                      </p>
                      <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        The Accountant&apos;s Companion
                      </h2>
                      <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                        Ask technical questions, walk through standards, or draft journal logic. Use the
                        starters below or type your own. Everything saves in{" "}
                        <span className="font-medium text-foreground/90">Threads</span> in the sidebar.
                      </p>
                    </div>

                    <div className="mt-8 w-full space-y-8 md:mt-10">
                      {TEMPLATES.map((section, sectionIdx) => (
                        <motion.div
                          key={section.category}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.06 + sectionIdx * 0.05 }}
                        >
                          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {section.category}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {section.items.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInput(suggestion)}
                                className={cn(
                                  "group rounded-lg border border-border/60 border-l-4 border-l-primary/45 bg-card px-4 py-3 text-left text-sm transition-all",
                                  theme === "dark"
                                    ? "hover:border-border hover:border-l-primary/80 hover:bg-card/90"
                                    : "hover:border-emerald-900/15 hover:border-l-primary hover:shadow-sm"
                                )}
                              >
                                <span className="leading-snug text-foreground/85 group-hover:text-foreground">
                                  {suggestion}
                                </span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="chat" className="space-y-6 pb-4">
                    {chat.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                        className={cn(
                          "flex w-full min-w-0",
                          msg.sender === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%]",
                            msg.sender === "user" ? "items-end" : "items-stretch"
                          )}
                        >
                          <div
                            className={cn(
                              "flex gap-3",
                              msg.sender === "user" ? "flex-row-reverse" : "flex-row",
                              "items-center"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                msg.sender === "user"
                                  ? theme === "dark"
                                    ? "bg-foreground text-background"
                                    : "bg-emerald-950 text-emerald-50"
                                  : theme === "dark" ? "bg-card border border-border/50" : "bg-card border border-border/60 shadow-sm"
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
                                "group/msg relative min-w-0",
                                msg.sender === "user" ? "w-fit max-w-full" : "w-full min-w-0 flex-1"
                              )}
                            >
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
                                    ? theme === "dark"
                                      ? "bg-foreground text-background"
                                      : "bg-emerald-950 text-emerald-50"
                                    : cn(
                                        "border border-border/50",
                                        theme === "dark" ? "bg-card" : "bg-card shadow-sm"
                                      )
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
                            </div>
                          </div>
                          <p
                            className={cn(
                              "mt-1.5 text-[10px] text-muted-foreground/50",
                              msg.sender === "user" ? "mr-11 self-end text-right" : "ml-11 text-left"
                            )}
                          >
                            {msg.time}
                          </p>
                        </div>
                      </motion.div>
                    ))}
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
                            Try another answer
                          </Button>
                        </div>

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
                                      : "border-border/70 bg-card/80 text-muted-foreground hover:border-emerald-800/30 hover:bg-card hover:text-foreground"
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
            className={cn(
              "relative border-t border-border/40 px-4 py-4 backdrop-blur-xl md:px-8",
              theme === "dark" ? "bg-card/70" : "bg-card/80"
            )}
          >
            <div className="mx-auto max-w-3xl">
              <div
                className={cn(
                  "flex items-end gap-2 rounded-xl border border-border/70 border-l-4 border-l-primary/40 p-2 transition-all focus-within:border-primary/30 focus-within:shadow-md",
                  theme === "dark" ? "border-border/50 bg-card" : "border-border/70 bg-background shadow-sm"
                )}
              >
                <textarea
                  ref={inputRef}
                  placeholder="e.g. ASC 606 performance obligations, or a prepaid rent entry…"
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
                {/* Voice input - Press and hold */}
                <AnimatePresence mode="wait">
                  {isListening ? (
                    <motion.div
                      key="recording"
                      initial={{ width: 40, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 40, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3",
                        "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20"
                      )}
                    >
                      {/* Pulsing record indicator */}
                      <motion.div
                        className="h-2 w-2 rounded-full bg-white"
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      {/* Waveform visualization */}
                      <div className="flex h-5 items-center gap-[3px]">
                        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                          const delay = i * 0.05;
                          const baseHeight = 4;
                          const dynamicHeight = Math.max(baseHeight, audioLevel * 20 * (0.6 + Math.sin(Date.now() / 100 + i) * 0.4));
                          return (
                            <motion.div
                              key={i}
                              className="w-[3px] rounded-full bg-white/90"
                              animate={{
                                height: `${dynamicHeight}px`,
                                scaleY: [1, 1.1, 1],
                              }}
                              transition={{ 
                                duration: 0.15,
                                delay,
                                scaleY: { duration: 0.3, repeat: Infinity }
                              }}
                            />
                          );
                        })}
                      </div>
                      <span className="min-w-[36px] text-xs font-medium tabular-nums">
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                      </span>
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopRecording();
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 transition-colors hover:bg-white/30"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Square className="h-3 w-3" />
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="idle"
                      type="button"
                      onMouseDown={isTranscribing ? undefined : startRecording}
                      onTouchStart={isTranscribing ? undefined : startRecording}
                      disabled={isTranscribing}
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        isTranscribing
                          ? "bg-muted text-muted-foreground cursor-wait"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-red-500 active:text-white"
                      )}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title={isTranscribing ? "Transcribing..." : "Hold to record"}
                    >
                      {isTranscribing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>

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
