import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const MAX_HEIGHT = 220;

export default function Composer({ onSend, waiting, large = false, autoFocus = false }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const canSend = value.trim().length > 0 && !waiting;

  function submit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

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
          placeholder="Ask anything about landing page url..."
          rows={large ? 2 : 1}
        />
        <button type="submit" className="send-btn" disabled={!canSend} aria-label="Send message" title="Send">
          <ArrowUp size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="hint">Tip: include the client name, e.g. Wagner, Yandina or Coolum.</p>
    </form>
  );
}
