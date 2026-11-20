/**
 * 00_setup.gs
 * =============================================================================
 * Forma Token Studio — Community Design Sharing Backend
 * Sheet Setup Module
 * =============================================================================
 * Run the `setupSheets()` function ONCE from the Apps Script editor to create
 * the spreadsheet structure. It is safe to re-run: it only creates what is
 * missing and never overwrites existing data.
 *
 * After running, the spreadsheet will have four tabs:
 *   - Designs       : the published design catalog (approved themes)
 *   - Submissions   : the moderation queue (pending community submissions)
 *   - Logs          : an append-only audit log of every action
 *   - Config        : key/value configuration (web-app auth token, etc.)
 *
 * Usage:
 *   1. Open your Google Sheet → Extensions → Apps Script
 *   2. Paste ALL the .gs files into the editor (in file order: 00, 10, 20, …)
 *   3. Run setupSheets() from the editor and authorize the script.
 *   4. Deploy → New deployment → Web app (Execute as: Me, Who has access:
 *      Anyone). Copy the deployment URL and send it back.
 */

/** Sheet tab names used across the project. Keep these in sync everywhere. */
var SHEET_DESIGNS = "Designs";
var SHEET_SUBMISSIONS = "Submissions";
var SHEET_LOGS = "Logs";
var SHEET_CONFIG = "Config";

/** Column order for each tab. Headers are created from these arrays. */
var DESIGNS_COLUMNS = [
  "id",
  "name",
  "creator",
  "description",
  "status",
  "tokens_json",
  "created_at",
  "updated_at"
];

var SUBMISSIONS_COLUMNS = [
  "id",
  "name",
  "creator",
  "description",
  "tokens_json",
  "status",
  "submitted_at",
  "reviewed_at",
  "review_note"
];

var LOGS_COLUMNS = [
  "id",
  "timestamp",
  "action",
  "actor",
  "target",
  "detail"
];

var CONFIG_COLUMNS = [
  "key",
  "value"
];

/**
 * Creates every tab, writes the header row, applies number formats and
 * column widths, and seeds the Config tab with a default auth token if the
 * sheet is empty. Safe to run repeatedly.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  configureTab(ss, SHEET_DESIGNS, DESIGNS_COLUMNS, 100, [
    // (columnLetter, numberFormat) — none for text columns
  ]);

  configureTab(ss, SHEET_SUBMISSIONS, SUBMISSIONS_COLUMNS, 100, []);

  configureTab(ss, SHEET_LOGS, LOGS_COLUMNS, 100, []);

  configureTab(ss, SHEET_CONFIG, CONFIG_COLUMNS, 40, []);

  // Seed a default web-app auth token if Config is empty. The frontend must
  // send this token in the `X-Auth-Token` header on every write request.
  var configSheet = ss.getSheetByName(SHEET_CONFIG);
  if (configSheet.getLastRow() <= 1) {
    setConfig("webapp_token", "change-this-token");
    Logger.log("Seeded default web-app token. Update it in the Config tab "
        + "and re-deploy before going live.");
  }

  Logger.log("Sheet setup complete. Tabs ready: "
      + SHEET_DESIGNS + ", " + SHEET_SUBMISSIONS + ", " + SHEET_LOGS
      + ", " + SHEET_CONFIG);
}

/**
 * Creates a tab if missing, writes a bold header row, and applies basic
 * column widths. Never touches rows below the header.
 *
 * @param {SpreadsheetApp.Spreadsheet} ss   The active spreadsheet.
 * @param {string}                        name  Tab name.
 * @param {string[]}                      cols  Column header names.
 * @param {number}                        width Default column width (chars).
 * @param {Object[]}                      formats Optional per-column number
 *                                              formats, keyed by index.
 */
function configureTab(ss, name, cols, width, formats) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  // Header row
  var headerRange = sheet.getRange(1, 1, 1, cols.length);
  headerRange.setValues([cols]);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#f0f0f0");

  // Column widths
  for (var i = 0; i < cols.length; i++) {
    sheet.setColumnWidth(i + 1, width);
  }

  // Per-column number formats (applied to a sample range so new rows inherit
  // the formatting via the sheet's default style where possible).
  if (formats && formats.length) {
    for (var f = 0; f < formats.length; f++) {
      var fmt = formats[f];
      if (fmt && fmt.index != null && fmt.format) {
        sheet.getRange(2, fmt.index + 1, 1000, 1).setNumberFormat(fmt.format);
      }
    }
  }

  // Freeze the header row and add an auto-filter.
  sheet.setFrozenRows(1);
  sheet.autoSortRanges = sheet.getDataRange().setSort(1, true);
}

/**
 * Reads a config value from the Config tab.
 * @param {string} key The config key.
 * @return {string} The value, or "" if not found.
 */
function getConfig(key) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === key) {
      return String(values[r][1] || "");
    }
  }
  return "";
}

/**
 * Writes a config value to the Config tab, creating the row if needed.
 * @param {string} key   The config key.
 * @param {string} value The config value.
 */
function setConfig(key, value) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === key) {
      sheet.getRange(r + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}
