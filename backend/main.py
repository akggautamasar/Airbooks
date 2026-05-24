import asyncio, json, os, hashlib
from datetime import datetime, timedelta
from typing import Dict, Optional
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import Response, StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt

import config
from streamer import stream_media_file
from cache_manager import load_all_caches, save_cache, delete_cache, get_cache_info
from pyrogram import Client
from pyrogram.errors import (
    PhoneNumberInvalid, PhoneCodeInvalid, PhoneCodeExpired,
    SessionPasswordNeeded, PasswordHashInvalid, FloodWait
)

# ─── Sessions ─────────────────────────────────────────────────────────────────
user_sessions: Dict[str, Client] = {}
# The "admin" session used for Discover scanning (first user who logs in, or pre-configured)
discover_session: Optional[str] = None  # session_id of the session used for discover

# Bot client — used for Discover streaming when no user session is available
bot_client: Optional[Client] = None

security = HTTPBearer(auto_error=False)

def create_jwt(data: dict, hours: int = 24 * 30) -> str:
    return pyjwt.encode({**data, "exp": datetime.utcnow() + timedelta(hours=hours)},
                        config.JWT_SECRET, algorithm="HS256")

def verify_jwt(token: str) -> dict:
    return pyjwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])

async def require_auth(request: Request,
                       creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = (creds.credentials if creds else None) or request.query_params.get("token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        return verify_jwt(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")

async def get_user_client(user: dict = Depends(require_auth)) -> Client:
    sid = user.get("session_id")
    if not sid or sid not in user_sessions:
        raise HTTPException(401, "Session not found — please login again")
    c = user_sessions[sid]
    if not c.is_connected:
        try: await c.start()
        except Exception: raise HTTPException(401, "Session expired")
    return c

def get_discover_client() -> Optional[Client]:
    """Get a client suitable for scanning/streaming Discover channels.
    Priority: designated user session → any user session → bot client.
    """
    global discover_session
    # Try the designated discover session first
    if discover_session and discover_session in user_sessions:
        c = user_sessions[discover_session]
        if c.is_connected:
            return c
    # Fall back to any available connected user session
    for sid, c in user_sessions.items():
        if c.is_connected:
            discover_session = sid
            return c
    # Last resort: bot client (always available if BOT_TOKEN is set)
    if bot_client and bot_client.is_connected:
        return bot_client
    return None

def get_bot_or_discover_client() -> Optional[Client]:
    """Return bot client if available, else fall back to user discover client."""
    if bot_client and bot_client.is_connected:
        return bot_client
    return get_discover_client()

# ─── File type helpers ────────────────────────────────────────────────────────
VIDEO_MIMES = {"video/mp4","video/x-matroska","video/webm","video/x-msvideo",
               "video/quicktime","video/x-flv","video/x-ms-wmv","video/3gpp","video/mpeg"}
VIDEO_EXTS  = {".mp4",".mkv",".webm",".avi",".mov",".m4v",".flv",".wmv",".3gp",".ts"}
AUDIO_MIMES = {"audio/mpeg","audio/mp3","audio/ogg","audio/flac","audio/wav","audio/aac","audio/m4a"}
AUDIO_EXTS  = {".mp3",".wav",".flac",".aac",".ogg",".m4a",".opus",".wma"}
IMAGE_MIMES = {"image/jpeg","image/png","image/gif","image/webp","image/bmp"}
IMAGE_EXTS  = {".jpg",".jpeg",".png",".gif",".webp",".bmp"}

def media_type(mime: str, fname: str) -> str:
    m, f = (mime or "").lower(), (fname or "").lower()
    ext = Path(f).suffix.lower()
    if m == "application/pdf" or ext == ".pdf": return "pdf"
    if m in ("application/epub+zip","application/epub") or ext == ".epub": return "epub"
    if m in VIDEO_MIMES or ext in VIDEO_EXTS: return "video"
    if m in AUDIO_MIMES or ext in AUDIO_EXTS: return "audio"
    if m in IMAGE_MIMES or ext in IMAGE_EXTS: return "image"
    return "other"

# ─── Discover cache ────────────────────────────────────────────────────────────
discover_cache: Dict[str, dict] = {}
_discover_lock = asyncio.Lock()
_discover_done = False

# ─── General file cache (all channels user has ever visited) ──────────────────
# key: str(chat_id), value: {files: [...], scanned_at: str, channel_name: str}
file_cache: Dict[str, dict] = {}
_file_cache_lock = asyncio.Lock()

async def refresh_discover():
    global discover_cache, _discover_done
    client = get_discover_client()
    if not client:
        print("Discover: no user session available yet. Login first.")
        return
    async with _discover_lock:
        for ch_id_str in config.BOT_CHANNELS:
            try:
                ch_id = int(ch_id_str)
                chat = await client.get_chat(ch_id)
                files = []
                # Get ALL messages using async iteration (Pyrogram handles pagination internally)
                async for msg in client.get_chat_history(ch_id):
                    media = (getattr(msg, "document", None) or
                             getattr(msg, "video", None) or
                             getattr(msg, "audio", None))
                    if not media:
                        if msg.photo:
                            files.append({
                                "id": f"{ch_id}_{msg.id}", "msg_id": msg.id,
                                "channel_id": ch_id, "name": f"photo_{msg.id}.jpg",
                                "type": "image", "mime": "image/jpeg", "size": 0,
                                "date": msg.date.timestamp() if msg.date else 0,
                                "caption": msg.caption or "",
                                "has_thumb": True,
                            })
                        continue
                    mime  = getattr(media, "mime_type", "") or ""
                    fname = getattr(media, "file_name", "") or f"file_{msg.id}"
                    ftype = media_type(mime, fname)
                    if ftype == "other": continue
                    files.append({
                        "id": f"{ch_id}_{msg.id}", "msg_id": msg.id,
                        "channel_id": ch_id, "name": fname,
                        "type": ftype, "mime": mime,
                        "size": getattr(media, "file_size", 0),
                        "date": msg.date.timestamp() if msg.date else 0,
                        "caption": msg.caption or "",
                        "duration": getattr(media, "duration", None),
                        "has_thumb": bool(getattr(media, "thumbs", None)),
                    })
                channel_name = getattr(chat, "title", None) or ch_id_str
                discover_cache[ch_id_str] = {
                    "id": ch_id, "str_id": ch_id_str,
                    "name": channel_name,
                    "username": getattr(chat, "username", None) or "",
                    "description": getattr(chat, "description", None) or "",
                    "file_count": len(files),
                    "files": files,
                }
                # Also save to general file_cache and Telegram
                async with _file_cache_lock:
                    file_cache[ch_id_str] = {
                        "files": files,
                        "scanned_at": datetime.utcnow().isoformat(),
                        "channel_name": channel_name,
                        "file_count": len(files),
                    }
                if config.CACHE_CHANNEL_ID:
                    asyncio.create_task(save_cache(client, ch_id_str, files, channel_name))
                print(f"Discover: {ch_id_str} ({channel_name}) → {len(files)} files")
            except Exception as e:
                print(f"Discover failed for {ch_id_str}: {e}")
        _discover_done = True

async def _load_startup_caches():
    """Load all cached file lists from Telegram on startup."""
    global file_cache, discover_cache, _discover_done
    # Wait for a user session to be available (loaded from persistent session file if any)
    # Try for up to 60 seconds
    for _ in range(12):
        client = get_discover_client()
        if client:
            break
        await asyncio.sleep(5)
    if not client:
        print("[startup] No client available for cache load")
        return
    caches = await load_all_caches(client)
    for chat_id_str, data in caches.items():
        file_cache[chat_id_str] = data
        # Also populate discover_cache for BOT_CHANNELS
        if chat_id_str in config.BOT_CHANNELS:
            discover_cache[chat_id_str] = {
                **data,
                "id": int(chat_id_str),
                "str_id": chat_id_str,
                "name": data.get("channel_name", chat_id_str),
                "file_count": data.get("file_count", len(data.get("files", []))),
            }
    if any(s in file_cache for s in config.BOT_CHANNELS):
        _discover_done = True
    print(f"[startup] Loaded {len(caches)} channel caches from Telegram")

# ─── App lifecycle ────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_client
    print(f"AirBooks starting. BOT_CHANNELS: {config.BOT_CHANNELS}")
    # Start bot client if BOT_TOKEN is configured
    if config.BOT_TOKEN:
        try:
            bot_client = Client(
                "airbooks_bot",
                api_id=config.API_ID,
                api_hash=config.API_HASH,
                bot_token=config.BOT_TOKEN,
                in_memory=True,
            )
            await bot_client.start()
            me = await bot_client.get_me()
            print(f"[bot] Started as @{me.username} — will handle Discover streaming for guests")
        except Exception as e:
            print(f"[bot] Failed to start bot client: {e}")
            bot_client = None
    else:
        print("[bot] No BOT_TOKEN configured — guests cannot stream Discover content")
    # Load all caches from Telegram cache channel on startup
    if config.CACHE_CHANNEL_ID:
        print(f"[startup] Loading caches from Telegram channel {config.CACHE_CHANNEL_ID}...")
        asyncio.create_task(_load_startup_caches())
    yield
    # Cleanup
    if bot_client and bot_client.is_connected:
        try: await bot_client.stop()
        except Exception: pass
    for c in user_sessions.values():
        try:
            if c.is_connected: await c.stop()
        except Exception: pass

app = FastAPI(title="AirBooks", lifespan=lifespan)

_origins = ([o.strip() for o in config.FRONTEND_URL.split(",") if o.strip()]
            if config.FRONTEND_URL and config.FRONTEND_URL != "*" else ["*"])
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["Content-Length","Content-Range","Accept-Ranges"])

