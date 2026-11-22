/**
 * app/api/community/submit/route.ts
 * =============================================================================
 * Proxy for public community design submissions.
 *
 * Submissions go through the Apps Script public doGet endpoint. There is
 * no auth token required — submissions land in the moderation queue and
 * only appear in the marketplace after a moderator approves them.
 */

import { NextRequest, NextResponse } from "next/server";

/** The Apps Script web-app deployment URL (server-side). */
const COMMUNITY_API =
  (process.env.FORMA_COMMUNITY_API ?? process.env.NEXT_PUBLIC_FORMA_COMMUNITY_API)?.replace(/\/$/, "") ?? "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handles POST requests to submit a community design.
 * Forwarded to Apps Script's public doGet endpoint — no token required.
 * Submissions are gated by the moderation queue, not by auth.
 */
export async function POST(request: NextRequest) {
  if (!COMMUNITY_API) {
    return NextResponse.json(
      { success: false, message: "Community backend is not configured. Set NEXT_PUBLIC_FORMA_COMMUNITY_API." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();

    // tokens can be an object or array — stringify for query string transport.
    const tokensStr = typeof body.tokens === "string" ? body.tokens : JSON.stringify(body.tokens ?? []);

    const queryString = new URLSearchParams({
      action: "createSubmission",
      name: String(body.name ?? ""),
      creator: String(body.creator ?? ""),
      description: String(body.description ?? ""),
      tokens: tokensStr,
    }).toString();

    const response = await fetch(`${COMMUNITY_API}/exec?${queryString}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Backend returned HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log(`[submit-proxy] action=createSubmission | http=${response.status} | success=${data.success} | message=${data.message || "(none)"}`);
    return NextResponse.json(data);
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
