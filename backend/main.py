import asyncio, json, os, hashlib
from datetime import datetime, timedelta
from typing import Dict, Optional
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt

import config
from pyrogram import Client
from pyrogram.errors import (
    PhoneNumberInvalid, PhoneCodeInvalid, PhoneCodeExpired,
    SessionPasswordNeeded, PasswordHashInvalid, FloodWait
)

# ─── Bot client ───────────────────────────────────────────────────────────────
bot_client: Optional[Client] = None

async def get_bot():
    global bot_client
    if bot_client and bot_client.is_connected:
        return bot_client
    raise HTTPException(status_code=503, detail="Bot not connected")

# ─── User sessions ────────────────────────────────────────────────────────────
user_sessions: Dict[str, Client] = {}
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
        try:
            await c.start()
        except Exception:
            raise HTTPException(401, "Session expired — please login again")
    return c

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

async def refresh_discover():
    global discover_cache, _discover_done
    if not bot_client or not bot_client.is_connected:
        return
    async with _discover_lock:
        for ch_id_str in config.BOT_CHANNELS:
            try:
                ch_id = int(ch_id_str)
                # Force resolve peer by joining/getting chat info
                try:
                    chat = await bot_client.get_chat(ch_id)
                except Exception:
                    # Try to resolve via get_messages first
                    try:
                        await bot_client.get_messages(ch_id, 1)
                        chat = await bot_client.get_chat(ch_id)
                    except Exception as e:
                        print(f"Cannot access channel {ch_id_str}: {e}")
                        continue

                files = []
                # Scan up to 5000 messages
                async for msg in bot_client.get_chat_history(ch_id, limit=5000):
                    media = (getattr(msg, "document", None) or
                             getattr(msg, "video", None) or
                             getattr(msg, "audio", None))
                    if not media:
                        if msg.photo:
                            files.append({
                                "id": f"{ch_id}_{msg.id}",
                                "msg_id": msg.id,
                                "channel_id": ch_id,
                                "name": f"photo_{msg.id}.jpg",
                                "type": "image",
                                "mime": "image/jpeg",
                                "size": 0,
                                "date": msg.date.timestamp() if msg.date else 0,
                                "caption": msg.caption or "",
                            })
                        continue
                    mime  = getattr(media, "mime_type", "") or ""
                    fname = getattr(media, "file_name", "") or f"file_{msg.id}"
                    ftype = media_type(mime, fname)
                    if ftype == "other":
                        continue
                    files.append({
                        "id": f"{ch_id}_{msg.id}",
                        "msg_id": msg.id,
                        "channel_id": ch_id,
                        "name": fname,
                        "type": ftype,
                        "mime": mime,
                        "size": getattr(media, "file_size", 0),
                        "date": msg.date.timestamp() if msg.date else 0,
                        "caption": msg.caption or "",
                    })

                discover_cache[ch_id_str] = {
                    "id": ch_id,
                    "str_id": ch_id_str,
                    "name": getattr(chat, "title", None) or getattr(chat, "username", None) or ch_id_str,
                    "username": getattr(chat, "username", None) or "",
                    "description": getattr(chat, "description", None) or "",
                    "members": getattr(chat, "members_count", 0),
                    "file_count": len(files),
                    "files": files,
                }
                print(f"Discover: {ch_id_str} → {len(files)} files")
            except Exception as e:
                print(f"Discover refresh failed for {ch_id_str}: {e}")
        _discover_done = True

# ─── App lifecycle ────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_client
    if config.BOT_TOKEN and config.API_ID:
        bot_client = Client(
            "airbooks_bot",
            api_id=config.API_ID,
            api_hash=config.API_HASH,
            bot_token=config.BOT_TOKEN,
            in_memory=True,
        )
        await bot_client.start()
        print(f"Bot started. Channels to scan: {config.BOT_CHANNELS}")
        asyncio.create_task(refresh_discover())
    yield
    if bot_client and bot_client.is_connected:
        await bot_client.stop()
    for c in user_sessions.values():
        try:
            if c.is_connected: await c.stop()
        except Exception:
            pass

app = FastAPI(title="AirBooks", lifespan=lifespan)

