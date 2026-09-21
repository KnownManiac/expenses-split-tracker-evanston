import { NextRequest, NextResponse } from "next/server";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { runChat } from "@/lib/claude";
import { getIdentity } from "@/lib/session";
import { listExpenses } from "@/lib/db";
import { computeBalance } from "@/lib/balance";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5MB raw, safely under Vercel's request body limit

export async function POST(req: NextRequest) {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  const image = body?.image;
  const history = Array.isArray(body?.history) ? (body.history as MessageParam[]) : [];

  if (!message.trim() && !image) {
    return NextResponse.json({ error: "Message or image is required" }, { status: 400 });
  }

  let validatedImage: { mediaType: string; data: string } | undefined;
  if (image) {
    if (
      typeof image.mediaType !== "string" ||
      !ALLOWED_IMAGE_TYPES.includes(image.mediaType) ||
      typeof image.data !== "string" ||
      !image.data.length
    ) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
    if (image.data.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json({ error: "Image is too large" }, { status: 400 });
    }
    validatedImage = { mediaType: image.mediaType, data: image.data };
  }

  try {
    const { reply, pdfReady, history: updatedHistory } = await runChat(
      { text: message, image: validatedImage },
      identity,
      history
    );
    const expenses = await listExpenses();
    return NextResponse.json({
      reply,
      pdfReady,
      expenses,
      balance: computeBalance(expenses),
      history: updatedHistory,
    });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: "Something went wrong talking to the assistant" }, { status: 500 });
  }
}
