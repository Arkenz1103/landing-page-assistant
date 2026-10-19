import { useEffect, useMemo, useRef } from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import Markdown from './Markdown.jsx';
import CopyButton from './CopyButton.jsx';
import Composer from './Composer.jsx';
import { QUESTIONS, followUpChips } from '../lib/clients.js';
import { UNREACHABLE_MSG } from '../lib/api.js';

// the same wording as the sidebar quick questions
const STARTERS = [
  QUESTIONS.status('Wagner Soil Testing'),
  QUESTIONS.assigned('Bruin Pest Management'),
  QUESTIONS.pages('Wagner Soil Testing'),
  QUESTIONS.months('A Vision Windscreens'),
];

function Welcome({ onSend, waiting }) {
  return (
    <div className="welcome">
      <h2 className="welcome-title">What would you like to check?</h2>
      <Composer onSend={onSend} waiting={waiting} large autoFocus />
      <div className="starters">
        {STARTERS.map((q) => (
          <button key={q} type="button" className="starter" onClick={() => onSend(q)} disabled={waiting}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// shown labels are generic; the question sent names the client's sheet so the agent can route it
const CLIENT_PROMPTS = [
  { key: 'status', icon: '📊', label: 'Where are we at for this client?' },
  { key: 'pages', icon: '🔗', label: 'Show live landing pages' },
  { key: 'months', icon: '❌', label: 'Which months are missing URLs?' },
  { key: 'assigned', icon: '👤', label: 'Who is assigned to this client?' },
];

function ClientWelcome({ client, onSend, waiting }) {
  return (
    <div className="welcome">
      <div className="client-welcome">
        <h2 className="client-welcome-title">
          {client.name} <span>— Ask anything about this client</span>
        </h2>
        <p className="client-welcome-help">Select a quick question below or type your query in the chat box.</p>
        <div className="chips client-welcome-chips" aria-label="Suggested questions">
          {CLIENT_PROMPTS.map((p) => (
            <button key={p.key} type="button" className="chip" onClick={() => onSend(QUESTIONS[p.key](client.sheet))} disabled={waiting}>
              <span aria-hidden="true">{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
      </div>
      <Composer onSend={onSend} waiting={waiting} large autoFocus />
    </div>
  );
}

function Waiting() {
  return (
    <div className="waiting" role="status" aria-live="polite">
      <span className="waiting-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Checking the sheet…
    </div>
  );
}

export default function ChatView({ chat, waiting, error, clients, onSend, onStop, onRetry, onRetryError }) {
  const bottomRef = useRef(null);
  const messages = chat?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, waiting, error, chat?.id]);

  const last = messages[messages.length - 1];
  const chips = useMemo(() => {
    if (waiting || !last || last.role !== 'assistant') return [];
    return followUpChips(messages, clients);
  }, [messages, last, waiting, clients]);

  if (!chat || messages.length === 0) {
    return (
      <div className="chat-scroll">
        {chat?.client ? (
          <ClientWelcome client={chat.client} onSend={onSend} waiting={waiting} />
        ) : (
          <Welcome onSend={onSend} waiting={waiting} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="chat-scroll">
        <div className="thread">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="msg msg-user">
                <div className="bubble">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="msg msg-assistant">
                <Markdown>{m.content}</Markdown>
                <div className="msg-actions">
                  <CopyButton text={m.content} label="Copy answer" />
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => onRetry(i)}
                    disabled={waiting}
                    aria-label="Retry this answer"
                  >
                    <RotateCw size={14} aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                </div>
                {i === messages.length - 1 && chips.length > 0 && (
                  <div className="chips" aria-label="Suggested follow-up questions">
                    {chips.map((c) => (
                      <button key={c.label} type="button" className="chip" onClick={() => onSend(c.question)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {waiting && <Waiting />}

          {error && !waiting && (
            <div className="error-banner" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <span>{UNREACHABLE_MSG}</span>
              <button type="button" className="action-btn" onClick={onRetryError}>
                <RotateCw size={14} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="composer-dock">
        <Composer onSend={onSend} onStop={onStop} waiting={waiting} />
      </div>
    </>
  );
}
