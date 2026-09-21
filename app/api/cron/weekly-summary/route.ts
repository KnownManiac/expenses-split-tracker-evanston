import { NextRequest, NextResponse } from "next/server";
import { listExpenses } from "@/lib/db";
import { computeBalance } from "@/lib/balance";
import { sendWeeklySummaryEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expenses = await listExpenses();
    const balance = computeBalance(expenses);
    await sendWeeklySummaryEmail(expenses, balance);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("weekly summary email failed", err);
    return NextResponse.json({ error: "Failed to send weekly summary" }, { status: 500 });
  }
}
