import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import App from '../App.jsx';
import AuthScreen from './AuthScreen.jsx';
import Logo from './Logo.jsx';
import { getSession, logout } from '../lib/auth.js';
import { loadChats, takeDeviceChats } from '../lib/storage.js';
import { useTheme } from '../lib/hooks.js';

// The gate's own screens follow the saved theme (the workspace applies it itself once it opens)
function Themed({ children }) {
  useTheme();
  return children;
}

// The user's chats on this device, plus any saved before login existed (the first user to sign in takes them over)
function initialChats(userId) {
  const chats = loadChats(userId);
  const ids = new Set(chats.map((c) => c.id));
  return [...chats, ...takeDeviceChats().filter((c) => !ids.has(c.id))];
}

/**
 * Only a signed-in user gets the workspace: without a valid session cookie the sign-in screen shows instead.
 * Signing out closes the workspace again.
 */
export default function AuthGate() {
  // undefined while the session is being checked, null when signed out
  const [user, setUser] = useState(undefined);
  // shown on the sign-in card when the session check itself failed (server unreachable or not set up)
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getSession()
      .then(setUser)
      .catch((err) => {
        setNotice(err.message);
        setUser(null);
      });
  }, []);

  // read once per sign-in (App keeps them in its own state after that)
  const chats = useMemo(() => (user ? initialChats(user.id) : null), [user?.id]);

  const signOut = useCallback(async () => {
    await logout().catch(() => {});
    setUser(null);
  }, []);

  if (user === undefined) {
    return (
      <Themed>
        <div className="auth-screen">
          <div className="auth-loading" role="status">
            <Logo className="auth-loading-logo" />
            <span>
              <LoaderCircle size={15} className="spin" aria-hidden="true" />
              Checking your session…
            </span>
          </div>
        </div>
      </Themed>
    );
  }

  if (!user) {
    return (
      <Themed>
        <AuthScreen
          notice={notice}
          onSignedIn={(u) => {
            setNotice('');
            setUser(u);
          }}
        />
      </Themed>
    );
  }

  return <App key={user.id} user={user} initialChats={chats} onSignOut={signOut} />;
}
