/**
 * 10_helpers.gs
 * =============================================================================
 * Forma Token Studio — Community Design Sharing Backend
 * Shared helpers (auth, logging, ID generation, JSON, row mapping)
 * =============================================================================
 * These functions are used by every other module. Do not delete or rename
 * them. Keep this file in the editor.
 */

/**
 * Generates a short unique ID. Uses a timestamp + random suffix so IDs are
 * sortable by creation time and collision-resistant without external libs.
 * @return {string} An 18-character hex ID.
 */
function generateId() {
  var ts = new Date().getTime().toString(16);
  var rand = Math.floor(Math.random() * 0xffffff).toString(16);
  return (ts + "-" + rand).slice(0, 18);
}

/**
 * Returns the current ISO timestamp string.
 * @return {string} ISO-8601 timestamp.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Validates the incoming request's auth token against the Config tab.
 * Reads the `X-Auth-Token` header (web-app mode) or the `token` field in
 * the request body (direct call mode).
 *
 * @param {Object} e The event object (doGet / doPost).
 * @return {boolean} true if authorised, false otherwise.
 */
function isAuthorized(e) {
  var expected = getConfig("webapp_token");
  if (!expected || expected === "change-this-token") {
    Logger.warn("Auth check skipped: no webapp_token configured in Config.");
    return false;
  }
  var provided = "";
  if (e && e.parameter && e.parameter.token) {
    provided = e.parameter.token;
  } else if (e && e.headers) {
    // Apps Script event headers are lowercased.
    provided = e.headers["x-auth-token"] || e.headers["X-Auth-Token"] || "";
  }
  return provided === expected;
}

/**
 * Appends an entry to the Logs tab. Never throws — logging must not break
 * the request that triggered it.
 *
 * @param {string} action  A short action name (e.g. "design.create").
 * @param {string} actor   Who performed the action ("webapp", "manual", or a user id).
 * @param {string} target  The resource affected (design id, submission id, etc.).
 * @param {string} detail  Optional free-text detail.
 */
function logAction(action, actor, target, detail) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
    sheet.appendRow([
      generateId(),
      nowIso(),
      action,
      actor || "unknown",
      target || "",
      detail || ""
    ]);
  } catch (err) {
    Logger.log("Failed to write log: " + err);
  }
}

/**
 * Parses the request body (JSON or form-encoded) into a plain object.
 * Handles both content types so the web app can accept JSON from fetch()
 * and form posts from testing tools.
 *
 * @param {Object} e The event object.
 * @return {Object} The parsed parameters.
 */
function parseBody(e) {
  if (!e) return {};
  if (e.postData && e.postData.contentType &&
      e.postData.contentType.indexOf("application/json") !== -1) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error("Invalid JSON body: " + err.message);
    }
  }
  return e.parameter || {};
}

/**
 * Serializes a value to a JSON string, returning "" on failure.
 * @param {*} value The value to serialize.
 * @return {string} The JSON string.
 */
function toJson(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return "";
  }
}

/**
 * Deserializes a JSON string, returning null on failure.
 * @param {string} json The JSON string.
 * @return {*} The parsed value, or null.
 */
function fromJson(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

/**
 * Builds a standard JSON response object.
 * @param {boolean} success Whether the operation succeeded.
 * @param {string} message A human-readable message.
 * @param {*} data Optional payload.
 * @return {Object} { success, message, data }
 */
function makeResponse(success, message, data) {
  return {
    success: Boolean(success),
    message: message || "",
    data: data === undefined ? null : data
  };
}

/**
 * Writes a JSON response with the correct content type.
 * @param {Object} obj The object to serialize and return.
 * @return {ContentService.TextOutput} The response.
 */
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Reads all rows from a named sheet as an array of plain objects, keyed by
 * the header names. Skips the header row.
 *
 * @param {string} sheetName The tab name.
 * @return {Object[]} Array of row objects.
 */
function readRows(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = {};
    for (var c = 0; c < headers.length; c++) {
      row[headers[c]] = values[r][c];
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Finds a row in a sheet by a column/value match.
 * @param {string} sheetName The tab name.
 * @param {string} column The column header to match.
 * @param {string} value The value to find.
 * @return {Object|null} The matching row object, or null.
 */
function findRow(sheetName, column, value) {
  var rows = readRows(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][column]) === String(value)) {
      return rows[i];
    }
  }
  return null;
}
