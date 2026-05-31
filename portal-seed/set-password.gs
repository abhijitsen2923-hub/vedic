/**
 * IVA — in-sheet "Set / reset password" tool for the Students tab.
 *
 * This is NOT imported like a CSV. To install:
 *   1. Open the "IVA Portal DB" sheet → Extensions → Apps Script.
 *   2. Paste this file's contents into the editor (replace the default Code.gs) → Save.
 *   3. Project Settings → Script properties → add two properties:
 *        WORKER_URL   = https://internationalvedicacademy.com   (no trailing slash)
 *        ADMIN_TOKEN  = <the exact same value as the Worker's ADMIN_TOKEN secret>
 *   4. Reload the spreadsheet → an "IVA" menu appears.
 *
 * Usage: select any cell in a student's row on the Students tab →
 *        IVA → "Set / reset password (selected row)" → type the new password.
 * The script asks the Worker to hash it (PBKDF2) and writes the hash into that
 * row's password_hash cell. The plaintext is never stored — tell the student
 * the new password directly. "Forgot password" = just set a new one here.
 */

var STUDENTS_SHEET = "Students";
var HASH_HEADER = "password_hash";
var EMAIL_HEADER = "email";
var ID_HEADER = "student_id";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("IVA")
    .addItem("Set / reset password (selected row)", "ivaSetPassword")
    .addToUi();
}

function ivaSetPassword() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  if (sheet.getName() !== STUDENTS_SHEET) {
    ui.alert('Open the "' + STUDENTS_SHEET + '" tab and select the student row first.');
    return;
  }

  var props = PropertiesService.getScriptProperties();
  var workerUrl = (props.getProperty("WORKER_URL") || "").replace(/\/+$/, "");
  var adminToken = props.getProperty("ADMIN_TOKEN");
  if (!workerUrl || !adminToken) {
    ui.alert("Setup needed: add WORKER_URL and ADMIN_TOKEN in Project Settings → Script properties.");
    return;
  }

  var row = sheet.getActiveRange().getRow();
  if (row < 2) {
    ui.alert("Select a student data row (not the header).");
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hashCol = headers.indexOf(HASH_HEADER) + 1;
  var emailCol = headers.indexOf(EMAIL_HEADER) + 1;
  var idCol = headers.indexOf(ID_HEADER) + 1;
  if (hashCol === 0) {
    ui.alert('Could not find a "' + HASH_HEADER + '" column on this tab.');
    return;
  }

  var who =
    (idCol ? sheet.getRange(row, idCol).getValue() : "row " + row) +
    (emailCol ? " (" + sheet.getRange(row, emailCol).getValue() + ")" : "");

  var resp = ui.prompt(
    "Set / reset password",
    "New password for " + who + ":\n(6–200 characters; the student is told this value)",
    ui.ButtonSet.OK_CANCEL,
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var password = resp.getResponseText();
  if (!password || password.length < 6 || password.length > 200) {
    ui.alert("Password must be 6–200 characters. Nothing changed.");
    return;
  }

  var res = UrlFetchApp.fetch(workerUrl + "/api/admin/hash", {
    method: "post",
    contentType: "application/json",
    headers: { "X-Admin-Token": adminToken },
    payload: JSON.stringify({ password: password }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code !== 200) {
    ui.alert("Hashing failed (HTTP " + code + "). Check WORKER_URL / ADMIN_TOKEN.\n" + res.getContentText());
    return;
  }

  var hash = JSON.parse(res.getContentText()).hash;
  if (!hash) {
    ui.alert("No hash returned. Nothing changed.");
    return;
  }

  sheet.getRange(row, hashCol).setValue(hash);
  ss.toast("Password updated for " + who, "IVA", 5);
}
