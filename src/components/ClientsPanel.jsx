import { useState } from 'react';
import { ChevronDown, ChevronRight, FileSpreadsheet, LayoutDashboard, RefreshCw, Search } from 'lucide-react';
import { QUESTIONS, QUICK_ACTIONS } from '../lib/clients.js';

const SHEETS = [
  { key: 'summary', label: 'Summary sheet', icon: LayoutDashboard },
  { key: 'master', label: 'Clients master sheet', icon: FileSpreadsheet },
];

export default function ClientsPanel({ clients, status, onRefresh, onAsk, activeSheet, onOpenSheet, onOpenClient }) {
  const [filter, setFilter] = useState('');
  const [openSheet, setOpenSheet] = useState(null);

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
        <RefreshCw size={13} className={status === 'loading' ? 'spin' : ''} aria-hidden="true" />
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
      <ul className="client-list">
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
                    <button key={a.key} type="button" className="quick-btn" onClick={() => onAsk(QUESTIONS[a.key](c.sheet))}>
                      {a.label}
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
