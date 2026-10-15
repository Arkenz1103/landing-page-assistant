const CHAT_URL = import.meta.env.VITE_N8N_CHAT_URL;

export const REQUEST_TIMEOUT_MS = 30000;
export const UNREACHABLE_MSG = "Can't reach the assistant right now. Please try again.";
export const NO_ANSWER_MSG = "Sorry, I didn't get an answer. Please try again.";

function extractOutput(data) {
  // n8n may return an object or a single-item array
  const item = Array.isArray(data) ? data[0] : data;
  const output = item?.output;
  return typeof output === 'string' ? output : '';
}

/**
 * Sends one message to the n8n chat workflow.
 * Resolves to the markdown output string (may be empty).
 * Throws on network error, non-200 or timeout (details are logged).
 */
export async function sendChatMessage(sessionId, chatInput) {
  if (!CHAT_URL) {
    console.error('VITE_N8N_CHAT_URL is not set. Copy .env.example to .env and set it.');
    throw new Error('Missing VITE_N8N_CHAT_URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput }),
      signal: controller.signal,
    });
    if (res.status !== 200) {
      const body = await res.text().catch(() => '');
      console.error('Assistant request failed:', res.status, res.statusText, body);
      throw new Error(`HTTP ${res.status}`);
    }

    let data = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error('Assistant response was not valid JSON:', parseErr);
    }
    const output = extractOutput(data);
    if (!output.trim()) console.warn('Assistant response had no "output" field:', data);
    return output;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`Assistant request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    } else if (!err.message?.startsWith('HTTP ')) {
      console.error('Assistant request error:', err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
