"use client";

import { useState } from "react";
import type { Expense, Identity, SplitType } from "@/lib/types";

export interface ExpenseFormValues {
  description: string;
  amount: number;
  paid_by: Identity;
  split_type: SplitType;
  split_g?: number;
  split_b?: number;
  expense_date: string;
}

export default function ExpenseForm({
  initial,
  defaultPaidBy,
  onSave,
  onCancel,
}: {
  initial?: Expense;
  defaultPaidBy: Identity;
  onSave: (values: ExpenseFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paidBy, setPaidBy] = useState<Identity>(initial?.paid_by ?? defaultPaidBy);
  const [splitType, setSplitType] = useState<SplitType>(initial?.split_type ?? "equal");
  const [gPercent, setGPercent] = useState(
    initial && initial.split_type === "percentage" && initial.amount
      ? String(Math.round((initial.split_g / initial.amount) * 100))
      : "50"
  );
  const [gManual, setGManual] = useState(
    initial && initial.split_type === "manual" ? String(initial.split_g) : ""
  );
  const [bManual, setBManual] = useState(
    initial && initial.split_type === "manual" ? String(initial.split_b) : ""
  );
  const [date, setDate] = useState(initial?.expense_date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const bPercent = 100 - Number(gPercent || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!description.trim() || !amt || amt <= 0) {
      setError("Enter a description and a positive amount");
      return;
    }
    if (splitType === "manual") {
      const g = Number(gManual || 0);
      const b = Number(bManual || 0);
      if (Math.abs(g + b - amt) > 0.05) {
        setError(`G + B shares must add up to $${amt.toFixed(2)}`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: amt,
        paid_by: paidBy,
        split_type: splitType,
        split_g: splitType === "percentage" ? Number(gPercent) : splitType === "manual" ? Number(gManual) : undefined,
        split_b: splitType === "percentage" ? bPercent : splitType === "manual" ? Number(bManual) : undefined,
        expense_date: date,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white rounded-2xl border border-slate-200 p-5"
    >
      <div>
        <label className="text-sm font-medium text-slate-600">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Groceries"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-600">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-600">Paid by</label>
        <div className="flex gap-2 mt-1">
          {(["G", "B"] as const).map((who) => (
            <button
              type="button"
              key={who}
              onClick={() => setPaidBy(who)}
              className={`flex-1 py-2 rounded-lg border font-medium ${
                paidBy === who ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
              }`}
            >
              {who}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-600">Split</label>
        <select
          value={splitType}
          onChange={(e) => setSplitType(e.target.value as SplitType)}
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="equal">Equally (50/50)</option>
          <option value="percentage">By percentage</option>
          <option value="manual">Manual amounts</option>
        </select>
      </div>

      {splitType === "percentage" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">G %</label>
            <input
              type="number"
              value={gPercent}
              onChange={(e) => setGPercent(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">B %</label>
            <input type="number" value={bPercent} disabled className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500" />
          </div>
        </div>
      )}

      {splitType === "manual" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">G's share ($)</label>
            <input
              type="number"
              step="0.01"
              value={gManual}
              onChange={(e) => setGManual(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">B's share ($)</label>
            <input
              type="number"
              step="0.01"
              value={bManual}
              onChange={(e) => setBManual(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
