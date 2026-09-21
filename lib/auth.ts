import { SignJWT, jwtVerify } from "jose";
import type { Identity } from "./types";

export const SESSION_COOKIE = "session";
export type { Identity };

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(identity: Identity): Promise<string> {
  return new SignJWT({ identity })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<Identity | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.identity === "G" || payload.identity === "B") {
      return payload.identity;
    }
    return null;
  } catch {
    return null;
  }
}
