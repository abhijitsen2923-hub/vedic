// Single source of truth for talking to /api/* from the portal frontend.
// - All requests are same-origin and rely on the iva_token httpOnly cookie.
// - Writes carry the X-IVA-Client header to satisfy the CSRF gate in Functions.
// - 401 from a protected endpoint redirects to /portal/login.html (unless we're already there).

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (!SAFE_METHODS.has(method)) headers["X-IVA-Client"] = "portal";

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch (err) {
    throw new Error("Network error. Please check your connection.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON response — leave data empty */
  }

  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    if (!location.pathname.endsWith("/portal/login.html")) {
      location.href = "/portal/login.html";
    }
  }

  if (!res.ok) {
    const msg = data.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data.code;
    err.details = data.details;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (payload) =>
    request("/api/auth/register", { method: "POST", body: payload }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
};

// Helper for protected pages to enforce auth client-side.
// Server is still the source of truth — this just avoids a flash of empty page.
export async function requireAuth() {
  try {
    const data = await api.me();
    return data.student;
  } catch (err) {
    if (err.status === 401) location.href = "/portal/login.html";
    throw err;
  }
}
