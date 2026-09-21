"use client";

import { useEffect, useRef, useState } from "react";
import type { Balance, Expense } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  pdfUrl?: string;
}

// Minimal typing for the non-standard Web Speech API.
interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

export default function ChatPanel({
  onResult,
}: {
  onResult: (data: { expenses: Expense[]; balance: Balance }) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hi! Tell me about an expense, ask for the balance, or ask for a PDF report." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      return;
    }
    const recognition: SpeechRecognitionLike = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setListening(false);
      void sendMessage(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setListening(true);
      recognitionRef.current.start();
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.error ?? "Something went wrong." }]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply, pdfUrl: data.pdfReady ? "/api/pdf" : undefined },
      ]);
      onResult({ expenses: data.expenses, balance: data.balance });
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error, please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white flex flex-col h-[520px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.pdfUrl && (
                <a
                  href={m.pdfUrl}
                  className="inline-block mt-2 text-blue-600 underline text-sm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF
                </a>
              )}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-slate-400">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="border-t border-slate-200 p-3 flex items-center gap-2"
      >
        <button
          type="button"
          onClick={toggleMic}
          disabled={!speechSupported}
          title={speechSupported ? "Speak" : "Voice input not supported in this browser"}
          className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center border ${
            listening
              ? "bg-red-500 border-red-500 text-white animate-pulse"
              : "border-slate-200 text-slate-600 hover:bg-slate-100"
          } disabled:opacity-30`}
        >
          🎤
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : "Type a message…"}
          className="flex-1 border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 px-4 py-2 rounded-full bg-blue-600 text-white font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
