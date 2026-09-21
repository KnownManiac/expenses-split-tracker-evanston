import type { Balance } from "@/lib/types";

export default function BalanceCard({ balance }: { balance: Balance | null }) {
  if (!balance) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse h-24" />
    );
  }

  const settled = !balance.owedBy;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">Balance</p>
        {settled ? (
          <p className="text-lg font-semibold text-emerald-600 mt-1">All settled up</p>
        ) : (
          <p className="text-lg font-semibold mt-1">
            <span className={balance.owedBy === "G" ? "text-g" : "text-b"}>{balance.owedBy}</span> owes{" "}
            <span className={balance.owedTo === "G" ? "text-g" : "text-b"}>{balance.owedTo}</span>{" "}
            <span>${balance.amount.toFixed(2)}</span>
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">Total spent</p>
        <p className="text-lg font-semibold mt-1">${balance.totalSpent.toFixed(2)}</p>
      </div>
    </div>
  );
}
