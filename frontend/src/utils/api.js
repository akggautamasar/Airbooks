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

export const api = {
  // Auth
  sendCode:        (phone) => req('/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyCode:      (data)  => req('/auth/verify-code', { method: 'POST', body: JSON.stringify(data) }),
  logout:          ()      => req('/auth/logout', { method: 'POST' }),
  getMe:           ()      => req('/auth/me'),

  // Discover
  getDiscoverChannels: ()            => req('/discover/channels'),
  getChannelFiles:     (id, type)    => req(`/discover/channels/${id}/files${type ? '?type=' + type : ''}`),

  // User chats
  getChats:        ()               => req('/chats'),
  getChatFiles:    (id, type)       => req(`/chats/${id}/files${type ? '?type=' + type : ''}`),

  // Stream URL builder
  streamUrl: (source, chatId, msgId) =>
    `${BASE}/stream/${source}/${chatId}/${msgId}?token=${encodeURIComponent(token())}`,
};
