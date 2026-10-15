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

function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
