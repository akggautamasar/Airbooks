# AirBooks

A Telegram-powered media platform. Browse your bot's channels in Discover, and log in with your own Telegram account to access your personal chats.

## Structure

```
airbooks/
├── backend/          FastAPI + Pyrogram
│   ├── main.py       API server
│   ├── config.py     Environment config
│   └── requirements.txt
└── frontend/         React + Vite + Tailwind
    └── src/
        ├── App.jsx               Main app + bottom nav
        ├── pages/LoginPage.jsx   Telegram OTP login
        ├── components/
        │   ├── discover/         Bot channels (Discover tab)
        │   ├── chats/            User's Telegram chats
        │   ├── player/           Video player
        │   └── ui/               Settings, shared UI
        ├── store/AppContext.jsx  Global state
        └── utils/api.js          API client
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env   # fill in your values
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL
npm install
npm run dev
```

## Environment Variables

### Backend (.env)
| Variable | Description |
|----------|-------------|
| `API_ID` | Telegram API ID from my.telegram.org |
| `API_HASH` | Telegram API Hash |
| `BOT_TOKEN` | Bot token from @BotFather |
| `JWT_SECRET` | Random secret for JWT signing |
| `FRONTEND_URL` | Your Vercel frontend URL (for CORS) |
| `BOT_CHANNELS` | Comma-separated channel IDs for Discover |

### Frontend (.env)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Your Render backend URL + /api |

## Deploy

**Backend → Render**
- Connect repo, set root to `backend/`, add env vars

**Frontend → Vercel**  
- Connect repo, set root to `frontend/`, add `VITE_API_URL`

## Features

- **Discover**: Browse channels where your bot is admin (videos, music, images, PDFs)
- **Chats**: Login with Telegram phone + OTP to browse your own chats
- **Player**: Full-featured video player with speed control, seek, fullscreen, PiP
- **Search**: Search files within any channel
