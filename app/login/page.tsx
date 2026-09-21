"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<"G" | "B" | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identity) {
      setError("Choose who you are first");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, identity }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6"
      >
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Household Expenses</h1>
          <p className="text-sm text-slate-500">Enter the PIN and pick who you are</p>
        </div>

        <div className="flex gap-3 justify-center">
          {(["G", "B"] as const).map((who) => (
            <button
              type="button"
              key={who}
              onClick={() => setIdentity(who)}
              className={`flex-1 py-3 rounded-xl border text-lg font-medium transition ${
                identity === who
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {who}
            </button>
          ))}
        </div>

        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full text-center tracking-[0.5em] text-lg border border-slate-200 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={8}
        />

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium disabled:opacity-50"
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