# ─── Auth ─────────────────────────────────────────────────────────────────────
pending_auth: Dict[str, dict] = {}

@app.post("/api/auth/send-code")
async def send_code(request: Request):
    body = await request.json()
    phone = body.get("phone", "").strip()
    if not phone: raise HTTPException(400, "Phone number required")
    client = Client(f"user_{hashlib.md5(phone.encode()).hexdigest()[:8]}",
                    api_id=config.API_ID, api_hash=config.API_HASH, in_memory=True)
    await client.connect()
    try:
        sent = await client.send_code(phone)
    except PhoneNumberInvalid: raise HTTPException(400, "Invalid phone number")
    except FloodWait as e: raise HTTPException(429, f"Wait {e.value}s")
    except Exception as e: raise HTTPException(500, str(e))
    pending_auth[sent.phone_code_hash] = {"client": client, "phone": phone}
    return {"phone_code_hash": sent.phone_code_hash}

@app.post("/api/auth/verify-code")
async def verify_code(request: Request):
    global discover_session
    body = await request.json()
    pch = body.get("phone_code_hash", "")
    code = body.get("code", "").strip()
    password = body.get("password", "")
    if pch not in pending_auth: raise HTTPException(400, "Session expired")
    entry = pending_auth[pch]
    client, phone = entry["client"], entry["phone"]
    try:
        await client.sign_in(phone, pch, code)
    except PhoneCodeInvalid: raise HTTPException(400, "Invalid code")
    except PhoneCodeExpired:
        del pending_auth[pch]; raise HTTPException(400, "Code expired")
    except SessionPasswordNeeded:
        if not password: return {"needs_2fa": True, "phone_code_hash": pch}
        try: await client.check_password(password)
        except PasswordHashInvalid: raise HTTPException(400, "Wrong 2FA password")
    except Exception as e: raise HTTPException(500, str(e))
    del pending_auth[pch]
    me = await client.get_me()
    sid = hashlib.md5(f"{me.id}{datetime.utcnow().isoformat()}".encode()).hexdigest()
    user_sessions[sid] = client
    # First login becomes the discover session and triggers a scan
    if discover_session is None or discover_session not in user_sessions:
        discover_session = sid
        asyncio.create_task(refresh_discover())
    token = create_jwt({"session_id": sid, "user_id": me.id,
                        "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
                        "username": me.username or ""})
    return {"token": token, "user": {"id": me.id,
        "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
        "username": me.username or ""}}

