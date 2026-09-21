export type Identity = "G" | "B";
export type SplitType = "equal" | "percentage" | "manual";

export interface Expense {
  id: number;
  description: string;
  amount: number;
  paid_by: Identity;
  split_type: SplitType;
  split_g: number;
  split_b: number;
  expense_date: string;
  created_at: string;
}

export interface Balance {
  netG: number;
  owedBy: Identity | null;
  owedTo: Identity | null;
  amount: number;
  totalSpent: number;
}
