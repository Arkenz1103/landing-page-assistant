// Short topic names for chats ("Queensland Paint Supplies Missing Landing Pages"), the way Claude and Gemini name them:
// built from the first answer's heading ("### <client> — <topic>"), else from the question itself.
import { NO_ANSWER_MSG, STOPPED_MSG } from './api.js';

// answer headings that ask the user something back: the chat gets its name from a later answer
const NOT_A_TOPIC = /^(?:which client|hi\b|hello\b|i couldn.?t find|that.?s a question)/i;
// left part of "X — Y" that is a report name, not a client
const REPORT_HEAD = /^(?:landing page (?:check|audit)|landing pages|missing landing page|landing page urls|all landing page|rows with)/i;

// "<client> — <topic>" topic wordings, shortened
const TOPICS = [
  [/^status/i, 'Status'],
  [/^rows without landing pages?|^missing landing page|without (?:a )?landing page|no landing page/i, 'Missing Landing Pages'],
  [/^all landing page rows|^all rows/i, 'All Landing Pages'],
  [/^landing pages?(?: urls?)?$/i, 'Landing Pages'],
];

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'vs']);

// Capitalises words, keeps words that already have capitals (client names, URLs) as written
function titleCase(s) {
  return s
    .split(' ')
    .map((w, i) => {
      if (w.length < 2 || /[A-Z]/.test(w) || /\d/.test(w) || /[./:]/.test(w)) return w;
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

const plain = (s) =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

// The heading shows the client name from the sheet ("Neptunes Pool Care"); when the question names the tab in full
// ("Neptunes Pool Care Kallangur", "Luxe Lighting - E-commerce") the title keeps those extra words, so similar clients differ
function fullClient(name, question) {
  const q = plain(String(question || '')).replace(/[?!.,]+(\s|$)/g, '$1');
  const at = q.toLowerCase().indexOf(name.toLowerCase());
  if (at === -1) return name;
  const extra = [];
  for (const w of q.slice(at + name.length).trim().split(' ')) {
    if (extra.length >= 4 || !(w === '-' || w === '&' || /^[A-Z0-9]/.test(w))) break;
    extra.push(w);
  }
  while (extra.length && /^[-&]$/.test(extra[extra.length - 1])) extra.pop();
  return [name, ...extra].join(' ');
}

function fromHeading(reply, question) {
  const lines = String(reply || '').split('\n').slice(0, 6);
  const line = lines.find((l) => /^#{1,4}\s+\S/.test(l));
  if (!line) return '';
  const head = plain(line);
  if (!head || NOT_A_TOPIC.test(head)) return null;
  const parts = head.split(/\s+[—–]\s+/);
  if (parts.length < 2) return titleCase(head.replace(/\s*\(\d+\)$/, ''));
  const [left, ...rest] = parts;
  const right = rest.join(' – ');
  if (REPORT_HEAD.test(left)) return `${titleCase(left)}: ${titleCase(right)}`;
  // keep a month or other note in brackets at the end ("(October)")
  const note = (right.match(/\s*(\([^)]*\))$/) || ['', ''])[1];
  const core = right.replace(/\s*\([^)]*\)$/, '');
  const topic = (TOPICS.find(([re]) => re.test(core)) || [])[1] || titleCase(core.split(' ').slice(0, 6).join(' '));
  return [fullClient(left, question), topic, note].filter(Boolean).join(' ');
}

const FILLER =
  /^(?:(?:hi|hey|hello|ok|okay|so|please|pls|can you|could you|would you|will you|can i|could i|i want to|i want|i need|i would like to|i'd like to|help me|show me|tell me|give me|let me know|let me see|check|find|what is|what are|what's)\b[\s,]*)+/i;

function fromQuestion(question) {
  let s = plain(String(question || '')).replace(/[?!.]+$/, '');
  s = s.replace(FILLER, '').trim() || s;
  const words = s.split(' ');
  s = words.slice(0, 7).join(' ') + (words.length > 7 ? '…' : '');
  return titleCase(s.charAt(0).toUpperCase() + s.slice(1));
}

/**
 * The chat's name after the answer `reply` to `question`, or null while the answer only asked back
 * ("Which client do you mean?"), so a later answer names the chat.
 */
export function topicTitle(question, reply) {
  if (reply === STOPPED_MSG || reply === NO_ANSWER_MSG) return null;
  const h = fromHeading(reply, question);
  if (h === null) return null;
  return h || fromQuestion(question);
}

/**
 * Names a saved chat from its first real answer (answers made in the app, like greetings, are skipped).
 * Returns { title, done }; done is false while no answer has named it yet.
 */
export function titleFromMessages(messages) {
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'assistant' || m.local) continue;
    const q = [...messages.slice(0, i)].reverse().find((x) => x.role === 'user');
    const t = topicTitle(q ? q.content : '', m.content);
    if (t) return { title: t, done: true };
  }
  return { title: '', done: false };
}
