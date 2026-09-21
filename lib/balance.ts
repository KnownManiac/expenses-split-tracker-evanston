import type { Balance, Expense } from "./types";

export type { Balance };

export function computeBalance(expenses: Expense[]): Balance {
  let netG = 0;
  let totalSpent = 0;
  for (const e of expenses) {
    totalSpent += e.amount;
    if (e.paid_by === "G") netG += e.amount;
    netG -= e.split_g;
  }
  netG = Math.round(netG * 100) / 100;

  if (Math.abs(netG) < 0.01) {
    return { netG: 0, owedBy: null, owedTo: null, amount: 0, totalSpent };
  }
  if (netG > 0) {
    return { netG, owedBy: "B", owedTo: "G", amount: netG, totalSpent };
  }
  return { netG, owedBy: "G", owedTo: "B", amount: -netG, totalSpent };
}
