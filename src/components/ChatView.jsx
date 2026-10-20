import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import Logo from './Logo.jsx';
import Markdown from './Markdown.jsx';
import CopyButton from './CopyButton.jsx';
import Composer from './Composer.jsx';
import { QUESTIONS, followUpChips } from '../lib/clients.js';
import { NO_ANSWER_MSG, STOPPED_MSG, UNREACHABLE_MSG } from '../lib/api.js';
import { isWorkbookQuestion, splitMasterCta } from '../lib/master.js';

// the same wording as the sidebar quick questions
const STARTERS = [
  QUESTIONS.status('Wagner Soil Testing'),
  QUESTIONS.assigned('Bruin Pest Management'),
  QUESTIONS.pages('Wagner Soil Testing'),
  QUESTIONS.months('A Vision Windscreens'),
];

// landing screen greeting by local time; one line per period is picked when the period starts
const GREETINGS = {
  // statements only: the line below already asks "What would you like to check?"
  morning: ['Good morning! Let’s get to work.', 'Good morning! Hope your day starts well.', 'Good morning! Great to see you.'],
  afternoon: ['Good afternoon! Let’s keep it moving.', 'Good afternoon! Hope your day is great.', 'Good afternoon! Great to see you.'],
  evening: ['Good evening! Let’s finish strong.', 'Good evening! Hope you had a good day.', 'Good evening! Great to see you.'],
};

function period(date) {
  const h = date.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

function pickGreeting(p) {
  const list = GREETINGS[p];
  return list[Math.floor(Math.random() * list.length)];
}

// re-checked every minute, so a screen left open moves from morning to afternoon to evening
function useTimeGreeting() {
  const [state, setState] = useState(() => {
    const p = period(new Date());
    return { period: p, text: pickGreeting(p) };
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const p = period(new Date());
      setState((s) => (s.period === p ? s : { period: p, text: pickGreeting(p) }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  return state.text;
}

function Welcome({ onSend, waiting }) {
  const greeting = useTimeGreeting();
  return (
    <div className="welcome">
      <h2 className="welcome-greeting">
        <Logo className="welcome-logo" />
        <span>{greeting}</span>
      </h2>
      <p className="welcome-title">What would you like to check?</p>
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

// Under partial multi-client answers and whole-workbook answers: opens the Clients tab on Master Sheet Clients
function MasterSheetCta({ onOpen }) {
  return (
    <div className="master-cta">
      <p>For a complete side-by-side view across all clients, visit the master overview:</p>
      <button type="button" className="master-cta-btn" onClick={onOpen}>
        <span aria-hidden="true">📊</span> Open Master Sheet Clients
      </button>
    </div>
  );
}

// The answer without the workflow's master sheet link, and whether to show the button
// (the link was there, or the question was about the whole workbook)
function answerParts(messages, i) {
  const { text, cta } = splitMasterCta(messages[i].content);
  const answered = text !== NO_ANSWER_MSG && text !== STOPPED_MSG;
  return { text, cta: cta || (answered && isWorkbookQuestion(messages[i - 1]?.content)) };
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

export default function ChatView({ chat, waiting, error, clients, onSend, onStop, onRetry, onRetryError, onOpenMaster }) {
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

  const answers = useMemo(() => messages.map((m, i) => (m.role === 'assistant' ? answerParts(messages, i) : null)), [messages]);

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
                <Markdown>{answers[i].text}</Markdown>
                {answers[i].cta && <MasterSheetCta onOpen={onOpenMaster} />}
                <div className="msg-actions">
                  <CopyButton text={answers[i].text} label="Copy answer" />
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
