/**
 * lib/community.ts
 * =============================================================================
 * Client for the Forma Token Studio community design-sharing backend.
 *
 * The backend is an Apps Script web app (Google Sheets-backed). Its
 * deployment URL is configured via the NEXT_PUBLIC_FORMA_COMMUNITY_API env
 * var at build time. When the variable is absent, the client degrades
 * gracefully: read calls return an empty catalog and write calls throw a
 * clear error, so the app keeps working in local development without the
 * backend.
 */

import type { ThemeDraft } from "@/lib/theme";

/** The Apps Script web-app deployment URL. */
const BASE_URL = (
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_FORMA_COMMUNITY_API
)
  ? String(process.env.NEXT_PUBLIC_FORMA_COMMUNITY_API).replace(/\/$/, "")
  : "";

/** The auth token the backend expects on write requests. */
const AUTH_TOKEN = (
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_FORMA_COMMUNITY_TOKEN
)
  ? String(process.env.NEXT_PUBLIC_FORMA_COMMUNITY_TOKEN)
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
 * Performs a POST request against the community backend with the auth token.
 */
async function post<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!BASE_URL) {
    throw new Error("Community backend is not configured. Set NEXT_PUBLIC_FORMA_COMMUNITY_API.");
  }
  const response = await fetch(`${BASE_URL}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": AUTH_TOKEN,
    },
    body: JSON.stringify({ action, ...payload }),
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
 * Submits a theme for community moderation. Requires the auth token to be
 * configured (NEXT_PUBLIC_FORMA_COMMUNITY_TOKEN).
 */
export async function submitCommunityDesign(params: {
  name: string;
  creator: string;
  description: string;
  tokens: ThemeDraft;
}): Promise<CommunitySubmission> {
  return post<CommunitySubmission>("createSubmission", params);
}
