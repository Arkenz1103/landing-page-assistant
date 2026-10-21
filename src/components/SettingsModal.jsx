import { useEffect, useRef, useState } from 'react';
import {
  CircleUser,
  Database,
  Download,
  Eraser,
  Info,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { version } from '../../package.json';
import { chatExport } from '../lib/storage.js';
import { PHOTO_TYPES, photoFromFile, shownName } from '../lib/profile.js';
import Avatar from './Avatar.jsx';

const THEMES = [
  { key: 'system', label: 'System', icon: Monitor },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

const TEXT_SIZES = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
];

const CHAT_WIDTHS = [
  { key: 'narrow', label: 'Narrow' },
  { key: 'medium', label: 'Medium' },
  { key: 'wide', label: 'Wide' },
];

const LAUNCH_VIEWS = [
  { key: 'chat', label: 'New Chat' },
  { key: 'clients', label: 'Clients Workbook' },
];

const ROW_LIMITS = [
  { key: 50, label: '50' },
  { key: 100, label: '100' },
  { key: 'all', label: 'All' },
];

// left-hand navigation (the search box filters it)
const SECTIONS = [
  {
    key: 'general',
    label: 'General',
    icon: Settings,
    keywords: 'appearance theme text size width chat table compact rows enter send launch start view clients workbook',
  },
  {
    key: 'account',
    label: 'Account',
    icon: CircleUser,
    keywords: 'profile photo picture avatar name full name call display username login log out sign out',
  },
  {
    key: 'data',
    label: 'Data & Cache',
    icon: Database,
    keywords:
      'client list master sheet workbook cache sync refresh conversation state layout columns filter table row limit chat history export import clear delete backup',
  },
  { key: 'about', label: 'About', icon: Info, keywords: 'version system status n8n workflow supabase' },
];

// System status, as shown by the last client list request (the list comes from Supabase through the n8n workflow)
const STATUS = {
  ok: { n8n: 'Active', supabase: 'Connected', tone: 'ok' },
  // a fresh saved list was used, so the workflow wasn't asked this session
  cached: { n8n: 'Active (cached)', supabase: 'Connected (cached)', tone: 'ok' },
  loading: { n8n: 'Checking…', supabase: 'Checking…', tone: 'muted' },
  error: { n8n: 'Unreachable', supabase: 'Unknown', tone: 'error' },
  idle: { n8n: 'Not checked yet', supabase: 'Not checked yet', tone: 'muted' },
};

function syncedLabel(time) {
  if (!time) return 'Never synced on this device.';
  const mins = Math.round((Date.now() - time) / 60000);
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return `Last synced ${ago} (${new Date(time).toLocaleString()}).`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Saves the chats as a JSON file (Settings > Export chats)
function downloadChats(chats) {
  const blob = new Blob([chatExport(chats)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `landing-page-assistant-chats-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Export / import / clear the chat history
function ChatHistorySection({ chats, onImportChats, onClearChats }) {
  const fileRef = useRef(null);
  const [imported, setImported] = useState(null); // a count, or 'error'
  const [cleared, setCleared] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const pinned = chats.filter((c) => c.pinned).length;

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be picked again
    if (!file) return;
    try {
      setImported(onImportChats(await file.text()));
    } catch {
      setImported('error');
    }
  }

  return (
    <section className="settings-section" aria-labelledby="settings-history">
      <h4 id="settings-history" className="settings-section-title">
        Chat history
      </h4>
      <Row label="Export chats" hint={`Downloads all ${plural(chats.length, 'chat')} as a JSON file.`}>
        <button type="button" className="small-btn" onClick={() => downloadChats(chats)} disabled={chats.length === 0}>
          <Download size={13} aria-hidden="true" />
          Export
        </button>
      </Row>
      <Row
        label="Import chats"
        hint={
          imported === null
            ? 'Adds the chats from an exported file. Chats already here keep the newer copy.'
            : imported === 'error'
              ? 'That file isn’t a chat export.'
              : `Imported ${plural(imported, 'chat')}.`
        }
      >
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
        <button type="button" className="small-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={13} aria-hidden="true" />
          Import
        </button>
      </Row>
      <Row
        label="Clear all chats"
        hint={
          cleared !== null
            ? `Removed ${plural(cleared, 'chat')}.`
            : pinned
              ? `Removes every chat except the ${plural(pinned, 'pinned chat')}.`
              : 'Removes every chat. Pinned chats are kept.'
        }
      >
        {confirmClear ? (
          <button
            type="button"
            className="small-btn clear-btn danger"
            autoFocus
            onBlur={() => setConfirmClear(false)}
            onClick={() => {
              setConfirmClear(false);
              setCleared(onClearChats());
            }}
          >
            <Trash2 size={13} aria-hidden="true" />
            Confirm clear
          </button>
        ) : (
          <button
            type="button"
            className="small-btn clear-btn"
            onClick={() => setConfirmClear(true)}
            disabled={chats.length === pinned}
          >
            <Trash2 size={13} aria-hidden="true" />
            Clear all
          </button>
        )}
      </Row>
    </section>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(({ key, label: text, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {Icon && <Icon size={14} aria-hidden="true" />}
          {text}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" aria-hidden="true" />
    </button>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div className="settings-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

function GeneralTab({ theme, onTheme, settings, set }) {
  return (
    <>
      <h3 className="settings-heading">General</h3>

      <section className="settings-section" aria-labelledby="settings-appearance">
        <h4 id="settings-appearance" className="settings-section-title">
          Appearance
        </h4>
        <Row label="Theme">
          <Segmented label="Theme" options={THEMES} value={theme} onChange={onTheme} />
        </Row>
        <Row label="Transcript text size" hint="Size of the conversation transcript text.">
          <Segmented label="Transcript text size" options={TEXT_SIZES} value={settings.textSize} onChange={set('textSize')} />
        </Row>
        <Row label="Transcript width" hint="Maximum width of the transcript and composer columns.">
          <Segmented label="Transcript width" options={CHAT_WIDTHS} value={settings.chatWidth} onChange={set('chatWidth')} />
        </Row>
      </section>

      <section className="settings-section" aria-labelledby="settings-behavior">
        <h4 id="settings-behavior" className="settings-section-title">
          Chat &amp; table behavior
        </h4>
        <Row label="Compact table rows" hint="Less padding in data tables, so more rows fit on screen.">
          <Toggle label="Compact table rows" checked={settings.compactTables} onChange={set('compactTables')} />
        </Row>
        <Row
          label="Press Enter to send"
          hint={settings.enterToSend ? 'Shift+Enter adds a new line.' : 'Enter adds a new line; Ctrl+Enter sends.'}
        >
          <Toggle label="Press Enter to send" checked={settings.enterToSend} onChange={set('enterToSend')} />
        </Row>
        <Row label="Default launch view" hint="What the app opens on.">
          <Segmented label="Default launch view" options={LAUNCH_VIEWS} value={settings.launchView} onChange={set('launchView')} />
        </Row>
      </section>
    </>
  );
}

function DataTab({
  settings,
  set,
  clientStatus,
  clientsSyncedAt,
  onSyncClients,
  masterStatus,
  masterSyncedAt,
  onSyncMaster,
  onClearTableState,
  chats,
  onImportChats,
  onClearChats,
}) {
  const [cleared, setCleared] = useState(null);
  const syncing = clientStatus === 'loading';
  const masterSyncing = masterStatus === 'loading';

  return (
    <>
      <h3 className="settings-heading">Data &amp; Cache</h3>

      <section className="settings-section" aria-labelledby="settings-cache">
        <h4 id="settings-cache" className="settings-section-title">
          Cache management
        </h4>
        <Row
          label="Client list cache"
          hint={syncing ? 'Syncing…' : clientStatus === 'error' ? 'Sync failed. Try again in a moment.' : syncedLabel(clientsSyncedAt)}
        >
          <button type="button" className="small-btn" onClick={onSyncClients} disabled={syncing}>
            <RefreshCw size={13} className={`refresh-icon ${syncing ? 'spin' : ''}`} aria-hidden="true" />
            Sync Now
          </button>
        </Row>
        <Row
          label="Master sheet cache"
          hint={
            masterSyncing ? 'Syncing…' : masterStatus === 'error' ? 'Sync failed. Try again in a moment.' : syncedLabel(masterSyncedAt)
          }
        >
          <button type="button" className="small-btn" onClick={onSyncMaster} disabled={masterSyncing}>
            <RefreshCw size={13} className={`refresh-icon ${masterSyncing ? 'spin' : ''}`} aria-hidden="true" />
            Sync Now
          </button>
        </Row>
        <Row
          label="Clear conversation state"
          hint={
            cleared === null
              ? 'Forgets table filters and column layouts. Chat history is kept.'
              : `Cleared. ${cleared} chat${cleared === 1 ? '' : 's'} had a saved table layout.`
          }
        >
          <button type="button" className="small-btn clear-btn" onClick={() => setCleared(onClearTableState())}>
            <Eraser size={13} aria-hidden="true" />
            Clear
          </button>
        </Row>
      </section>

      <ChatHistorySection chats={chats} onImportChats={onImportChats} onClearChats={onClearChats} />

      <section className="settings-section" aria-labelledby="settings-display">
        <h4 id="settings-display" className="settings-section-title">
          Data display
        </h4>
        <Row label="Default table row limit" hint="Rows per page in the Clients workbook sheets.">
          <Segmented label="Default table row limit" options={ROW_LIMITS} value={settings.rowLimit} onChange={set('rowLimit')} />
        </Row>
      </section>
    </>
  );
}

// Profile (photo, names) and the login: the profile is saved per user on this device
function AccountTab({ user, profile, onProfile, onSignOut }) {
  const fileRef = useRef(null);
  const [photoError, setPhotoError] = useState('');
  const set = (key) => (e) => onProfile({ ...profile, [key]: e.target.value });

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be picked again
    if (!file) return;
    try {
      onProfile({ ...profile, photo: await photoFromFile(file) });
      setPhotoError('');
    } catch (err) {
      setPhotoError(err.message);
    }
  }

  return (
    <>
      <h3 className="settings-heading">Account</h3>

      <section className="settings-section" aria-labelledby="settings-profile">
        <h4 id="settings-profile" className="settings-section-title">
          Profile
        </h4>
        <Row label="Profile photo" hint={photoError || 'PNG, JPEG, or WebP, up to 10MB.'}>
          <div className="profile-photo">
            <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(',')} hidden onChange={onFile} />
            {profile.photo && (
              <button type="button" className="small-btn" onClick={() => onProfile({ ...profile, photo: '' })}>
                Remove
              </button>
            )}
            <button
              type="button"
              className="profile-photo-btn"
              onClick={() => fileRef.current?.click()}
              aria-label={profile.photo ? 'Change profile photo' : 'Upload profile photo'}
              title={profile.photo ? 'Change photo' : 'Upload photo'}
            >
              <Avatar photo={profile.photo} name={shownName(profile, user)} className="avatar-lg" />
              <span className="profile-photo-overlay" aria-hidden="true">
                <Upload size={15} />
              </span>
            </button>
          </div>
        </Row>
        <Row label="Full name">
          <input
            className="settings-input"
            value={profile.fullName}
            onChange={set('fullName')}
            maxLength={80}
            placeholder="Your full name"
            aria-label="Full name"
            autoComplete="name"
          />
        </Row>
        <Row label="What should the assistant call you?" hint="Used in the greeting and the sidebar.">
          <input
            className="settings-input"
            value={profile.displayName}
            onChange={set('displayName')}
            maxLength={40}
            placeholder={profile.fullName.trim().split(/\s+/)[0] || user.name}
            aria-label="What should the assistant call you?"
            autoComplete="nickname"
          />
        </Row>
      </section>

      <section className="settings-section" aria-labelledby="settings-login">
        <h4 id="settings-login" className="settings-section-title">
          Login
        </h4>
        <Row label="Username" hint="Set by APP_USERNAME in the server’s .env file.">
          <span className="settings-value">{user.name}</span>
        </Row>
        <Row label="Log out of this device">
          <button type="button" className="small-btn" onClick={onSignOut}>
            <LogOut size={13} aria-hidden="true" />
            Log out
          </button>
        </Row>
      </section>
    </>
  );
}

function AboutTab({ clientStatus }) {
  const status = STATUS[clientStatus] ?? STATUS.idle;
  return (
    <>
      <h3 className="settings-heading">About Landing Page Assistant</h3>

      <section className="settings-section">
        <Row label="Version">
          <span className="settings-value">v{version}</span>
        </Row>
        <Row label="System status" hint="From the last client list sync.">
          <span className={`settings-status ${status.tone}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            n8n Workflow: {status.n8n} | Supabase: {status.supabase}
          </span>
        </Row>
      </section>
    </>
  );
}

// Settings: General (appearance, chat and table behaviour), Account (profile, login), Data & Cache, About
export default function SettingsModal({
  open,
  onClose,
  theme,
  onTheme,
  settings,
  onSettings,
  clientStatus,
  clientsSyncedAt,
  onSyncClients,
  masterStatus,
  masterSyncedAt,
  onSyncMaster,
  onClearTableState,
  chats,
  onImportChats,
  onClearChats,
  user,
  profile,
  onProfile,
  onSignOut,
}) {
  const ref = useRef(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('general');

  // a native modal <dialog>: focus trap, Escape to close and the backdrop come with it
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key) => (value) => onSettings({ ...settings, [key]: value });
  const q = search.trim().toLowerCase();
  const sections = SECTIONS.filter((s) => !q || `${s.label} ${s.keywords}`.toLowerCase().includes(q));

  return (
    <dialog
      ref={ref}
      className="settings-modal"
      aria-labelledby="settings-title"
      onClose={onClose}
      // a click on the backdrop lands on the dialog itself
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <div className="search-box">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search"
              aria-label="Search settings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <h2 id="settings-title" className="settings-nav-title">
            Settings
          </h2>
          {sections.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`settings-nav-item ${tab === key ? 'active' : ''}`}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => setTab(key)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
          {sections.length === 0 && <p className="settings-nav-empty">No matching settings</p>}
        </nav>

        <div className="settings-content">
          <button type="button" className="icon-btn settings-close" onClick={onClose} aria-label="Close settings" title="Close">
            <X size={18} aria-hidden="true" />
          </button>

          {/* keyed by tab so each switch replays the fade-in */}
          <div key={tab} className="settings-pane">
            {tab === 'general' && <GeneralTab theme={theme} onTheme={onTheme} settings={settings} set={set} />}
            {tab === 'account' && <AccountTab user={user} profile={profile} onProfile={onProfile} onSignOut={onSignOut} />}
            {tab === 'data' && (
              <DataTab
                settings={settings}
                set={set}
                clientStatus={clientStatus}
                clientsSyncedAt={clientsSyncedAt}
                onSyncClients={onSyncClients}
                masterStatus={masterStatus}
                masterSyncedAt={masterSyncedAt}
                onSyncMaster={onSyncMaster}
                onClearTableState={onClearTableState}
                chats={chats}
                onImportChats={onImportChats}
                onClearChats={onClearChats}
              />
            )}
            {tab === 'about' && <AboutTab clientStatus={clientStatus} />}
          </div>
        </div>
      </div>
    </dialog>
  );
}
