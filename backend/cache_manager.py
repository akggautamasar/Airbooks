"""
Telegram-backed JSON cache manager.
Stores file lists as JSON documents in a private Telegram channel.
Survives Render restarts — loads from Telegram on startup.
"""

import json
import asyncio
import io
from datetime import datetime
from typing import Optional, Dict, Any
from pyrogram import Client

import config


def _filename(chat_id: int | str) -> str:
    """Consistent filename for each channel's cache."""
    return f"cache_{chat_id}.json"


async def load_all_caches(client: Client) -> Dict[str, dict]:
    """
    On startup: scan the cache channel for all JSON files.
    Returns dict of {str_chat_id: cache_data}
    """
    if not config.CACHE_CHANNEL_ID:
        return {}

    caches = {}
    try:
        async for msg in client.get_chat_history(config.CACHE_CHANNEL_ID):
            if not msg.document:
                continue
            fname = msg.document.file_name or ""
            if not fname.startswith("cache_") or not fname.endswith(".json"):
                continue
            try:
                # Download JSON document
                data = await client.download_media(msg.document.file_id, in_memory=True)
                if data:
                    parsed = json.loads(bytes(data).decode("utf-8"))
                    chat_id_str = fname.replace("cache_", "").replace(".json", "")
                    caches[chat_id_str] = parsed
                    print(f"[cache] Loaded {fname}: {len(parsed.get('files', []))} files")
            except Exception as e:
                print(f"[cache] Failed to load {fname}: {e}")
    except Exception as e:
        print(f"[cache] Failed to scan cache channel: {e}")

    return caches


async def save_cache(client: Client, chat_id: int | str, files: list, channel_name: str = "") -> bool:
    """
    Save a channel's file list as JSON to the cache channel.
    Deletes the old cache message first if it exists.
    """
    if not config.CACHE_CHANNEL_ID:
        return False

    chat_id_str = str(chat_id)
    fname = _filename(chat_id_str)

    # Build cache data
    cache_data = {
        "chat_id": chat_id_str,
        "channel_name": channel_name,
        "scanned_at": datetime.utcnow().isoformat(),
        "file_count": len(files),
        "files": files,
    }

    json_bytes = json.dumps(cache_data, ensure_ascii=False, separators=(',', ':')).encode("utf-8")

    try:
        # Delete old cache message for this channel if exists
        await delete_cache(client, chat_id_str)

        # Upload new JSON as document
        await client.send_document(
            chat_id=config.CACHE_CHANNEL_ID,
            document=io.BytesIO(json_bytes),
            file_name=fname,
            caption=f"📦 Cache: {channel_name or chat_id_str} | {len(files)} files | {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC",
            force_document=True,
        )
        print(f"[cache] Saved {fname}: {len(files)} files")
        return True
    except Exception as e:
        print(f"[cache] Failed to save {fname}: {e}")
        return False


async def delete_cache(client: Client, chat_id: int | str) -> bool:
    """Delete the existing cache message for a channel."""
    if not config.CACHE_CHANNEL_ID:
        return False

    chat_id_str = str(chat_id)
    fname = _filename(chat_id_str)

    try:
        async for msg in client.get_chat_history(config.CACHE_CHANNEL_ID, limit=500):
            if msg.document and (msg.document.file_name or "") == fname:
                await msg.delete()
                return True
    except Exception as e:
        print(f"[cache] Failed to delete {fname}: {e}")
    return False


async def get_cache_info(client: Client) -> list:
    """Get list of all cached channels with metadata."""
    if not config.CACHE_CHANNEL_ID:
        return []

    info = []
    try:
        async for msg in client.get_chat_history(config.CACHE_CHANNEL_ID, limit=500):
            if not msg.document:
                continue
            fname = msg.document.file_name or ""
            if fname.startswith("cache_") and fname.endswith(".json"):
                info.append({
                    "filename": fname,
                    "chat_id": fname.replace("cache_", "").replace(".json", ""),
                    "caption": msg.caption or "",
                    "date": msg.date.isoformat() if msg.date else None,
                    "size_kb": round((msg.document.file_size or 0) / 1024, 1),
                })
    except Exception as e:
        print(f"[cache] Failed to get info: {e}")
    return info
