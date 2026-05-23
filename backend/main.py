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
from pyrogram import Client
from pyrogram.errors import (
    PhoneNumberInvalid, PhoneCodeInvalid, PhoneCodeExpired,
    SessionPasswordNeeded, PasswordHashInvalid, FloodWait
)

# ─── Bot client (for Discover / admin channels) ──────────────────────────────
bot_client: Optional[Client] = None

async def get_bot():
    global bot_client
    if bot_client and bot_client.is_connected:
        return bot_client
    raise HTTPException(status_code=503, detail="Bot not connected")

# ─── User sessions ────────────────────────────────────────────────────────────
# session_id → pyrogram Client
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
    ext = Path(f).suffix
    if m == "application/pdf" or f.endswith(".pdf"): return "pdf"
    if m in ("application/epub+zip","application/epub") or ext == ".epub": return "epub"
    if m in VIDEO_MIMES or ext in VIDEO_EXTS: return "video"
    if m in AUDIO_MIMES or ext in AUDIO_EXTS: return "audio"
    if m in IMAGE_MIMES or ext in IMAGE_EXTS: return "image"
    return "other"

# ─── Discover cache (bot channels) ───────────────────────────────────────────
discover_cache: Dict[str, dict] = {}   # channel_id_str → {info, files}
_discover_lock = asyncio.Lock()

async def refresh_discover():
    global discover_cache
    if not bot_client or not bot_client.is_connected:
        return
    async with _discover_lock:
        for ch_id_str in config.BOT_CHANNELS:
            try:
                ch_id = int(ch_id_str)
                chat = await bot_client.get_chat(ch_id)
                files = []
                async for msg in bot_client.get_chat_history(ch_id, limit=500):
                    media = getattr(msg, "document", None) or getattr(msg, "video", None) or getattr(msg, "audio", None)
                    if not media:
                        if msg.photo:
                            files.append({
                                "id": f"{ch_id}_{msg.id}", "msg_id": msg.id,
                                "channel_id": ch_id, "name": f"photo_{msg.id}.jpg",
                                "type": "image", "mime": "image/jpeg",
                                "size": 0, "date": msg.date.timestamp() if msg.date else 0,
                                "caption": msg.caption or "",
                            })
                        continue
                    mime  = getattr(media, "mime_type", "") or ""
                    fname = getattr(media, "file_name", "") or f"file_{msg.id}"
                    ftype = media_type(mime, fname)
                    if ftype == "other":
                        continue
                    files.append({
                        "id": f"{ch_id}_{msg.id}", "msg_id": msg.id,
                        "channel_id": ch_id, "name": fname,
                        "type": ftype, "mime": mime,
                        "size": getattr(media, "file_size", 0),
                        "date": msg.date.timestamp() if msg.date else 0,
                        "caption": msg.caption or "",
                    })
                discover_cache[ch_id_str] = {
                    "id": ch_id, "str_id": ch_id_str,
                    "name": chat.title or chat.username or ch_id_str,
                    "username": chat.username or "",
                    "description": chat.description or "",
                    "members": getattr(chat, "members_count", 0),
                    "files": files,
                }
            except Exception as e:
                print(f"Discover refresh failed for {ch_id_str}: {e}")

# ─── App lifecycle ────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_client
    if config.BOT_TOKEN and config.API_ID:
        bot_client = Client(
            "airbooks_bot", api_id=config.API_ID, api_hash=config.API_HASH,
            bot_token=config.BOT_TOKEN, in_memory=True,
        )
        await bot_client.start()
        print("Bot client started")
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
            if config.FRONTEND_URL != "*" else ["*"])
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["Content-Length","Content-Range","Accept-Ranges"])

# ─── Auth: phone/OTP flow ─────────────────────────────────────────────────────
pending_auth: Dict[str, dict] = {}  # phone_hash → {client, phone}

