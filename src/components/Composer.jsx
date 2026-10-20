import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';

const MAX_HEIGHT = 220;
const NOTICE_MS = 5000;

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

const SPEECH_ERRORS = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to use voice input.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in your browser settings to use voice input.',
  'audio-capture': 'No microphone was found. Check that one is connected.',
  'no-speech': "Didn't catch that. Click the mic and try again.",
  network: 'Voice input needs an internet connection. Please try again.',
};

export default function Composer({ onSend, onStop, waiting, large = false, autoFocus = false, enterToSend = true }) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const ref = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // Stop the microphone if the composer goes away mid-dictation.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const canSend = value.trim().length > 0 && !waiting;

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function startListening() {
    if (!SpeechRecognition) {
      setNotice('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    // Spoken words are added after whatever is already typed.
    const base = value.trim() ? `${value.trimEnd()} ` : '';
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-AU';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setValue(base + text.trimStart());
    };
    recognition.onerror = (e) => {
      if (e.error !== 'aborted') setNotice(SPEECH_ERRORS[e.error] || 'Voice input stopped unexpectedly. Please try again.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      ref.current?.focus();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setNotice('');
      setListening(true);
    } catch {
      setNotice('Voice input could not start. Please try again.');
    }
  }

  function submit() {
    if (!canSend) return;
    stopListening();
    onSend(value.trim());
    setValue('');
  }

  // Enter sends (Shift+Enter: new line); with "Press Enter to send" off, Ctrl/Cmd+Enter sends instead
  function onKeyDown(e) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (enterToSend ? !e.shiftKey : e.ctrlKey || e.metaKey) {
      e.preventDefault();
      submit();
    }
  }

  const micLabel = listening ? 'Stop listening' : 'Click to speak';

  return (
    <form
      className={`composer ${large ? 'composer-large' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="composer-box">
        <label htmlFor="composer-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="composer-input"
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={listening ? 'Listening...' : 'Ask anything about landing page URLs...'}
          rows={large ? 2 : 1}
        />
        <button
          type="button"
          className={`mic-btn ${listening ? 'listening' : ''}`}
          onClick={listening ? stopListening : startListening}
          aria-label={micLabel}
          aria-pressed={listening}
          title={micLabel}
        >
          <Mic size={18} aria-hidden="true" />
        </button>
        {waiting && onStop ? (
          <button type="button" className="send-btn stop-btn" onClick={onStop} aria-label="Stop generating" title="Stop generating">
            <Square size={14} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" className="send-btn" disabled={!canSend} aria-label="Send message" title="Send">
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className={`hint ${notice ? 'hint-error' : ''}`} role="status" aria-live="polite">
        {notice || 'For best results, include the full client name — e.g. Wagner Soil Testing or Bruin Pest Management.'}
      </p>
    </form>
  );
}
