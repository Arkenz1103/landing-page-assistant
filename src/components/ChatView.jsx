import { useEffect, useMemo, useRef } from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import Markdown from './Markdown.jsx';
import CopyButton from './CopyButton.jsx';
import Composer from './Composer.jsx';
import { followUpChips } from '../lib/clients.js';
import { UNREACHABLE_MSG } from '../lib/api.js';

const STARTERS = [
  'Where are we at for Wagner Soil Testing?',
  'Who is assigned to Bruin Pest Management?',
  'Show the September landing pages for Wagner Soil Testing',
  "Which months don't have landing pages for A Vision Windscreens?",
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

export default function ChatView({ chat, waiting, error, clients, onSend, onRetry, onRetryError }) {
  const bottomRef = useRef(null);
  const messages = chat?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, waiting, error, chat?.id]);

  const last = messages[messages.length - 1];
  const chips = useMemo(() => {
    if (waiting || !last || last.role !== 'assistant') return [];
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return followUpChips(lastUser?.content, clients);
  }, [messages, last, waiting, clients]);

  if (!chat || messages.length === 0) {
    return (
      <div className="chat-scroll">
        <Welcome onSend={onSend} waiting={waiting} />
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
        <Composer onSend={onSend} waiting={waiting} />
      </div>
    </>
  );
}