@app.post("/api/auth/logout")
async def logout(user: dict = Depends(require_auth)):
    sid = user.get("session_id")
    if sid and sid in user_sessions:
        try:
            c = user_sessions[sid]
            if c.is_connected: await c.log_out()
        except Exception: pass
        del user_sessions[sid]
    return {"success": True}

@app.get("/api/auth/me")
async def get_me(client: Client = Depends(get_user_client)):
    me = await client.get_me()
    return {"id": me.id, "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
            "username": me.username or ""}

# ─── Discover ─────────────────────────────────────────────────────────────────
@app.get("/api/discover/channels")
async def get_discover_channels():
    return {"channels": [{k: v for k, v in ch.items() if k != "files"}
                         for ch in discover_cache.values()],
            "ready": _discover_done,
            "has_session": get_discover_client() is not None}

@app.get("/api/discover/channels/{ch_id}/files")
async def get_channel_files(ch_id: str, type: str = None, refresh: bool = False):
    """Get all files in a discover channel. refresh=true forces re-scan."""
    # If refresh requested, clear all caches and trigger re-scan synchronously
    if refresh:
        # Clear from memory caches
        discover_cache.pop(ch_id, None)
        file_cache.pop(ch_id, None)
        # Delete from Telegram JSON cache + re-scan
        client = get_discover_client()
        if client:
            try:
                # Delete old JSON cache
                if config.CACHE_CHANNEL_ID:
                    await delete_cache(client, ch_id)
                # Re-scan the channel
                ch_id_int = int(ch_id)
                files = []
                async for msg in client.get_chat_history(ch_id_int):
                    media = (getattr(msg,"document",None) or getattr(msg,"video",None) or getattr(msg,"audio",None))
                    if not media:
                        if msg.photo:
                            files.append({"id": f"{ch_id_int}_{msg.id}", "msg_id": msg.id,
                                          "channel_id": ch_id_int, "name": f"photo_{msg.id}.jpg",
                                          "type": "image", "mime": "image/jpeg", "size": 0,
                                          "date": msg.date.timestamp() if msg.date else 0,
                                          "caption": msg.caption or "", "has_thumb": True})
                        continue
                    mime  = getattr(media,"mime_type","") or ""
                    fname = getattr(media,"file_name","") or f"file_{msg.id}"
                    ftype = media_type(mime, fname)
                    if ftype == "other": continue
                    files.append({"id": f"{ch_id_int}_{msg.id}", "msg_id": msg.id,
                                  "channel_id": ch_id_int, "name": fname,
                                  "type": ftype, "mime": mime,
                                  "size": getattr(media,"file_size",0),
                                  "date": msg.date.timestamp() if msg.date else 0,
                                  "caption": msg.caption or "",
                                  "duration": getattr(media,"duration",None),
                                  "has_thumb": bool(getattr(media,"thumbs",None))})
                # Get channel name
                try:
                    chat_obj = await client.get_chat(ch_id_int)
                    channel_name = getattr(chat_obj, "title", None) or ch_id
                except Exception:
                    channel_name = ch_id
                # Save to discover_cache
                discover_cache[ch_id] = {
                    "id": ch_id_int, "str_id": ch_id,
                    "name": channel_name,
                    "file_count": len(files),
                    "files": files,
                    "scanned_at": datetime.utcnow().isoformat(),
                }
                # Save to file_cache too
                async with _file_cache_lock:
                    file_cache[ch_id] = {
                        "files": files,
                        "scanned_at": datetime.utcnow().isoformat(),
                        "channel_name": channel_name,
                        "file_count": len(files),
                    }
                # Save new JSON to Telegram cache channel
                if config.CACHE_CHANNEL_ID:
                    asyncio.create_task(save_cache(client, ch_id, files, channel_name))
            except Exception as e:
                raise HTTPException(500, f"Refresh failed: {str(e)}")

    # Serve from cache
    if ch_id not in discover_cache:
        # Try file_cache as fallback
        if ch_id in file_cache:
            files = file_cache[ch_id].get("files", [])
            if type: files = [f for f in files if f.get("type") == type]
            return {"files": files,
                    "channel": {"name": file_cache[ch_id].get("channel_name", ""),
                                "scanned_at": file_cache[ch_id].get("scanned_at", "")}}
        raise HTTPException(404, "Channel not found")
    files = discover_cache[ch_id]["files"]
    if type: files = [f for f in files if f["type"] == type]
    return {"files": files,
            "channel": {k: v for k, v in discover_cache[ch_id].items() if k != "files"}}

