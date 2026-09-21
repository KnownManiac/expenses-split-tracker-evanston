import { NextRequest, NextResponse } from "next/server";
import { createExpense, listExpenses } from "@/lib/db";
import { getIdentity } from "@/lib/session";

export async function GET() {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = await listExpenses();
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.description !== "string" || typeof body.amount !== "number") {
    return NextResponse.json({ error: "Invalid expense payload" }, { status: 400 });
  }

  const expense = await createExpense({
    description: body.description,
    amount: body.amount,
    paid_by: body.paid_by,
    split_type: body.split_type,
    split_g: body.split_g,
    split_b: body.split_b,
    expense_date: body.expense_date,
  });
  return NextResponse.json({ expense });
}
