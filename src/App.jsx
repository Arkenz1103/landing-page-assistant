import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftOpen, SquarePen } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import ChatView from './components/ChatView.jsx';
import ClientsMasterView, { clientSheetKey } from './components/ClientsMasterView.jsx';
import { NO_ANSWER_MSG, STOPPED_MSG, sendChatMessage } from './lib/api.js';
import { fetchClients, getCachedClients } from './lib/clients.js';
import { fetchMaster, getCachedMaster } from './lib/master.js';
import { createChat, loadChats, loadTheme, saveChats, saveTheme } from './lib/storage.js';

const MOBILE_QUERY = '(max-width: 767px)';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function useTheme() {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const choose = useCallback((t) => {
    setTheme(t);
    saveTheme(t);
  }, []);

  return [theme, choose];
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(null);
  const [pending, setPending] = useState({});
  const [errors, setErrors] = useState({});
  // one AbortController per chat with a request in flight (the Stop button aborts it)
  const controllers = useRef({});

  const [panel, setPanel] = useState('chats');
  // main area: the chat, or the clients master sheet (opened from the Clients tab)
  const [view, setView] = useState('chat');
  // clients workbook: the active sheet ('summary' = Master Sheet Clients, or a client sheet)
  const [sheet, setSheet] = useState('summary');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useTheme();

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarVisible = isMobile ? drawerOpen : !collapsed;

  const [clients, setClients] = useState(() => getCachedClients()?.clients ?? null);
  const [clientStatus, setClientStatus] = useState('idle');
  const clientsRequested = useRef(false);

  // { rows, summary } from the master workbook
  const [master, setMaster] = useState(null);
  const [masterStatus, setMasterStatus] = useState('idle');
  const masterRequested = useRef(false);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const loadClients = useCallback(async () => {
    setClientStatus('loading');
    try {
      setClients(await fetchClients());
      setClientStatus('ok');
    } catch {
      setClientStatus('error');
    }
  }, []);

  // Load the client list once (unless a fresh cached copy exists)
  useEffect(() => {
    if (clientsRequested.current) return;
    clientsRequested.current = true;
    if (!getCachedClients()?.fresh) loadClients();
  }, [loadClients]);

  const loadMaster = useCallback(async () => {
    setMasterStatus('loading');
    try {
      setMaster(await fetchMaster());
      setMasterStatus('ok');
    } catch {
      setMasterStatus('error');
    }
  }, []);

  // Load the master sheet the first time the Clients view opens (a fresh cached copy is used as is)
  useEffect(() => {
    if (view !== 'clients' || masterRequested.current) return;
    masterRequested.current = true;
    const cached = getCachedMaster();
    if (cached) setMaster(cached.data);
    if (!cached?.fresh) loadMaster();
  }, [view, loadMaster]);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  const updateChat = useCallback((id, fn) => {
    setChats((list) => list.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const request = useCallback(
    async (chatId, sessionId, text) => {
      const controller = new AbortController();
      controllers.current[chatId] = controller;
      setPending((p) => ({ ...p, [chatId]: true }));
      setErrors((e) => ({ ...e, [chatId]: false }));
      try {
        const output = await sendChatMessage(sessionId, text, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const now = Date.now();
        updateChat(chatId, (c) => ({
          ...c,
          updatedAt: now,
          messages: [...c.messages, { role: 'assistant', content: output.trim() ? output : NO_ANSWER_MSG, createdAt: now }],
        }));
      } catch {
        if (!controller.signal.aborted) setErrors((e) => ({ ...e, [chatId]: true }));
      } finally {
        // a stopped request was already cleaned up by stop(); a newer request may own this chat now
        if (controllers.current[chatId] === controller) {
          delete controllers.current[chatId];
          setPending((p) => ({ ...p, [chatId]: false }));
        }
      }
    },
    [updateChat]
  );

  function send(text, { newChat = false } = {}) {
    const chatInput = text.trim();
    if (!chatInput) return;

    setView('chat');
    const now = Date.now();
    const userMsg = { role: 'user', content: chatInput, createdAt: now };
    let chat = newChat ? null : activeChat;
    if (chat) {
      if (pending[chat.id]) return;
      updateChat(chat.id, (c) => ({ ...c, updatedAt: now, messages: [...c.messages, userMsg] }));
    } else {
      chat = { ...createChat(chatInput), messages: [userMsg] };
      setChats((list) => [chat, ...list]);
      setActiveId(chat.id);
    }
    request(chat.id, chat.sessionId, chatInput);
  }

  // Stop button: cancel the pending request and unlock the composer straight away
  function stop() {
    const chat = activeChat;
    const controller = chat && controllers.current[chat.id];
    if (!controller) return;
    controller.abort();
    delete controllers.current[chat.id];
    setPending((p) => ({ ...p, [chat.id]: false }));
    const now = Date.now();
    updateChat(chat.id, (c) => ({
      ...c,
      updatedAt: now,
      messages: [...c.messages, { role: 'assistant', content: STOPPED_MSG, createdAt: now }],
    }));
  }

  // Resend the user message that produced the assistant answer at `index`
  function retryAnswer(index) {
    const chat = activeChat;
    const userMsg = chat?.messages[index - 1];
    if (!chat || pending[chat.id] || userMsg?.role !== 'user') return;
    updateChat(chat.id, (c) => ({ ...c, messages: c.messages.slice(0, index) }));
    request(chat.id, chat.sessionId, userMsg.content);
  }

  function retryAfterError() {
    const chat = activeChat;
    const last = chat?.messages[chat.messages.length - 1];
    if (!chat || pending[chat.id] || last?.role !== 'user') return;
    request(chat.id, chat.sessionId, last.content);
  }

  function closeDrawerOnMobile() {
    if (isMobile) setDrawerOpen(false);
  }

  function newChat() {
    setActiveId(null);
    setView('chat');
    closeDrawerOnMobile();
  }

  function choosePanel(key) {
    setPanel(key);
    // on mobile the drawer stays open so a sheet or client can be picked from the list
    setView(key === 'clients' ? 'clients' : 'chat');
  }

  function openSheet(key) {
    setSheet(key);
    setView('clients');
  }

  // "Open Master Sheet Clients" button in a chat answer: the Clients tab with the master overview sheet
  function openMasterSheet() {
    setPanel('clients');
    openSheet('summary');
    closeDrawerOnMobile();
  }

  // Sidebar: a client name opens its sheet
  function openClientSheet(client) {
    openSheet(clientSheetKey(client));
    closeDrawerOnMobile();
  }

  // "Chat about this client" on a client sheet: an empty chat named after the client, showing its welcome guide
  // (an unused one for the same client is reopened instead of adding another)
  function chatAboutClient({ sheet, name }) {
    const title = name || sheet;
    let chat = chats.find((c) => c.client?.sheet === sheet && c.messages.length === 0);
    if (!chat) {
      chat = { ...createChat(title), title, client: { sheet, name: title } };
      setChats((list) => [chat, ...list]);
    }
    setActiveId(chat.id);
    setPanel('chats');
    setView('chat');
  }

  // Clients / Help quick questions: show the answer in the Chats view
  function askFromSidebar(question) {
    closeDrawerOnMobile();
    setPanel('chats');
    send(question);
  }

  const chatHandlers = {
    onOpen: (id) => {
      setActiveId(id);
      setView('chat');
      closeDrawerOnMobile();
    },
    onPin: (id) => updateChat(id, (c) => ({ ...c, pinned: !c.pinned })),
    onRename: (id, title) => updateChat(id, (c) => ({ ...c, title })),
    onDelete: (id) => {
      setChats((list) => list.filter((c) => c.id !== id));
      if (id === activeId) setActiveId(null);
    },
  };

  function toggleSidebar() {
    if (isMobile) setDrawerOpen((o) => !o);
    else setCollapsed((c) => !c);
  }

  return (
    <div className={`app ${sidebarVisible ? 'sidebar-open' : 'sidebar-closed'} ${isMobile ? 'is-mobile' : ''}`}>
      {isMobile && drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <aside className="sidebar" aria-label="Sidebar" aria-hidden={!sidebarVisible} inert={!sidebarVisible ? true : undefined}>
        <Sidebar
          panel={panel}
          onPanel={choosePanel}
          query={query}
          onQuery={setQuery}
          onNewChat={newChat}
          onClose={toggleSidebar}
          chats={chats}
          activeId={activeId}
          chatHandlers={chatHandlers}
          clients={clients}
          clientStatus={clientStatus}
          onRefreshClients={loadClients}
          onAsk={askFromSidebar}
          activeSheet={view === 'clients' ? sheet : null}
          onOpenSheet={(key) => {
            openSheet(key);
            closeDrawerOnMobile();
          }}
          onOpenClient={openClientSheet}
          theme={theme}
          onTheme={setTheme}
        />
      </aside>

      <main className="main">
        {/* on the Clients view the bar would be empty while the sidebar is open, so it is dropped */}
        {(view === 'chat' || !sidebarVisible) && (
          <header className="topbar">
            {!sidebarVisible && (
              <>
                <button type="button" className="icon-btn" onClick={toggleSidebar} aria-label="Open sidebar" title="Open sidebar">
                  <PanelLeftOpen size={18} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" onClick={newChat} aria-label="New chat" title="New chat">
                  <SquarePen size={18} aria-hidden="true" />
                </button>
              </>
            )}
            {view === 'chat' && <span className="topbar-title">{activeChat?.title ?? ''}</span>}
          </header>
        )}

        {view === 'clients' ? (
          <ClientsMasterView
            rows={master?.rows ?? null}
            summary={master?.summary ?? null}
            status={masterStatus}
            onRefresh={loadMaster}
            onChat={chatAboutClient}
            sheet={sheet}
            onSheet={openSheet}
          />
        ) : (
          <ChatView
            key={activeChat?.id ?? 'new'}
            chat={activeChat}
            waiting={Boolean(activeChat && pending[activeChat.id])}
            error={Boolean(activeChat && errors[activeChat.id])}
            clients={clients}
            onSend={send}
            onStop={stop}
            onRetry={retryAnswer}
            onRetryError={retryAfterError}
            onOpenMaster={openMasterSheet}
          />
        )}
      </main>
    </div>
  );
}
