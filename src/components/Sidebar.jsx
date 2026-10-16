import { CircleHelp, MessageSquare, Moon, PanelLeftClose, Search, SquarePen, Sun, Users } from 'lucide-react';
import ChatsPanel from './ChatsPanel.jsx';
import ClientsPanel from './ClientsPanel.jsx';
import HelpPanel from './HelpPanel.jsx';

const NAV = [
  { key: 'chats', label: 'Chats', icon: MessageSquare },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'help', label: 'Help', icon: CircleHelp },
];

const THEMES = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

export default function Sidebar({
  panel,
  onPanel,
  query,
  onQuery,
  onNewChat,
  onClose,
  chats,
  activeId,
  chatHandlers,
  clients,
  clientStatus,
  onRefreshClients,
  onAsk,
  theme,
  onTheme,
}) {
  return (
    <div className="sidebar-inner">
      <div className="sidebar-top">
        <h1 className="app-name">Landing Page Assistant</h1>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close sidebar" title="Close sidebar">
          <PanelLeftClose size={18} aria-hidden="true" />
        </button>
      </div>

      <button type="button" className="new-chat-btn" onClick={onNewChat}>
        <SquarePen size={16} aria-hidden="true" />
        New chat
      </button>

      <div className="search-box">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search chats"
          aria-label="Search chats"
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            if (panel !== 'chats') onPanel('chats');
          }}
        />
      </div>

      <nav className="side-nav" aria-label="Sidebar sections">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`nav-btn ${panel === key ? 'active' : ''}`}
            aria-pressed={panel === key}
            onClick={() => onPanel(key)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-panel">
        {panel === 'chats' && <ChatsPanel chats={chats} query={query} activeId={activeId} {...chatHandlers} />}
        {panel === 'clients' && (
          <ClientsPanel clients={clients} status={clientStatus} onRefresh={onRefreshClients} onAsk={onAsk} />
        )}
        {panel === 'help' && <HelpPanel onAsk={onAsk} />}
      </div>

      <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
        {THEMES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={theme === key}
            className={theme === key ? 'active' : ''}
            onClick={() => onTheme(key)}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