_origins = ([o.strip() for o in config.FRONTEND_URL.split(",") if o.strip()]
            if config.FRONTEND_URL and config.FRONTEND_URL != "*" else ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
)

# ─── Auth ─────────────────────────────────────────────────────────────────────
pending_auth: Dict[str, dict] = {}

@app.post("/api/auth/send-code")
async def send_code(request: Request):
    body = await request.json()
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(400, "Phone number required")
    session_name = f"user_{hashlib.md5(phone.encode()).hexdigest()[:8]}"
    client = Client(session_name, api_id=config.API_ID, api_hash=config.API_HASH, in_memory=True)
    await client.connect()
    try:
        sent = await client.send_code(phone)
    except PhoneNumberInvalid:
        raise HTTPException(400, "Invalid phone number")
    except FloodWait as e:
        raise HTTPException(429, f"Too many attempts. Wait {e.value} seconds.")
    except Exception as e:
        raise HTTPException(500, str(e))
    key = sent.phone_code_hash
    pending_auth[key] = {"client": client, "phone": phone}
    return {"phone_code_hash": key, "message": "Code sent to Telegram"}

@app.post("/api/auth/verify-code")
async def verify_code(request: Request):
    body = await request.json()
    phone_code_hash = body.get("phone_code_hash", "")
    code = body.get("code", "").strip()
    password = body.get("password", "")
    if phone_code_hash not in pending_auth:
        raise HTTPException(400, "Session expired — request a new code")
    entry = pending_auth[phone_code_hash]
    client: Client = entry["client"]
    phone: str = entry["phone"]
    try:
        await client.sign_in(phone, phone_code_hash, code)
    except PhoneCodeInvalid:
        raise HTTPException(400, "Invalid code")
    except PhoneCodeExpired:
        del pending_auth[phone_code_hash]
        raise HTTPException(400, "Code expired — request a new one")
    except SessionPasswordNeeded:
        if not password:
            return {"needs_2fa": True, "phone_code_hash": phone_code_hash}
        try:
            await client.check_password(password)
        except PasswordHashInvalid:
            raise HTTPException(400, "Wrong 2FA password")
    except Exception as e:
        raise HTTPException(500, str(e))
    del pending_auth[phone_code_hash]
    me = await client.get_me()
    session_id = hashlib.md5(f"{me.id}{datetime.utcnow().isoformat()}".encode()).hexdigest()
    user_sessions[session_id] = client
    token = create_jwt({
        "session_id": session_id,
        "user_id": me.id,
        "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
        "username": me.username or "",
    })
    return {
        "token": token,
        "user": {
            "id": me.id,
            "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
            "username": me.username or "",
        }
    }

@app.post("/api/auth/logout")
async def logout(user: dict = Depends(require_auth)):
    sid = user.get("session_id")
    if sid and sid in user_sessions:
        try:
            c = user_sessions[sid]
            if c.is_connected:
                await c.log_out()
        except Exception:
            pass
        del user_sessions[sid]
    return {"success": True}

@app.get("/api/auth/me")
async def get_me(client: Client = Depends(get_user_client)):
    me = await client.get_me()
    return {
        "id": me.id,
        "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
        "username": me.username or "",
    }

# ─── Discover ─────────────────────────────────────────────────────────────────
@app.get("/api/discover/channels")
async def get_discover_channels():
    return {
        "channels": [
            {k: v for k, v in ch.items() if k != "files"}
            for ch in discover_cache.values()
        ],
        "ready": _discover_done,
    }

@app.get("/api/discover/channels/{ch_id}/files")
async def get_channel_files(ch_id: str, type: str = None):
    if ch_id not in discover_cache:
        raise HTTPException(404, "Channel not found")
    files = discover_cache[ch_id]["files"]
    if type:
        files = [f for f in files if f["type"] == type]
    return {
        "files": files,
        "channel": {k: v for k, v in discover_cache[ch_id].items() if k != "files"},
    }

@app.post("/api/discover/refresh")
async def trigger_discover_refresh():
    asyncio.create_task(refresh_discover())
    return {"message": "Refresh started"}

