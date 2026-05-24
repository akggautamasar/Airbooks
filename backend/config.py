import os
from dotenv import load_dotenv
load_dotenv()

API_ID            = int(os.getenv("API_ID", "0"))
API_HASH          = os.getenv("API_HASH", "")
BOT_TOKEN         = os.getenv("BOT_TOKEN", "")
JWT_SECRET        = os.getenv("JWT_SECRET", "changeme")
FRONTEND_URL      = os.getenv("FRONTEND_URL", "*")
WEBSITE_URL       = os.getenv("WEBSITE_URL", "")

# Bot-admin channels shown in Discover
BOT_CHANNELS      = [c.strip() for c in os.getenv("BOT_CHANNELS", "").split(",") if c.strip()]

# Sessions stored here
SESSIONS_DIR      = os.getenv("SESSIONS_DIR", "./sessions")

# Telegram channel used as JSON cache storage
CACHE_CHANNEL_ID  = int(os.getenv("CACHE_CHANNEL_ID", "0"))

import pathlib
pathlib.Path(SESSIONS_DIR).mkdir(parents=True, exist_ok=True)
