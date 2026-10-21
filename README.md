# Landing Page Assistant

A chat app that answers questions about client landing pages. Answers come from an n8n workflow, reached through an n8n chat webhook.

Built with React and Vite.

## Install

```bash
npm install
```

## Configure

Copy the example env file and set your n8n chat webhook URL:

```bash
cp .env.example .env
```

Then edit `.env`:

```
VITE_N8N_CHAT_URL=your-n8n-chat-webhook-url
APP_USERNAME=admin
APP_PASSWORD=choose-a-strong-password
AUTH_SECRET=a-long-random-string
```

## Login

The app opens on a sign-in screen; only a signed-in user reaches the dashboard. The username and password are
`APP_USERNAME` and `APP_PASSWORD` from `.env`. They are checked on the server (`server/auth.js`) and never sent
to the browser. `AUTH_SECRET` signs the session cookie, which keeps you signed in for 7 days.

- To change the login, edit `.env` and restart `npm run dev`. Changing `APP_USERNAME` or `AUTH_SECRET` signs
  everyone out.
- On Vercel, add the same three variables under **Project > Settings > Environment Variables**, then redeploy.
  The login API runs from the `api/` folder there.
- Chats are saved in the browser, separately for each user.

`.env` is git-ignored. Never commit it.

## Run

```bash
npm run dev
```

The app opens on http://localhost:5173.
