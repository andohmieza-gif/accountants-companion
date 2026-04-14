import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";

export function RatingModal({ open, onOpenChange, onComplete }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `New Rating: ${rating}/5 stars - Accountant's Companion`,
          from_name: "Accountant's Companion",
          rating: `${rating}/5 stars`,
          feedback: feedback || "(No feedback provided)",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setSent(true);
      setTimeout(() => {
        onComplete();
        onOpenChange(false);
        setSent(false);
        setRating(0);
        setFeedback("");
      }, 2000);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="mx-4">
        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
            >
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </motion.div>
            <h3 className="mt-4 text-xl font-semibold">Thank you!</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your feedback helps us improve.</p>
          </motion.div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">How are we doing?</DialogTitle>
              <DialogDescription>
                We&apos;d love to hear your feedback on The Accountant&apos;s Companion.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col items-center gap-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    className="rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Star
                      className={cn(
                        "h-10 w-10 transition-colors duration-150",
                        star <= displayRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-transparent text-muted-foreground/40"
                      )}
                    />
                  </motion.button>
                ))}
              </div>

              <motion.p
                key={displayRating}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-5 text-sm font-medium text-muted-foreground"
              >
                {displayRating === 1 && "Poor"}
                {displayRating === 2 && "Fair"}
                {displayRating === 3 && "Good"}
                {displayRating === 4 && "Very Good"}
                {displayRating === 5 && "Excellent!"}
              </motion.p>

              <textarea
                placeholder="Any additional feedback? (optional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex w-full gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={sending}
                >
                  Maybe later
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  onClick={handleSubmit}
                  disabled={rating === 0 || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
