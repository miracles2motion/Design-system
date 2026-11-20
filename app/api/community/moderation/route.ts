/**
 * app/api/community/moderation/route.ts
 * =============================================================================
 * Proxy for the moderation queue. All access is gated by a moderator
 * password checked server-side. The auth token is injected here too, so
 * neither the token nor the password ever reaches the browser.
 *
 * Actions:
 *   GET  ?action=list  → returns pending submissions
 *   POST { action: "approve", id, note } → approves and publishes
 *   POST { action: "reject", id, note } → rejects with a note
 */

import { NextRequest, NextResponse } from "next/server";

/** The Apps Script web-app deployment URL (server-side only). */
const COMMUNITY_API = process.env.FORMA_COMMUNITY_API?.replace(/\/$/, "") ?? "";

/** The auth token for write operations (server-side only, never exposed). */
const AUTH_TOKEN = process.env.FORMA_COMMUNITY_TOKEN ?? "";

/** The moderator password (server-side only, never exposed). */
const MODERATOR_PASSWORD = process.env.FORMA_MODERATOR_PASSWORD ?? "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compares the provided password against the server-side env var using a
 * constant-time comparison to avoid timing attacks.
 */
function isPasswordValid(provided: string): boolean {
  if (!MODERATOR_PASSWORD) return false;
  if (provided.length !== MODERATOR_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ MODERATOR_PASSWORD.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Forward a request to the Apps Script backend with the auth token injected
 * into the POST body (Apps Script web apps do not reliably pass custom
 * HTTP headers through to the event object).
 */
async function forwardToBackend(
  action: string,
  payload: Record<string, unknown> = {},
) {
  if (!COMMUNITY_API) {
    return { success: false, message: "Community backend is not configured." };
  }

  const response = await fetch(`${COMMUNITY_API}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, token: AUTH_TOKEN, ...payload }),
  });

  if (!response.ok) {
    return { success: false, message: `Backend returned HTTP ${response.status}` };
  }

  return await response.json();
}

/**
 * GET handler — lists pending submissions for the moderation queue.
 */
export async function GET(request: NextRequest) {
  const password = request.headers.get("x-moderation-password") ?? "";

  if (!isPasswordValid(password)) {
    return NextResponse.json(
      { success: false, message: "Invalid or missing moderator password." },
      { status: 401 },
    );
  }

  try {
    const result = await forwardToBackend("listSubmissions", { status: "pending", limit: 100 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to reach community backend.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST handler — approve or reject a submission.
 */
export async function POST(request: NextRequest) {
  const password = request.headers.get("x-moderation-password") ?? "";

  if (!isPasswordValid(password)) {
    return NextResponse.json(
      { success: false, message: "Invalid or missing moderator password." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { action, id, note } = body;

    if (action === "approve") {
      const result = await forwardToBackend("approveSubmission", { id, note });
      return NextResponse.json(result);
    }

    if (action === "reject") {
      const result = await forwardToBackend("rejectSubmission", { id, note });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, message: "Unknown action. Use 'approve' or 'reject'." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to reach community backend.",
      },
      { status: 500 },
    );
  }
}