@app.post("/api/discover/refresh")
async def trigger_discover_refresh(user: dict = Depends(require_auth)):
    asyncio.create_task(refresh_discover())
    return {"message": "Refresh started"}

@app.get("/api/cache/info")
async def cache_info(user: dict = Depends(require_auth)):
    """List all cached channels with metadata."""
    memory_info = [
        {"chat_id": k, "channel_name": v.get("channel_name",""), 
         "file_count": v.get("file_count", len(v.get("files",[]))),
         "scanned_at": v.get("scanned_at","")}
        for k, v in file_cache.items()
    ]
    return {"cached_channels": len(file_cache), "channels": memory_info,
            "cache_channel_id": config.CACHE_CHANNEL_ID}

@app.delete("/api/cache/{chat_id}")
async def clear_cache(chat_id: str, user: dict = Depends(require_auth)):
    """Force clear cache for a channel (will re-scan next visit)."""
    sid = user.get("session_id")
    client = user_sessions.get(sid) if sid else None
    if chat_id in file_cache:
        del file_cache[chat_id]
    if client and config.CACHE_CHANNEL_ID:
        asyncio.create_task(delete_cache(client, chat_id))
    return {"message": f"Cache cleared for {chat_id}"}

# ─── User chats ───────────────────────────────────────────────────────────────
@app.get("/api/chats")
async def get_user_chats(client: Client = Depends(get_user_client)):
    chats = []
    async for dialog in client.get_dialogs(limit=200):
        chat = dialog.chat
        chats.append({
            "id": chat.id,
            "name": getattr(chat,"title",None) or f"{getattr(chat,'first_name','') or ''} {getattr(chat,'last_name','') or ''}".strip() or str(chat.id),
            "username": getattr(chat,"username",None) or "",
            "type": str(chat.type).split(".")[-1].lower(),
            "unread": getattr(dialog,"unread_messages_count",0),
        })
    return {"chats": chats}

