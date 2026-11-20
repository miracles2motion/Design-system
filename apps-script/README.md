# Forma Token Studio — Community Design Sharing Backend (Apps Script)

These are the Apps Script files for the community design-sharing backend that
backs the Forma Token Studio marketplace. Paste them into the Apps Script
editor attached to a Google Sheet, run the setup, and deploy as a web app.

## What the sheet stores

The `setupSheets()` function creates **four tabs**:

| Tab | Purpose |
|-----|---------|
| **Designs** | Published, approved token themes (the public catalog the frontend fetches). |
| **Submissions** | Moderation queue — community submissions awaiting approve/reject. |
| **Logs** | Append-only audit log of every create/update/delete/approve/reject. |
| **Config** | Key/value settings, including the web-app auth token. |

## Files (paste in this order)

| File | Role |
|------|------|
| `00_setup.gs` | Creates the tabs, headers, formats, and seeds the auth token. **Run once.** |
| `10_helpers.gs` | Shared utilities: ID gen, auth, logging, JSON, row reading. |
| `20_designs.gs` | Design catalog CRUD: create, get, list, update, delete. |
| `30_submissions.gs` | Moderation queue: submit, list, approve (copies to Designs), reject. |
| `40_webapp.gs` | HTTP entry points (`doGet`/`doPost`) + spreadsheet menu. **This is the deployed surface.** |

## Setup steps

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Delete any default code in the editor.
3. Paste **all five files** into the editor, in the order above (each file's
   full contents go into the editor; you can use the Apps Script file
   selector to create separate files, but a single editor with all code also
   works).
4. In the editor, select and run **`setupSheets()`**. Authorize the script
   when prompted. This creates the four tabs and seeds a default token
   (`change-this-token`).
5. **Change the token**: open the sheet's **Config** tab and update the
   `webapp_token` value to something secret. (Or call `setConfig("webapp_token", "your-secret")` from the editor.)
6. **Deploy**: **Deploy → New deployment → Web app**.
   - **Execute as:** *Me*
   - **Who has access:** *Anyone* (so the frontend can reach it)
7. Copy the **deployment URL** and send it back. The frontend will use it as
   the base for all requests.

## API

All responses are JSON: `{ "success": bool, "message": string, "data": ... }`.
Write requests must send the auth token in the **`X-Auth-Token`** header
(or a `token` field in the body).

### Public (no auth)

| Method | Action | Params | Result |
|--------|--------|--------|--------|
| GET | `listDesigns` | `limit` (optional, default 50) | Approved designs, newest first. |
| GET | `getDesign` | `id` | One design with parsed `tokens`. |
| GET | `listSubmissions` | `status`, `limit` (optional) | Submissions by status. |
| GET | `health` | — | Service health check. |

### Write (auth required)

| Method | Action | Body fields |
|--------|--------|-------------|
| POST | `createDesign` | `name`, `creator`, `description`, `tokens` |
| POST | `updateDesign` | `id`, `name`, `description`, `tokens` |
| POST | `deleteDesign` | `id` |
| POST | `createSubmission` | `name`, `creator`, `description`, `tokens` |
| POST | `approveSubmission` | `id`, `note` (optional) |
| POST | `rejectSubmission` | `id`, `note` |

All POST bodies are JSON: `Content-Type: application/json`.

### Example (curl)

```bash
# Public: list approved designs
curl "https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?action=listDesigns&limit=10"

# Auth: create a design
curl -X POST "https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?action=createDesign" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-secret-token" \
  -d '{"action":"createDesign","name":"Warm Dashboard","creator":"sam","description":"Cozy palette","tokens":{"palette":{}}}'
```

## Approval flow

1. A community member calls `createSubmission` → row appears in **Submissions**
   with status `pending`.
2. A moderator calls `approveSubmission` → the submission is marked `approved`
   and a new row is **copied into Designs** with status `approved`, so it
   immediately appears in the public catalog.
3. `rejectSubmission` marks the submission `rejected` with a note; the row is
   kept for the audit trail.
