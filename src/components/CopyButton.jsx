import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts without the async clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Copies `text` and briefly shows "Copied". `label` is shown next to the icon when given. */
export default function CopyButton({ text, label, ariaLabel, className = '' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    if (await copyText(text)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      className={`copy-btn ${className}`}
      onClick={onClick}
      aria-label={copied ? 'Copied' : ariaLabel || label || 'Copy'}
      title={copied ? 'Copied' : ariaLabel || label || 'Copy'}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {label ? <span>{copied ? 'Copied' : label}</span> : copied && <span className="copied-tag">Copied</span>}
    </button>
  );
}
