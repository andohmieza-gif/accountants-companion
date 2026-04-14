import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, Menu, Search, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Conversation = {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  messages: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  content: string;
  time: string;
  isHtml?: boolean;
  bookmarked?: boolean;
  followups?: string[];
};

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Opens delete confirmation in parent — do not remove from list here. */
  onRequestDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  isOpen,
  isCollapsed,
  onToggle,
  onCollapse,
  onSelect,
  onNew,
  onRequestDelete,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedConversations;
    return sortedConversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q) ||
        c.messages.some((m) => {
          const t = m.isHtml ? m.content.replace(/<[^>]+>/g, " ") : m.content;
          return t.toLowerCase().includes(q);
        })
    );
  }, [sortedConversations, searchQuery]);

  const sharedContentProps = {
    conversations: filtered,
    totalCount: sortedConversations.length,
    searchQuery,
    onSearchChange: setSearchQuery,
    activeId,
    onSelect,
    onNew,
    onRequestDelete,
    isCollapsed,
    onCollapse,
  };

  return (
    <>
      {/* Mobile toggle button */}
      <motion.button
        initial={false}
        animate={{ x: isOpen ? 280 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={onToggle}
        className="fixed left-4 top-4 z-50 rounded-xl border border-border/50 bg-card/80 p-2.5 shadow-lg backdrop-blur-xl transition-colors hover:bg-muted lg:hidden"
      >
        {isOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </motion.button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border/40 bg-gradient-to-b from-card via-card to-card/95 shadow-2xl backdrop-blur-xl lg:hidden"
      >
        <SidebarContent {...sharedContentProps} isCollapsed={false} />
      </motion.aside>

      {/* Desktop sidebar - collapsible */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 64 : 288 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden shrink-0 flex-col border-r border-border/40 bg-gradient-to-b from-card via-card to-card/95 lg:flex"
      >
        <SidebarContent {...sharedContentProps} />
      </motion.aside>
    </>
  );
}

interface SidebarContentProps {
  conversations: Conversation[];
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRequestDelete: (id: string) => void;
  isCollapsed: boolean;
  onCollapse: () => void;
}

function SidebarContent({
  conversations,
  totalCount,
  searchQuery,
  onSearchChange,
  activeId,
  onSelect,
  onNew,
  onRequestDelete,
  isCollapsed,
  onCollapse,
}: SidebarContentProps) {
  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col items-center py-4">
        <button
          type="button"
          onClick={onCollapse}
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Expand sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onNew}
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background transition-colors hover:bg-foreground/90"
          title="New chat"
        >
          <Plus className="h-5 w-5" />
        </button>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.slice(0, 10).map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                "mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                activeId === conv.id
                  ? "bg-muted ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={conv.title}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Chats</h2>
          <div className="flex items-center gap-1">
            <Button type="button" onClick={onNew} size="sm" className="shrink-0 gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" />
              New
            </Button>
            <button
              type="button"
              onClick={onCollapse}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search chats…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 rounded-lg border-border/60 bg-background/80 pl-9 text-sm"
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {totalCount === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-8 text-center text-sm text-muted-foreground"
            >
              No conversations yet.
              <br />
              Start a new chat or send a message.
            </motion.p>
          ) : conversations.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-8 text-center text-sm text-muted-foreground"
            >
              No chats match &ldquo;{searchQuery.trim()}&rdquo;.
            </motion.p>
          ) : (
            conversations.map((conv, index) => (
              <motion.div
                key={conv.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="group relative mb-2"
              >
                <div
                  className={cn(
                    "flex items-stretch gap-0.5 rounded-xl p-1 transition-colors",
                    activeId === conv.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-2.5 text-left"
                  >
                    <div
                      className={cn(
                        "mt-0.5 shrink-0 rounded-lg p-1.5 transition-colors",
                        activeId === conv.id
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{conv.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {conv.preview || "No messages yet"}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                    aria-label={`Delete ${conv.title}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRequestDelete(conv.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
