import { NextRequest, NextResponse } from "next/server";
import { runChat } from "@/lib/claude";
import { getIdentity } from "@/lib/session";
import { listExpenses } from "@/lib/db";
import { computeBalance } from "@/lib/balance";

export async function POST(req: NextRequest) {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const { reply, pdfReady } = await runChat(message, identity);
    const expenses = await listExpenses();
    return NextResponse.json({
      reply,
      pdfReady,
      expenses,
      balance: computeBalance(expenses),
    });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: "Something went wrong talking to the assistant" }, { status: 500 });
  }
}
