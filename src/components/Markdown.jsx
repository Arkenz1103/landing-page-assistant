import { createContext, memo, useContext, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from './CopyButton.jsx';
import { scrollBehavior } from '../lib/storage.js';

const InTableContext = createContext(false);
// opens a client's tab in the Clients workbook view (the status answer's "view full sheet" link); null = no handler here
export const OpenClientSheetContext = createContext(null);
const CLIENT_SHEET_LINK = '#open-client-sheet:';
// true inside a scroll box the answer already has (the workflow's own row tables)
const InScrollBoxContext = createContext(false);
// a longer table with no scroll box of its own (e.g. written by the AI) gets one, like the workflow's row tables
const AUTO_SCROLL_ROWS = 10;
const AUTO_SCROLL_HEIGHT = 320;

// body rows of a markdown table (hast node)
const bodyRows = (node) =>
  (node?.children ?? [])
    .filter((c) => c.tagName === 'tbody')
    .flatMap((b) => b.children ?? [])
    .filter((r) => r.tagName === 'tr').length;

function Link({ node, href, children, ...props }) {
  const inTable = useContext(InTableContext);
  const openClientSheet = useContext(OpenClientSheetContext);
  // "[👉 Click here to view full X sheet](#open-client-sheet:X)": a button that opens the client's sheet tab
  if (href?.startsWith(CLIENT_SHEET_LINK)) {
    let sheet = href.slice(CLIENT_SHEET_LINK.length);
    try {
      sheet = decodeURIComponent(sheet);
    } catch {
      // keep the raw name
    }
    if (!openClientSheet) return <span>{children}</span>;
    return (
      <button type="button" className="sheet-link-btn" onClick={() => openClientSheet(sheet)}>
        {children}
      </button>
    );
  }
  const link = (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
  if (!inTable || !href) return link;
  return (
    <span className="table-link">
      {link}
      <CopyButton text={href} ariaLabel="Copy link" className="icon-only" />
    </span>
  );
}

function Table({ node, ...props }) {
  const inScrollBox = useContext(InScrollBoxContext);
  const table = (
    <InTableContext.Provider value={true}>
      <div className="table-wrap">
        <table {...props} />
      </div>
    </InTableContext.Provider>
  );
  if (inScrollBox || bodyRows(node) <= AUTO_SCROLL_ROWS) return table;
  return (
    <div className="scroll-box" style={{ maxHeight: AUTO_SCROLL_HEIGHT + 'px' }}>
      <div className="markdown-small">{table}</div>
    </div>
  );
}

const components = { a: Link, table: Table };
const plugins = [remarkGfm];

// Raw HTML is not rendered, so the few wrappers the assistant uses around large tables are split out here
// (nesting allowed): <details [open] [id="…"]><summary>…</summary>…</details>, a scroll box <div style="…">…</div>,
// a sheet tab strip <div style="display: flex; …"><a href="#id">…</a>…</div>, and <small>…</small>.
// Inline styles are never applied (except a scroll box's max-height); each wrapper maps to a CSS class.
const OPEN_TAG = /<(details|div|small)\b([^>]*)>/gi;
const stripTags = (s) => s.replace(/<[^>]*>/g, '').trim();
const attr = (attrs, name) => {
  const m = attrs.match(new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"', 'i'));
  return m ? m[1] : '';
};

// Index of the matching </tag> for an opening tag that ends at `from`, counting nested tags of the same name.
function findClose(text, tag, from) {
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { start: m.index, end: m.index + m[0].length };
  }
  return null;
}

// Google Sheets style tab bar: each tab opens the matching <details id> in the same message and scrolls it into view.
function TabStrip({ html }) {
  const [active, setActive] = useState('');
  const tabs = [...html.matchAll(/<a\b[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    id: m[1],
    label: stripTags(m[2]),
  }));
  const go = (e, id) => {
    e.preventDefault();
    setActive(id);
    const root = e.currentTarget.closest('.markdown');
    const target = root && [...root.querySelectorAll('details[data-tab-id]')].find((d) => d.dataset.tabId === id);
    if (!target) return;
    target.open = true;
    const box = target.closest('.scroll-box');
    const strip = e.currentTarget.closest('.sheet-tabs');
    if (box) {
      const offset = target.getBoundingClientRect().top - box.getBoundingClientRect().top;
      box.scrollTo({ top: box.scrollTop + offset - (strip ? strip.offsetHeight + 4 : 0), behavior: scrollBehavior() });
    } else {
      target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  };
  return (
    <div className="sheet-tabs" role="tablist">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={'#' + t.id}
          role="tab"
          aria-selected={active === t.id}
          className={'sheet-tab' + (active === t.id ? ' active' : '')}
          onClick={(e) => go(e, t.id)}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}

function renderBlocks(text, keyPrefix = '') {
  const out = [];
  let last = 0;
  const md = (s, key) =>
    s.trim() && (
      <ReactMarkdown key={key} remarkPlugins={plugins} components={components}>
        {s}
      </ReactMarkdown>
    );
  const open = new RegExp(OPEN_TAG, 'gi');
  for (let m = open.exec(text); m; m = open.exec(text)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const innerStart = m.index + m[0].length;
    const close = findClose(text, tag, innerStart);
    if (!close) break;
    const inner = text.slice(innerStart, close.start);
    const key = keyPrefix + m.index;
    out.push(md(text.slice(last, m.index), key + 'md'));
    if (tag === 'details') {
      const sm = inner.match(/^\s*<summary>([\s\S]*?)<\/summary>/i);
      const id = attr(attrs, 'id');
      out.push(
        <details key={key} className="sheet-details" open={/\bopen\b/i.test(attrs)} data-tab-id={id || undefined}>
          <summary>
            <strong>{stripTags(sm ? sm[1] : '')}</strong>
          </summary>
          {renderBlocks(sm ? inner.slice(sm[0].length) : inner, key + '-')}
        </details>
      );
    } else if (tag === 'div' && /display\s*:\s*flex/i.test(attr(attrs, 'style'))) {
      out.push(<TabStrip key={key} html={inner} />);
    } else if (tag === 'div') {
      const mh = attr(attrs, 'style').match(/max-height\s*:\s*(\d+)px/i);
      const hasTabs = /<div\b[^>]*style="[^"]*display\s*:\s*flex/i.test(inner);
      out.push(
        <div
          key={key}
          className={'scroll-box' + (hasTabs ? ' has-tabs' : '')}
          style={mh ? { maxHeight: Number(mh[1]) + 'px' } : undefined}
        >
          <InScrollBoxContext.Provider value={true}>{renderBlocks(inner, key + '-')}</InScrollBoxContext.Provider>
        </div>
      );
    } else {
      out.push(
        <div key={key} className="markdown-small">
          {renderBlocks(inner, key + '-')}
        </div>
      );
    }
    last = close.end;
    open.lastIndex = close.end;
  }
  out.push(md(text.slice(last), keyPrefix + 'end'));
  return out;
}

function Markdown({ children }) {
  return <div className="markdown">{renderBlocks(String(children ?? ''))}</div>;
}

export default memo(Markdown);
