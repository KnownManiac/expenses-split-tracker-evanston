"use client";

import { useState } from "react";
import type { Expense } from "@/lib/types";
import ExpenseForm, { type ExpenseFormValues } from "./ExpenseForm";

function splitLabel(e: Expense) {
  if (e.split_type === "equal") return "Split equally";
  if (e.split_type === "percentage") {
    const gPct = e.amount ? Math.round((e.split_g / e.amount) * 100) : 0;
    return `Split ${gPct}/${100 - gPct}`;
  }
  return `Split $${e.split_g.toFixed(2)} / $${e.split_b.toFixed(2)}`;
}

export default function ExpenseList({
  expenses,
  defaultPaidBy,
  onUpdate,
  onDelete,
}: {
  expenses: Expense[];
  defaultPaidBy: "G" | "B";
  onUpdate: (id: number, values: ExpenseFormValues) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
        No expenses yet. Add one manually or via chat.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((e) => {
        const isEditing = editingId === e.id;
        if (isEditing) {
          return (
            <ExpenseForm
              key={e.id}
              initial={e}
              defaultPaidBy={defaultPaidBy}
              onCancel={() => setEditingId(null)}
              onSave={async (values) => {
                await onUpdate(e.id, values);
                setEditingId(null);
              }}
            />
          );
        }
        return (
          <div
            key={e.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{e.description}</p>
              <p className="text-sm text-slate-500">
                {e.expense_date} · Paid by{" "}
                <span className={e.paid_by === "G" ? "text-g font-medium" : "text-b font-medium"}>
                  {e.paid_by}
                </span>{" "}
                · {splitLabel(e)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold">${e.amount.toFixed(2)}</span>
              <button
                onClick={() => setEditingId(e.id)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  setDeletingId(e.id);
                  await onDelete(e.id);
                  setDeletingId(null);
                }}
                disabled={deletingId === e.id}
                className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {deletingId === e.id ? "…" : "Delete"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
