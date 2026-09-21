import { Pool } from "pg";
import type { Expense, Identity, SplitType } from "./types";

export type { Expense, Identity, SplitType };

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!connectionString) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) environment variable is not set");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

const SELECT_COLUMNS = `
  id, description, amount::float8 as amount, paid_by, split_type,
  split_g::float8 as split_g, split_b::float8 as split_b,
  expense_date::text as expense_date, created_at::text as created_at
`;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          description TEXT NOT NULL,
          amount NUMERIC(10, 2) NOT NULL,
          paid_by TEXT NOT NULL CHECK (paid_by IN ('G', 'B')),
          split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'percentage', 'manual')),
          split_g NUMERIC(10, 2) NOT NULL,
          split_b NUMERIC(10, 2) NOT NULL,
          expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );`
      )
      .then(() => undefined);
  }
  return schemaReady;
}

function computeSplit(
  amount: number,
  splitType: SplitType,
  splitG?: number,
  splitB?: number
): { split_g: number; split_b: number } {
  if (splitType === "equal") {
    const half = Math.round((amount / 2) * 100) / 100;
    return { split_g: half, split_b: Math.round((amount - half) * 100) / 100 };
  }
  if (splitType === "percentage") {
    const pctG = splitG ?? 50;
    const pctB = splitB ?? 100 - pctG;
    return {
      split_g: Math.round(((amount * pctG) / 100) * 100) / 100,
      split_b: Math.round(((amount * pctB) / 100) * 100) / 100,
    };
  }
  // manual
  return {
    split_g: Math.round((splitG ?? 0) * 100) / 100,
    split_b: Math.round((splitB ?? 0) * 100) / 100,
  };
}

export interface CreateExpenseInput {
  description: string;
  amount: number;
  paid_by: Identity;
  split_type: SplitType;
  split_g?: number;
  split_b?: number;
  expense_date?: string;
}

export async function listExpenses(): Promise<Expense[]> {
  await ensureSchema();
  const { rows } = await getPool().query<Expense>(
    `SELECT ${SELECT_COLUMNS} FROM expenses ORDER BY expense_date DESC, id DESC;`
  );
  return rows;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  await ensureSchema();
  const { split_g, split_b } = computeSplit(
    input.amount,
    input.split_type,
    input.split_g,
    input.split_b
  );
  const date = input.expense_date ?? new Date().toISOString().slice(0, 10);
  const { rows } = await getPool().query<Expense>(
    `INSERT INTO expenses (description, amount, paid_by, split_type, split_g, split_b, expense_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SELECT_COLUMNS};`,
    [input.description, input.amount, input.paid_by, input.split_type, split_g, split_b, date]
  );
  return rows[0];
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  paid_by?: Identity;
  split_type?: SplitType;
  split_g?: number;
  split_b?: number;
  expense_date?: string;
}

export async function updateExpense(
  id: number,
  input: UpdateExpenseInput
): Promise<Expense | null> {
  await ensureSchema();
  const { rows: existingRows } = await getPool().query<Expense>(
    `SELECT ${SELECT_COLUMNS} FROM expenses WHERE id = $1;`,
    [id]
  );
  const existing = existingRows[0];
  if (!existing) return null;

  const merged = { ...existing, ...input };
  const { split_g, split_b } =
    input.split_type || input.amount !== undefined || input.split_g !== undefined || input.split_b !== undefined
      ? computeSplit(merged.amount, merged.split_type, merged.split_g, merged.split_b)
      : { split_g: existing.split_g, split_b: existing.split_b };

  const { rows } = await getPool().query<Expense>(
    `UPDATE expenses SET
       description = $1,
       amount = $2,
       paid_by = $3,
       split_type = $4,
       split_g = $5,
       split_b = $6,
       expense_date = $7
     WHERE id = $8
     RETURNING ${SELECT_COLUMNS};`,
    [merged.description, merged.amount, merged.paid_by, merged.split_type, split_g, split_b, merged.expense_date, id]
  );
  return rows[0];
}

export async function deleteExpense(id: number): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(`DELETE FROM expenses WHERE id = $1;`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function getExpense(id: number): Promise<Expense | null> {
  await ensureSchema();
  const { rows } = await getPool().query<Expense>(
    `SELECT ${SELECT_COLUMNS} FROM expenses WHERE id = $1;`,
    [id]
  );
  return rows[0] ?? null;
}
