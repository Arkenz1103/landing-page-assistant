const CHATS_KEY = 'lpa-chats';
const THEME_KEY = 'lpa-theme';
const SETTINGS_KEY = 'lpa-settings';
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
