import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, PanelLeftOpen, SquarePen } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import ChatView from './components/ChatView.jsx';
import ClientsMasterView, { clientSheetKey } from './components/ClientsMasterView.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ChatTitle from './components/ChatTitle.jsx';
import { NO_ANSWER_MSG, STOPPED_MSG, sendChatMessage } from './lib/api.js';
import { fetchClients, getCachedClients } from './lib/clients.js';
import { clearMasterCache, fetchMaster, getCachedMaster } from './lib/master.js';
import { localGreeting, withAppExamples } from './lib/greetings.js';
import {
  createChat,
  loadChats,
  loadSettings,
  loadTheme,
  parseChatExport,
  saveChats,
  saveSettings,
  saveTheme,
  trimChats,
} from './lib/storage.js';

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

// `theme` is the saved choice ('light', 'dark' or 'system'); the page gets the resolved light/dark one
function useTheme() {
  const [theme, setTheme] = useState(loadTheme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  }, [theme, systemDark]);

  const choose = useCallback((t) => {
    setTheme(t);
    saveTheme(t);
  }, []);

  return [theme, choose];
}

// Text size, chat width and compact tables, applied as data attributes on <html> (index.css reads them)
function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = settings.textSize;
    root.dataset.chatWidth = settings.chatWidth;
    root.dataset.compactTables = settings.compactTables;
  }, [settings]);

  const update = useCallback((s) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  return [settings, update];
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(null);
  const [pending, setPending] = useState({});
  // per chat: the failed request's kind ('network', 'timeout', ...; see ERROR_MSGS in api.js)
  const [errors, setErrors] = useState({});
  // the chats could not be saved on this device (storage full or blocked)
  const [saveFailed, setSaveFailed] = useState(false);
  // one AbortController per chat with a request in flight (the Stop button aborts it)
  const controllers = useRef({});

  // Settings > Default launch view: start on a new chat or on the clients workbook
  const [panel, setPanel] = useState(() => (loadSettings().launchView === 'clients' ? 'clients' : 'chats'));
  // main area: the chat, or the clients master sheet (opened from the Clients tab)
  const [view, setView] = useState(() => (loadSettings().launchView === 'clients' ? 'clients' : 'chat'));
  // clients workbook: the active sheet ('summary' = Master Sheet Clients, or a client sheet)
  const [sheet, setSheet] = useState('summary');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useTheme();
  const [settings, setSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [collapsed, setCollapsed] = useState(false);
  // the sidebar's "Search chats" box (Ctrl+K focuses it)
  const searchRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarVisible = isMobile ? drawerOpen : !collapsed;

  const [clients, setClients] = useState(() => getCachedClients()?.clients ?? null);
  // 'cached' when a fresh saved list is used without asking the workflow
  const [clientStatus, setClientStatus] = useState(() => (getCachedClients()?.fresh ? 'cached' : 'idle'));
  // when the client list was last fetched (Settings > Data & Cache)
  const [clientsSyncedAt, setClientsSyncedAt] = useState(() => getCachedClients()?.fetchedAt ?? null);
  const clientsRequested = useRef(false);

  // { rows, summary } from the master workbook
  const [master, setMaster] = useState(null);
  const [masterStatus, setMasterStatus] = useState('idle');
  const [masterSyncedAt, setMasterSyncedAt] = useState(null);
  const masterRequested = useRef(false);

  useEffect(() => {
    // over the limit: drop the oldest in the app too, so the list doesn't change on the next reload
    const kept = trimChats(chats, activeId);
    if (kept !== chats) {
      setChats(kept);
      return;
    }
    let saved = saveChats(chats);
    // storage full: the cached workbook is the big item and can be fetched again, the chats can't
    if (!saved) {
      clearMasterCache();
      saved = saveChats(chats);
    }
    setSaveFailed(!saved);
  }, [chats, activeId]);

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
      setClientsSyncedAt(Date.now());
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
      setMasterSyncedAt(Date.now());
      setMasterStatus('ok');
    } catch {
      setMasterStatus('error');
    }
  }, []);

  // Load the master sheet in the background shortly after the app opens, or straight away when the Clients view
  // opens first, so it is usually ready before it is needed (a fresh cached copy is used as is)
  useEffect(() => {
    if (masterRequested.current) return;
    const start = () => {
      if (masterRequested.current) return;
      masterRequested.current = true;
      const cached = getCachedMaster();
      if (cached) {
        setMaster(cached.data);
        setMasterSyncedAt(cached.fetchedAt);
      }
      if (!cached?.fresh) loadMaster();
    };
    if (view === 'clients') {
      start();
      return;
    }
    const timer = setTimeout(start, 2000);
    return () => clearTimeout(timer);
  }, [view, loadMaster]);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  const updateChat = useCallback((id, fn) => {
    setChats((list) => list.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const request = useCallback(
    // `prior`: the chat's messages before `text`, sent as history so a follow-up ("How about Ace Restumping?") keeps the context
    async ({ id: chatId, sessionId, client, tableState }, text, prior = []) => {
      const controller = new AbortController();
      controllers.current[chatId] = controller;
      setPending((p) => ({ ...p, [chatId]: true }));
      setErrors((e) => ({ ...e, [chatId]: null }));
      try {
        // a chat bound to a client sends it along, so "who is assigned?" needs no client name
        // the chat's table state (row filter + column layout) goes out with the message and comes back updated
        let nextTableState = null;
        const output = await sendChatMessage(sessionId, text, {
          signal: controller.signal,
          client,
          history: prior,
          tableState,
          onTableState: (s) => (nextTableState = s),
        });
        if (controller.signal.aborted) return;
        const now = Date.now();
        updateChat(chatId, (c) => {
          // off-topic answers get the app's random example questions in place of the workflow's
          const content = output.trim()
            ? withAppExamples(output, { prior: c.messages, client: c.client, clients: getCachedClients()?.clients })
            : NO_ANSWER_MSG;
          return {
            ...c,
            updatedAt: now,
            ...(nextTableState && { tableState: nextTableState }),
            messages: [...c.messages, { role: 'assistant', content, createdAt: now }],
          };
        });
      } catch (err) {
        if (!controller.signal.aborted) setErrors((e) => ({ ...e, [chatId]: err.kind || 'network' }));
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

  // `client` ({ sheet, name }): the question is about that client, so it goes to a chat bound to it
  // (the open chat when it is already bound to that client, otherwise a new one)
  function send(text, { newChat = false, client = null } = {}) {
    const chatInput = text.trim();
    if (!chatInput) return;

    let chat = newChat || (client && activeChat?.client?.sheet !== client.sheet) ? null : activeChat;
    if (chat && pending[chat.id]) {
      // a sidebar quick question for a client whose chat is still waiting goes to a new chat instead of being dropped
      if (!client) return;
      chat = null;
    }
    setView('chat');
    const now = Date.now();
    const userMsg = { role: 'user', content: chatInput, createdAt: now };
    const prior = chat ? chat.messages : [];
    // a pure greeting / thanks / "who are you" is answered here at once, without a workflow call
    const greeting = localGreeting(chatInput, { prior, client: chat ? chat.client : client, clients });
    // `local`: answered here, so it has no Retry
    const added = greeting ? [userMsg, { role: 'assistant', content: greeting, local: true, createdAt: now }] : [userMsg];
    if (chat) {
      updateChat(chat.id, (c) => ({ ...c, updatedAt: now, messages: [...c.messages, ...added] }));
    } else {
      chat = { ...createChat(chatInput), messages: added, ...(client && { client }) };
      setChats((list) => [chat, ...list]);
      setActiveId(chat.id);
    }
    if (!greeting) request(chat, chatInput, prior);
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
    request(chat, userMsg.content, chat.messages.slice(0, index - 1));
  }

  function retryAfterError() {
    const chat = activeChat;
    const last = chat?.messages[chat.messages.length - 1];
    if (!chat || pending[chat.id] || last?.role !== 'user') return;
    request(chat, last.content, chat.messages.slice(0, -1));
  }

  function closeDrawerOnMobile() {
    if (isMobile) setDrawerOpen(false);
  }

  function newChat() {
    setActiveId(null);
    setView('chat');
    closeDrawerOnMobile();
  }

  // Sidebar logo/title: back to the home screen (an empty chat, with the Chats list showing)
  function goHome() {
    setPanel('chats');
    newChat();
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

  // "Click here to view full X sheet" button in a status answer: the Clients tab with that client's sheet
  function openClientSheetFromChat(sheet) {
    setPanel('clients');
    openSheet(clientSheetKey(sheet));
    closeDrawerOnMobile();
  }

  // Sidebar: a client name opens its sheet
  function openClientSheet(client) {
    openSheet(clientSheetKey(client));
    closeDrawerOnMobile();
  }

  // "Ask Assistant" on a client sheet: an empty chat named after the client, showing its welcome guide
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

  // "Ask Assistant" on Master Sheet Clients: the same, for a chat about every client (`scope: 'all'`, not bound to one)
  function chatAboutAllClients() {
    const title = 'Master Sheet Clients';
    let chat = chats.find((c) => c.scope === 'all' && c.messages.length === 0);
    if (!chat) {
      chat = { ...createChat(title), title, scope: 'all' };
      setChats((list) => [chat, ...list]);
    }
    setActiveId(chat.id);
    setPanel('chats');
    setView('chat');
  }

  // Clients / Help quick questions: show the answer in the Chats view
  // (a client tab's quick question binds the chat to that client)
  function askFromSidebar(question, client) {
    closeDrawerOnMobile();
    setPanel('chats');
    send(question, { client: client ? { sheet: client.sheet, name: client.name || client.sheet } : null });
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
      // cancel a request still running for the chat and forget its pending / error flags
      controllers.current[id]?.abort();
      delete controllers.current[id];
      setPending(({ [id]: _p, ...rest }) => rest);
      setErrors(({ [id]: _e, ...rest }) => rest);
      setChats((list) => list.filter((c) => c.id !== id));
      if (id === activeId) setActiveId(null);
    },
  };

  // Settings > Import chats: adds the file's chats (a chat already here keeps whichever copy is newer).
  // Throws when the text isn't a chat export; returns how many chats it had.
  function importChats(text) {
    const imported = parseChatExport(text);
    setChats((list) => {
      const byId = new Map(list.map((c) => [c.id, c]));
      for (const c of imported) {
        const have = byId.get(c.id);
        if (!have || c.updatedAt > have.updatedAt) byId.set(c.id, c);
      }
      return [...byId.values()];
    });
    return imported.length;
  }

  // Settings > Clear all chats: every chat except the pinned ones; returns how many were removed
  function clearChats() {
    const removed = chats.filter((c) => !c.pinned);
    for (const c of removed) controllers.current[c.id]?.abort();
    for (const c of removed) delete controllers.current[c.id];
    setPending({});
    setErrors({});
    setChats((list) => list.filter((c) => c.pinned));
    if (removed.some((c) => c.id === activeId)) setActiveId(null);
    return removed.length;
  }

  // Ctrl/Cmd+K: search chats (opens the sidebar if needed); Ctrl/Cmd+Shift+O: new chat
  const shortcuts = useRef(null);
  shortcuts.current = (e) => {
    if (settingsOpen || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'k' && !e.shiftKey) {
      e.preventDefault();
      if (isMobile) setDrawerOpen(true);
      else setCollapsed(false);
      setPanel('chats');
      // after the sidebar has rendered (it is inert while closed)
      requestAnimationFrame(() => searchRef.current?.select());
    } else if (key === 'o' && e.shiftKey) {
      e.preventDefault();
      newChat();
    }
  };
  useEffect(() => {
    const onKey = (e) => shortcuts.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Settings > Clear conversation state: forget every chat's table filter / column layout but keep its messages.
  // The workflow also keeps a copy per session id, so every chat gets a new one (its history still goes with each message).
  function clearTableState() {
    const count = chats.filter((c) => c.tableState).length;
    setChats((list) => list.map(({ tableState: _dropped, ...c }) => ({ ...c, sessionId: crypto.randomUUID() })));
    return count;
  }

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
          onHome={goHome}
          searchRef={searchRef}
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
          onSettings={() => {
            closeDrawerOnMobile();
            setSettingsOpen(true);
          }}
        />
      </aside>

      <main className="main">
        {/* on the Clients view the bar would be empty while the sidebar is open, so it is dropped */}
        {(view === 'chat' || !sidebarVisible) && (
          <header className="topbar">
            {!sidebarVisible && (
              <>
                <button type="button" className="icon-btn expand-btn" onClick={toggleSidebar} aria-label="Open sidebar" title="Open sidebar">
                  <PanelLeftOpen size={18} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn new-chat-icon-btn" onClick={newChat} aria-label="New chat" title="New chat (Ctrl+Shift+O)">
                  <SquarePen size={18} aria-hidden="true" />
                </button>
              </>
            )}
            {view === 'chat' && activeChat && <ChatTitle key={activeChat.id} chat={activeChat} onRename={chatHandlers.onRename} />}
          </header>
        )}

        {saveFailed && (
          <div className="error-banner save-banner" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>Chats can’t be saved on this device (browser storage is full or blocked). New messages will be lost on reload.</span>
          </div>
        )}

        {view === 'clients' ? (
          <ClientsMasterView
            rows={master?.rows ?? null}
            summary={master?.summary ?? null}
            status={masterStatus}
            onRefresh={loadMaster}
            onChat={chatAboutClient}
            onAskAll={chatAboutAllClients}
            sheet={sheet}
            onSheet={openSheet}
            rowLimit={settings.rowLimit}
          />
        ) : (
          <ChatView
            key={activeChat?.id ?? 'new'}
            chat={activeChat}
            waiting={Boolean(activeChat && pending[activeChat.id])}
            error={(activeChat && errors[activeChat.id]) || null}
            clients={clients}
            onSend={send}
            onStop={stop}
            onRetry={retryAnswer}
            onRetryError={retryAfterError}
            onOpenMaster={openMasterSheet}
            onOpenClient={openClientSheetFromChat}
            enterToSend={settings.enterToSend}
          />
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setTheme}
        settings={settings}
        onSettings={setSettings}
        clientStatus={clientStatus}
        clientsSyncedAt={clientsSyncedAt}
        onSyncClients={loadClients}
        masterStatus={masterStatus}
        masterSyncedAt={masterSyncedAt}
        onSyncMaster={loadMaster}
        onClearTableState={clearTableState}
        chats={chats}
        onImportChats={importChats}
        onClearChats={clearChats}
      />
    </div>
  );
}
