import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, type Identity } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const pin = body?.pin;
  const identity = body?.identity as Identity | undefined;

  if (identity !== "G" && identity !== "B") {
    return NextResponse.json({ error: "Choose G or B" }, { status: 400 });
  }
  if (typeof pin !== "string" || pin !== process.env.APP_PIN) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const token = await createSessionToken(identity);
  const response = NextResponse.json({ ok: true, identity });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
