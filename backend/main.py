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
from pyrogram import Client
from pyrogram.errors import (
    PhoneNumberInvalid, PhoneCodeInvalid, PhoneCodeExpired,
    SessionPasswordNeeded, PasswordHashInvalid, FloodWait
)

# ─── Sessions ─────────────────────────────────────────────────────────────────
user_sessions: Dict[str, Client] = {}
# The "admin" session used for Discover scanning (first user who logs in, or pre-configured)
discover_session: Optional[str] = None  # session_id of the session used for discover

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
    """Get a user client suitable for scanning Discover channels."""
    global discover_session
    # Try the designated discover session first
    if discover_session and discover_session in user_sessions:
        c = user_sessions[discover_session]
        if c.is_connected:
            return c
    # Fall back to any available connected session
    for sid, c in user_sessions.items():
        if c.is_connected:
            discover_session = sid
            return c
    return None

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
                # Paginate to get ALL messages (no limit per batch)
                offset_id = 0
                while True:
                    batch = await client.get_chat_history(ch_id, limit=200, offset_id=offset_id)
                    if not batch:
                        break
                    last_id = None
                    for msg in batch:
                        last_id = msg.id
                        media = (getattr(msg, "document", None) or
                                 getattr(msg, "video", None) or
                                 getattr(msg, "audio", None))
                        # Extract thumbnail message_id if available
                        thumb_msg_id = None
                        if msg.video and hasattr(msg.video, "thumbs") and msg.video.thumbs:
                            thumb_msg_id = msg.id  # use same msg_id, backend streams thumb
                        if not media:
                            if msg.photo:
                                files.append({
                                    "id": f"{ch_id}_{msg.id}", "msg_id": msg.id,
                                    "channel_id": ch_id, "name": f"photo_{msg.id}.jpg",
                                    "type": "image", "mime": "image/jpeg", "size": 0,
                                    "date": msg.date.timestamp() if msg.date else 0,
                                    "caption": msg.caption or "",
                                    "thumb_msg_id": msg.id,
                                })
                            continue
                        mime  = getattr(media, "mime_type", "") or ""
                        fname = getattr(media, "file_name", "") or f"file_{msg.id}"
                        ftype = media_type(mime, fname)
                        if ftype == "other": continue
                        # Extract duration
                        duration = getattr(media, "duration", None)
                        # Extract thumbnail
                        thumbs = getattr(media, "thumbs", None)
                        has_thumb = bool(thumbs)
                        files.append({
                            "id": f"{ch_id}_{msg.id}", "msg_id": msg.id,
                            "channel_id": ch_id, "name": fname,
                            "type": ftype, "mime": mime,
                            "size": getattr(media, "file_size", 0),
                            "date": msg.date.timestamp() if msg.date else 0,
                            "caption": msg.caption or "",
                            "duration": duration,
                            "has_thumb": has_thumb,
                        })
                    if not batch or len(batch) < 200:
                        break
                    offset_id = last_id
                discover_cache[ch_id_str] = {
                    "id": ch_id, "str_id": ch_id_str,
                    "name": getattr(chat, "title", None) or ch_id_str,
                    "username": getattr(chat, "username", None) or "",
                    "description": getattr(chat, "description", None) or "",
                    "file_count": len(files),
                    "files": files,
                }
                print(f"Discover: {ch_id_str} ({getattr(chat,'title','?')}) → {len(files)} files")
            except Exception as e:
                print(f"Discover failed for {ch_id_str}: {e}")
        _discover_done = True

# ─── App lifecycle ────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"AirBooks starting. BOT_CHANNELS: {config.BOT_CHANNELS}")
    print("Note: Discover requires a user to login first (bots cannot read chat history)")
    yield
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
async def get_channel_files(ch_id: str, type: str = None):
    if ch_id not in discover_cache: raise HTTPException(404, "Channel not found")
    files = discover_cache[ch_id]["files"]
    if type: files = [f for f in files if f["type"] == type]
    return {"files": files, "channel": {k: v for k, v in discover_cache[ch_id].items() if k != "files"}}

@app.post("/api/discover/refresh")
async def trigger_discover_refresh(user: dict = Depends(require_auth)):
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
            "name": getattr(chat,"title",None) or f"{getattr(chat,'first_name','') or ''} {getattr(chat,'last_name','') or ''}".strip() or str(chat.id),
            "username": getattr(chat,"username",None) or "",
            "type": str(chat.type).split(".")[-1].lower(),
            "unread": getattr(dialog,"unread_messages_count",0),
        })
    return {"chats": chats}

