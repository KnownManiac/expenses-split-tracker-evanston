import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type Identity } from "./auth";

export async function getIdentity(): Promise<Identity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
