import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

// The open chat's name in the top bar: click it to rename (Enter or clicking away saves, Escape cancels)
export default function ChatTitle({ chat, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startRename() {
    setDraft(chat.title);
    setEditing(true);
  }

  function commitRename() {
    const t = draft.trim();
    if (t && t !== chat.title) onRename(chat.id, t);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="rename-input topbar-rename-input"
        value={draft}
        aria-label="Chat name"
        maxLength={120}
        style={{ width: `${draft.length + 3}ch` }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button type="button" className="topbar-title" onClick={startRename} title="Rename chat">
      <span className="topbar-title-text">{chat.title}</span>
      <Pencil size={13} className="topbar-title-icon" aria-hidden="true" />
    </button>
  );
}