@app.get("/api/chats/{chat_id}/files")
async def get_chat_files(chat_id: int, request: Request, type: str = None,
                         client: Client = Depends(get_user_client)):
    files = []
    offset = 0
    limit = int(request.query_params.get("limit", "2000"))
    try:
        offset_id = 0
        while True:
            batch = await client.get_chat_history(chat_id, limit=200, offset_id=offset_id)
            if not batch:
                break
            last_id = None
            for msg in batch:
                last_id = msg.id
                media = (getattr(msg,"document",None) or getattr(msg,"video",None) or getattr(msg,"audio",None))
                if not media:
                    if msg.photo and (not type or type == "image"):
                        files.append({"id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
                                      "channel_id": chat_id, "name": f"photo_{msg.id}.jpg",
                                      "type": "image", "mime": "image/jpeg", "size": 0,
                                      "date": msg.date.timestamp() if msg.date else 0,
                                      "caption": msg.caption or "",
                                      "has_thumb": True})
                    continue
                mime  = getattr(media,"mime_type","") or ""
                fname = getattr(media,"file_name","") or f"file_{msg.id}"
                ftype = media_type(mime, fname)
                if ftype == "other" or (type and ftype != type): continue
                duration = getattr(media,"duration",None)
                thumbs = getattr(media,"thumbs",None)
                files.append({"id": f"{chat_id}_{msg.id}", "msg_id": msg.id,
                              "channel_id": chat_id, "name": fname, "type": ftype, "mime": mime,
                              "size": getattr(media,"file_size",0),
                              "date": msg.date.timestamp() if msg.date else 0,
                              "caption": msg.caption or "",
                              "duration": duration,
                              "has_thumb": bool(thumbs)})
            if not batch or len(batch) < 200:
                break
            offset_id = last_id
    except Exception as e: raise HTTPException(500, str(e))
    return {"files": files}

# ─── Streaming ────────────────────────────────────────────────────────────────
@app.get("/api/stream/{source}/{chat_id}/{msg_id}")
async def stream_file(source: str, chat_id: int, msg_id: int,
                      request: Request, user: dict = Depends(require_auth)):
    # Pick client: prefer user's own session (peer already resolved),
    # fall back to discover session
    sid = user.get("session_id")
    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    elif source == "discover":
        client = get_discover_client()
        if not client:
            raise HTTPException(503, "Please login first to stream content")
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
    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    elif source == "discover":
        client = get_discover_client()
        if not client:
            raise HTTPException(503, "No session")
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

@app.get("/api/chat-photo/{source}/{chat_id}")
async def get_chat_photo(source: str, chat_id: int,
                          request: Request, user: dict = Depends(require_auth)):
    """Stream chat/channel profile photo"""
    from fastapi.responses import Response as FastResp
    sid = user.get("session_id")
    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    elif source == "discover":
        client = get_discover_client()
        if not client:
            raise HTTPException(503, "No session")
    else:
        raise HTTPException(401, "Not authenticated")
    try:
        chat = await client.get_chat(chat_id)
        if not chat.photo:
            raise HTTPException(404, "No photo")
        data = await client.download_media(chat.photo.small_file_id, in_memory=True)
        if not data:
            raise HTTPException(404, "No photo data")
        return FastResp(content=bytes(data), media_type="image/jpeg",
            headers={"Cache-Control":"public,max-age=3600","Access-Control-Allow-Origin":"*"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@app.head("/api/stream/{source}/{chat_id}/{msg_id}")
async def stream_file_head(source: str, chat_id: int, msg_id: int,
                            request: Request, user: dict = Depends(require_auth)):
    """HEAD request — returns file metadata without body (needed by video players for seeking)"""
    from fastapi.responses import Response as FastResponse
    sid = user.get("session_id")
    if sid and sid in user_sessions and user_sessions[sid].is_connected:
        client = user_sessions[sid]
    elif source == "discover":
        client = get_discover_client()
        if not client:
            raise HTTPException(503, "No session")
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

@app.get("/health")
async def health():
    return {"status": "ok", "discover_channels": len(discover_cache),
            "discover_ready": _discover_done, "active_sessions": len(user_sessions),
            "has_discover_session": get_discover_client() is not None,
            "bot_channels": config.BOT_CHANNELS}
