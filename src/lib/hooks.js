import { useCallback, useEffect, useState } from 'react';
import { loadTheme, saveTheme } from './storage.js';

export function useMediaQuery(query) {
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
export function useTheme() {
  const [theme, setTheme] = useState(loadTheme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  }, [theme, systemDark]);

  const choose = useCallback((t) => {
    setTheme(t);
    saveTheme(t);
  }, []);

  return [theme, choose, systemDark];
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
