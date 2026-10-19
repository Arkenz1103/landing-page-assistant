import { sendChatMessage } from './api.js';
import { readJson, writeJson } from './storage.js';

// v3: rows carry the GMB / Yellow Pages / True Local / Assigned URL columns, tabs follow workbook order,
// and the payload includes the Summary worksheet rows
const MASTER_KEY = 'lpa-master-v3';
const OLD_KEYS = ['lpa-master', 'lpa-master-v2'];
const MASTER_SESSION_ID = 'master-sheet';
const MASTER_TIMEOUT_MS = 60000;
const CACHE_MS = 12 * 60 * 60 * 1000;

// Row status, same rule as the chat answers: an http link is live, text in the URL cell is a note, a blank cell is missing
function rowStatus(url, note) {
  if (url) return 'live';
  if (note) return 'note';
  return 'missing';
}

/** The Summary worksheet rows, cells keyed by the sheet's own headers (null if the payload has none). */
function decodeSummary(summary) {
  if (!summary || !Array.isArray(summary.rows)) return null;
  return {
    columns: Array.isArray(summary.columns) ? summary.columns : [],
    rows: summary.rows.filter((r) => r && r.cells).map((r) => ({ row: Number(r.row) || 0, cells: r.cells })),
  };
}

/** Turns the compact n8n payload (one array per sheet row) into row objects. */
function decodeRows(payload) {
  if (payload?.type !== 'master' || !Array.isArray(payload.tabs) || !Array.isArray(payload.rows)) {
    throw new Error('Unexpected master sheet format');
  }
  const col = Object.fromEntries(payload.columns.map((name, i) => [name, i]));
  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  return payload.rows
    .map((r, i) => {
      const tab = payload.tabs[r[col.tab]];
      if (!tab) return null;
      const url = str(r[col.url]);
      const note = str(r[col.note]);
      return {
        id: i,
        sheet: tab.sheet,
        name: tab.name || tab.sheet,
        month: str(r[col.month]),
        service: str(r[col.service]),
        city: str(r[col.city]),
        suburb: str(r[col.suburb]),
        assigned: str(r[col.assigned]),
        url,
        note,
        row: Number(r[col.row]) || 0,
        gmb: str(r[col.gmb]),
        yellowPages: str(r[col.yellowPages]),
        trueLocal: str(r[col.trueLocal]),
        assignedUrl: str(r[col.assignedUrl]),
        status: rowStatus(url, note),
      };
    })
    .filter(Boolean);
}

function decode(payload) {
  return { rows: decodeRows(payload), summary: decodeSummary(payload.summary) };
}

export function getCachedMaster() {
  try {
    OLD_KEYS.forEach((k) => localStorage.removeItem(k)); // older copies are no longer read
  } catch {
    // storage unavailable
  }
  const cached = readJson(MASTER_KEY);
  if (!cached?.payload) return null;
  try {
    // a copy saved before the workflow sent the Summary rows is refetched straight away
    const fresh = Boolean(cached.payload.summary) && Date.now() - cached.fetchedAt < CACHE_MS;
    return { data: decode(cached.payload), fresh };
  } catch {
    return null;
  }
}

export async function fetchMaster() {
  const output = await sendChatMessage(MASTER_SESSION_ID, '__master__', { timeoutMs: MASTER_TIMEOUT_MS });
  let payload;
  let data;
  try {
    payload = JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    data = decode(payload);
  } catch (err) {
    console.error('Could not parse master sheet data:', err, output.slice(0, 500));
    throw err;
  }
  writeJson(MASTER_KEY, { fetchedAt: Date.now(), payload });
  return data;
}

/** Totals for a set of rows (one client, or the whole sheet). */
export function summarize(rows) {
  const count = (status) => rows.filter((r) => r.status === status).length;
  // unique values in sheet order
  const unique = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))];
  // unique values, most frequent first
  const ranked = (key) => {
    const n = new Map();
    for (const r of rows) if (r[key]) n.set(r[key], (n.get(r[key]) || 0) + 1);
    return [...n.keys()].sort((a, b) => n.get(b) - n.get(a));
  };
  const total = rows.length;
  const live = count('live');
  return {
    total,
    live,
    note: count('note'),
    missing: count('missing'),
    percent: total ? Math.round((live / total) * 100) : 0,
    assigned: ranked('assigned'),
    services: ranked('service'),
    cities: ranked('city'),
    months: unique('month'),
  };
}

/** One summary per client tab, in sheet order. */
export function summarizeClients(rows) {
  const bySheet = new Map();
  for (const r of rows) {
    if (!bySheet.has(r.sheet)) bySheet.set(r.sheet, []);
    bySheet.get(r.sheet).push(r);
  }
  return [...bySheet.values()].map((list) => ({ sheet: list[0].sheet, name: list[0].name, ...summarize(list) }));
}
