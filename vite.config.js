import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { routes } from './server/auth.js';

// The login API (server/auth.js) on the dev server; when deployed, Vercel serves it from api/
function authApi() {
  return {
    name: 'auth-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const handler = routes[req.url.split('?')[0]];
        if (!handler) return next();
        Promise.resolve(handler(req, res)).catch(next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // the login settings have no VITE_ prefix, so they stay on the server: load them for the dev API
  // (again on every config reload, so an edit to .env applies without restarting). loadEnv prefers values already in
  // process.env, so the ones loaded here last time are dropped first; ones set outside .env still win.
  globalThis.__authEnvKeys ??= new Set();
  for (const k of globalThis.__authEnvKeys) delete process.env[k];
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (/^(APP_USERNAME|APP_PASSWORD|AUTH_SECRET)$/.test(k) && process.env[k] === undefined) {
      process.env[k] = v;
      globalThis.__authEnvKeys.add(k);
    }
  }
  return {
    plugins: [react(), authApi()],
    server: { port: 5173, strictPort: true },
  };
});