@app.get("/api/chats/{chat_id}/files")
async def get_chat_files(chat_id: int, type: str = None, refresh: bool = False,
                         user: dict = Depends(require_auth)):
    sid = user.get("session_id") if user else None
    client = (user_sessions.get(sid) if sid and sid in user_sessions
              and user_sessions[sid].is_connected else None) or get_discover_client()
    if not client: raise HTTPException(503, "No session")
    chat_id_str = str(chat_id)

    # Return from cache if available and not forcing refresh
    if not refresh and chat_id_str in file_cache:
        all_files = file_cache[chat_id_str].get("files", [])
        filtered = [f for f in all_files if not type or f.get("type") == type]
        return {"files": filtered, "from_cache": True,
                "scanned_at": file_cache[chat_id_str].get("scanned_at")}

    # Incremental scan — only scan messages newer than what's already cached
    existing_files = []
    newest_msg_id = 0
    if chat_id_str in file_cache and not refresh:
        existing_files = file_cache[chat_id_str].get("files", [])
        newest_msg_id = file_cache[chat_id_str].get("newest_msg_id", 0)
    elif chat_id_str in file_cache and refresh:
        # On explicit refresh, keep existing files but rescan for new ones
        existing_files = file_cache[chat_id_str].get("files", [])
        newest_msg_id = file_cache[chat_id_str].get("newest_msg_id", 0)

    # Build set of existing msg_ids to avoid duplicates
    existing_ids = {f["msg_id"] for f in existing_files}

    new_files = []
    try:
        async for msg in client.get_chat_history(chat_id):
            # Stop when we reach messages we already have
            if msg.id <= newest_msg_id and newest_msg_id > 0:
                break
            media = (getattr(msg,"document",None) or getattr(msg,"video",None) or getattr(msg,"audio",None))
            if not media:
                if msg.photo and msg.id not in existing_ids:
                    new_files.append({"id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
                                  "channel_id": chat_id, "name": f"photo_{msg.id}.jpg",
                                  "type": "image", "mime": "image/jpeg", "size": 0,
                                  "date": msg.date.timestamp() if msg.date else 0,
                                  "caption": msg.caption or "",
                                  "has_thumb": True})
                continue
            if msg.id in existing_ids:
                continue
            mime  = getattr(media,"mime_type","") or ""
            fname = getattr(media,"file_name","") or f"file_{msg.id}"
            ftype = media_type(mime, fname)
            if ftype == "other": continue
            new_files.append({"id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
                          "channel_id": chat_id, "name": fname, "type": ftype, "mime": mime,
                          "size": getattr(media,"file_size",0),
                          "date": msg.date.timestamp() if msg.date else 0,
                          "caption": msg.caption or "",
                          "duration": getattr(media,"duration",None),
                          "has_thumb": bool(getattr(media,"thumbs",None))})
    except Exception as e: raise HTTPException(500, str(e))

    # Merge new files with existing (new files are newer, go first)
    files = new_files + existing_files
    # Track the newest msg_id seen
    all_msg_ids = [f["msg_id"] for f in files]
    new_newest = max(all_msg_ids) if all_msg_ids else 0

    # Try to get channel name
    try:
        chat_obj = await client.get_chat(chat_id)
        channel_name = getattr(chat_obj, "title", None) or str(chat_id)
    except Exception:
        channel_name = str(chat_id)

    # Save to memory cache
    async with _file_cache_lock:
        file_cache[chat_id_str] = {
            "files": files,
            "scanned_at": datetime.utcnow().isoformat(),
            "channel_name": channel_name,
            "newest_msg_id": new_newest,
            "file_count": len(files),
        }

    # Save to Telegram cache channel in background
    if config.CACHE_CHANNEL_ID:
        asyncio.create_task(save_cache(client, chat_id, files, channel_name))

    # Return filtered by type
    filtered = [f for f in files if not type or f.get("type") == type]
    return {"files": filtered, "from_cache": False, "total_scanned": len(files)}

