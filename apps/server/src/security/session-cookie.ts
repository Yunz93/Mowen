import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE = "mowen_session";

const sessions = new Set<string>();

export function createSessionToken(): string {
  const token = randomBytes(32).toString("hex");
  sessions.add(token);
  return token;
}

export function hasSession(token: string | undefined): boolean {
  return Boolean(token && sessions.has(token));
}

export function ensureSessionCookie(request: FastifyRequest, reply: FastifyReply): string {
  const existing = request.cookies[SESSION_COOKIE];
  if (existing && sessions.has(existing)) {
    return existing;
  }
  const token = createSessionToken();
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: false,
  });
  return token;
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE}=`)) {
      return part.slice(SESSION_COOKIE.length + 1);
    }
  }
  return undefined;
}
