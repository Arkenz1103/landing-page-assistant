import { titleFromMessages } from './chatTitle.js';

const CHATS_KEY = 'lpa-chats';
const THEME_KEY = 'lpa-theme';
const SETTINGS_KEY = 'lpa-settings';
const SIDEBAR_W_KEY = 'lpa-sidebar-w';
const MAX_CHATS = 100;

// Keys used by the previous single-chat version of the app
const OLD_SESSION_KEY = 'lpa-session-id';
const OLD_MESSAGES_KEY = 'lpa-messages';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// true when saved; false when storage is unavailable or full
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Could not save "${key}" to localStorage:`, err);
    return false;
  }
}

// The whole first message (up to 120 characters); the sidebar and top bar shorten it on screen with CSS
export function makeTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 120 ? `${clean.slice(0, 120).trimEnd()}…` : clean;
}

// Chats saved before topic names still carry their first message as the title (older ones cut at 40 characters):
// name them from their first answer. A title the user renamed never matches the first message, so it is left alone.
function topicNamed(chat) {
  if (typeof chat?.title !== 'string' || !Array.isArray(chat.messages) || chat.autoTitle !== undefined) return chat;
  const first = chat.messages.find((m) => m && m.role === 'user' && typeof m.content === 'string');
  if (!first) return chat;
  const clean = first.content.replace(/\s+/g, ' ').trim();
  const oldCut = clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
  if (chat.title !== oldCut && chat.title !== makeTitle(first.content)) return chat;
  const { title, done } = titleFromMessages(chat.messages);
  return done ? { ...chat, title, autoTitle: false } :{ ...chat, title: makeTitle(first.content), autoTitle: true };
}

export function createChat(firstMessage) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    title: makeTitle(firstMessage),
    // the first message is only a placeholder name: the first real answer gives the chat its topic name
    autoTitle: true,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function migrateOldChat() {
  let oldSessionId = null;
  let oldMessages = null;
  try {
    oldSessionId = localStorage.getItem(OLD_SESSION_KEY);
    oldMessages = readJson(OLD_MESSAGES_KEY);
    localStorage.removeItem(OLD_SESSION_KEY);
    localStorage.removeItem(OLD_MESSAGES_KEY);
  } catch {
    return null;
  }
  if (!Array.isArray(oldMessages) || oldMessages.length === 0) return null;

  const now = Date.now();
  const messages = oldMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt || now }));
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return null;

  return {
    ...createChat(firstUser.content),
    sessionId: oldSessionId || crypto.randomUUID(),
    messages,
  };
}

// Each user's chats, saved on this device under their own key
const userChatsKey = (userId) => `${CHATS_KEY}:${userId}`;

export function loadChats(userId) {
  const stored = readJson(userChatsKey(userId));
  return Array.isArray(stored) ? stored.map(topicNamed) : [];
}

/**
 * Chats kept on this device from before sign-in existed (and the even older single-chat version).
 * They are removed here: the first user to sign in on the device takes them over.
 */
export function takeDeviceChats() {
  const stored = readJson(CHATS_KEY);
  const chats = Array.isArray(stored) ? stored.map(topicNamed) : [];
  const migrated = migrateOldChat();
  if (migrated) chats.unshift(migrated);
  try {
    localStorage.removeItem(CHATS_KEY);
  } catch {
    // ignore
  }
  return chats;
}

/**
 * The chats that are kept (at most MAX_CHATS): pinned first, then the most recently updated.
 * `keepId` (the open chat) is never dropped. Returns the same array when nothing has to go.
 */
export function trimChats(chats, keepId = null) {
  if (chats.length <= MAX_CHATS) return chats;
  const rank = (c) => (c.id === keepId ? 2 : Number(Boolean(c.pinned)));
  return [...chats].sort((a, b) => rank(b) - rank(a) || b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
}

export const EXPORT_TYPE = 'lpa-chats';

/** The file Settings > Export chats downloads. */
export function chatExport(chats) {
  return JSON.stringify({ type: EXPORT_TYPE, version: 1, exportedAt: new Date().toISOString(), chats }, null, 2);
}

/**
 * The chats in an exported file, cleaned up (unknown fields dropped, bad messages left out).
 * Throws when the text isn't a chat export.
 */
export function parseChatExport(text) {
  const data = JSON.parse(text);
  if (data?.type !== EXPORT_TYPE || !Array.isArray(data.chats)) throw new Error('Not a chat export');
  const now = Date.now();
  return data.chats
    .filter((c) => c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages))
    .map((c) => ({
      id: c.id,
      sessionId: typeof c.sessionId === 'string' ? c.sessionId : crypto.randomUUID(),
      title: c.title,
      pinned: Boolean(c.pinned),
      createdAt: Number(c.createdAt) || now,
      updatedAt: Number(c.updatedAt) || now,
      messages: c.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content, createdAt: Number(m.createdAt) || now, ...(m.local && { local: true }) })),
      ...(c.client?.sheet && { client: { sheet: String(c.client.sheet), name: String(c.client.name || c.client.sheet) } }),
      ...(c.scope === 'all' && { scope: 'all' }),
      ...(c.tableState && typeof c.tableState === 'object' && { tableState: c.tableState }),
    }));
}

// true when saved
export function saveChats(chats, userId) {
  return writeJson(userChatsKey(userId), trimChats(chats));
}

// 'light', 'dark' or 'system' (follows the OS preference); 'system' when nothing is saved
export function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark' || t === 'system') return t;
  } catch {
    // ignore
  }
  return 'system';
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

// Sidebar width in pixels (dragged on its right edge); DEFAULT_SIDEBAR_W when nothing valid is saved
export const DEFAULT_SIDEBAR_W = 260;
export const MIN_SIDEBAR_W = 220;
export const MAX_SIDEBAR_W = 420;

export function loadSidebarWidth() {
  const w = Number(readJson(SIDEBAR_W_KEY));
  return w >= MIN_SIDEBAR_W && w <= MAX_SIDEBAR_W ? w : DEFAULT_SIDEBAR_W;
}

export function saveSidebarWidth(w) {
  writeJson(SIDEBAR_W_KEY, w);
}

export const DEFAULT_SETTINGS = {
  textSize: 'medium',
  chatWidth: 'wide',
  compactTables: false,
  enterToSend: true,
  launchView: 'chat',
  rowLimit: 100,
};

const SETTING_VALUES = {
  textSize: ['small', 'medium', 'large'],
  chatWidth: ['narrow', 'medium', 'wide'],
  compactTables: [false, true],
  enterToSend: [true, false],
  launchView: ['chat', 'clients'],
  rowLimit: [50, 100, 'all'],
};

// General preferences other than the theme (unknown or missing values fall back to the defaults)
export function loadSettings() {
  const stored = readJson(SETTINGS_KEY) ?? {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([k, d]) => [k, SETTING_VALUES[k].includes(stored[k]) ? stored[k] : d])
  );
}

export function saveSettings(settings) {
  writeJson(SETTINGS_KEY, settings);
}

// no smooth scrolling when the OS asks for reduced motion
export function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export { readJson, writeJson };
