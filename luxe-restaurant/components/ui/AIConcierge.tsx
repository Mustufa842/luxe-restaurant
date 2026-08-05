"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

type Message = { role: "user" | "assistant"; content: string };

export function AIConcierge() {
  const isOpen = useAppStore((s) => s.isConciergeOpen);
  const toggle = useAppStore((s) => s.toggleConcierge);

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setMessages((m) => [...m, { role: "user", content: userMessage }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.sessionId);
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: "The concierge is unavailable right now." }]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating glowing avatar */}
      <button
        onClick={toggle}
        aria-label="Open AI Concierge"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-champagne/60 bg-graphite shadow-gold transition-transform duration-300 ease-silk hover:scale-105"
      >
        <span className="h-3 w-3 animate-pulse rounded-full bg-champagne shadow-[0_0_16px_4px_rgba(201,165,103,0.7)]" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[340px] flex-col rounded-md border border-champagne/25 bg-graphite/80 backdrop-blur-xl shadow-gold"
          >
            <div className="hairline flex items-center justify-between px-4 py-3">
              <span className="font-display text-lg font-light text-ivory">Concierge</span>
              <button onClick={toggle} aria-label="Close" className="text-ash hover:text-ivory">
                ×
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <p className="font-mono text-xs text-ash">
                  Ask about the menu, allergens, or tonight's availability.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-sm px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto bg-champagne/20 text-ivory"
                      : "bg-onyx/60 text-ash"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {sending && <p className="font-mono text-xs text-ash">Typing…</p>}
            </div>

            <div className="hairline flex gap-2 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask the concierge…"
                className="flex-1 rounded-sm border border-champagne/20 bg-onyx px-3 py-2 text-sm text-ivory placeholder:text-ash/50"
              />
              <button
                onClick={send}
                className="rounded-sm bg-champagne px-3 py-2 font-mono text-xs uppercase text-onyx"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
