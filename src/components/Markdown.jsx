import { createContext, memo, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from './CopyButton.jsx';

const InTableContext = createContext(false);

function Link({ node, href, children, ...props }) {
  const inTable = useContext(InTableContext);
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
  return (
    <InTableContext.Provider value={true}>
      <div className="table-wrap">
        <table {...props} />
      </div>
    </InTableContext.Provider>
  );
}

const components = { a: Link, table: Table };
const plugins = [remarkGfm];

// Raw HTML is not rendered, so the few wrappers the assistant uses around large tables are split out here:
// <details open><summary>…</summary>…</details>, a scroll box <div style="…">…</div>, and <small>…</small>.
// Inline styles are never applied; each wrapper maps to a CSS class.
const BLOCK =
  /<details(\s+open)?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>|<div style="[^"]*">([\s\S]*?)<\/div>|<small>([\s\S]*?)<\/small>/g;
const stripTags = (s) => s.replace(/<[^>]*>/g, '').trim();

function renderBlocks(text, keyPrefix = '') {
  const out = [];
  let last = 0;
  const md = (s, key) =>
    s.trim() && (
      <ReactMarkdown key={key} remarkPlugins={plugins} components={components}>
        {s}
      </ReactMarkdown>
    );
  for (const m of text.matchAll(BLOCK)) {
    const key = keyPrefix + m.index;
    out.push(md(text.slice(last, m.index), key + 'md'));
    if (m[3] !== undefined) {
      out.push(
        <details key={key} className="sheet-details" open={!!m[1]}>
          <summary>
            <strong>{stripTags(m[2])}</strong>
          </summary>
          {renderBlocks(m[3], key + '-')}
        </details>
      );
    } else if (m[4] !== undefined) {
      out.push(
        <div key={key} className="scroll-box">
          {renderBlocks(m[4], key + '-')}
        </div>
      );
    } else {
      out.push(
        <div key={key} className="markdown-small">
          {renderBlocks(m[5], key + '-')}
        </div>
      );
    }
    last = m.index + m[0].length;
  }
  out.push(md(text.slice(last), keyPrefix + 'end'));
  return out;
}

function Markdown({ children }) {
  return <div className="markdown">{renderBlocks(String(children ?? ''))}</div>;
}

export default memo(Markdown);