# ─── Streaming ────────────────────────────────────────────────────────────────
@app.get("/api/stream/{source}/{chat_id}/{msg_id}")
async def stream_file(source: str, chat_id: int, msg_id: int,
                      request: Request, user: dict = Depends(require_auth)):
    sid = user.get("session_id")
    ch_id_str = str(chat_id)
    is_discover_channel = ch_id_str in config.BOT_CHANNELS

    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        # Logged-in user — always use their own session (works for everything)
        client = user_sessions[sid]
    elif is_discover_channel:
        # Guest or other user accessing a BOT_CHANNEL — use bot client
        client = get_bot_or_discover_client()
        if not client:
            raise HTTPException(503, "Streaming unavailable — bot not configured")
    else:
        raise HTTPException(401, "Not authenticated")

    range_header = request.headers.get("range", "")
    return await stream_media_file(client, chat_id, msg_id, range_header, request)

# ─── Fast Player ──────────────────────────────────────────────────────────────
FAST_PLAYER_HTML = open(Path(__file__).parent / "fast_player.html").read() if (Path(__file__).parent / "fast_player.html").exists() else "<h1>Player not found</h1>"

@app.get("/api/thumb/{source}/{chat_id}/{msg_id}")
async def get_thumbnail(source: str, chat_id: int, msg_id: int,
                         request: Request, user: dict = Depends(require_auth)):
    """Stream video/audio thumbnail (small JPEG)"""
    from fastapi.responses import Response as FastResp
    sid = user.get("session_id")
    ch_id_str = str(chat_id)
    is_discover_channel = ch_id_str in config.BOT_CHANNELS

    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    elif is_discover_channel:
        client = get_bot_or_discover_client()
        if not client:
            raise HTTPException(503, "No bot client available")
    else:
        raise HTTPException(401, "Not authenticated")
    try:
        msg = await client.get_messages(chat_id, msg_id)
        if not msg:
            raise HTTPException(404, "Not found")
        media = (getattr(msg,"video",None) or getattr(msg,"document",None) or
                 getattr(msg,"audio",None) or getattr(msg,"photo",None))
        if not media:
            raise HTTPException(404, "No media")
        # Download thumbnail bytes
        thumbs = getattr(media, "thumbs", None)
        if thumbs:
            # Pick smallest thumb for speed
            thumb = sorted(thumbs, key=lambda t: getattr(t,"file_size",9999))[0]
            data = await client.download_media(thumb.file_id, in_memory=True)
            if data:
                return FastResp(content=bytes(data), media_type="image/jpeg",
                    headers={"Cache-Control":"public,max-age=86400","Access-Control-Allow-Origin":"*"})
        # Fallback: if it's a photo, download it at small size
        if msg.photo:
            data = await client.download_media(msg.photo, in_memory=True)
            if data:
                return FastResp(content=bytes(data), media_type="image/jpeg",
                    headers={"Cache-Control":"public,max-age=86400","Access-Control-Allow-Origin":"*"})
        raise HTTPException(404, "No thumbnail")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

# In-memory photo cache: chat_id -> bytes
_photo_cache: Dict[int, bytes] = {}