@app.post("/api/auth/send-code")
async def send_code(request: Request):
    body = await request.json()
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(400, "Phone number required")
    session_name = f"user_{hashlib.md5(phone.encode()).hexdigest()[:8]}"
    client = Client(session_name, api_id=config.API_ID, api_hash=config.API_HASH,
                    in_memory=True)
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
        signed_in = await client.sign_in(phone, phone_code_hash, code)
    except PhoneCodeInvalid:
        raise HTTPException(400, "Invalid code")
    except PhoneCodeExpired:
        del pending_auth[phone_code_hash]
        raise HTTPException(400, "Code expired — request a new one")
    except SessionPasswordNeeded:
        if not password:
            return {"needs_2fa": True, "phone_code_hash": phone_code_hash}
        try:
            signed_in = await client.check_password(password)
        except PasswordHashInvalid:
            raise HTTPException(400, "Wrong 2FA password")
    except Exception as e:
        raise HTTPException(500, str(e))

    del pending_auth[phone_code_hash]
    me = await client.get_me()
    session_id = hashlib.md5(f"{me.id}{datetime.utcnow().isoformat()}".encode()).hexdigest()
    user_sessions[session_id] = client

    token = create_jwt({"session_id": session_id, "user_id": me.id,
                        "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
                        "username": me.username or ""})
    return {
        "token": token,
        "user": {"id": me.id, "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
                 "username": me.username or "", "photo": None}
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
    return {"id": me.id, "name": f"{me.first_name or ''} {me.last_name or ''}".strip(),
            "username": me.username or ""}

# ─── Discover endpoints ────────────────────────────────────────────────────────
@app.get("/api/discover/channels")
async def get_discover_channels():
    return {"channels": [
        {k: v for k, v in ch.items() if k != "files"}
        for ch in discover_cache.values()
    ]}

@app.get("/api/discover/channels/{ch_id}/files")
async def get_channel_files(ch_id: str, type: str = None):
    if ch_id not in discover_cache:
        raise HTTPException(404, "Channel not found")
    files = discover_cache[ch_id]["files"]
    if type:
        files = [f for f in files if f["type"] == type]
    return {"files": files, "channel": {k: v for k, v in discover_cache[ch_id].items() if k != "files"}}

@app.post("/api/discover/refresh")
async def trigger_discover_refresh():
    asyncio.create_task(refresh_discover())
    return {"message": "Refresh started"}

# ─── User chats ───────────────────────────────────────────────────────────────
@app.get("/api/chats")
async def get_user_chats(client: Client = Depends(get_user_client)):
    chats = []
    async for dialog in client.get_dialogs(limit=100):
        chat = dialog.chat
        chats.append({
            "id": chat.id,
            "name": chat.title or f"{chat.first_name or ''} {chat.last_name or ''}".strip(),
            "username": chat.username or "",
            "type": str(chat.type).split(".")[-1].lower(),
            "unread": dialog.unread_messages_count,
            "photo": None,
        })
    return {"chats": chats}

@app.get("/api/chats/{chat_id}/files")
async def get_chat_files(chat_id: int, type: str = None,
                         client: Client = Depends(get_user_client)):
    files = []
    async for msg in client.get_chat_history(chat_id, limit=200):
        media = getattr(msg, "document", None) or getattr(msg, "video", None) or getattr(msg, "audio", None)
        if not media:
            if msg.photo and (not type or type == "image"):
                files.append({
                    "id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
                    "channel_id": chat_id, "name": f"photo_{msg.id}.jpg",
                    "type": "image", "mime": "image/jpeg", "size": 0,
                    "date": msg.date.timestamp() if msg.date else 0,
                    "caption": msg.caption or "",
                })
            continue
        mime  = getattr(media, "mime_type", "") or ""
        fname = getattr(media, "file_name", "") or f"file_{msg.id}"
        ftype = media_type(mime, fname)
        if ftype == "other" or (type and ftype != type):
            continue
        files.append({
            "id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
            "channel_id": chat_id, "name": fname,
            "type": ftype, "mime": mime,
            "size": getattr(media, "file_size", 0),
            "date": msg.date.timestamp() if msg.date else 0,
            "caption": msg.caption or "",
        })
    return {"files": files}

# ─── Streaming ────────────────────────────────────────────────────────────────
async def _stream(client: Client, chat_id: int, msg_id: int,
                  request: Request, file_size: int = 0, mime: str = "application/octet-stream"):
    msg = await client.get_messages(chat_id, msg_id)
    if not msg:
        raise HTTPException(404, "Message not found")

    range_header = request.headers.get("range")
    offset = 0
    end = file_size - 1 if file_size else None

    if range_header and file_size:
        parts = range_header.replace("bytes=", "").split("-")
        offset = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        chunk_size = end - offset + 1
        status = 206
        headers = {
            "Content-Range": f"bytes {offset}-{end}/{file_size}",
            "Content-Length": str(chunk_size),
            "Accept-Ranges": "bytes",
            "Content-Type": mime,
        }
    else:
        status = 200
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": mime,
            "Cache-Control": "no-cache",
        }
        if file_size:
            headers["Content-Length"] = str(file_size)

    async def generator():
        async for chunk in client.stream_media(msg, offset=offset, limit=1024*1024):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(generator(), status_code=status, headers=headers, media_type=mime)

@app.get("/api/stream/{source}/{chat_id}/{msg_id}")
async def stream_file(source: str, chat_id: int, msg_id: int,
                      request: Request,
                      token: str = None,
                      user: dict = Depends(require_auth)):
    if source == "discover":
        client = await get_bot()
    else:
        sid = user.get("session_id")
        if not sid or sid not in user_sessions:
            raise HTTPException(401, "Not authenticated")
        client = user_sessions[sid]

    # Get file info for size/mime
    try:
        msg = await client.get_messages(chat_id, msg_id)
        media = getattr(msg, "document", None) or getattr(msg, "video", None) or getattr(msg, "audio", None)
        file_size = getattr(media, "file_size", 0) if media else 0
        mime = getattr(media, "mime_type", "application/octet-stream") if media else "application/octet-stream"
    except Exception:
        file_size, mime = 0, "application/octet-stream"

    return await _stream(client, chat_id, msg_id, request, file_size, mime)

@app.get("/health")
async def health():
    return {"status": "ok", "discover_channels": len(discover_cache),
            "active_sessions": len(user_sessions)}
