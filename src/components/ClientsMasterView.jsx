import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Menu, RefreshCw, Search } from 'lucide-react';
import Logo from './Logo.jsx';
import { noLandingPage, summarize, summarizeClients } from '../lib/master.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live URLs' },
  { key: 'missing', label: 'Missing URLs' },
];

const STATUS_LABEL = { live: 'Live', note: 'Note', missing: 'Missing' };

// `sort`: { key, dir: 'asc' | 'desc' } or null (sheet row order); `month` / `assigned`: '' = all
const DEFAULT_UI = { filter: 'all', page: 0, sort: null, month: '', assigned: '' };

/** Sheet keys: 'summary' (shown as Master Sheet Clients), 'missing' (every client's rows without a URL) or 'client:<tab name>'. */
export const clientSheetKey = (sheet) => `client:${sheet}`;
// the Missing URLs sheet is hidden (no sidebar entry or bottom tab); set to true to show it again
export const SHOW_MISSING_SHEET = false;
export const sheetOfKey = (key) => (key?.startsWith('client:') ? key.slice(7) : null);

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

function place(r) {
  if (r.suburb && r.city) return `${r.suburb}, ${r.city}`;
  return r.suburb || r.city || '';
}

function UrlCell({ row }) {
  if (row.url) {
    return (
      <a href={row.url} target="_blank" rel="noreferrer" className="master-url" title={row.url} onClick={(e) => e.stopPropagation()}>
        {row.url.replace(/^https?:\/\/(www\.)?/i, '')}
      </a>
    );
  }
  if (row.note) return <span className="master-note" title={row.note}>{row.note}</span>;
  return <span className="master-blank">—</span>;
}

/** A link column from the sheet (GMB, Yellow Pages, ...): a short clickable link, or the cell text as is. */
function LinkCell({ value }) {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return <span className="master-note">{value}</span>;
  return (
    <a href={value} target="_blank" rel="noreferrer" className="master-url link-cell" title={value} onClick={(e) => e.stopPropagation()}>
      {value.replace(/^https?:\/\/(www\.)?/i, '')}
    </a>
  );
}

// "September 2025" (or "Sep 2025", "September") as a date number, so months sort in calendar order; else the text
function monthValue(m) {
  const t = Date.parse(`1 ${m}`);
  return Number.isNaN(t) ? m : t;
}

const STATUS_ORDER = { missing: 0, note: 1, live: 2 };

// Same columns, in the same order, as each client tab of the master workbook (plus Status);
// `sort`: the value a header click sorts by
const SHEET_COLS = [
  { key: 'month', label: 'Month', cell: (r) => r.month, sort: (r) => monthValue(r.month) },
  { key: 'name', label: 'Client', cell: (r) => r.name, className: 'master-client', sort: (r) => r.name },
  { key: 'assigned', label: 'Assigned to', cell: (r) => r.assigned, sort: (r) => r.assigned },
  { key: 'service', label: 'Service', cell: (r) => r.service, sort: (r) => r.service },
  { key: 'city', label: 'City', cell: (r) => r.city, sort: (r) => r.city },
  { key: 'suburb', label: 'Suburb', cell: (r) => r.suburb, sort: (r) => r.suburb },
  { key: 'url', label: 'Landing Page URL', cell: (r) => <UrlCell row={r} />, className: 'master-url-cell', sort: (r) => r.url || r.note },
  { key: 'gmb', label: 'GMB Link', cell: (r) => <LinkCell value={r.gmb} />, className: 'link-col', sort: (r) => r.gmb },
  { key: 'yellowPages', label: 'Yellow Pages', cell: (r) => <LinkCell value={r.yellowPages} />, className: 'link-col', sort: (r) => r.yellowPages },
  { key: 'trueLocal', label: 'True Local Link', cell: (r) => <LinkCell value={r.trueLocal} />, className: 'link-col', sort: (r) => r.trueLocal },
  { key: 'assignedUrl', label: 'ASSIGNED URL', cell: (r) => <LinkCell value={r.assignedUrl} />, className: 'link-col', sort: (r) => r.assignedUrl },
  { key: 'status', label: 'Status', cell: (r) => <StatusBadge status={r.status} />, sort: (r) => STATUS_ORDER[r.status] },
];

const isBlank = (v) => v === '' || v == null;

// numbers in order, then text (A-Z, "Page 2" before "Page 10")
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

// blank cells stay at the bottom in both directions; ties keep sheet order
function sortRows(rows, sort) {
  const col = sort && SHEET_COLS.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = col.sort(a);
    const vb = col.sort(b);
    if (isBlank(va) || isBlank(vb)) return isBlank(va) - isBlank(vb) || a.id - b.id;
    return compareValues(va, vb) * dir || a.id - b.id;
  });
}

