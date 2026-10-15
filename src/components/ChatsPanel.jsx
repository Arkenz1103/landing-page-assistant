import { useEffect, useRef, useState } from 'react';
import { Ellipsis, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';

const DAY = 24 * 60 * 60 * 1000;

function groupChats(chats) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups = { Pinned: [], Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const c of sorted) {
    if (c.pinned) groups.Pinned.push(c);
    else if (c.updatedAt >= startOfToday) groups.Today.push(c);
    else if (c.updatedAt >= startOfToday - DAY) groups.Yesterday.push(c);
    else if (c.updatedAt >= startOfToday - 7 * DAY) groups['Previous 7 days'].push(c);
    else groups.Older.push(c);
  }
  return Object.entries(groups).filter(([, list]) => list.length > 0);
}

function ChatItem({ chat, active, onOpen, onPin, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) closeMenu();
    }
    function onKey(e) {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function closeMenu() {
    setMenuOpen(false);
    setConfirmDelete(false);
  }

  function startRename() {
    closeMenu();
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
      <li className="chat-item editing">
        <input
          ref={inputRef}
          className="rename-input"
          value={draft}
          aria-label="Chat name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li ref={rootRef} className={`chat-item ${active ? 'active' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <button
        type="button"
        className="chat-link"
        onClick={() => onOpen(chat.id)}
        aria-current={active ? 'page' : undefined}
        title={chat.title}
      >
        {chat.title || 'Untitled chat'}
      </button>
      <button
        type="button"
        className="chat-menu-btn"
        aria-label={`Options for ${chat.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onPin(chat.id);
              closeMenu();
            }}
          >
            {chat.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
            {chat.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button type="button" role="menuitem" onClick={startRename}>
            <Pencil size={15} aria-hidden="true" />
            Rename
          </button>
          {confirmDelete ? (
            <button
              type="button"
              role="menuitem"
              className="danger confirm"
              autoFocus
              onClick={() => {
                closeMenu();
                onDelete(chat.id);
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Confirm delete
            </button>
          ) : (
            <button type="button" role="menuitem" className="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function ChatsPanel({ chats, query, activeId, ...handlers }) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? chats.filter(
        (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))
      )
    : chats;

  if (chats.length === 0) return <p className="panel-empty">No chats yet. Ask a question to start one.</p>;
  if (filtered.length === 0) return <p className="panel-empty">No chats match “{query.trim()}”.</p>;

  return (
    <div className="chat-groups">
      {groupChats(filtered).map(([label, list]) => (
        <section key={label} className="chat-group" aria-label={label}>
          <h3 className="group-label">{label}</h3>
          <ul>
            {list.map((c) => (
              <ChatItem key={c.id} chat={c} active={c.id === activeId} {...handlers} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
