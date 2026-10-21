import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, LayoutDashboard, RefreshCw, Search } from 'lucide-react';
import { QUICK_ACTIONS } from '../lib/clients.js';
import { SHOW_MISSING_SHEET } from './ClientsMasterView.jsx';

const SHEETS = [
  { key: 'summary', label: 'Master Sheet Clients', icon: LayoutDashboard },
  { key: 'missing', label: 'Missing URLs', icon: CircleAlert },
].filter((s) => s.key !== 'missing' || SHOW_MISSING_SHEET);

export default function ClientsPanel({ clients, status, onRefresh, onAsk, activeSheet, onOpenSheet, onOpenClient }) {
  const [filter, setFilter] = useState('');
  const [openSheet, setOpenSheet] = useState(null);
  const listRef = useRef(null);

  // a client sheet opened elsewhere (sheet tabs, Summary links): expand it here and scroll it into view,
  // so the highlighted item is always the one that is showing
  const currentClient = activeSheet?.startsWith('client:') ? activeSheet.slice(7) : null;
  useEffect(() => {
    if (!currentClient) return;
    setOpenSheet(currentClient);
    requestAnimationFrame(() => listRef.current?.querySelector('.client.current')?.scrollIntoView({ block: 'center' }));
  }, [currentClient]);

  const header = (
    <div className="panel-head">
      <span className="panel-title">Clients{clients ? ` (${clients.length})` : ''}</span>
      <button
        type="button"
        className="small-btn"
        onClick={onRefresh}
        disabled={status === 'loading'}
        aria-label="Refresh client list"
      >
        <RefreshCw size={13} className={`refresh-icon ${status === 'loading' ? 'spin' : ''}`} aria-hidden="true" />
        Refresh
      </button>
    </div>
  );

  const sheetLinks = (
    <div className="sheet-links">
      {SHEETS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          className={`sheet-link ${activeSheet === key ? 'active' : ''}`}
          aria-current={activeSheet === key ? 'page' : undefined}
          onClick={() => onOpenSheet(key)}
        >
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );

  if (!clients) {
    return (
      <div className="clients-panel">
        {header}
        {sheetLinks}
        {status === 'error' ? (
          <div className="panel-empty">
            <p>Client list unavailable</p>
            <button type="button" className="small-btn" onClick={onRefresh}>
              Retry
            </button>
          </div>
        ) : (
          <p className="panel-empty">Loading clients…</p>
        )}
      </div>
    );
  }

  const q = filter.trim().toLowerCase();
  const shown = q
    ? clients.filter((c) => c.sheet.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    : clients;

  return (
    <div className="clients-panel">
      {header}
      {sheetLinks}
      {status === 'error' && <p className="panel-note">Couldn't refresh. Showing saved list.</p>}
      <div className="search-box small">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Filter clients"
          aria-label="Filter clients"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {shown.length === 0 && <p className="panel-empty">No clients match.</p>}
      <ul className="client-list" ref={listRef}>
        {shown.map((c) => {
          const open = openSheet === c.sheet;
          const current = activeSheet === `client:${c.sheet}`;
          const showName = c.name && c.name.toLowerCase() !== c.sheet.toLowerCase();
          return (
            <li key={c.sheet} className={`client ${open ? 'open' : ''} ${current ? 'current' : ''}`}>
              <button
                type="button"
                className="client-btn"
                aria-expanded={open}
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  // open the client's sheet; the quick questions stay open while it is the current sheet
                  setOpenSheet(open && current ? null : c.sheet);
                  if (!current) onOpenClient(c.sheet);
                }}
              >
                {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                <span className="client-text">
                  <span className="client-sheet">{c.sheet}</span>
                  {showName && <span className="client-name">{c.name}</span>}
                </span>
              </button>
              {open && (
                <div className="quick-actions">
                  {QUICK_ACTIONS.map((a) => (
                    <button key={a.key} type="button" className="quick-btn" onClick={() => onAsk(a.question(c.sheet), c)} title={a.label}>
                      {a.short || a.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