@app.get("/api/chat-photo/{source}/{chat_id}")
async def get_chat_photo(source: str, chat_id: int, request: Request,
                          user: dict = Depends(require_auth)):
    """Stream chat/channel profile photo"""
    from fastapi.responses import Response as FastResp

    # Serve from memory cache if available (avoids repeated Telegram API calls)
    if chat_id in _photo_cache:
        return FastResp(content=_photo_cache[chat_id], media_type="image/jpeg",
            headers={"Cache-Control":"public,max-age=86400","Access-Control-Allow-Origin":"*"})

    # Try user session first, then bot, then any discover client
    client = None
    sid = user.get("session_id")
    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    if not client:
        client = get_bot_or_discover_client()
    if not client:
        raise HTTPException(503, "No session available")

    try:
        # get_chat works for channels/supergroups even without prior resolution
        # For private users it may fail — that's fine, initials are shown instead
        chat = await client.get_chat(chat_id)
        if not chat or not chat.photo:
            raise HTTPException(404, "No photo")
        photo = chat.photo
        file_id = (getattr(photo, "small_file_id", None) or
                   getattr(photo, "big_file_id", None) or
                   getattr(photo, "file_id", None))
        if not file_id:
            raise HTTPException(404, "No photo file_id")
        data = await client.download_media(file_id, in_memory=True)
        if not data:
            raise HTTPException(404, "No photo data")
        photo_bytes = bytes(data)
        _photo_cache[chat_id] = photo_bytes  # Cache in memory
        return FastResp(content=photo_bytes, media_type="image/jpeg",
            headers={"Cache-Control":"public,max-age=86400","Access-Control-Allow-Origin":"*"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(404, "Photo not available")

@app.head("/api/stream/{source}/{chat_id}/{msg_id}")
async def stream_file_head(source: str, chat_id: int, msg_id: int,
                            request: Request, user: dict = Depends(require_auth)):
    """HEAD request — returns file metadata without body (needed by video players for seeking)"""
    from fastapi.responses import Response as FastResponse
    sid = user.get("session_id")
    ch_id_str = str(chat_id)
    is_discover_channel = ch_id_str in config.BOT_CHANNELS

    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    elif is_discover_channel:
        client = get_bot_or_discover_client()
        if not client:
            raise HTTPException(503, "No bot client available")
    else:
        raise HTTPException(401, "Not authenticated")

    from streamer import get_streamer
    streamer = get_streamer(client)
    try:
        file_id = await streamer.get_file_properties(chat_id, msg_id)
        file_size = file_id.file_size or 0
        mime = file_id.mime_type or "application/octet-stream"
        headers = {
            "Content-Type": mime,
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
        }
        if file_size:
            headers["Content-Length"] = str(file_size)
        return FastResponse(status_code=200, headers=headers)
    except Exception as e:
        raise HTTPException(404, str(e))

@app.get("/player", response_class=HTMLResponse)
async def fast_player():
    return HTMLResponse(content=FAST_PLAYER_HTML)

@app.get("/pdf-viewer", response_class=HTMLResponse)
async def pdf_viewer():
    """BeyondDrive PDF+EPUB viewer"""
    from pathlib import Path as _Path
    p = _Path(__file__).parent / "pdf_viewer.html"
    return HTMLResponse(content=p.read_text() if p.exists() else "<h1>Viewer not found</h1>")

@app.get("/air-player", response_class=HTMLResponse)
async def air_player_route():
    """BeyondDrive AirPlayer"""
    from pathlib import Path as _Path
    p = _Path(__file__).parent / "air_player.html"
    return HTMLResponse(content=p.read_text() if p.exists() else "<h1>Player not found</h1>")

@app.api_route("/", methods=["GET","HEAD"], response_class=HTMLResponse)
async def homepage():
    """Simple status page — keep-alive for UptimeRobot"""
    sessions = len(user_sessions)
    cached = len(file_cache)
    discover = len(discover_cache)
    status = "🟢 Online" if sessions > 0 else "🟡 Waiting for login"
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>AirBooks API</title>
<meta http-equiv="refresh" content="60">
<style>
body{{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.card{{background:#ffffff10;border:1px solid #ffffff15;border-radius:20px;padding:40px;max-width:400px;width:90%;text-align:center}}
h1{{font-size:28px;margin:0 0 8px;background:linear-gradient(135deg,#3478f6,#5856d6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.status{{font-size:18px;margin:20px 0;font-weight:600}}
.grid{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:20px}}
.stat{{background:#ffffff08;border-radius:12px;padding:14px 8px}}
.stat-num{{font-size:24px;font-weight:800;color:#3478f6}}
.stat-label{{font-size:11px;color:#8e8e93;margin-top:4px}}
</style></head>
<body><div class="card">
<h1>AirBooks</h1>
<p style="color:#8e8e93;margin:0">Telegram Media Platform</p>
<div class="status">{status}</div>
<div class="grid">
<div class="stat"><div class="stat-num">{sessions}</div><div class="stat-label">Sessions</div></div>
<div class="stat"><div class="stat-num">{cached}</div><div class="stat-label">Cached</div></div>
<div class="stat"><div class="stat-num">{discover}</div><div class="stat-label">Discover</div></div>
</div>
</div></body></html>"""
    return HTMLResponse(content=html)

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    """Health check endpoint for UptimeRobot — returns 200 always"""
    return {
        "status": "ok",
        "active_sessions": len(user_sessions),
        "cached_channels": len(file_cache),
        "discover_channels": len(discover_cache),
        "discover_ready": _discover_done,
        "has_session": get_discover_client() is not None,
        "photo_cache_size": len(_photo_cache),
    }


# ─── SSE Scan Progress ────────────────────────────────────────────────────────

async def _build_file_entry(msg, chat_id: int) -> dict | None:
    """Extract file metadata from a message."""
    media = (getattr(msg,"document",None) or getattr(msg,"video",None) or getattr(msg,"audio",None))
    if not media:
        if msg.photo:
            return {"id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
                    "channel_id": chat_id, "name": f"photo_{msg.id}.jpg",
                    "type": "image", "mime": "image/jpeg", "size": 0,
                    "date": msg.date.timestamp() if msg.date else 0,
                    "caption": msg.caption or "", "has_thumb": True}
        return None
    mime  = getattr(media,"mime_type","") or ""
    fname = getattr(media,"file_name","") or f"file_{msg.id}"
    ftype = media_type(mime, fname)
    if ftype == "other":
        return None
    return {"id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
            "channel_id": chat_id, "name": fname, "type": ftype, "mime": mime,
            "size": getattr(media,"file_size",0),
            "date": msg.date.timestamp() if msg.date else 0,
            "caption": msg.caption or "",
            "duration": getattr(media,"duration",None),
            "has_thumb": bool(getattr(media,"thumbs",None))}


@app.get("/api/chats/{chat_id}/scan-progress")
async def scan_progress(chat_id: int, refresh: bool = False,
                        request: Request = None,
                        user: dict = Depends(require_auth)):
    """
    SSE endpoint — streams real-time scan progress.
    Emits JSON events: {msg, scanned, rate, elapsed, done, from_cache, channel_name}
    """
    import time
    from fastapi.responses import StreamingResponse as SR

    chat_id_str = str(chat_id)

    # Already cached and not refreshing → instant done
    if not refresh and chat_id_str in file_cache:
        cached = file_cache[chat_id_str]
        async def instant():
            data = json.dumps({
                "msg": 0, "scanned": cached.get("file_count", len(cached.get("files", []))),
                "rate": 0, "elapsed": 0, "done": True, "from_cache": True,
                "channel_name": cached.get("channel_name", ""),
                "scanned_at": cached.get("scanned_at", ""),
            })
            yield f"data: {data}\n\n"
        return SR(instant(), media_type="text/event-stream",
                  headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                           "Access-Control-Allow-Origin": "*"})

    # Get client
    sid = user.get("session_id")
    if not sid or sid not in user_sessions:
        raise HTTPException(401, "Not authenticated")
    client = user_sessions[sid]

    async def generator():
        files = []
        start = time.time()
        msg_count = 0
        file_count = 0
        last_emit = start

        # Get channel name
        try:
            chat_obj = await client.get_chat(chat_id)
            channel_name = getattr(chat_obj, "title", None) or str(chat_id)
        except Exception:
            channel_name = str(chat_id)

        # Initial event
        yield f"data: {json.dumps({'msg':0,'scanned':0,'rate':0,'elapsed':0,'done':False,'channel_name':channel_name})}\n\n"

        async for msg in client.get_chat_history(chat_id):
            if request and await request.is_disconnected():
                break

            msg_count += 1
            entry = await _build_file_entry(msg, chat_id)
            if entry:
                files.append(entry)
                file_count += 1

            # Emit update every 200 messages or every 2 seconds
            now = time.time()
            if msg_count % 200 == 0 or (now - last_emit) >= 2:
                elapsed = round(now - start)
                rate = round(msg_count / elapsed, 1) if elapsed > 0 else 0
                yield f"data: {json.dumps({'msg':msg_count,'scanned':file_count,'rate':rate,'elapsed':elapsed,'done':False,'channel_name':channel_name})}\n\n"
                last_emit = now

        # Save to memory cache
        async with _file_cache_lock:
            file_cache[chat_id_str] = {
                "files": files,
                "scanned_at": datetime.utcnow().isoformat(),
                "channel_name": channel_name,
                "file_count": len(files),
            }

        # Save to Telegram cache in background
        if config.CACHE_CHANNEL_ID:
            asyncio.create_task(save_cache(client, chat_id, files, channel_name))

        # Final done event
        elapsed = round(time.time() - start)
        rate = round(msg_count / elapsed, 1) if elapsed > 0 else 0
        yield f"data: {json.dumps({'msg':msg_count,'scanned':len(files),'rate':rate,'elapsed':elapsed,'done':True,'channel_name':channel_name,'scanned_at':datetime.utcnow().isoformat()})}\n\n"

    return SR(generator(), media_type="text/event-stream",
              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                       "Access-Control-Allow-Origin": "*"})
