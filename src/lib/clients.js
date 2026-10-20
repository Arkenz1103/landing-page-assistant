import { sendChatMessage } from './api.js';
import { readJson, writeJson } from './storage.js';

const CLIENTS_KEY = 'lpa-clients';
const CLIENTS_SESSION_ID = 'client-list';
const CACHE_MS = 12 * 60 * 60 * 1000;

export const QUESTIONS = {
  status: (sheet) => `What is the status for ${sheet}?`,
  pages: (sheet) => `Which months have landing page URLs for ${sheet}?`,
  months: (sheet) => `Which months don't have landing page URLs for ${sheet}?`,
  assigned: (sheet) => `Who is assigned to ${sheet}?`,
};

// example questions: phrasings the workflow answers with its fast template tables
const EXAMPLE_QUESTIONS = [
  (sheet) => `Show me missing landing page URLs for ${sheet}`,
  (sheet) => `Which cities or suburbs are listed for ${sheet}?`,
  (sheet) => `Who is assigned to ${sheet}?`,
  (sheet) => `Where are we at for ${sheet}?`,
  (sheet) => `Which months have landing page URLs for ${sheet}?`,
];
// used until the client list has loaded
const EXAMPLE_CLIENTS = [
  'Wagner Soil Testing',
  'Bruin Pest Management',
  'A Vision Windscreens',
  'Yandina Station',
  'Ace Restumping',
  'Deadlock Garage Doors',
  'Bob Gunn Termite Zillmere',
  'Cuzkell',
];

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * `count` (3 or 4 at random) example questions, each a different question type, for different random clients (or all
 * for `client` when the chat is bound to one). Question types and clients in `avoid` (an earlier example list) come last.
 */
export function randomExamples(clients, { client = null, avoid = [], count = 3 + Math.floor(Math.random() * 2) } = {}) {
  const used = avoid.join('\n');
  const fresh = (items, label) => {
    const s = shuffle(items);
    return [...s.filter((x) => !used.includes(label(x))), ...s.filter((x) => used.includes(label(x)))];
  };
  // a template's fixed words (before the client name) tell whether it was used
  const types = fresh(EXAMPLE_QUESTIONS, (q) => q('\u0000').split('\u0000')[0]);
  const sheets = client?.sheet
    ? [client.sheet]
    : fresh(clients?.length ? clients.map((c) => c.sheet) : EXAMPLE_CLIENTS, (s) => s);
  return types.slice(0, count).map((q, i) => q(sheets[i % sheets.length]));
}

export const QUICK_ACTIONS = [
  { key: 'status', label: 'Status' },
  { key: 'pages', label: 'Landing pages url' },
  { key: 'months', label: 'Without Landing pages url' },
  { key: 'assigned', label: 'Who is assigned to' },
];

export function getCachedClients() {
  const cached = readJson(CLIENTS_KEY);
  if (!cached || !Array.isArray(cached.clients)) return null;
  return { clients: cached.clients, fetchedAt: cached.fetchedAt, fresh: Date.now() - cached.fetchedAt < CACHE_MS };
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

/** Classifies a question as one of the QUICK_ACTIONS keys ('detail' for other client facts), or null. */
export function questionType(question) {
  const q = question.toLowerCase();
  if (/\bmonths?\b/.test(q) && /(without|don't|dont|do not|missing|no landing|no url)/.test(q)) return 'months';
  // rows without a URL, however it is worded ("Show me missing landing page URLs", "Any blank landing pages?")
  if (/(landing pages?|urls?)\b/.test(q) && /\b(missing|without|blank|empty|don't|dont|do not|no|not done)\b/.test(q)) return 'months';
  if (/(assigned|who is|who's)/.test(q)) return 'assigned';
  if (/(service|city|cities|suburb|location|gmb|yellow pages|true local|truelocal)/.test(q)) return 'detail';
  if (/(landing pages?|urls?)\b/.test(q)) return 'pages';
  if (/(where are we|status|progress|up to)/.test(q)) return 'status';
  return null;
}

/** The question with the client's own name removed, so e.g. "City Plumbing" isn't read as a city question. */
function typeFor(question, client) {
  let rest = question.toLowerCase();
  for (const label of [client.sheet, client.name]) {
    if (label) rest = rest.split(label.toLowerCase()).join(' ');
  }
  return questionType(rest);
}

/** Quick actions the last answer shows would come back empty (its totals say "0 with URL" / "0 without"). */
function emptyActions(answer = '') {
  const empty = new Set();
  if (/\b0 with url\b/i.test(answer)) empty.add('pages');
  if (/\b0 without\b/i.test(answer)) empty.add('months');
  return empty;
}

/**
 * Follow-up chips after an answer: the client quick actions (same labels as the sidebar) for the client
 * in the last question, leaving out every one already asked about that client in this chat and any the
 * answer shows has nothing to list.
 */
export function followUpChips(messages, clients) {
  const userQuestions = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const lastQuestion = userQuestions[userQuestions.length - 1];
  const client = findClient(lastQuestion, clients);
  if (!client || !typeFor(lastQuestion, client)) return [];
  const asked = new Set(
    userQuestions.filter((q) => findClient(q, clients) === client).map((q) => typeFor(q, client))
  );
  const empty = emptyActions(messages[messages.length - 1]?.content);
  return QUICK_ACTIONS.filter((a) => !asked.has(a.key) && !empty.has(a.key)).map((a) => ({
    label: a.label,
    question: QUESTIONS[a.key](client.sheet),
  }));
}
