import { MessageSquare, Moon, PanelLeftOpen, SquarePen, Sun, Table2 } from 'lucide-react';
import ChatTitle from './ChatTitle.jsx';

// assistant status pill: the dot colour comes from `status-<key>` in index.css
const STATUS = {
  ready: { label: 'Active', title: 'The assistant is connected and ready for questions' },
  thinking: { label: 'Thinking…', title: 'The assistant is working on an answer' },
  error: { label: 'Can’t reach assistant', title: 'The last request failed. Retry it from the chat.' },
  offline: { label: 'Offline', title: 'You’re offline. Questions will fail until the connection is back.' },
  unconfigured: { label: 'Not configured', title: 'VITE_N8N_CHAT_URL is missing from the .env file' },
};

// Header over the main panel: sidebar / new chat buttons (when the sidebar is closed), the open chat's name or the
// workbook title, the assistant status and quick actions (switch view, theme)
export default function TopBar({
  sidebarVisible,
  onToggleSidebar,
  onNewChat,
  view,
  chat,
  onRename,
  status,
  onToggleView,
  dark,
  onToggleTheme,
}) {
  const s = STATUS[status] ?? STATUS.ready;
  return (
    <header className="topbar">
      {!sidebarVisible && (
        <>
          <button type="button" className="icon-btn expand-btn" onClick={onToggleSidebar} aria-label="Open sidebar" title="Open sidebar">
            <PanelLeftOpen size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn new-chat-icon-btn" onClick={onNewChat} aria-label="New chat" title="New chat (Ctrl+Shift+O)">
            <SquarePen size={18} aria-hidden="true" />
          </button>
        </>
      )}

      {view === 'chat' && chat ? (
        <ChatTitle key={chat.id} chat={chat} onRename={onRename} />
      ) : (
        <span className="topbar-section">{view === 'clients' ? 'Clients Workbook' : 'New chat'}</span>
      )}

      <div className="topbar-actions">
        <span className={`status-pill status-${status}`} role="status" title={s.title}>
          <span className="status-dot" aria-hidden="true" />
          <span className="status-label">{s.label}</span>
        </span>
        <button
          type="button"
          className="icon-btn view-toggle-btn"
          onClick={onToggleView}
          aria-label={view === 'clients' ? 'Back to chat' : 'Open Clients Workbook'}
          title={view === 'clients' ? 'Back to chat' : 'Open Clients Workbook'}
        >
          {view === 'clients' ? <MessageSquare size={17} aria-hidden="true" /> : <Table2 size={17} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="icon-btn theme-toggle-btn"
          onClick={onToggleTheme}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={dark ? 'Light theme' : 'Dark theme'}
        >
          {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
