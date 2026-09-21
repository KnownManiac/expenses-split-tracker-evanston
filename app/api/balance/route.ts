import { NextResponse } from "next/server";
import { listExpenses } from "@/lib/db";
import { computeBalance } from "@/lib/balance";
import { getIdentity } from "@/lib/session";

export async function GET() {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = await listExpenses();
  return NextResponse.json({ balance: computeBalance(expenses) });
}
