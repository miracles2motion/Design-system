/**
 * 40_webapp.gs
 * =============================================================================
 * Forma Token Studio — Community Design Sharing Backend
 * Web App entry points (doGet / doPost)
 * =============================================================================
 * This is the HTTP surface the Forma Token Studio frontend calls. Deploy the
 * script as a web app (Execute as: Me · Who has access: Anyone) and copy the
 * deployment URL. The frontend sends all requests as JSON with the auth
 * token in the `X-Auth-Token` header.
 *
 * Endpoints (all JSON, POST unless noted):
 *   GET  /?action=listDesigns              → public catalog (no auth)
 *   GET  /?action=getDesign&id=…           → single design (no auth)
 *   POST /?action=createDesign             → create (auth required)
 *   POST /?action=updateDesign             → update (auth required)
 *   POST /?action=deleteDesign             → delete (auth required)
 *   POST /?action=createSubmission         → submit for moderation (auth)
 *   GET  /?action=listSubmissions         → list queue (no auth, or auth)
 *   POST /?action=approveSubmission       → approve (auth required)
 *   POST /?action=rejectSubmission        → reject (auth required)
 */

/**
 * Handles GET requests. Public read endpoints are served without auth;
 * write actions always go through doPost.
 *
 * @param {Object} e The event object.
 * @return {ContentService.TextOutput} JSON response.
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || "";

  try {
    switch (action) {
      case "listDesigns":
        return jsonOutput(listDesigns({ limit: params.limit }));

      case "getDesign":
        return jsonOutput(getDesign(params.id));

      case "listSubmissions":
        return jsonOutput(listSubmissions({
          status: params.status,
          limit: params.limit
        }));

      case "createSubmission":
        return jsonOutput(createSubmission({
          name: params.name,
          creator: params.creator,
          description: params.description,
          tokens: typeof params.tokens === "string" ? JSON.parse(params.tokens) : params.tokens,
          actor: "public"
        }));

      case "approveSubmission":
        return jsonOutput(approveSubmission({
          id: params.id,
          note: params.note,
          actor: "moderation"
        }));

      case "rejectSubmission":
        return jsonOutput(rejectSubmission({
          id: params.id,
          note: params.note,
          actor: "moderation"
        }));

      case "health":
        return jsonOutput(makeResponse(true, "OK", {
          service: "forma-token-studio",
          time: nowIso()
        }));

      default:
        return jsonOutput(makeResponse(false,
            "Unknown action or missing action param. " +
            "Supported: listDesigns, getDesign, listSubmissions, " +
            "createSubmission, approveSubmission, rejectSubmission, health."));
    }
  } catch (err) {
    return jsonOutput(makeResponse(false, "doGet error: " + err.message));
  }
}

/**
 * Handles POST requests. All write actions require auth via the
 * X-Auth-Token header or a token field in the body.
 *
 * @param {Object} e The event object.
 * @return {ContentService.TextOutput} JSON response.
 */
function doPost(e) {
  var body = parseBody(e);
  var action = body.action || "";

  // createSubmission is public — no auth required. Submissions are gated
  // by the moderation queue, not by auth. The tokens payload is too large
  // for a URL query string, so this action must accept a POST body.
  if (action !== "createSubmission" && !isAuthorized(e)) {
    return jsonOutput(makeResponse(false, "Unauthorized: invalid or missing token."));
  }

  try {
    switch (action) {
      case "createDesign":
        return jsonOutput(createDesign({
          name: body.name,
          creator: body.creator,
          description: body.description,
          tokens: body.tokens,
          actor: body.actor
        }));

      case "updateDesign":
        return jsonOutput(updateDesign({
          id: body.id,
          name: body.name,
          description: body.description,
          tokens: body.tokens,
          actor: body.actor
        }));

      case "deleteDesign":
        return jsonOutput(deleteDesign({
          id: body.id,
          actor: body.actor
        }));

      case "listSubmissions":
        return jsonOutput(listSubmissions({
          status: body.status,
          limit: body.limit
        }));

      case "createSubmission":
        return jsonOutput(createSubmission({
          name: body.name,
          creator: body.creator,
          description: body.description,
          tokens: body.tokens,
          actor: body.actor
        }));

      case "approveSubmission":
        return jsonOutput(approveSubmission({
          id: body.id,
          note: body.note,
          actor: body.actor
        }));

      case "rejectSubmission":
        return jsonOutput(rejectSubmission({
          id: body.id,
          note: body.note,
          actor: body.actor
        }));

      default:
        return jsonOutput(makeResponse(false,
            "Unknown action or missing action param. " +
            "Supported: createDesign, updateDesign, deleteDesign, " +
            "listSubmissions, createSubmission, approveSubmission, rejectSubmission."));
    }
  } catch (err) {
    return jsonOutput(makeResponse(false, "doPost error: " + err.message));
  }
}

/**
 * Adds a custom menu to the spreadsheet so you can run common operations
 * manually from the sheet UI without the editor. Apps Script runs this on
 * open automatically.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Forma Backend")
      .addItem("Setup sheets", "setupSheets")
      .addSeparator()
      .addItem("List approved designs", "showDesignsInLog")
      .addItem("List pending submissions", "showPendingInLog")
      .addToUi();
}

/** Quick manual log of the approved design catalog. */
function showDesignsInLog() {
  var result = listDesigns({ limit: 100 });
  Logger.log("Approved designs (%d):", result.data.length);
  result.data.forEach(function (d) {
    Logger.log("  %s — %s by %s", d.id, d.name, d.creator);
  });
}

/** Quick manual log of pending submissions. */
function showPendingInLog() {
  var result = listSubmissions({ status: "pending", limit: 100 });
  Logger.log("Pending submissions (%d):", result.data.length);
  result.data.forEach(function (s) {
    Logger.log("  %s — %s by %s", s.id, s.name, s.creator);
  });
}
