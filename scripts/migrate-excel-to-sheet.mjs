#!/usr/bin/env node
/**
 * One-time bootstrap: read the six Excel workbooks from the legacy Flask app
 * and write their contents into the private "IVA Portal DB" Google Sheet
 * (six tabs, one per workbook).
 *
 * Prereqs (run once locally, no Cloudflare needed):
 *   - Node 18+
 *   - `npm install` in this repo (installs `xlsx` and `jose`)
 *   - A service-account JSON key with Sheets API enabled, saved to
 *     `./service-account.json` (gitignored).
 *   - The target Google Sheet shared with the service-account email as Editor.
 *   - Env: IVA_SHEET_ID = the target sheet ID
 *          GOOGLE_SERVICE_ACCOUNT_JSON_PATH = path to the key file (default ./service-account.json)
 *          EXCEL_DIR = path to the .xlsx files (default ../astro/astro/backend/data)
 *
 * Usage:
 *   IVA_SHEET_ID=<id> node scripts/migrate-excel-to-sheet.mjs
 *
 * Safe to re-run: it overwrites each tab with the Excel contents.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SignJWT, importPKCS8 } from "jose";
import * as XLSX from "xlsx";

const TABS = [
  { tab: "Students", workbook: "iva_students.xlsx" },
  { tab: "Courses", workbook: "iva_courses.xlsx" },
  { tab: "Enrollments", workbook: "iva_enrollments.xlsx" },
  { tab: "Classes", workbook: "iva_classes.xlsx" },
  { tab: "Attendance", workbook: "iva_attendance.xlsx" },
  { tab: "Resources", workbook: "iva_resources.xlsx" },
];

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function getAccessToken(sa) {
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function ensureTabExists(sheetId, token, title) {
  // Look up existing tabs
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());
  const exists = (meta.sheets || []).some((s) => s.properties.title === title);
  if (exists) return;
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    },
  );
  if (!r.ok) throw new Error(`Could not create tab "${title}": ${await r.text()}`);
}

async function writeTab(sheetId, token, title, values) {
  // Clear, then write.
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(title)}:clear`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(title)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    },
  );
  if (!r.ok) throw new Error(`Write failed for "${title}": ${await r.text()}`);
}

function workbookToValues(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // header:1 → returns rows of arrays, first row is headers
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

async function main() {
  const sheetId = process.env.IVA_SHEET_ID;
  if (!sheetId) {
    console.error("IVA_SHEET_ID env var is required");
    process.exit(1);
  }
  const keyPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || "./service-account.json";
  if (!existsSync(keyPath)) {
    console.error(`Service-account key not found at ${keyPath}`);
    process.exit(1);
  }
  const excelDir = resolve(
    process.env.EXCEL_DIR || "../astro/astro/backend/data",
  );

  const sa = JSON.parse(await readFile(keyPath, "utf8"));
  console.log(`Authenticating as ${sa.client_email}…`);
  const token = await getAccessToken(sa);
  console.log("OK. Migrating tabs:");

  for (const { tab, workbook } of TABS) {
    const filePath = resolve(excelDir, workbook);
    if (!existsSync(filePath)) {
      console.warn(`  - SKIP ${tab}: ${filePath} not found`);
      continue;
    }
    await ensureTabExists(sheetId, token, tab);
    const values = workbookToValues(filePath);
    if (!values.length) {
      console.warn(`  - SKIP ${tab}: workbook is empty`);
      continue;
    }
    await writeTab(sheetId, token, tab, values);
    console.log(`  - ${tab}: wrote ${values.length - 1} rows (+ header) from ${workbook}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
