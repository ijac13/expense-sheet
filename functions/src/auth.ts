import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export type AuthResult =
  | { ok: true; email: string }
  | { ok: false; status: number; body: { error: string } };

const UNAUTHORIZED = { ok: false as const, status: 401, body: { error: "unauthorized" } };
const FORBIDDEN = { ok: false as const, status: 403, body: { error: "forbidden" } };
const UNCONFIGURED = {
  ok: false as const,
  status: 500,
  body: { error: "AUTHORIZED_EMAILS not configured" },
};

// A comma-separated list, compared as a set of trimmed lowercase addresses. The
// captain edits this by hand in functions/.env, so padding around an entry and a
// trailing comma both have to mean what they look like.
export function parseAuthorizedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function bearerToken(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

// Not cached in a module-level binding: getAuth() already returns the SDK's own
// per-app instance, and a local cache would survive a test's re-stub of the SDK.
function verifier() {
  if (getApps().length === 0) initializeApp();
  return getAuth();
}

export async function authorize(req: {
  headers?: Record<string, unknown>;
}): Promise<AuthResult> {
  // Fail closed: with no configured list there is no way to tell an authorized
  // caller from a stranger, so nothing passes (Design Decision D3).
  const allowed = parseAuthorizedEmails(process.env.AUTHORIZED_EMAILS);
  if (allowed.length === 0) return UNCONFIGURED;

  const headers = req.headers ?? {};
  const token = bearerToken(headers.authorization ?? headers.Authorization);
  if (!token) return UNAUTHORIZED;

  let decoded: { email?: string; email_verified?: boolean };
  try {
    decoded = await verifier().verifyIdToken(token);
  } catch {
    return UNAUTHORIZED;
  }

  // A credential that verified but cannot be tied to a confirmed address is a
  // known caller who is not authorized — 403, not 401 (D4).
  if (decoded.email_verified !== true) return FORBIDDEN;
  const email = String(decoded.email ?? "").trim().toLowerCase();
  if (!email || !allowed.includes(email)) return FORBIDDEN;

  return { ok: true, email };
}