# ─── User chats ───────────────────────────────────────────────────────────────
@app.get("/api/chats")
async def get_user_chats(client: Client = Depends(get_user_client)):
    chats = []
    async for dialog in client.get_dialogs(limit=200):
        chat = dialog.chat
        chats.append({
            "id": chat.id,
            "name": getattr(chat, "title", None) or f"{getattr(chat,'first_name','') or ''} {getattr(chat,'last_name','') or ''}".strip() or str(chat.id),
            "username": getattr(chat, "username", None) or "",
            "type": str(chat.type).split(".")[-1].lower(),
            "unread": getattr(dialog, "unread_messages_count", 0),
        })
    return {"chats": chats}

@app.get("/api/chats/{chat_id}/files")
async def get_chat_files(chat_id: int, type: str = None,
                         client: Client = Depends(get_user_client)):
    files = []
    try:
        async for msg in client.get_chat_history(chat_id, limit=1000):
            media = (getattr(msg, "document", None) or
                     getattr(msg, "video", None) or
                     getattr(msg, "audio", None))
            if not media:
                if msg.photo:
                    ftype = "image"
                    if type and ftype != type:
                        continue
                    files.append({
                        "id": f"{chat_id}_{msg.id}",
                        "msg_id": msg.id,
                        "channel_id": chat_id,
                        "name": f"photo_{msg.id}.jpg",
                        "type": "image",
                        "mime": "image/jpeg",
                        "size": 0,
                        "date": msg.date.timestamp() if msg.date else 0,
                        "caption": msg.caption or "",
                    })
                continue
            mime  = getattr(media, "mime_type", "") or ""
            fname = getattr(media, "file_name", "") or f"file_{msg.id}"
            ftype = media_type(mime, fname)
            if ftype == "other":
                continue
            if type and ftype != type:
                continue
            files.append({
                "id": f"{chat_id}_{msg.id}",
                "msg_id": msg.id,
                "channel_id": chat_id,
                "name": fname,
                "type": ftype,
                "mime": mime,
                "size": getattr(media, "file_size", 0),
                "date": msg.date.timestamp() if msg.date else 0,
                "caption": msg.caption or "",
            })
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"files": files}

# ─── Streaming ────────────────────────────────────────────────────────────────
@app.get("/api/stream/{source}/{chat_id}/{msg_id}")
async def stream_file(source: str, chat_id: int, msg_id: int,
                      request: Request,
                      user: dict = Depends(require_auth)):
    # Pick client
    if source == "discover":
        client = await get_bot()
    else:
        sid = user.get("session_id")
        if not sid or sid not in user_sessions:
            raise HTTPException(401, "Not authenticated")
        client = user_sessions[sid]

    try:
        msg = await client.get_messages(chat_id, msg_id)
    except Exception as e:
        raise HTTPException(500, f"Could not fetch message: {e}")

    if not msg:
        raise HTTPException(404, "Message not found")

    # Get media info
    media = (getattr(msg, "document", None) or
             getattr(msg, "video", None) or
             getattr(msg, "audio", None))

    if media:
        file_size = getattr(media, "file_size", 0) or 0
        mime = getattr(media, "mime_type", None) or "application/octet-stream"
    elif msg.photo:
        file_size = 0
        mime = "image/jpeg"
    else:
        raise HTTPException(404, "No media in message")

    # Handle range requests
    range_header = request.headers.get("range", "")
    if range_header and file_size:
        parts = range_header.replace("bytes=", "").split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(chunk),
            "Accept-Ranges": "bytes",
            "Content-Type": mime,
            "Cache-Control": "no-cache",
        }
        status = 206
    else:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": mime,
            "Cache-Control": "no-cache",
        }
        if file_size:
            headers["Content-Length"] = str(file_size)
        status = 200

    async def generator():
        try:
            async for chunk in client.stream_media(msg):
                if await request.is_disconnected():
                    break
                yield chunk
        except Exception as e:
            print(f"Stream error: {e}")

    return StreamingResponse(generator(), status_code=status, headers=headers, media_type=mime)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "discover_channels": len(discover_cache),
        "discover_ready": _discover_done,
        "bot_channels_config": config.BOT_CHANNELS,
        "active_sessions": len(user_sessions),
    }
