import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CHAT_URL = import.meta.env.VITE_N8N_CHAT_URL;
const SESSION_KEY = 'lpa-session-id';

const REQUEST_TIMEOUT_MS = 30000;
const NO_ANSWER_MSG = "Sorry, I didn't get an answer. Please try again.";
const UNREACHABLE_MSG = "Can't reach the assistant right now. Please try again.";

const STARTERS = [
  'Where are we at for Wagner Soil Testing?',
  'Who is assigned to Bruin Pest Management?',
  'Show the September landing pages for Wagner Soil Testing',
  "Which months don't have landing pages for A Vision Windscreens?",
];

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function extractOutput(data) {
  // n8n may return an object or a single-item array
  const item = Array.isArray(data) ? data[0] : data;
  const output = item?.output;
  return typeof output === 'string' && output.trim() ? output : '';
}

const markdownComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export default function App() {
  const [sessionId, setSessionId] = useState(getSessionId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, error]);

  async function send(text) {
    const chatInput = text.trim();
    if (!chatInput || loading) return;

    setMessages((m) => [...m, { role: 'user', content: chatInput }]);
    setInput('');
    setError('');
    setLoading(true);

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
        setError(UNREACHABLE_MSG);
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('Assistant response was not valid JSON:', parseErr);
      }
      const output = extractOutput(data);
      if (!output) console.warn('Assistant response had no "output" field:', data);
      setMessages((m) => [...m, { role: 'assistant', content: output || NO_ANSWER_MSG }]);
    } catch (err) {
      console.error(
        err.name === 'AbortError'
          ? `Assistant request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
          : 'Assistant request error:',
        err
      );
      setError(UNREACHABLE_MSG);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  function newChat() {
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
    setMessages([]);
    setError('');
    setInput('');
  }

  function onSubmit(e) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Landing Page Assistant</h1>
        <button className="new-chat" onClick={newChat} disabled={loading}>
          New chat
        </button>
      </header>

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <p>Ask about project status, assignments or landing pages.</p>
            <div className="starters">
              {STARTERS.map((q) => (
                <button key={q} className="starter" onClick={() => send(q)} disabled={loading}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.role === 'assistant' ? (
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {m.content}
                </ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}

        {loading && (
          <div className="message assistant typing" aria-label="Assistant is typing">
            <span /><span /><span />
          </div>
        )}

        {error && <div className="error">⚠️ {error}</div>}

        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={onSubmit}>
        <div className="composer-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question…"
            rows={1}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
        <p className="hint">Tip: include the client name, e.g. Wagner, Yandina or Coolum.</p>
      </form>
    </div>
  );
}
