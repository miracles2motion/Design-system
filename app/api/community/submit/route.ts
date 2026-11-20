/**
 * app/api/community/submit/route.ts
 * =============================================================================
 * Proxy for public community design submissions.
 *
 * This route holds the auth token server-side and injects it into the
 * Apps Script request. The token never reaches the browser. Anyone can
 * call this endpoint to submit a design — submissions still go through
 * the moderation queue before appearing in the marketplace.
 */

import { NextRequest, NextResponse } from "next/server";

/** The Apps Script web-app deployment URL (server-side only). */
const COMMUNITY_API = process.env.FORMA_COMMUNITY_API?.replace(/\/$/, "") ?? "";

/** The auth token for write operations (server-side only, never exposed). */
const AUTH_TOKEN = process.env.FORMA_COMMUNITY_TOKEN ?? "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handles POST requests to submit a community design.
 * Injects the auth token server-side before forwarding to Apps Script.
 */
export async function POST(request: NextRequest) {
  if (!COMMUNITY_API) {
    return NextResponse.json(
      { success: false, message: "Community backend is not configured." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const action = "createSubmission";

    const response = await fetch(`${COMMUNITY_API}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        token: AUTH_TOKEN,
        name: body.name,
        creator: body.creator,
        description: body.description,
        tokens: body.tokens,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Backend returned HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
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