// header click: ascending, then descending, then back to sheet order
function nextSort(sort, key) {
  if (sort?.key !== key) return { key, dir: 'asc' };
  return sort.dir === 'asc' ? { key, dir: 'desc' } : null;
}

function SortIcon({ dir }) {
  if (dir === 'asc') return <ArrowUp size={12} aria-hidden="true" />;
  if (dir === 'desc') return <ArrowDown size={12} aria-hidden="true" />;
  return <ArrowUpDown size={12} className="sort-idle" aria-hidden="true" />;
}

// a dropdown filter ('' = everything); left out when there is nothing to choose between
function SheetSelect({ label, allLabel, options, value, onChange }) {
  if (options.length < 2 && !value) return null;
  return (
    <select className="sheet-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/* ---------- Summary sheet ---------- */

// The Summary worksheet's columns, in sheet order. Matched to the stored headers ignoring case, spaces and
// punctuation, so "*ContactName" fills ContactName and "Assigned To" fills Assigned to.
const SUMMARY_COLUMNS = [
  'ContactName',
  'plans',
  'Plans Purchased',
  'Landing Pages',
  'Posts',
  'Assigned to',
  'Notes',
  'F2F',
  'Date Assigned',
  'Website',
  'SEO',
  'SEM',
  'Social',
  'Website Live?',
];

const headerKey = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, '');

function cellValue(cells, column) {
  const k = Object.keys(cells).find((key) => headerKey(key) === headerKey(column));
  return k ? String(cells[k]) : '';
}

const words = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// the same word allowing a plural or a cut-off ending ("Pools" = "Pool", "Caloundra" = "Caloundr")
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/**
 * Looser match for names written differently in the Summary and the tab name: the letters run together
 * ("Micks Gasfitting Service Pty Ltd" -> "Micks Gas Fitting"), or the same brand and location with other words
 * left out ("Billabong Pools Caloundra" -> "Billabong Pool Service Caloundr"). 0 when it isn't a match.
 */
function looseScore(contact, label) {
  const cw = words(contact);
  const tw = words(label);
  const c = cw.join('');
  const t = tw.join('');
  if (t.length >= 8 && (c.startsWith(t) || t.startsWith(c))) return 90;
  // brand (first word) and location (last contact word) must both match; every contact word must be in the tab
  if (cw.length < 2 || !sameWord(cw[0], tw[0]) || !tw.some((w) => sameWord(w, cw[cw.length - 1]))) return 0;
  return cw.every((w) => tw.some((x) => sameWord(w, x))) ? 60 + cw.length : 0;
}

/**
 * The client tab for a Summary contact name. Best: the same name. Next: every word of the tab name is in the
 * contact name (the last tab word may be cut off, as tab names stop at 31 characters), preferring a tab that
 * has the contact's last word, usually the location ("... Repairs Bellmere" -> "Above All Roof Bellmere").
 * Last: the looser match above.
 */
function matchTab(contact, clients) {
  const c = headerKey(contact);
  const cw = words(contact);
  if (!c) return null;
  let best = null;
  for (const t of clients) {
    for (const label of [t.sheet, t.name]) {
      const tw = words(label);
      if (!tw.length) continue;
      let score = 0;
      if (headerKey(label) === c) score = 1000;
      else if (tw.every((w, i) => cw.includes(w) || (i === tw.length - 1 && w.length >= 2 && cw.some((x) => x.startsWith(w))))) {
        const hasLast = tw.includes(cw[cw.length - 1]);
        // a short client name ("Smith Tree Solutions") fits every branch, so it only counts with the location word
        if (label !== t.sheet && !hasLast) continue;
        score = 100 + (hasLast ? 50 : 0) + tw.length;
      } else score = looseScore(contact, label);
      if (!score || (best && score < best.score)) continue;
      // two different tabs equally good (e.g. both named "Smith Tree Solutions") = no link rather than a guess
      if (best && score === best.score && best.sheet !== t.sheet) best = { sheet: null, score };
      else best = { sheet: t.sheet, score };
    }
  }
  return best?.sheet ?? null;
}

// tabs of the same business at another location: every tab word but the last (the location) is in the contact name
// ("Smith Tree Solutions Sunshine Coast" -> "Smith Tree Solutions Chevallum" and "... Gympie")
function branchTabs(contact, clients) {
  const cw = words(contact);
  return clients
    .filter((t) => {
      const brand = words(t.sheet).slice(0, -1);
      return brand.length >= 2 && brand.every((w) => cw.some((x) => sameWord(w, x)));
    })
    .map((t) => t.sheet);
}

/**
 * The client tab for each Summary contact (null when none). A contact that matches no tab by name gets the one
 * branch of its business that no other Summary row links to: the Summary has "Smith Tree Solutions Gympie" and
 * "Smith Tree Solutions Sunshine Coast", the tabs are Gympie and Chevallum, so Sunshine Coast is Chevallum.
 */
function summaryTabs(contacts, clients) {
  const tabs = contacts.map((c) => matchTab(c, clients));
  const taken = new Set(tabs.filter(Boolean));
  return tabs.map((tab, i) => {
    if (tab || !contacts[i]) return tab;
    const free = branchTabs(contacts[i], clients).filter((s) => !taken.has(s));
    return free.length === 1 ? free[0] : null;
  });
}

function SummarySheet({ summary, clients, onOpenClient }) {
  const shown = useMemo(() => {
    const list = (summary?.rows ?? []).map((r) => ({ row: r.row, values: SUMMARY_COLUMNS.map((col) => cellValue(r.cells, col)) }));
    const tabs = summaryTabs(
      list.map((r) => r.values[0]),
      clients
    );
    return list.map((r, i) => ({ ...r, tab: tabs[i] }));
  }, [summary, clients]);

  if (!summary) {
    return (
      <div className="master-empty">
        <p>The Summary worksheet isn’t in the data yet.</p>
        <p className="sheet-note">The n8n workflow needs the update that adds the Summary rows. Use Refresh once it’s published.</p>
      </div>
    );
  }

  return (
    <div className="sheet-body">
      <div className="master-controls">
        <ClientSearch clients={clients} onOpen={onOpenClient} />
        <span className="sheet-count">
          {shown.length.toLocaleString()} row{shown.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="master-table-wrap">
        <table className="master-table sheet-table summary-sheet">
          <thead>
            <tr>
              <th className="row-head" aria-label="Sheet row">
                #
              </th>
              {SUMMARY_COLUMNS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.row}>
                <td className="row-head">{r.row || ''}</td>
                {r.values.map((v, i) => (
                  <td key={SUMMARY_COLUMNS[i]} className={i === 0 ? 'master-client' : 'summary-cell'} title={v.length > 30 ? v : undefined}>
                    {i === 0 && r.tab ? (
                      <button type="button" className="contact-link" onClick={() => onOpenClient(r.tab)} title={`Open ${r.tab} sheet`}>
                        {v}
                      </button>
                    ) : i === 0 && v ? (
                      <span className="contact-no-tab" title="No client sheet matches this name, so there's nothing to open">
                        {v}
                      </span>
                    ) : /^https?:\/\//i.test(v) ? (
                      <LinkCell value={v} />
                    ) : (
                      v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="master-none">No rows match.</p>}
      </div>
    </div>
  );
}

/* ---------- Client sheets ---------- */

// Finds a client sheet tab by name (tab or client name, every typed word must match) and opens it
function ClientSearch({ clients, active, onOpen }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef(null);

  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return clients.filter((c) => {
      const hay = `${c.sheet} ${c.name}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [clients, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (c) => {
    onOpen(c.sheet);
    setQuery('');
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!matches.length) return;
      setOpen(true);
      setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
    } else if (e.key === 'Enter' && matches.length) {
      e.preventDefault();
      pick(matches[Math.min(hi, matches.length - 1)]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && query.trim() !== '';
  return (
    <div className="search-box master-search client-search" ref={rootRef}>
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        placeholder="Search client sheets"
        aria-label="Search client sheets"
        role="combobox"
        aria-expanded={showList}
        aria-controls="client-search-list"
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHi(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {showList && (
        <ul className="client-search-list" id="client-search-list" role="listbox" aria-label="Client sheets">
          {matches.length === 0 && <li className="client-search-none">No client sheet matches “{query.trim()}”</li>}
          {matches.slice(0, 50).map((c, i) => (
            <li key={c.sheet} role="option" aria-selected={i === hi}>
              <button
                type="button"
                className={`${i === hi ? 'hi' : ''} ${c.sheet === active ? 'active' : ''}`.trim()}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(c)}
              >
                <span className="client-search-name">
                  {c.sheet}
                  {c.name && c.name !== c.sheet && <small>{c.name}</small>}
                </span>
                <span className="client-search-meta">
                  {c.total} rows · {c.total - c.live} missing
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// `rowLimit`: rows per page (Settings > Default table row limit), or 'all' for one page.
// `pills`: show the Live / Missing filter (the Missing URLs sheet has only one kind of row).
function RowsSheet({ rows, ui, onUi, rowLimit, pills = true, clients, activeSheet, onOpenClient }) {
  const { filter, page, sort, month, assigned } = ui;

  // dropdown choices from the whole sheet, so picking one never empties the other list
  const choices = useMemo(() => summarize(rows), [rows]);

  const searched = useMemo(
    () => rows.filter((r) => (!month || r.month === month) && (!assigned || r.assigned === assigned)),
    [rows, month, assigned]
  );

  const counts = useMemo(
    () => ({
      all: searched.length,
      live: searched.filter((r) => r.status === 'live').length,
      // no landing page URL: a blank cell or a note instead of a link (same rule as the chat)
      missing: searched.filter(noLandingPage).length,
    }),
    [searched]
  );

  const shown = useMemo(
    () =>
      sortRows(
        filter === 'all' || !pills ? searched : searched.filter((r) => (filter === 'missing' ? noLandingPage(r) : r.status === filter)),
        sort
      ),
    [searched, filter, pills, sort]
  );
  const PAGE_SIZE = rowLimit === 'all' ? Math.max(shown.length, 1) : rowLimit;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className="sheet-body">
      <div className="master-controls">
        <ClientSearch clients={clients} active={activeSheet} onOpen={onOpenClient} />
        <SheetSelect
          label="Filter by month"
          allLabel="All months"
          options={choices.months}
          value={month}
          onChange={(v) => onUi({ month: v, page: 0 })}
        />
        <SheetSelect
          label="Filter by assignee"
          allLabel="Everyone"
          options={choices.assigned}
          value={assigned}
          onChange={(v) => onUi({ assigned: v, page: 0 })}
        />
        {pills && (
          <div className="status-pills" role="radiogroup" aria-label="Filter by URL status">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={filter === f.key}
                className={`status-pill ${filter === f.key ? 'active' : ''}`}
                onClick={() => onUi({ filter: f.key, page: 0 })}
              >
                {f.label}
                <span className="pill-count">{counts[f.key].toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
        <span className="sheet-count">
          {shown.length.toLocaleString()} row{shown.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="master-table-wrap">
        <table className="master-table sheet-table">
          <thead>
            <tr>
              <th className="row-head" aria-label="Sheet row">
                #
              </th>
              {SHEET_COLS.map((c) => {
                const dir = sort?.key === c.key ? sort.dir : null;
                return (
                  <th key={c.key} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    <button
                      type="button"
                      className={`sort-btn ${dir ? 'sorted' : ''}`}
                      onClick={() => onUi({ sort: nextSort(sort, c.key), page: 0 })}
                      title={`Sort by ${c.label}`}
                    >
                      {c.label}
                      <SortIcon dir={dir} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td className="row-head">{r.row || ''}</td>
                {SHEET_COLS.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="master-none">No rows match.</p>}
      </div>

      {pages > 1 && (
        <nav className="master-pager" aria-label="Table pages">
          <button type="button" className="small-btn pager-prev" onClick={() => onUi({ page: current - 1 })} disabled={current === 0}>
            <ChevronLeft size={14} aria-hidden="true" />
            Prev
          </button>
          <span>
            {(current * PAGE_SIZE + 1).toLocaleString()}–{Math.min((current + 1) * PAGE_SIZE, shown.length).toLocaleString()} of{' '}
            {shown.length.toLocaleString()}
          </span>
          <button
            type="button"
            className="small-btn pager-next"
            onClick={() => onUi({ page: current + 1 })}
            disabled={current >= pages - 1}
          >
            Next
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}

/* ---------- Workbook ---------- */

function SheetTabs({ active, clients, onSelect }) {
  const barRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // keep the active tab visible (e.g. when it is opened from the sidebar)
  useEffect(() => {
    barRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('.wb-menu-list .active')?.scrollIntoView({ block: 'nearest' });
    const onDown = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function pick(key) {
    setMenuOpen(false);
    onSelect(key);
  }

  const sheets = [
    { key: 'summary', label: 'Summary' },
    ...(SHOW_MISSING_SHEET ? [{ key: 'missing', label: 'Missing URLs' }] : []),
    ...clients.map((c) => ({ key: clientSheetKey(c.sheet), label: c.sheet })),
  ];

  return (
    <div className="wb-bar">
      <div className="wb-menu" ref={menuRef}>
        <button
          type="button"
          className="icon-btn wb-menu-btn"
          aria-label="All sheets"
          title="All sheets"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Menu size={16} aria-hidden="true" />
        </button>
        {menuOpen && (
          <ul className="wb-menu-list" aria-label="All sheets">
            {sheets.map((sh) => (
              <li key={sh.key}>
                <button type="button" className={active === sh.key ? 'active' : ''} onClick={() => pick(sh.key)}>
                  {active === sh.key ? <Check size={13} aria-hidden="true" /> : <span className="wb-menu-gap" />}
                  {sh.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="wb-tabs" role="tablist" aria-label="Sheets" ref={barRef}>
        {sheets.map((sh) => (
          <button key={sh.key} type="button" role="tab" aria-selected={active === sh.key} className="wb-tab" onClick={() => onSelect(sh.key)}>
            {sh.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ClientsMasterView({ rows, summary, status, onRefresh, onChat, onAskAll, sheet, onSheet, rowLimit = 100 }) {
  // search / filter / page are kept per sheet, like separate worksheets
  const [ui, setUi] = useState({});

  const clients = useMemo(() => (rows ? summarizeClients(rows) : []), [rows]);
  const activeClient = sheetOfKey(sheet);
  const client = useMemo(() => clients.find((c) => c.sheet === activeClient) ?? null, [clients, activeClient]);
  const clientRows = useMemo(() => (client && rows ? rows.filter((r) => r.sheet === client.sheet) : []), [rows, client]);
  const missingRows = useMemo(() => (sheet === 'missing' && rows ? rows.filter(noLandingPage) : []), [rows, sheet]);

  const sheetUi = ui[sheet] ?? DEFAULT_UI;
  const updateUi = (patch) => setUi((all) => ({ ...all, [sheet]: { ...(all[sheet] ?? DEFAULT_UI), ...patch } }));

  const refreshBtn = (
    <button type="button" className="head-btn" onClick={onRefresh} disabled={status === 'loading'} aria-label="Refresh master sheet">
      <RefreshCw size={14} className={`refresh-icon ${status === 'loading' ? 'spin' : ''}`} aria-hidden="true" />
      Refresh
    </button>
  );

  if (!rows) {
    return (
      <div className="master-view">
        <div className="master-empty">
          {status === 'error' ? (
            <>
              <p>Master sheet unavailable</p>
              {refreshBtn}
            </>
          ) : (
            <p>
              <RefreshCw size={14} className="spin" aria-hidden="true" /> Loading the master sheet…
            </p>
          )}
        </div>
      </div>
    );
  }

  const openClient = (s) => onSheet(clientSheetKey(s));
  const sheetTitle =
    sheet === 'summary' ? 'Master Sheet Clients' : sheet === 'missing' ? 'Missing URLs (all clients)' : client?.name || activeClient;

  let body;
  if (sheet === 'summary') {
    body = <SummarySheet summary={summary} clients={clients} onOpenClient={openClient} />;
  } else if (sheet === 'missing') {
    body = (
      <RowsSheet key={sheet} rows={missingRows} ui={sheetUi} onUi={updateUi} rowLimit={rowLimit} pills={false} clients={clients} onOpenClient={openClient} />
    );
  } else if (client) {
    body = (
      <RowsSheet
        key={sheet}
        rows={clientRows}
        ui={sheetUi}
        onUi={updateUi}
        rowLimit={rowLimit}
        clients={clients}
        activeSheet={client.sheet}
        onOpenClient={openClient}
      />
    );
  } else {
    body = (
      <div className="master-empty">
        <p>No landing page rows found for {activeClient}.</p>
      </div>
    );
  }

  return (
    <div className="master-view">
      <div className="master-head">
        <p className="master-sub">
          Clients workbook · {clients.length} client sheets
          {status === 'error' && ' · couldn’t refresh, showing saved data'}
        </p>
        <div className="sheet-title-row">
          <h2 className="master-title">{sheetTitle}</h2>
          <div className="sheet-actions">
            {client && (
              <button
                type="button"
                className="head-btn tinted"
                onClick={() => onChat(client)}
                aria-label={`Ask Assistant about ${client.name || client.sheet}`}
                title={`Ask Assistant about ${client.name || client.sheet}`}
              >
                <Logo className="btn-logo" />
                Ask Assistant
              </button>
            )}
            {/* the Summary and Missing URLs sheets cover every client, so their chat isn't bound to one */}
            {(sheet === 'summary' || sheet === 'missing') && (
              <button
                type="button"
                className="head-btn tinted"
                onClick={onAskAll}
                aria-label="Ask Assistant about all clients"
                title="Ask Assistant about all clients"
              >
                <Logo className="btn-logo" />
                Ask Assistant
              </button>
            )}
            {refreshBtn}
          </div>
        </div>
      </div>

      {body}

      <SheetTabs active={sheet} clients={clients} onSelect={onSheet} />
    </div>
  );
}
