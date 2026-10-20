const CHAT_URL = import.meta.env.VITE_N8N_CHAT_URL;

export const REQUEST_TIMEOUT_MS = 60000;
export const UNREACHABLE_MSG = "Can't reach the assistant right now. Please try again.";
// the error banner text for each failed request `kind` (see requestError)
export const ERROR_MSGS = {
  network: UNREACHABLE_MSG,
  offline: "You're offline. Check your connection and try again.",
  timeout: 'The assistant took too long to answer. Please try again.',
  http: 'The assistant ran into a problem on its side. Please try again in a moment.',
  config: "The assistant isn't set up: VITE_N8N_CHAT_URL is missing from the .env file.",
};
export const NO_ANSWER_MSG = "Sorry, I didn't get an answer. Please try again.";
export const STOPPED_MSG = '_Response stopped._';

// Conversation history sent with each message: the last turns, long answers (tables) cut short,
// stopped / empty-answer placeholders left out.
const HISTORY_TURNS = 10;
const HISTORY_CHARS = 1500;

function toHistory(messages = []) {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content && m.content !== STOPPED_MSG && m.content !== NO_ANSWER_MSG)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.length > HISTORY_CHARS ? m.content.slice(0, HISTORY_CHARS) + ' …' : m.content }));
}

// An Error carrying `kind` ('config', 'http', 'timeout', 'offline' or 'network'), so the chat can say what went wrong
function requestError(kind, message) {
  return Object.assign(new Error(message), { kind });
}

function extractOutput(data) {
  // n8n may return an object or a single-item array
  const item = Array.isArray(data) ? data[0] : data;
  const output = item?.output;
  return typeof output === 'string' ? output : '';
}

// The chat's table state ({ client, active_filter, active_layout }) comes back as a JSON string; null when absent
function extractTableState(data) {
  const item = Array.isArray(data) ? data[0] : data;
  try {
    const state = item?.table_state ? JSON.parse(item.table_state) : null;
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

/**
 * Sends one message to the n8n chat workflow.
 * Resolves to the markdown output string (may be empty).
 * Throws on network error, non-200 or timeout (details are logged); the error's `kind` says which.
 * Pass `signal` to cancel the request (e.g. the Stop button); it then throws an AbortError.
 * Pass `timeoutMs` for requests that need longer than the default (e.g. the full master sheet).
 * Pass `client` ({ sheet, name }) for a chat bound to one client: a question that names no client is answered for it.
 * Pass `history` (the chat's earlier messages) so a follow-up like "How about Ace Restumping?" reuses the previous request.
 * Pass `tableState` (the chat's active row filter / column layout) and `onTableState` to receive the updated one,
 * so "sort by suburb" or "How about Ace Restumping?" keeps the table the user set up.
 */
export async function sendChatMessage(
  sessionId,
  chatInput,
  { signal, timeoutMs = REQUEST_TIMEOUT_MS, client, history, tableState, onTableState } = {}
) {
  if (!CHAT_URL) {
    console.error('VITE_N8N_CHAT_URL is not set. Copy .env.example to .env and set it.');
    throw requestError('config', 'Missing VITE_N8N_CHAT_URL');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onCancel, { once: true });

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId,
        chatInput,
        history: toHistory(history),
        ...(tableState && { tableState }),
        ...(client?.sheet && { activeClientName: client.name || client.sheet, activeClientSheet: client.sheet }),
      }),
      signal: controller.signal,
    });
    if (res.status !== 200) {
      const body = await res.text().catch(() => '');
      console.error('Assistant request failed:', res.status, res.statusText, body);
      throw requestError('http', `HTTP ${res.status}`);
    }

    let data = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error('Assistant response was not valid JSON:', parseErr);
    }
    const output = extractOutput(data);
    if (!output.trim()) console.warn('Assistant response had no "output" field:', data);
    const nextState = extractTableState(data);
    if (nextState) onTableState?.(nextState);
    return output;
  } catch (err) {
    if (err.kind) throw err;
    if (err.name === 'AbortError') {
      if (!timedOut) throw err; // cancelled by the caller (Stop button)
      console.error(`Assistant request timed out after ${timeoutMs / 1000}s`);
      throw requestError('timeout', 'Request timed out');
    }
    console.error('Assistant request error:', err);
    throw requestError(navigator.onLine === false ? 'offline' : 'network', err.message);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCancel);
  }
}
