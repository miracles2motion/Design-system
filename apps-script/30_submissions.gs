/**
 * 30_submissions.gs
 * =============================================================================
 * Forma Token Studio — Community Design Sharing Backend
 * Submission queue and moderation (approve / reject)
 * =============================================================================
 * The "Submissions" tab is the moderation queue. Community members submit
 * designs here; they stay "pending" until a moderator approves or rejects
 * them. Approving a submission copies it into the Designs catalog.
 */

/**
 * Creates a new submission in the moderation queue.
 *
 * @param {Object} params
 * @param {string} params.name        Design name.
 * @param {string} params.creator     Submitter name.
 * @param {string} params.description Short description.
 * @param {Object} params.tokens      The theme token object.
 * @param {string} [params.actor]     Who is calling (for logging).
 * @return {Object} { success, message, data: { id, status: "pending", ... } }
 */
function createSubmission(params) {
  try {
    var name = (params.name || "").trim();
    var creator = (params.creator || "anonymous").trim();

    if (!name) {
      return makeResponse(false, "Submission name is required.");
    }

    var submission = {
      id: generateId(),
      name: name,
      creator: creator,
      description: (params.description || "").trim(),
      tokens_json: toJson(params.tokens || {}),
      status: "pending",
      submitted_at: nowIso(),
      reviewed_at: "",
      review_note: ""
    };

    var sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(SHEET_SUBMISSIONS);
    sheet.appendRow([
      submission.id,
      submission.name,
      submission.creator,
      submission.description,
      submission.tokens_json,
      submission.status,
      submission.submitted_at,
      submission.reviewed_at,
      submission.review_note
    ]);

    logAction("submission.create", params.actor || "webapp", submission.id,
        "name=" + submission.name);
    return makeResponse(true, "Submission created.", submission);
  } catch (err) {
    return makeResponse(false, "createSubmission error: " + err.message);
  }
}

/**
 * Lists submissions, optionally filtered by status. Newest-first.
 *
 * @param {Object} [params]
 * @param {string} [params.status]  "pending", "approved", "rejected", or omit for all.
 * @param {number} [params.limit]   Max results (default 50).
 * @return {Object} { success, message, data: [submission, ...] }
 */
function listSubmissions(params) {
  try {
    var statusFilter = (params && params.status) ? String(params.status) : null;
    var limit = (params && params.limit) ? Number(params.limit) : 50;

    var rows = readRows(SHEET_SUBMISSIONS)
        .filter(function (r) {
          return !statusFilter || r.status === statusFilter;
        })
        .sort(function (a, b) {
          return String(b.submitted_at).localeCompare(String(a.submitted_at));
        })
        .slice(0, limit)
        .map(function (r) {
          return {
            id: r.id,
            name: r.name,
            creator: r.creator,
            description: r.description,
            status: r.status,
            submitted_at: r.submitted_at,
            reviewed_at: r.reviewed_at,
            review_note: r.review_note,
            tokens: fromJson(r.tokens_json)
          };
        });
    return makeResponse(true, "OK", rows);
  } catch (err) {
    return makeResponse(false, "listSubmissions error: " + err.message);
  }
}

/**
 * Approves a pending submission: marks it approved and copies it into the
 * Designs catalog so it becomes part of the public marketplace.
 *
 * @param {Object} params
 * @param {string} params.id       The submission ID.
 * @param {string} [params.note]   Optional review note.
 * @param {string} [params.actor]  Who is approving.
 * @return {Object} { success, message, data: { submissionId, designId } }
 */
function approveSubmission(params) {
  try {
    var id = (params.id || "").trim();
    var row = findRow(SHEET_SUBMISSIONS, "id", id);
    if (!row) {
      return makeResponse(false, "Submission not found.");
    }
    if (row.status === "approved") {
      return makeResponse(false, "Submission is already approved.");
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(SHEET_SUBMISSIONS);
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) === id) { rowIndex = r + 1; break; }
    }

    var reviewedAt = nowIso();
    sheet.getRange(rowIndex, 6, 1, 1).setValue("approved");
    sheet.getRange(rowIndex, 8, 1, 1).setValue(reviewedAt);
    sheet.getRange(rowIndex, 9, 1, 1).setValue(params.note || "");

    // Copy into the Designs catalog as a new approved design.
    var createResult = createDesign({
      name: row.name,
      creator: row.creator,
      description: row.description,
      tokens: fromJson(row.tokens_json),
      actor: params.actor || "moderation"
    });

    var designId = createResult.data ? createResult.data.id : null;
    logAction("submission.approve", params.actor || "moderation", id,
        "design_id=" + designId);
    return makeResponse(true, "Submission approved and published.",
        { submissionId: id, designId: designId });
  } catch (err) {
    return makeResponse(false, "approveSubmission error: " + err.message);
  }
}

/**
 * Rejects a pending submission: marks it rejected with a note. Does not
 * delete the row so the moderation history is preserved.
 *
 * @param {Object} params
 * @param {string} params.id       The submission ID.
 * @param {string} params.note     Rejection reason.
 * @param {string} [params.actor]  Who is rejecting.
 * @return {Object} { success, message }
 */
function rejectSubmission(params) {
  try {
    var id = (params.id || "").trim();
    var sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(SHEET_SUBMISSIONS);
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) === id) {
        sheet.getRange(r + 1, 6, 1, 1).setValue("rejected");
        sheet.getRange(r + 1, 8, 1, 1).setValue(nowIso());
        sheet.getRange(r + 1, 9, 1, 1).setValue(params.note || "");
        logAction("submission.reject", params.actor || "moderation", id,
            params.note || "");
        return makeResponse(true, "Submission rejected.");
      }
    }
    return makeResponse(false, "Submission not found.");
  } catch (err) {
    return makeResponse(false, "rejectSubmission error: " + err.message);
  }
}
