import { CircleHelp, MessageSquare, PanelLeftClose, Search, Settings, SquarePen, Users } from 'lucide-react';
import ChatsPanel from './ChatsPanel.jsx';
import ClientsPanel from './ClientsPanel.jsx';
import HelpPanel from './HelpPanel.jsx';
import Logo from './Logo.jsx';

const NAV = [
  { key: 'chats', label: 'Chats', icon: MessageSquare },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'help', label: 'Help', icon: CircleHelp },
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
  activeSheet,
  onOpenSheet,
  onOpenClient,
  onSettings,
  onHome,
  searchRef,
}) {
  return (
    <div className="sidebar-inner">
      <div className="sidebar-top">
        <h1 className="app-name">
          <button type="button" className="home-btn" onClick={onHome} title="Home">
            <Logo className="app-logo" />
            <span>Landing Page Assistant</span>
          </button>
        </h1>
        <button type="button" className="icon-btn collapse-btn" onClick={onClose} aria-label="Close sidebar" title="Close sidebar">
          <PanelLeftClose size={18} aria-hidden="true" />
        </button>
      </div>

      <button type="button" className="new-chat-btn" onClick={onNewChat} title="New chat (Ctrl+Shift+O)">
        <SquarePen size={16} aria-hidden="true" />
        New chat
      </button>

      <div className="search-box">
        <Search size={15} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search chats"
          aria-label="Search chats"
          title="Search chats (Ctrl+K)"
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
          <ClientsPanel
            clients={clients}
            status={clientStatus}
            onRefresh={onRefreshClients}
            onAsk={onAsk}
            activeSheet={activeSheet}
            onOpenSheet={onOpenSheet}
            onOpenClient={onOpenClient}
          />
        )}
        {panel === 'help' && <HelpPanel onAsk={onAsk} />}
      </div>

      <button type="button" className="settings-btn" onClick={onSettings}>
        <Settings size={16} aria-hidden="true" />
        Settings
      </button>
    </div>
  );
}
