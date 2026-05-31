// Auth helpers for Cloudflare Pages Functions.
// - JWT issue/verify via `jose` (HS256, same shape as the prior Flask app: { sub, iat, exp }).
// - Password hash/verify via `bcryptjs` (pure JS; validates existing bcrypt hashes unchanged).
// - Cookie helpers: read/set/clear the `iva_token` httpOnly cookie.

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

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

// --- Password hashing: PBKDF2 via Web Crypto (native, fast in Workers) ---
// New hashes use the format  pbkdf2$<iterations>$<saltB64>$<hashB64>.
// Legacy bcrypt hashes ($2a/$2b/$2y$...) are still VERIFIED via bcryptjs so
// existing rows keep working; they upgrade to PBKDF2 whenever the password is reset.
const PBKDF2_ITERS = 100000;
const PBKDF2_KEYLEN = 32; // bytes (256-bit)

function bytesToB64(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2Bits(plain, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    PBKDF2_KEYLEN * 8,
  );
  return new Uint8Array(bits);
}

// Constant-time string compare (avoids leaking match position via timing).
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2Bits(plain, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToB64(salt)}$${bytesToB64(bits)}`;
}

export async function comparePassword(plain, hash) {
  if (!hash) return false;
  if (hash.startsWith("pbkdf2$")) {
    const parts = hash.split("$");
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    const salt = b64ToBytes(parts[2]);
    const bits = await pbkdf2Bits(plain, salt, iterations);
    return timingSafeEqual(bytesToB64(bits), parts[3]);
  }
  // Legacy bcrypt verification (pre-PBKDF2 rows).
  return bcrypt.compare(plain, hash);
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
