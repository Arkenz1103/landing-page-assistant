import { createHmac, timingSafeEqual } from 'node:crypto';

// Login for the app: one username + password from the server's environment (APP_USERNAME, APP_PASSWORD), checked
// here and never sent to the browser. A signed session cookie (AUTH_SECRET) keeps the user signed in.
// Used by the Vite dev server (vite.config.js) and by the Vercel functions in api/.

const COOKIE = 'lpa_session';
const SESSION_DAYS = 7;

function config() {
  const { APP_USERNAME: username, APP_PASSWORD: password, AUTH_SECRET: secret } = process.env;
  return username && password && secret ? { username, password, secret } : null;
}

// constant-time compare, so the check doesn't leak how much of a guess was right
function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

// `username.expiry.signature` (the username is base64url so it can't contain the dots)
function makeToken(username, secret) {
  const value = `${Buffer.from(username).toString('base64url')}.${Date.now() + SESSION_DAYS * 86400000}`;
  return `${value}.${sign(value, secret)}`;
}

function readToken(token, cfg) {
  const [name, expiry, sig] = String(token || '').split('.');
  if (!name || !expiry || !sig) return null;
  if (!same(sig, sign(`${name}.${expiry}`, cfg.secret)) || Number(expiry) < Date.now()) return null;
  const username = Buffer.from(name, 'base64url').toString();
  // a changed APP_USERNAME signs everyone out
  return username === cfg.username ? username : null;
}

function getCookie(req, key) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === key) return decodeURIComponent(v.join('='));
  }
  return null;
}

function setCookie(req, res, value, maxAge) {
  const https = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`
  );
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Vercel parses JSON bodies into req.body; the Vite dev server leaves the stream to read
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

const NOT_SET_UP = 'Login isn’t set up: add APP_USERNAME, APP_PASSWORD and AUTH_SECRET to the server environment.';

// POST { username, password } -> 200 { user } with the session cookie, or 401
export async function handleLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const cfg = config();
  if (!cfg) return send(res, 500, { error: NOT_SET_UP });
  const { username, password } = await readBody(req);
  // both are always compared, so a wrong username takes as long as a wrong password
  const okUser = same(String(username || '').trim(), cfg.username);
  const okPass = same(password || '', cfg.password);
  if (!okUser || !okPass) return send(res, 401, { error: 'That username and password don’t match.' });
  setCookie(req, res, makeToken(cfg.username, cfg.secret), SESSION_DAYS * 86400);
  send(res, 200, { user: { id: cfg.username, name: cfg.username } });
}

export function handleLogout(req, res) {
  setCookie(req, res, '', 0);
  send(res, 200, { ok: true });
}

// GET -> 200 { user } while the session cookie is valid, otherwise 401
export function handleSession(req, res) {
  const cfg = config();
  if (!cfg) return send(res, 500, { error: NOT_SET_UP });
  const username = readToken(getCookie(req, COOKIE), cfg);
  if (!username) return send(res, 401, { error: 'Not signed in' });
  send(res, 200, { user: { id: username, name: username } });
}

export const routes = { '/api/login': handleLogin, '/api/logout': handleLogout, '/api/session': handleSession };
