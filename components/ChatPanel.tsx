"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { Balance, Expense } from "@/lib/types";
import { compressImageFile, type CompressedImage } from "@/lib/image";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  pdfUrl?: string;
  imagePreviewUrl?: string;
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
    {
      role: "assistant",
      text: "Hi! Tell me about an expense, snap a photo of a receipt, ask for the balance, or ask for a PDF report.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<MessageParam[]>([]);
  const pendingImageRef = useRef<CompressedImage | null>(null);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    pendingImageRef.current = pendingImage;
  }, [pendingImage]);

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
      // If a photo is attached, fill the caption instead of auto-sending so
      // the user can review the pairing before it goes out. Reads via refs
      // (not the closed-over state) so this always sees the latest values.
      if (pendingImageRef.current) {
        setInput(transcript);
      } else {
        void sendMessageRef.current(transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file");
      return;
    }
    setImageError("");
    try {
      const compressed = await compressImageFile(file);
      setPendingImage(compressed);
    } catch {
      setImageError("Could not read that image, try another one");
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    const image = pendingImage;
    if (!trimmed && !image) return;
    if (sending) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed, imagePreviewUrl: image?.previewUrl },
    ]);
    setInput("");
    setPendingImage(null);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          image: image ? { mediaType: image.mediaType, data: image.data } : undefined,
          history: historyRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.error ?? "Something went wrong." }]);
        return;
      }
      historyRef.current = data.history ?? [];
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

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

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
              {m.imagePreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imagePreviewUrl}
                  alt="Attached receipt"
                  className="rounded-lg mb-2 max-h-48 object-cover"
                />
              )}
              {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
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

      {pendingImage && (
        <div className="px-3 pt-3 flex items-center gap-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage.previewUrl} alt="Selected receipt" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-slate-500">Add a caption (who paid, how to split) and send.</p>
        </div>
      )}
      {imageError && <p className="px-3 pt-2 text-xs text-red-600">{imageError}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="border-t border-slate-200 p-3 flex items-center gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach or take a photo of a receipt"
          className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-100"
        >
          📷
        </button>
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
          placeholder={listening ? "Listening…" : pendingImage ? "Caption (optional)…" : "Type a message…"}
          className="flex-1 border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || (!input.trim() && !pendingImage)}
          className="shrink-0 px-4 py-2 rounded-full bg-blue-600 text-white font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
