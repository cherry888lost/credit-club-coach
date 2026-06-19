#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
/**
 * One-time import for the old Credit Club Collections sheet.
 * Default mode is dry-run. Pass --execute only after explicit approval.
 * Corrected model: Google Sheet "Closer" becomes the single owner_user_id/owner_name.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SPREADSHEET_ID = process.env.COLLECTIONS_GOOGLE_SHEET_ID || '1nShh1Y0UkBN_MaplQX8bB04NBMomSpgfiLlU5nNWVjQ';
const RANGE = process.env.COLLECTIONS_GOOGLE_RANGE || 'Collections!A:Q';
const ORG_ID = process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001';
const execute = process.argv.includes('--execute');

function token() {
  const tokenPath = path.join(process.env.HOME, '.hermes', 'google_token.json');
  const parsed = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  if (!parsed.token) throw new Error('Missing Google token in ~/.hermes/google_token.json');
  return parsed.token;
}

async function fetchSheetRows() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(RANGE)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`Google Sheets read failed: ${res.status} ${await res.text()}`);
  const values = (await res.json()).values || [];
  const headers = values[0] || [];
  const rows = values.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))).filter((row) => Object.values(row).some(Boolean));
  return { headers, rows };
}

function money(value) {
  const n = Number(String(value || '0').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
}

function date(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function clean(value) {
  const text = String(value || '').trim();
  return text || null;
}

function key(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function reps() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('reps').select('id,name,email,role,sales_role,status').eq('org_id', ORG_ID).eq('status', 'active');
  if (error) throw error;
  return { supabase, reps: data || [] };
}

function buildNameMap(reps) {
  const aliases = {
    adan: 'adan nadeem',
    callum: 'callum',
    papur: 'papur',
    john: 'john graham',
    yuvraj: 'yuvraj kang',
    kayode: 'kayode',
  };
  const map = new Map();
  for (const rep of reps) {
    map.set(key(rep.name), rep);
    if (rep.email) map.set(key(rep.email), rep);
  }
  for (const [alias, target] of Object.entries(aliases)) {
    const rep = reps.find((r) => key(r.name) === target);
    if (rep) map.set(alias, rep);
  }
  return map;
}

function mapRow(row, nameMap) {
  const ownerText = clean(row['Closer']);
  const owner = ownerText ? nameMap.get(key(ownerText)) : null;
  return {
    org_id: ORG_ID,
    client_name: clean(row['Client']),
    telegram: clean(row['Telegram']),
    phone_number: clean(row['Phone']),
    owner_user_id: owner?.id || null,
    owner_name: owner?.name || ownerText,
    owner_role: owner?.sales_role || owner?.role || null,
    total_sale_value: money(row['Sale Value']),
    amount_paid: money(row['Deposit']),
    collection_type: clean(row['Type']) || 'Deposit then balance',
    sale_date: date(row['Sale Date']),
    balance_due_date: date(row['Due Date']),
    next_follow_up_date: date(row['Next Follow Up']),
    risk: ['Low', 'Medium', 'High'].includes(row['Risk']) ? row['Risk'] : 'Medium',
    status: ['Open', 'Due Soon', 'Overdue', 'Collected', 'Failed Payment', 'Refund Risk', 'Cancelled'].includes(row['Status']) ? row['Status'] : 'Open',
    payment_link: clean(row['Payment Link']),
    notes: clean(row['Notes']),
    legacy_google_sheet_id: clean(row['ID']),
    source: 'google_sheet_import',
    _ownerText: ownerText,
    _ownerMapped: Boolean(ownerText && owner),
  };
}

async function main() {
  const { headers, rows } = await fetchSheetRows();
  const { supabase, reps: activeReps } = await reps();
  const nameMap = buildNameMap(activeReps);
  const mapped = rows.map((row) => mapRow(row, nameMap));
  const valid = mapped.filter((row) => row.client_name);
  const missingOwner = mapped.filter((row) => !row._ownerText);
  const unmappedOwner = mapped.filter((row) => row._ownerText && !row._ownerMapped);
  const mappedOwners = mapped.filter((row) => row._ownerMapped);
  const payload = valid.map(({ _ownerText, _ownerMapped, ...row }) => row);

  const report = {
    mode: execute ? 'execute' : 'dry-run',
    spreadsheetId: SPREADSHEET_ID,
    sheetRange: RANGE,
    columns: headers,
    rowCount: rows.length,
    validRecords: valid.length,
    recordsWithMappedOwnerFromCloser: mappedOwners.length,
    missingOwner: missingOwner.length,
    unmappedOwners: unmappedOwner.map((r) => ({ client: r.client_name, ownerFromCloser: r._ownerText })),
    skippedMissingClient: rows.length - valid.length,
    fieldMapping: {
      ID: 'legacy_google_sheet_id',
      Client: 'client_name',
      Telegram: 'telegram',
      Phone: 'phone_number',
      Closer: 'owner_user_id/owner_name/owner_role',
      'Sale Value': 'total_sale_value',
      Deposit: 'amount_paid',
      Type: 'collection_type',
      'Sale Date': 'sale_date',
      'Due Date': 'balance_due_date',
      'Next Follow Up': 'next_follow_up_date',
      Owner: 'ignored; old sheet column is not part of corrected ownership model',
      Risk: 'risk',
      Status: 'status',
      'Payment Link': 'payment_link',
      Notes: 'notes',
      'Updated At': 'source audit only; Supabase updated_at is managed by DB',
    },
  };

  if (!execute) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const { data, error } = await supabase.from('collections').upsert(payload, { onConflict: 'legacy_google_sheet_id' }).select('id');
  if (error) throw error;
  console.log(JSON.stringify({ ...report, imported: data?.length || 0 }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
