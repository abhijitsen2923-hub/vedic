// Auth helpers for the Worker.
// - JWT issue/verify via `jose` (HS256). Cookie shape: `iva_token`.
// - Passwords are stored as PLAINTEXT in the Google Sheet's `password` column.
//   Login does a direct equality check (see functions/api/auth/login.js).
//   This is an explicit owner choice for sheet-edit simplicity. If we ever
//   re-introduce hashing, the comparison lives in one place (login.js) and
//   any salt/iterations helpers would land back here.

import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "iva_token";

function getJwtKey(env) {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export async function issueToken(env, studentId) {
  const expHours = Number(env.JWT_EXP_HOURS || "24");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(studentId)
    .setIssuedAt(now)
    .setExpirationTime(now + expHours * 3600)
    .sign(getJwtKey(env));
}

export async function verifyToken(env, token) {
  try {
    const { payload } = await jwtVerify(token, getJwtKey(env), {
      algorithms: ["HS256"],
    });
    return payload; // { sub, iat, exp }
  } catch {
    return null;
  }
}

// Constant-time string compare (avoids leaking match position via timing).
// Used by login.js to compare submitted password to the sheet's `password` cell.
export function timingSafeEqual(a, b) {
  const aStr = String(a == null ? "" : a);
  const bStr = String(b == null ? "" : b);
  if (aStr.length !== bStr.length) return false;
  let diff = 0;
  for (let i = 0; i < aStr.length; i++) diff |= aStr.charCodeAt(i) ^ bStr.charCodeAt(i);
  return diff === 0;
}

// --- Cookie helpers ---

export function buildAuthCookie(token, env) {
  const expHours = Number(env.JWT_EXP_HOURS || "24");
  const maxAge = expHours * 3600;
  // Production should be HTTPS (Pages enforces). In `wrangler pages dev` (HTTP),
  // the Secure flag prevents the cookie from sticking — we drop it locally.
  const secure = (env.ENVIRONMENT || "production") === "production" ? "Secure; " : "";
  return `${COOKIE_NAME}=${token}; ${secure}HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function buildClearCookie(env) {
  const secure = (env.ENVIRONMENT || "production") === "production" ? "Secure; " : "";
  return `${COOKIE_NAME}=; ${secure}HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readAuthCookie(request) {
  const header = request.headers.get("Cookie") || "";
  const target = COOKIE_NAME + "=";
  for (const part of header.split(/;\s*/)) {
    if (part.startsWith(target)) return part.slice(target.length);
  }
  return null;
}

// Convenience: read + verify; returns student_id or null.
export async function studentIdFromRequest(env, request) {
  const token = readAuthCookie(request);
  if (!token) return null;
  const payload = await verifyToken(env, token);
  return payload?.sub || null;
}

// JSON response helpers with the project's standard error/success shape.
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export function error(message, status = 400, code) {
  const body = code ? { error: message, code } : { error: message };
  return json(body, { status });
}

// CSRF gate for unsafe methods. Requires the X-IVA-Client header on writes.
export function requireClientHeader(request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  const h = request.headers.get("X-IVA-Client");
  if (h !== "portal") return error("Missing client header", 403, "csrf");
  return null;
}
