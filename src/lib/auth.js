// Login calls to the app's own server (server/auth.js); the session lives in an httpOnly cookie

async function call(path, options) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// The signed-in user ({ id, name }), or null. Throws when the server can't be reached or isn't set up.
export async function getSession() {
  const { ok, status, data } = await call('/api/session');
  if (ok) return data.user;
  if (status === 401) return null;
  throw new Error(data.error || 'Can’t reach the login service. Please try again.');
}

// Resolves to the user; throws with a sentence for the form when the login is refused
export async function login(username, password) {
  let result;
  try {
    result = await call('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error('Can’t reach the login service. Check your connection and try again.');
  }
  if (!result.ok) throw new Error(result.data.error || 'Something went wrong. Please try again.');
  return result.data.user;
}

export async function logout() {
  await call('/api/logout', { method: 'POST' });
}
