import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Trash2, ChevronLeft, Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
};

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  isOpen,
  onToggle,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

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

      {/* Mobile backdrop */}
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

      {/* Mobile Sidebar (slide-out drawer) */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border/40 bg-gradient-to-b from-card via-card to-card/95 shadow-2xl backdrop-blur-xl lg:hidden"
      >
        <SidebarContent
          conversations={sortedConversations}
          activeId={activeId}
          onSelect={onSelect}
          onNew={onNew}
          onDelete={onDelete}
        />
      </motion.aside>

      {/* Desktop Sidebar (always visible) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border/40 bg-gradient-to-b from-card via-card to-card/95 lg:flex">
        <SidebarContent
          conversations={sortedConversations}
          activeId={activeId}
          onSelect={onSelect}
          onNew={onNew}
          onDelete={onDelete}
        />
      </aside>
    </>
  );
}

interface SidebarContentProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function SidebarContent({ conversations, activeId, onSelect, onNew, onDelete }: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 p-4">
        <h2 className="text-sm font-semibold text-foreground">Chat History</h2>
        <Button onClick={onNew} size="sm" className="gap-1.5 rounded-xl">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {conversations.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-8 text-center text-sm text-muted-foreground"
            >
              No conversations yet.
              <br />
              Start a new chat!
            </motion.p>
          ) : (
            conversations.map((conv, index) => (
              <motion.div
                key={conv.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="group relative mb-2"
              >
                <button
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-3 text-left transition-all duration-200",
                    activeId === conv.id
                      ? "bg-primary/10 shadow-sm ring-1 ring-primary/20"
                      : "hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 rounded-lg p-1.5 transition-colors",
                        activeId === conv.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{conv.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {conv.preview || "No messages"}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Delete button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
