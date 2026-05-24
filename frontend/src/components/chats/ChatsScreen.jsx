import React, { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const PALETTE = [
  '#9C27B0','#00BCD4','#3F51B5','#E91E63',
  '#4CAF50','#FF5722','#2196F3','#FF9800',
  '#009688','#F44336','#673AB7','#607D8B',
];

function initials(name) {
  const w = (name || '').trim().split(/\s+/);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return (name || '?').slice(0, 2).toUpperCase();
}

function ChatAvatar({ chat }) {
  const [failed, setFailed] = useState(false);
  const color = PALETTE[Math.abs(chat.id || 0) % PALETTE.length];
  const ini = initials(chat.name);

  const fallback = (
    <div style={{
      width: '100%', aspectRatio: '1/1',
      background: color,
      borderRadius: '14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '800', fontSize: '18px',
      flexShrink: 0,
    }}>
      {ini}
    </div>
  );

  if (failed) return fallback;

  return (
    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
      <img
        src={api.chatPhotoUrl('user', chat.id)}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ChatCard({ chat, onClick }) {
  const type = chat.type === 'channel' ? 'Channel'
    : (chat.type === 'group' || chat.type === 'supergroup') ? 'Group'
    : 'Chat';

  return (
    <button onClick={onClick} style={{
      background: 'white',
      borderRadius: '16px',
      border: 'none',
      cursor: 'pointer',
      padding: '12px 8px 10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '7px',
      boxShadow: '0 1px 5px rgba(0,0,0,0.08)',
      position: 'relative',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <ChatAvatar chat={chat} />
      <span style={{
        fontSize: '11px', fontWeight: '600', color: '#1c1c1e',
        textAlign: 'center', width: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: '1.3',
      }}>
        {chat.name}
      </span>
      <span style={{
        fontSize: '9px', fontWeight: '600', color: '#8e8e93',
        background: '#f2f2f7', borderRadius: '5px', padding: '1px 6px',
        lineHeight: '1.6',
      }}>
        {type}
      </span>
      {chat.unread > 0 && (
        <span style={{
          position: 'absolute', top: '8px', right: '8px',
          background: '#3478f6', color: 'white',
          fontSize: '9px', fontWeight: '800',
          borderRadius: '8px', padding: '1px 5px',
          minWidth: '16px', textAlign: 'center', lineHeight: '14px',
        }}>
          {chat.unread > 99 ? '99+' : chat.unread}
        </span>
      )}
    </button>
  );
}

// Pure CSS grid — no flex, no overflow issues
function ChatGrid({ chats, onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px',
      width: '100%',
    }}>
      {chats.map(c => (
        <ChatCard key={c.id} chat={c} onClick={() => onSelect(c)} />
      ))}
    </div>
  );
}

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'channel', label: 'Channels' },
  { key: 'group',   label: 'Groups' },
  { key: 'private', label: 'Private' },
];

const CACHE_KEY = 'airbooks_chats_v1';

export default function ChatsScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeChat, setActiveChat] = useState(null);

  // Load from cache first, then refresh
  useEffect(() => {
    if (!state.isLoggedIn) return;
    // Instant load from cache
    if (state.userChats.length === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached?.chats?.length) {
          actions.setChats(cached.chats);
        }
      } catch {}
    }
    // Background refresh
    refresh(state.userChats.length === 0);
  }, [state.isLoggedIn]);

  async function refresh(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.getChats();
      const chats = res.chats || [];
      actions.setChats(chats);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ chats, ts: Date.now() }));
    } catch {}
    setLoading(false);
  }

  if (activeChat) {
    return <ChannelPage channel={activeChat} source="user" onBack={() => setActiveChat(null)} />;
  }

  const visible = state.userChats.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all'
      || (filter === 'group' ? c.type === 'group' || c.type === 'supergroup' : c.type === filter);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>

      {/* Fixed header */}
      <div style={{ flexShrink: 0, background: '#f2f2f7', padding: '50px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '26px', fontWeight: '800', color: '#1c1c1e' }}>Chats</span>
          {state.isLoggedIn && (
            <button onClick={() => refresh(true)} style={{
              width: '36px', height: '36px', borderRadius: '10px', background: 'white',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}>
              <RefreshCw size={15} color="#3478f6" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>

        {state.isLoggedIn && (
          <>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} color="#8e8e93" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
                style={{
                  width: '100%', background: 'white', border: 'none', borderRadius: '12px',
                  padding: '10px 12px 10px 36px', fontSize: '14px', color: '#1c1c1e',
                  outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', boxSizing: 'border-box',
                }} />
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  flexShrink: 0, padding: '5px 14px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                  fontWeight: '600', fontSize: '12px',
                  background: filter === f.key ? '#3478f6' : 'white',
                  color: filter === f.key ? 'white' : '#636366',
                  boxShadow: filter === f.key ? '0 2px 6px rgba(52,120,246,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                }}>{f.label}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Scrollable grid */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px 100px' }}>
        {!state.isLoggedIn ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#8e8e93' }}>
            <p style={{ fontSize: '17px', fontWeight: '600', color: '#1c1c1e', marginBottom: '8px' }}>Sign in with Telegram</p>
            <p style={{ fontSize: '14px', lineHeight: '1.5' }}>Browse your channels, groups and chats</p>
          </div>
        ) : loading && visible.length === 0 ? (
          // Skeleton — always 3 columns
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '12px 8px 10px', boxShadow: '0 1px 5px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: '14px', background: '#e5e5ea', marginBottom: '8px' }} />
                <div style={{ height: '10px', background: '#e5e5ea', borderRadius: '5px', marginBottom: '6px' }} />
                <div style={{ height: '14px', background: '#e5e5ea', borderRadius: '7px', width: '50%', margin: '0 auto' }} />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8e8e93', padding: '40px', fontWeight: '500' }}>No chats found</p>
        ) : (
          <ChatGrid chats={visible} onSelect={setActiveChat} />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
