"""
Proper Telegram media streamer with HTTP Range Request support.
Ported from BeyondDrive - supports seeking, pausing, and resuming video.
"""

import math
import asyncio
from typing import Dict, Optional
from pyrogram import Client
from pyrogram.file_id import FileId


# ─── File ID extraction ────────────────────────────────────────────────────────

def get_media_from_message(message):
    for attr in ("document", "video", "audio", "photo", "voice", "animation", "video_note", "sticker"):
        media = getattr(message, attr, None)
        if media:
            return media
    return None

async def get_file_ids(client: Client, chat_id: int, message_id: int) -> Optional[FileId]:
    message = await client.get_messages(chat_id, message_id)
    if not message or message.empty:
        raise Exception("Message not found")
    media = get_media_from_message(message)
    if not media:
        raise Exception("No media in message")
    file_id_obj = FileId.decode(media.file_id)
    setattr(file_id_obj, "file_size", getattr(media, "file_size", 0))
    setattr(file_id_obj, "mime_type", getattr(media, "mime_type", "application/octet-stream"))
    setattr(file_id_obj, "file_name", getattr(media, "file_name", None) or "file")
    setattr(file_id_obj, "file_id", media.file_id)
    return file_id_obj


# ─── ByteStreamer ──────────────────────────────────────────────────────────────

class ByteStreamer:
    """Streams Telegram files with proper chunk-aligned range request support."""

    def __init__(self, client: Client):
        self.client = client
        self.cached_file_ids: Dict[str, FileId] = {}
        asyncio.create_task(self._clean_cache())

    def _cache_key(self, chat_id: int, message_id: int) -> str:
        return f"{chat_id}:{message_id}"

    async def get_file_properties(self, chat_id: int, message_id: int) -> FileId:
        key = self._cache_key(chat_id, message_id)
        if key not in self.cached_file_ids:
            file_id = await get_file_ids(self.client, chat_id, message_id)
            self.cached_file_ids[key] = file_id
        return self.cached_file_ids[key]

    async def yield_file(
        self,
        file_id: FileId,
        offset: int,           # chunk-aligned byte offset
        first_part_cut: int,   # bytes to skip from first chunk
        last_part_cut: int,    # bytes to keep from last chunk
        part_count: int,       # total chunks to fetch
        chunk_size: int,       # chunk size in bytes (1MB)
    ):
        """Async generator yielding file bytes for a range request."""
        chunk_offset = offset // chunk_size
        current_part = 1
        try:
            async for chunk in self.client.stream_media(
                file_id.file_id,
                offset=chunk_offset,
                limit=part_count,
            ):
                if not chunk:
                    break
                if part_count == 1:
                    yield chunk[first_part_cut:last_part_cut]
                elif current_part == 1:
                    yield chunk[first_part_cut:]
                elif current_part == part_count:
                    yield chunk[:last_part_cut]
                else:
                    yield chunk
                current_part += 1
                if current_part > part_count:
                    break
        except (TimeoutError, AttributeError):
            pass
        except Exception as e:
            print(f"[streamer] Stream error: {e}")
            raise

    async def _clean_cache(self):
        while True:
            await asyncio.sleep(30 * 60)
            self.cached_file_ids.clear()


# ─── Per-client streamer cache ─────────────────────────────────────────────────

_streamer_cache: Dict[int, ByteStreamer] = {}

def get_streamer(client: Client) -> ByteStreamer:
    cid = id(client)
    if cid not in _streamer_cache:
        _streamer_cache[cid] = ByteStreamer(client)
    return _streamer_cache[cid]


# ─── Range header parser ───────────────────────────────────────────────────────

def parse_range_header(range_header: str, file_size: int):
    """Parse Range header, return (start, end) bytes."""
    if not range_header or not range_header.startswith("bytes="):
        return 0, file_size - 1
    spec = range_header[6:]
    try:
        if spec.startswith("-"):
            start = max(0, file_size - int(spec[1:]))
            end = file_size - 1
        elif spec.endswith("-"):
            start = int(spec[:-1])
            end = file_size - 1
        elif "-" in spec:
            parts = spec.split("-", 1)
            start = int(parts[0])
            end = int(parts[1]) if parts[1] else file_size - 1
        else:
            return 0, file_size - 1
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        return start, end
    except (ValueError, IndexError):
        return 0, file_size - 1


# ─── Main streaming function ───────────────────────────────────────────────────

async def stream_media_file(client: Client, chat_id: int, message_id: int,
                             range_header: str, request):
    """
    Full range-request-aware streamer. Returns (generator, headers, status_code).
    Properly handles seeking by using chunk-aligned offsets with stream_media.
    """
    from fastapi.responses import StreamingResponse, Response

    streamer = get_streamer(client)

    try:
        file_id = await streamer.get_file_properties(chat_id, message_id)
    except Exception as e:
        return Response(status_code=404, content=f"File not found: {e}")

    file_size = file_id.file_size or 0
    mime_type = file_id.mime_type or "application/octet-stream"
    file_name = file_id.file_name or "file"

    if file_size == 0:
        # File size unknown — fall back to simple streaming (images/small files)
        async def simple_gen():
            try:
                async for chunk in client.stream_media(file_id.file_id):
                    if await request.is_disconnected():
                        break
                    yield chunk
            except Exception as e:
                print(f"[simple_gen] error: {e}")

        return StreamingResponse(
            simple_gen(),
            status_code=200,
            headers={"Content-Type": mime_type, "Accept-Ranges": "bytes"},
            media_type=mime_type,
        )

    # Parse range
    from_bytes, until_bytes = parse_range_header(range_header, file_size)

    if from_bytes >= file_size:
        return Response(
            status_code=416,
            headers={"Content-Range": f"bytes */{file_size}", "Accept-Ranges": "bytes"},
        )

    until_bytes = min(until_bytes, file_size - 1)

    # Chunk-aligned math (1MB chunks)
    chunk_size = 1024 * 1024
    offset = from_bytes - (from_bytes % chunk_size)
    first_part_cut = from_bytes - offset
    last_part_cut = (until_bytes % chunk_size) + 1
    req_length = until_bytes - from_bytes + 1
    part_count = math.ceil((until_bytes + 1) / chunk_size) - math.floor(offset / chunk_size)

    is_range = bool(range_header)
    status_code = 206 if is_range else 200

    headers = {
        "Content-Type": mime_type,
        "Content-Length": str(req_length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    }
    if is_range:
        headers["Content-Range"] = f"bytes {from_bytes}-{until_bytes}/{file_size}"

    body = streamer.yield_file(
        file_id, offset, first_part_cut, last_part_cut, part_count, chunk_size
    )

    return StreamingResponse(
        content=body,
        status_code=status_code,
        headers=headers,
        media_type=mime_type,
    )
