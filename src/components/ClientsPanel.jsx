import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { QUESTIONS, QUICK_ACTIONS } from '../lib/clients.js';

export default function ClientsPanel({ clients, status, onRefresh, onAsk }) {
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

  if (!clients) {
    return (
      <div className="clients-panel">
        {header}
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
          const showName = c.name && c.name.toLowerCase() !== c.sheet.toLowerCase();
          return (
            <li key={c.sheet} className={`client ${open ? 'open' : ''}`}>
              <button
                type="button"
                className="client-btn"
                aria-expanded={open}
                onClick={() => setOpenSheet(open ? null : c.sheet)}
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
