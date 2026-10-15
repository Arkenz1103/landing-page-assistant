import { sendChatMessage } from './api.js';
import { readJson, writeJson } from './storage.js';

const CLIENTS_KEY = 'lpa-clients';
const CLIENTS_SESSION_ID = 'client-list';
const CACHE_MS = 12 * 60 * 60 * 1000;

export const QUESTIONS = {
  status: (sheet) => `Where are we at for ${sheet}?`,
  pages: (sheet) => `Show the landing pages for ${sheet}`,
  months: (sheet) => `Which months don't have landing pages for ${sheet}?`,
  assigned: (sheet) => `Who is assigned to ${sheet}?`,
};

export const QUICK_ACTIONS = [
  { key: 'status', label: 'Status' },
  { key: 'pages', label: 'Landing pages' },
  { key: 'months', label: 'Months without pages' },
  { key: 'assigned', label: 'Assigned to' },
];

export function getCachedClients() {
  const cached = readJson(CLIENTS_KEY);
  if (!cached || !Array.isArray(cached.clients)) return null;
  return { clients: cached.clients, fresh: Date.now() - cached.fetchedAt < CACHE_MS };
}

function parseClients(output) {
  // Tolerate the JSON being wrapped in a markdown code fence
  const text = output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const data = JSON.parse(text);
  if (data?.type !== 'clients' || !Array.isArray(data.clients)) {
    throw new Error('Unexpected client list format');
  }
  return data.clients
    .filter((c) => c && typeof c.sheet === 'string' && c.sheet.trim())
    .map((c) => ({ sheet: c.sheet.trim(), name: typeof c.name === 'string' ? c.name.trim() : '' }));
}

export async function fetchClients() {
  const output = await sendChatMessage(CLIENTS_SESSION_ID, '__clients__');
  let clients;
  try {
    clients = parseClients(output);
  } catch (err) {
    console.error('Could not parse client list:', err, output);
    throw err;
  }
  writeJson(CLIENTS_KEY, { fetchedAt: Date.now(), clients });
  return clients;
}

/** Finds the client mentioned in a question (longest sheet/name match wins). */
export function findClient(question, clients) {
  if (!question || !clients?.length) return null;
  const q = question.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const c of clients) {
    for (const label of [c.sheet, c.name]) {
      if (!label) continue;
      const l = label.toLowerCase();
      if (l.length > bestLen && q.includes(l)) {
        best = c;
        bestLen = l.length;
      }
    }
  }
  return best;
}

/** Classifies a question so follow-up chips can be suggested. */
export function questionType(question) {
  const q = question.toLowerCase();
  if (/\bmonths?\b/.test(q) && /(which|without|don't|dont|do not|missing|no landing|with landing)/.test(q)) {
    return 'months';
  }
  if (/(assigned|who is|who's|service|city|gmb|yellow pages|true local|truelocal)/.test(q)) {
    return 'detail';
  }
  if (/landing pages?/.test(q)) return 'pages';
  if (/(where are we|status|progress|up to)/.test(q)) return 'status';
  return null;
}

const FOLLOW_UPS = {
  status: [
    { label: 'Show landing pages', key: 'pages' },
    { label: 'Months without pages', key: 'months' },
    { label: 'Who is assigned?', key: 'assigned' },
  ],
  pages: [
    { label: 'Status', key: 'status' },
    { label: 'Months without pages', key: 'months' },
  ],
  months: [
    { label: 'Status', key: 'status' },
    { label: 'Show landing pages', key: 'pages' },
  ],
  detail: [
    { label: 'Status', key: 'status' },
    { label: 'Show landing pages', key: 'pages' },
  ],
};

export function followUpChips(lastQuestion, clients) {
  const client = findClient(lastQuestion, clients);
  if (!client) return [];
  // Remove the client's own name first so e.g. "City Plumbing" isn't read as a city question
  let rest = lastQuestion.toLowerCase();
  for (const label of [client.sheet, client.name]) {
    if (label) rest = rest.split(label.toLowerCase()).join(' ');
  }
  const type = questionType(rest);
  if (!type) return [];
  return FOLLOW_UPS[type].map((f) => ({ label: f.label, question: QUESTIONS[f.key](client.sheet) }));
}
