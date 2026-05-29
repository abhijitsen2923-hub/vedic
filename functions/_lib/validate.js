// Tiny input validators. Each returns an array of error strings (empty = ok).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateRegister(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return ["request body must be JSON"];
  }
  const { name, email, password, academy_code } = input;
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("name must be at least 2 characters");
  }
  if (name && name.length > 80) {
    errors.push("name must be at most 80 characters");
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    errors.push("email must be a valid address");
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("password must be at least 6 characters");
  }
  if (password && password.length > 200) {
    errors.push("password is too long");
  }
  if (!academy_code || typeof academy_code !== "string") {
    errors.push("academy_code is required");
  }
  return errors;
}

export function validateLogin(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["request body must be JSON"];
  const { email, password } = input;
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    errors.push("email must be a valid address");
  }
  if (!password || typeof password !== "string") {
    errors.push("password is required");
  }
  return errors;
}

export function validateProfilePatch(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["request body must be JSON"];
  if ("name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 2) {
      errors.push("name must be at least 2 characters");
    }
  }
  if ("phone" in input) {
    if (typeof input.phone !== "string" || input.phone.length > 32) {
      errors.push("phone is invalid");
    }
  }
  return errors;
}

export function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

export function trim(s) {
  return String(s || "").trim();
}

export function avatarInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function newId(prefix) {
  // Crypto-random 12-char base32-ish suffix. Same shape as the Flask app's
  // student_id "STDNT-xxxxx" pattern.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${hex}`;
}
