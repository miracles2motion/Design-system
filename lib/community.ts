/**
 * lib/community.ts
 * =============================================================================
 * Client for the Forma Token Studio community design-sharing backend.
 *
 * SECURITY MODEL:
 * - Reads (listDesigns, getDesign) call the Apps Script backend directly.
 *   Only the backend URL is exposed to the browser via NEXT_PUBLIC_FORMA_COMMUNITY_API
 *   — the URL is not a secret.
 * - Writes (submitCommunityDesign) route through the server-side proxy at
 *   /api/community/submit, which injects the auth token server-side. The
 *   token NEVER reaches the browser.
 * - Moderation (listSubmissions, approveSubmission, rejectSubmission) routes
 *   through the server-side proxy at /api/community/moderation, which checks
 *   the moderator password and injects the token server-side. Neither the
 *   token nor the password reaches the browser.
 *
 * When the backend URL is not configured, read calls return an empty catalog
 * and write calls throw a clear error, so the app keeps working in local
 * development without the backend.
 */

import type { ThemeDraft } from "@/lib/theme";

/** The Apps Script web-app deployment URL (exposed to browser — not a secret). */
const BASE_URL = (
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_FORMA_COMMUNITY_API
)
  ? String(process.env.NEXT_PUBLIC_FORMA_COMMUNITY_API).replace(/\/$/, "")
  : "";

/** True when the backend base URL is configured. */
export function isCommunityBackendConfigured(): boolean {
  return BASE_URL.length > 0;
}

interface CommunityApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** A community design as returned by the backend. */
export interface CommunityDesign {
  id: string;
  name: string;
  creator: string;
  description: string;
  created_at: string;
  updated_at: string;
  tokens: ThemeDraft;
}

/** A pending submission as returned by the backend. */
export interface CommunitySubmission {
  id: string;
  name: string;
  creator: string;
  description: string;
  status: string;
  submitted_at: string;
  reviewed_at: string;
  review_note: string;
  tokens: ThemeDraft;
}

/**
 * Performs a GET request against the community backend.
 * Reads are public — no auth token is needed.
 */
async function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  if (!BASE_URL) {
    throw new Error("Community backend is not configured. Set NEXT_PUBLIC_FORMA_COMMUNITY_API.");
  }
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`${BASE_URL}/exec?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Community backend returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CommunityApiResponse<T>;
  if (!body.success) {
    throw new Error(body.message || "Community backend request failed.");
  }
  return body.data;
}

/**
 * Lists approved community designs from the catalog. Returns an empty array
 * when the backend is not configured.
 */
export async function listCommunityDesigns(limit = 50): Promise<CommunityDesign[]> {
  try {
    return await get<CommunityDesign[]>("listDesigns", { limit: String(limit) });
  } catch {
    return [];
  }
}

/**
 * Fetches a single community design by ID.
 */
export async function getCommunityDesign(id: string): Promise<CommunityDesign | null> {
  try {
    return await get<CommunityDesign | null>("getDesign", { id });
  } catch {
    return null;
  }
}

/**
 * Submits a theme for community moderation. Routes through the server-side
 * proxy at /api/community/submit, which injects the auth token server-side.
 * The token never reaches the browser.
 */
export async function submitCommunityDesign(params: {
  name: string;
  creator: string;
  description: string;
  tokens: ThemeDraft;
}): Promise<CommunitySubmission> {
  const response = await fetch("/api/community/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Submit proxy returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CommunityApiResponse<CommunitySubmission>;
  if (!body.success) {
    throw new Error(body.message || "Community backend request failed.");
  }
  return body.data;
}

/**
 * Fetches pending submissions for the moderation queue. Routes through the
 * server-side proxy at /api/community/moderation, which checks the moderator
 * password before returning data.
 */
export async function fetchPendingSubmissions(password: string): Promise<CommunitySubmission[]> {
  const response = await fetch("/api/community/moderation", {
    headers: { "x-moderation-password": password },
  });
  if (response.status === 401) {
    throw new Error("Invalid moderator password.");
  }
  if (!response.ok) {
    throw new Error(`Moderation proxy returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CommunityApiResponse<CommunitySubmission[]>;
  if (!body.success) {
    throw new Error(body.message || "Failed to fetch pending submissions.");
  }
  return body.data;
}

/**
 * Approves a submission via the moderation proxy. Approved designs are
 * copied into the Designs catalog automatically.
 */
export async function approveSubmission(password: string, id: string, note?: string): Promise<void> {
  const response = await fetch("/api/community/moderation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-moderation-password": password,
    },
    body: JSON.stringify({ action: "approve", id, note }),
  });
  if (response.status === 401) {
    throw new Error("Invalid moderator password.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Approve returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CommunityApiResponse<unknown>;
  if (!body.success) {
    throw new Error(body.message || "Approve failed.");
  }
}

/**
 * Rejects a submission via the moderation proxy.
 */
export async function rejectSubmission(password: string, id: string, note: string): Promise<void> {
  const response = await fetch("/api/community/moderation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-moderation-password": password,
    },
    body: JSON.stringify({ action: "reject", id, note }),
  });
  if (response.status === 401) {
    throw new Error("Invalid moderator password.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Reject returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CommunityApiResponse<unknown>;
  if (!body.success) {
    throw new Error(body.message || "Reject failed.");
  }
}
