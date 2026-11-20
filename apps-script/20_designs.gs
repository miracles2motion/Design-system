/**
 * 20_designs.gs
 * =============================================================================
 * Forma Token Studio — Community Design Sharing Backend
 * Design catalog CRUD (create, read, list, update, delete)
 * =============================================================================
 * The "Designs" tab holds approved, published token themes that the frontend
 * fetches to render the community marketplace. Only designs with
 * status = "approved" are exposed to the public list.
 */

/**
 * Creates a new design in the Designs tab.
 *
 * @param {Object} params
 * @param {string} params.name        Design name.
 * @param {string} params.creator     Designer / submitter name.
 * @param {string} params.description Short description.
 * @param {Object} params.tokens      The theme token object (palette,
 *                                    typography, spacing, etc.).
 * @param {string} [params.actor]     Who is calling (for logging).
 * @return {Object} { success, message, data: { id, ... } }
 */
function createDesign(params) {
  try {
    var name = (params.name || "").trim();
    var creator = (params.creator || "anonymous").trim();
    var description = (params.description || "").trim();

    if (!name) {
      return makeResponse(false, "Design name is required.");
    }

    var tokens = params.tokens || {};
    var design = {
      id: generateId(),
      name: name,
      creator: creator,
      description: description,
      status: "approved",
      tokens_json: toJson(tokens),
      created_at: nowIso(),
      updated_at: nowIso()
    };

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DESIGNS);
    sheet.appendRow([
      design.id,
      design.name,
      design.creator,
      design.description,
      design.status,
      design.tokens_json,
      design.created_at,
      design.updated_at
    ]);

    logAction("design.create", params.actor || "webapp", design.id,
        "name=" + design.name);
    return makeResponse(true, "Design created.", design);
  } catch (err) {
    return makeResponse(false, "createDesign error: " + err.message);
  }
}

/**
 * Returns a single design by ID.
 *
 * @param {string} id The design ID.
 * @return {Object} { success, message, data: { id, name, creator, ... tokens } }
 */
function getDesign(id) {
  try {
    var row = findRow(SHEET_DESIGNS, "id", id);
    if (!row) {
      return makeResponse(false, "Design not found.");
    }
    return makeResponse(true, "OK", {
      id: row.id,
      name: row.name,
      creator: row.creator,
      description: row.description,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tokens: fromJson(row.tokens_json)
    });
  } catch (err) {
    return makeResponse(false, "getDesign error: " + err.message);
  }
}

/**
 * Lists approved designs (the public catalog). Returns them newest-first.
 *
 * @param {Object} [params]
 * @param {number} [params.limit] Max results (default 50).
 * @return {Object} { success, message, data: [design, ...] }
 */
function listDesigns(params) {
  try {
    var limit = (params && params.limit) ? Number(params.limit) : 50;
    var rows = readRows(SHEET_DESIGNS)
        .filter(function (r) { return r.status === "approved"; })
        .sort(function (a, b) {
          return String(b.created_at).localeCompare(String(a.created_at));
        })
        .slice(0, limit)
        .map(function (r) {
          return {
            id: r.id,
            name: r.name,
            creator: r.creator,
            description: r.description,
            created_at: r.created_at,
            updated_at: r.updated_at,
            tokens: fromJson(r.tokens_json)
          };
        });
    return makeResponse(true, "OK", rows);
  } catch (err) {
    return makeResponse(false, "listDesigns error: " + err.message);
  }
}

/**
 * Updates an existing design's mutable fields.
 *
 * @param {Object} params
 * @param {string} params.id          The design ID to update.
 * @param {string} [params.name]      New name.
 * @param {string} [params.description] New description.
 * @param {Object} [params.tokens]    New token object.
 * @param {string} [params.actor]     Who is calling.
 * @return {Object} { success, message, data }
 */
function updateDesign(params) {
  try {
    var id = (params.id || "").trim();
    var row = findRow(SHEET_DESIGNS, "id", id);
    if (!row) {
      return makeResponse(false, "Design not found.");
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DESIGNS);
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) === id) { rowIndex = r + 1; break; }
    }
    if (rowIndex < 0) {
      return makeResponse(false, "Design row could not be located.");
    }

    var name = (params.name != null) ? String(params.name).trim() : row.name;
    var description = (params.description != null)
        ? String(params.description).trim() : row.description;
    var tokensJson = (params.tokens != null)
        ? toJson(params.tokens) : row.tokens_json;

    sheet.getRange(rowIndex, 1, 1, DESIGNS_COLUMNS.length).setValues([
      id,
      name,
      row.creator,
      description,
      row.status,
      tokensJson,
      row.created_at,
      nowIso()
    ]);

    logAction("design.update", params.actor || "webapp", id, "fields updated");
    return makeResponse(true, "Design updated.", { id: id, name: name });
  } catch (err) {
    return makeResponse(false, "updateDesign error: " + err.message);
  }
}

/**
 * Deletes a design by ID (removes the row).
 *
 * @param {Object} params
 * @param {string} params.id    The design ID.
 * @param {string} [params.actor]
 * @return {Object} { success, message }
 */
function deleteDesign(params) {
  try {
    var id = (params.id || "").trim();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DESIGNS);
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) === id) {
        sheet.deleteRow(r + 1);
        logAction("design.delete", params.actor || "webapp", id);
        return makeResponse(true, "Design deleted.");
      }
    }
    return makeResponse(false, "Design not found.");
  } catch (err) {
    return makeResponse(false, "deleteDesign error: " + err.message);
  }
}
