import { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, HardDrive, LoaderCircle, LogOut, Settings } from 'lucide-react';
import Avatar from './Avatar.jsx';

// Sidebar footer: the signed-in user (profile photo and name) and a menu with Settings / Sign out
export default function AccountMenu({ name, photo, onSettings, onSignOut, signingOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="account">
      <button
        type="button"
        className="account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={name}
      >
        <Avatar photo={photo} name={name} />
        <span className="account-text">
          <span className="account-email">{name}</span>
          <span className="account-sync">
            <HardDrive size={12} aria-hidden="true" />
            Chats saved on this device
          </span>
        </span>
        <ChevronsUpDown size={15} className="account-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu account-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            <Settings size={15} aria-hidden="true" />
            Settings
          </button>
          <button type="button" role="menuitem" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
