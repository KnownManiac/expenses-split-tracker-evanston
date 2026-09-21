"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Balance, Expense, Identity } from "@/lib/types";
import BalanceCard from "@/components/BalanceCard";
import ExpenseList from "@/components/ExpenseList";
import ExpenseForm, { type ExpenseFormValues } from "@/components/ExpenseForm";
import ChatPanel from "@/components/ChatPanel";

export default function DashboardPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const me = await meRes.json();
      setIdentity(me.identity);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const [expRes, balRes] = await Promise.all([fetch("/api/expenses"), fetch("/api/balance")]);
    if (expRes.ok) setExpenses((await expRes.json()).expenses);
    if (balRes.ok) setBalance((await balRes.json()).balance);
  }

  async function handleAdd(values: ExpenseFormValues) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error("Could not save expense");
    setShowAddForm(false);
    await refresh();
  }

  async function handleUpdate(id: number, values: ExpenseFormValues) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error("Could not update expense");
    await refresh();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!identity) {
    return <main className="min-h-screen flex items-center justify-center text-slate-400">Loading…</main>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Household Expenses</h1>
          <p className="text-sm text-slate-500">
            Signed in as <span className="font-medium">{identity}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/pdf"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-600 hover:text-slate-900 underline"
          >
            Download PDF
          </a>
          <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800">
            Log out
          </button>
        </div>
      </header>

      <BalanceCard balance={balance} />

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-slate-700">Expenses</h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-sm px-3 py-1.5 rounded-full bg-slate-900 text-white"
            >
              {showAddForm ? "Cancel" : "+ Add expense"}
            </button>
          </div>

          {showAddForm && (
            <ExpenseForm defaultPaidBy={identity} onCancel={() => setShowAddForm(false)} onSave={handleAdd} />
          )}

          {expenses ? (
            <ExpenseList
              expenses={expenses}
              defaultPaidBy={identity}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
              Loading…
            </div>
          )}
        </section>

        <section>
          <h2 className="font-medium text-slate-700 mb-3">Chat</h2>
          <ChatPanel onResult={({ expenses, balance }) => {
            setExpenses(expenses);
            setBalance(balance);
          }} />
        </section>
      </div>
    </main>
  );
}
