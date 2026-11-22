/**
 * app/api/community/submit/route.ts
 * =============================================================================
 * Proxy for public community design submissions.
 *
 * Submissions go through Apps Script's doPost endpoint. createSubmission is
 * a public action — no auth token required — because submissions are gated
 * by the moderation queue, not by auth. The tokens payload is sent in the
 * POST body (not the URL) to avoid Apps Script's URL length limit.
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

    const response = await fetch(`${COMMUNITY_API}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        action: "createSubmission",
        name: body.name,
        creator: body.creator,
        description: body.description,
        tokens: body.tokens ?? {},
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.log(`[submit-proxy] action=createSubmission | http=${response.status} | errorBody=${errorBody.slice(0, 200)}`);
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
