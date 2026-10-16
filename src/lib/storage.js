const CHATS_KEY = 'lpa-chats';
const THEME_KEY = 'lpa-theme';
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

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Could not save "${key}" to localStorage:`, err);
  }
}

export function makeTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
}

export function createChat(firstMessage) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    title: makeTitle(firstMessage),
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

export function loadChats() {
  const stored = readJson(CHATS_KEY);
  const chats = Array.isArray(stored) ? stored : [];
  const migrated = migrateOldChat();
  if (migrated) {
    chats.unshift(migrated);
    saveChats(chats);
  }
  return chats;
}

export function saveChats(chats) {
  const kept = [...chats]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHATS);
  writeJson(CHATS_KEY, kept);
}

// 'light' or 'dark'; with nothing saved (or an old 'system' value) it starts from the OS preference
export function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export { readJson, writeJson };
