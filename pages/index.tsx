import { useState, useEffect, useRef, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar, type Conversation, type ChatMessage } from "@/components/sidebar";
import { RatingModal } from "@/components/rating-modal";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "accountants-companion-v2";
const RATING_KEY = "accountants-companion-rated";
const MESSAGE_COUNT_KEY = "accountants-companion-msg-count";

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

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  // Check if should show rating
  useEffect(() => {
    if (!hydrated) return;
    try {
      const hasRated = localStorage.getItem(RATING_KEY) === "true";
      if (hasRated) return;

      const countRaw = localStorage.getItem(MESSAGE_COUNT_KEY);
      const count = countRaw ? parseInt(countRaw, 10) : 0;

      // Show rating popup after 5 messages or randomly (10% chance after 2 messages)
      if (count >= 5 || (count >= 2 && Math.random() < 0.1)) {
        const timer = setTimeout(() => setShowRating(true), 2000);
        return () => clearTimeout(timer);
      }
    } catch {
      /* ignore */
    }
  }, [hydrated, conversations]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat, loading, activeBotId, scrollToBottom]);

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

  const createNewConversation = (): string => {
    const newConv: Conversation = {
      id: newId(),
      title: "New chat",
      preview: "",
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    setSidebarOpen(false);
    return newConv.id;
  };

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
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    let convId = activeId;
    if (!convId) {
      convId = createNewConversation();
    }

    const time = formatTime();
    const userMsg: ChatMessage = { id: newId(), sender: "user", content: trimmed, time };
    const currentMessages = conversations.find((c) => c.id === convId)?.messages ?? [];
    const newMessages = [...currentMessages, userMsg];

    updateConversation(convId, newMessages);
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
                messages: c.messages.map((m) => (m.id === botId ? { ...m, content: finalText } : m)),
                preview: finalText.slice(0, 50),
                updatedAt: Date.now(),
              }
            : c
        )
      );
    } catch {
      updateConversation(
        convId,
        newMessages.concat({ id: botId, sender: "bot", content: "Oops! Something went wrong.", time: formatTime() })
      );
    } finally {
      setLoading(false);
      setActiveBotId(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Decorative background elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-500/5 to-orange-500/5 blur-3xl" />
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
        onNew={createNewConversation}
        onDelete={deleteConversation}
      />

      {/* Main content */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 border-b border-border/40 bg-white/60 px-4 py-4 backdrop-blur-xl md:px-8"
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-3 pl-12 lg:pl-0">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25"
              >
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </motion.div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">The Accountant&apos;s Companion</h1>
                <p className="text-xs text-muted-foreground">Your AI accounting assistant</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setShowRating(true)}
            >
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Rate us</span>
            </Button>
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
                      <Sparkles className="h-10 w-10 text-primary/70" />
                    </motion.div>
                    <h2 className="mb-2 text-xl font-semibold">How can I help you today?</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Ask me anything about GAAP, IFRS, audit procedures, tax regulations, CPA exam prep, journal
                      entries, and more.
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      {[
                        "What is the difference between GAAP and IFRS?",
                        "Explain deferred tax assets",
                        "How do I record depreciation?",
                        "What are audit assertions?",
                      ].map((suggestion, i) => (
                        <motion.button
                          key={suggestion}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                          onClick={() => {
                            setInput(suggestion);
                          }}
                          className="rounded-xl border border-border/60 bg-white/60 px-4 py-3 text-left text-sm text-muted-foreground shadow-sm backdrop-blur transition-all hover:border-primary/30 hover:bg-white hover:shadow-md"
                        >
                          {suggestion}
                        </motion.button>
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
                            "max-w-[85%] sm:max-w-[75%]",
                            msg.sender === "user" ? "order-2" : "order-1"
                          )}
                        >
                          <motion.div
                            whileHover={{ scale: 1.01 }}
                            className={cn(
                              "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                              msg.sender === "user"
                                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-primary/20"
                                : "border border-border/40 bg-white/80 text-foreground shadow-black/5 backdrop-blur"
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
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
            className="relative border-t border-border/40 bg-white/70 px-4 py-4 backdrop-blur-xl md:px-8"
          >
            <div className="mx-auto flex max-w-3xl gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Ask an accounting question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="h-12 rounded-xl border-border/60 bg-white/80 pr-4 shadow-sm backdrop-blur transition-all focus:border-primary/50 focus:shadow-md focus:ring-primary/20"
                />
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="button"
                  className="h-12 gap-2 rounded-xl px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Loader2 className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </motion.div>
            </div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-3 text-center text-xs text-muted-foreground"
            >
              Built by{" "}
              <a
                href="https://www.linkedin.com/in/mieza-morkye-andoh"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
              >
                Mieza Andoh
              </a>
            </motion.p>
          </motion.div>
        </div>
      </main>

      {/* Rating Modal */}
      <RatingModal open={showRating} onOpenChange={setShowRating} onComplete={handleRatingComplete} />
    </div>
  );
}
