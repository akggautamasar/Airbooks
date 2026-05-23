const BASE = import.meta.env.VITE_API_URL || '/api';

function token() {
  return localStorage.getItem('airbooks_token') || '';
}

function headers(extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...extra };
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// Persistent file list cache (sessionStorage - survives tab switches, cleared on close)
const FILE_CACHE = {
  key: (chatId, type) => `ab_files_${chatId}_${type}`,
  get(chatId, type) {
    try {
      const d = JSON.parse(sessionStorage.getItem(this.key(chatId, type)) || 'null');
      if (d && Date.now() - d.ts < 10 * 60 * 1000) return d.files; // 10 min cache
    } catch {}
    return null;
  },
  set(chatId, type, files) {
    try {
      sessionStorage.setItem(this.key(chatId, type), JSON.stringify({ files, ts: Date.now() }));
    } catch {}
  }
};

export const api = {
  // Auth
  sendCode:    (phone) => req('/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyCode:  (data)  => req('/auth/verify-code', { method: 'POST', body: JSON.stringify(data) }),
  logout:      ()      => req('/auth/logout', { method: 'POST' }),
  getMe:       ()      => req('/auth/me'),

  // Discover
  getDiscoverChannels:  () => req('/discover/channels'),
  triggerDiscoverRefresh: () => req('/discover/refresh', { method: 'POST' }),

  async getChannelFiles(id, type) {
    const cached = FILE_CACHE.get(`d_${id}`, type);
    if (cached) return { files: cached };
    const res = await req(`/discover/channels/${id}/files${type ? '?type=' + type : ''}`);
    if (res.files) FILE_CACHE.set(`d_${id}`, type, res.files);
    return res;
  },

  // User chats
  getChats: () => req('/chats'),

  async getChatFiles(id, type) {
    const cached = FILE_CACHE.get(id, type);
    if (cached) return { files: cached };
    const res = await req(`/chats/${id}/files${type ? '?type=' + type : ''}`);
    if (res.files) FILE_CACHE.set(id, type, res.files);
    return res;
  },

  // Stream URL builder - uses token in query param
  streamUrl: (source, chatId, msgId) =>
    `${BASE}/stream/${source}/${chatId}/${msgId}?token=${encodeURIComponent(token())}`,

  // Thumbnail URL for video/audio
  thumbUrl: (source, chatId, msgId) =>
    `${BASE}/thumb/${source}/${chatId}/${msgId}?token=${encodeURIComponent(token())}`,

  // Chat/channel profile photo
  chatPhotoUrl: (source, chatId) =>
    `${BASE}/chat-photo/${source}/${chatId}?token=${encodeURIComponent(token())}`,
};
