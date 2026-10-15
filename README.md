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
```

`.env` is git-ignored. Never commit it.

## Run

```bash
npm run dev
```

The app opens on http://localhost:5173.
